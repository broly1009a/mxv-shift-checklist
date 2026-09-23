/**
 * ============================================================
 *  RE-SCRAPE M-SYSTEM: Sửa 195 hồ sơ thiếu CCCD (Timing Bug)
 * ============================================================
 *
 * Nguyên nhân: Playwright đọc input React-controlled quá sớm (1000ms)
 * → soCMND_HoChieu bị lưu rỗng vào DB dù MS có dữ liệu.
 *
 * Script này:
 *  1. Truy vấn tất cả hồ sơ LECH có lý do "M-System chưa nhập số CCCD"
 *  2. Lần lượt mở từng hồ sơ trên M-System, cào lại đầy đủ
 *  3. Cập nhật ms.soCMND_HoChieu + toàn bộ khối ms vào MongoDB
 *  4. Re-evaluate reconciliation để cập nhật trạng thái (KHOP/LECH)
 *
 * Cách chạy:
 *   ts-node src/scripts/rescrape_ms_missing_cccd.ts [--headed] [--limit 20] [--dry-run]
 *
 * Tham số:
 *   --headed    : Mở trình duyệt có giao diện để quan sát
 *   --limit N   : Chỉ xử lý N hồ sơ đầu tiên (mặc định: tất cả)
 *   --dry-run   : Cào dữ liệu nhưng KHÔNG ghi vào DB (chỉ log kết quả)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import mongoose from 'mongoose';
import { chromium } from 'playwright-core';
import { CleanAccountRecordSchema } from '../schemas/clean-account-record.schema';
import { SystemSettingSchema } from '../schemas/system-setting.schema';
import { scrapeInvestorDetailFromMSystem } from '../modules/bot-engine/helpers/msystem-scraper.helper';
import { decrypt } from '../modules/bot-engine/utils/crypto';
import { evaluateRecordReconciliationRule } from '../modules/bot-engine/helpers/tkgd-reconcile-rules.helper';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

const BASE_MS_URL = 'https://msadmin.mxv.com.vn';

// ── Tìm Chrome/Edge trên máy ──────────────────────────────────────────────────
function findBrowserExecutable(): string {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

// ── Login M-System + nhập PIN nếu có ──────────────────────────────────────────
async function loginToMSystem(page: any, credentials: any) {
  console.log(`\n🔑 Đang đăng nhập M-System: ${credentials.username}...`);
  await page.goto(credentials.url || `${BASE_MS_URL}/#/login`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  await page.fill('input[type="text"], input[name="username"]', credentials.username);
  await page.fill('input[type="password"], input[name="password"]', credentials.password);
  await page.click('button[type="submit"], button.btn-primary');
  await page.waitForTimeout(2500);

  // Bàn phím ảo PIN
  const pinModal = page.locator('div.pincode');
  if (await pinModal.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('🔢 Nhập mã PIN tự động...');
    const pinStr = String(credentials.pin || '');
    for (const digit of pinStr) {
      const btn = page
        .locator('.pincode .keyboard .button')
        .filter({ hasText: new RegExp(`^\\s*${digit}\\s*$`) })
        .first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(300);
      } else {
        const fallback = page.locator(`div.pincode >> xpath=.//div[text()='${digit}']`).first();
        if (await fallback.isVisible({ timeout: 1000 }).catch(() => false)) {
          await fallback.click();
          await page.waitForTimeout(300);
        }
      }
    }
    await page.waitForTimeout(3000);
  }
  console.log('✅ Đăng nhập M-System thành công!\n');
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isHeaded = args.includes('--headed') || args.includes('--ui');
  const isDryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 0;

  console.log('═'.repeat(70));
  console.log('  RE-SCRAPE M-SYSTEM: SỬA HỒ SƠ THIẾU SỐ CCCD');
  console.log('═'.repeat(70));
  console.log(`  Chế độ     : ${isDryRun ? '⚠️  DRY-RUN (không ghi DB)' : '💾 LIVE (ghi thật vào DB)'}`);
  console.log(`  Trình duyệt: ${isHeaded ? '🪟  Có giao diện' : '🤖 Ẩn (headless)'}`);
  console.log(`  Giới hạn   : ${limit > 0 ? limit + ' hồ sơ' : 'Tất cả'}`);
  console.log('─'.repeat(70));

  // Kết nối MongoDB
  console.log('\n[DB] Đang kết nối MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('[DB] ✅ Kết nối thành công!\n');

  const CleanRecordModel = mongoose.model('CleanAccountRecord', CleanAccountRecordSchema);
  const SettingModel = mongoose.model('SystemSetting', SystemSettingSchema);

  // Truy vấn hồ sơ cần re-scrape
  const query: any = {
    $or: [
      { 'ketLuan.trangThai': 'LECH' },
      { 'reconciliationResult.status': 'LECH' },
      { trangThaiDoiSoat: 'LECH' },
    ],
    $and: [
      {
        $or: [
          { 'ketLuan.danhSachLoi': { $regex: 'chưa nhập số CCCD', $options: 'i' } },
          { 'reconciliationResult.criticalErrors': { $regex: 'chưa nhập số CCCD', $options: 'i' } },
        ],
      },
      {
        $or: [
          { 'ms.soCMND_HoChieu': { $exists: false } },
          { 'ms.soCMND_HoChieu': '' },
          { 'ms.soCMND_HoChieu': null },
        ],
      },
    ],
  };

  const totalCount = await CleanRecordModel.countDocuments(query);
  console.log(`📋 Tổng số hồ sơ cần re-scrape: ${totalCount}`);

  if (totalCount === 0) {
    console.log('✅ Không còn hồ sơ nào cần re-scrape. Hoàn thành!');
    await mongoose.disconnect();
    return;
  }

  const finalLimit = limit > 0 ? limit : totalCount;
  console.log(`▶  Sẽ xử lý: ${Math.min(finalLimit, totalCount)} hồ sơ\n`);

  // Lấy credentials MS từ DB
  const setting = await SettingModel.findOne({ key: 'bot_credentials_msystem' }).lean();
  let credentials: any = null;
  if (setting && (setting as any).value) {
    try {
      credentials = JSON.parse(decrypt((setting as any).value));
    } catch {
      console.error('❌ Không thể giải mã thông tin đăng nhập MS!');
    }
  }

  if (!credentials?.username) {
    console.error('❌ Không tìm thấy bot_credentials_msystem trong DB. Dừng lại.');
    await mongoose.disconnect();
    return;
  }

  // Khởi động Playwright
  const executablePath = findBrowserExecutable();
  console.log(`🌐 Sử dụng trình duyệt: ${executablePath}`);

  const browser = await chromium.launch({
    executablePath,
    headless: !isHeaded,
    slowMo: isHeaded ? 300 : 0,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1400,900',
    ],
  });

  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.setDefaultTimeout(30000);

  try {
    await loginToMSystem(page, credentials);
  } catch (err: any) {
    console.error(`❌ Đăng nhập thất bại: ${err.message}`);
    await browser.close();
    await mongoose.disconnect();
    return;
  }

  // ── Xử lý tuần tự từng hồ sơ ──────────────────────────────────────────────
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  const failedCodes: string[] = [];

  const cursor = CleanRecordModel.find(query).limit(finalLimit).cursor();

  let idx = 0;
  for await (const record of cursor) {
    idx++;
    const code = (record as any).maTKGD || (record as any).ms?.maTKGD || (record as any).noiDungMail?.maTKGD_Futures;

    if (!code) {
      console.log(`[${idx}] ⚠️  Không xác định được mã TKGD, bỏ qua.`);
      skipCount++;
      continue;
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${idx}/${Math.min(finalLimit, totalCount)}] 🔎 Đang re-scrape: ${code}`);
    console.log(`  ms.hoVaTen cũ   : "${(record as any).ms?.hoVaTen || '(trống)'}"`);
    console.log(`  ms.soCMND cũ    : "${(record as any).ms?.soCMND_HoChieu || '(trống)'}"`);

    try {
      const scraped = await scrapeInvestorDetailFromMSystem(page, code, BASE_MS_URL);

      console.log(`  ✅ Cào xong:`);
      console.log(`     hoVaTen       : "${scraped.hoVaTen || '---'}"`);
      console.log(`     soCMND_HoChieu: "${scraped.soCMND_HoChieu || '---'}" ← Quan trọng nhất`);
      console.log(`     ngayCap       : "${scraped.rawNgayCap || '---'}"`);
      console.log(`     isFoundOnMS   : ${scraped.isFoundOnMS}`);

      if (!scraped.isFoundOnMS || !scraped.soCMND_HoChieu) {
        console.log(`  ⚠️  Vẫn không đọc được CCCD sau khi re-scrape → Ghi chú để điều tra thủ công.`);
        failedCodes.push(`${code} (isFound=${scraped.isFoundOnMS}, cccd="${scraped.soCMND_HoChieu}")`);
        failCount++;
        continue;
      }

      if (isDryRun) {
        console.log(`  [DRY-RUN] Sẽ cập nhật ms.soCMND_HoChieu = "${scraped.soCMND_HoChieu}" (chưa ghi DB)`);
        successCount++;
        continue;
      }

      // Snapshot bản ghi cũ
      const oldMs = (record as any).toObject?.()?.ms || (record as any).ms;
      const snapshots = (record as any).snapshots || [];
      snapshots.push({
        snapshotAt: new Date(),
        action: 'RESCRAPE_MS_CCCD_FIX',
        previousData: { ms: oldMs },
      });

      // Cập nhật khối ms
      const newMs = {
        ...(oldMs || {}),
        maTKGD: scraped.maTKGD || code,
        tenTKGD: scraped.tenTKGD || oldMs?.tenTKGD,
        hoVaTen: scraped.hoVaTen || oldMs?.hoVaTen,
        soCMND_HoChieu: scraped.soCMND_HoChieu,          // ← FIX CHÍNH
        ngaySinh: scraped.ngaySinh || oldMs?.ngaySinh,
        rawNgaySinh: scraped.rawNgaySinh || oldMs?.rawNgaySinh,
        ngayCap: scraped.ngayCap || oldMs?.ngayCap,
        rawNgayCap: scraped.rawNgayCap || oldMs?.rawNgayCap,
        noiCap: scraped.noiCap || oldMs?.noiCap,
        gioiTinh: scraped.gioiTinh || oldMs?.gioiTinh,
        ngayThamGia: scraped.ngayThamGia || oldMs?.ngayThamGia,
        loaiHinhTaiKhoan: scraped.loaiHinhTaiKhoan || oldMs?.loaiHinhTaiKhoan || 'Cá nhân',
        diaChi: scraped.diaChi || oldMs?.diaChi,
        trangThai: scraped.trangThai || oldMs?.trangThai || 'Hoạt động',
        chuKy: scraped.chuKy || oldMs?.chuKy,
        isFoundOnMS: scraped.isFoundOnMS,
        ketQua: scraped.isFoundOnMS ? 'Đã tìm thấy trên MS' : 'Chưa có trên MS',
        // Giữ nguyên các URL ảnh cũ nếu scrape mới không có
        cccdMatTruocUrl: scraped.cccdMatTruocUrl || oldMs?.cccdMatTruocUrl,
        cccdMatSauUrl: scraped.cccdMatSauUrl || oldMs?.cccdMatSauUrl,
        chuKyUrl: scraped.chuKyUrl || oldMs?.chuKyUrl,
        cccdMatTruocLocalPath: scraped.cccdMatTruocLocalPath || oldMs?.cccdMatTruocLocalPath,
        cccdMatSauLocalPath: scraped.cccdMatSauLocalPath || oldMs?.cccdMatSauLocalPath,
        chuKyLocalPath: scraped.chuKyLocalPath || oldMs?.chuKyLocalPath,
        rescrapeAt: new Date(), // audit trail
      };

      // Re-evaluate reconciliation với ms mới
      const recordObj = (record as any).toObject ? (record as any).toObject() : record;
      const updatedRecord = { ...recordObj, ms: newMs };
      const newResult = evaluateRecordReconciliationRule(updatedRecord);

      console.log(`  📊 Kết quả đối chiếu mới: ${newResult.finalStatus}`);
      if (newResult.criticalErrors.length > 0) {
        console.log(`     Critical errors: ${newResult.criticalErrors.join(', ')}`);
      }
      if (newResult.softWarnings.length > 0) {
        console.log(`     Soft warnings  : ${newResult.softWarnings.join(', ')}`);
      }
      if (newResult.autoHealedNotes.length > 0) {
        console.log(`     Auto-healed    : ${newResult.autoHealedNotes.join(', ')}`);
      }

      // Lưu vào DB
      await CleanRecordModel.updateOne(
        { _id: (record as any)._id },
        {
          $set: {
            ms: newMs,
            ketLuan: {
              trangThai: newResult.finalStatus,
              danhSachLoi: newResult.finalErrors,
              reconciledAt: new Date(),
            },
            trangThaiDoiSoat: newResult.finalStatus,
            lyDoLoi: newResult.finalErrors.join('; '),
            daDoiSoat: true,
            reconciliationResult: {
              status: newResult.finalStatus,
              criticalErrors: newResult.criticalErrors,
              softWarnings: newResult.softWarnings,
              autoHealedNotes: newResult.autoHealedNotes,
              finalErrors: newResult.finalErrors,
              evaluatedAt: new Date(),
            },
            snapshots,
            updatedAt: new Date(),
          },
        },
      );

      console.log(`  💾 Đã lưu! Status: LECH → ${newResult.finalStatus}`);
      successCount++;

    } catch (err: any) {
      console.error(`  ❌ Lỗi khi re-scrape ${code}: ${err.message}`);
      failedCodes.push(`${code} (error: ${err.message?.slice(0, 80)})`);
      failCount++;
    }

    // Nhỏ dừng giữa các hồ sơ để tránh quá tải trình duyệt
    await page.waitForTimeout(isHeaded ? 2000 : 800);
  }

  await browser.close();
  await mongoose.disconnect();

  // ── Báo cáo tổng kết ──────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('  KẾT QUẢ RE-SCRAPE');
  console.log('═'.repeat(70));
  console.log(`  ✅ Thành công  : ${successCount} hồ sơ`);
  console.log(`  ❌ Thất bại    : ${failCount} hồ sơ`);
  console.log(`  ⏭  Bỏ qua     : ${skipCount} hồ sơ`);
  console.log(`  📦 Tổng đã xử lý: ${idx} / ${Math.min(finalLimit, totalCount)}`);

  if (failedCodes.length > 0) {
    console.log('\n⚠️  Danh sách hồ sơ vẫn còn lỗi (cần kiểm tra thủ công):');
    failedCodes.forEach((c, i) => console.log(`   ${i + 1}. ${c}`));
  }

  if (!isDryRun && successCount > 0) {
    console.log(`\n💡 Gợi ý: Chạy lại script re_evaluate_sequential.js để đồng bộ các hồ sơ còn lại.`);
  }

  console.log('\n✅ Hoàn thành!');
}

main().catch((err) => {
  console.error('💥 Lỗi nghiêm trọng:', err);
  process.exit(1);
});
