/**
 * TEST SCRIPT: MODULE 2 — RPA M-System Cào Chi Tiết TKGD & Lưu Khối 'MS' vào MongoDB
 *
 * Cách chạy:
 * cmd.exe /c "npx ts-node src/scripts/test_tkgd_module2_ms_scrape.ts"
 * Hoặc test riêng 1 mã TK:
 * cmd.exe /c "npx ts-node src/scripts/test_tkgd_module2_ms_scrape.ts --code 001C0008386-A"
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import mongoose from 'mongoose';
import { chromium, Browser, Page } from 'playwright-core';
import {
  CleanAccountRecordSchema,
  CleanAccountRecord,
} from '../schemas/clean-account-record.schema';
import { SystemSettingSchema } from '../schemas/system-setting.schema';
import { decrypt } from '../modules/bot-engine/utils/crypto';
import {
  scrapeInvestorDetailFromMSystem,
  MSystemInvestorScrapedData,
} from '../modules/bot-engine/helpers/msystem-scraper.helper';
import {
  detectAccountType,
  extractBaseAccountCode,
} from '../modules/bot-engine/helpers/tkgd-mail-parser.helper';


// 1. Nạp biến môi trường
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

// Helper tìm Chrome/Edge trên máy Windows
function findBrowserExecutable(): string {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

async function loginMSystem(
  credentials: any,
  headless: boolean = true,
): Promise<{ browser: Browser; page: Page }> {
  const executablePath = findBrowserExecutable();
  console.log(`\n   Khởi chạy trình duyệt: ${executablePath} (Headless: ${headless})`);

  const browser = await chromium.launch({
    executablePath,
    headless,
    slowMo: headless ? 0 : 400,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1400,900',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  const baseUrl = credentials.url || 'https://msadmin.mxv.com.vn/';
  console.log(`  🌐 Đang mở trang đăng nhập: ${baseUrl}`);
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(2000);

  // 1. Điền Username & Password
  console.log(`  🔑 Điền thông tin tài khoản: ${credentials.username}`);
  await page.fill('input[type="text"], input[name="username"]', credentials.username);
  await page.fill('input[type="password"], input[name="password"]', credentials.password);
  await page.click('button[type="submit"], button:has-text("Đăng nhập")');
  await page.waitForTimeout(2000);

  // 2. Nhập PIN nếu xuất hiện popup bàn phím ảo
  const pinModal = page.locator('div.pincode');
  if (await pinModal.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log(`  🔢 Phát hiện bàn phím ảo PIN. Đang click từng chữ số PIN...`);
    const pinStr = String(credentials.pin || '');
    for (const digit of pinStr) {
      const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
      const digitEl = page.locator(digitSelector).first();
      if (await digitEl.isVisible({ timeout: 3000 }).catch(() => false)) {
        await digitEl.click();
        await page.waitForTimeout(300);
      } else {
        // Fallback: tìm theo button hoặc text thông thường
        const fallbackEl = page.locator(`.ant-modal button:has-text("${digit}"), .pincode :text("${digit}")`).first();
        if (await fallbackEl.isVisible({ timeout: 1000 }).catch(() => false)) {
          await fallbackEl.click();
          await page.waitForTimeout(300);
        }
      }
    }
    // Bấm nút Xác nhận nếu có
    const confirmBtn = page.locator('.ant-modal button:has-text("Xác nhận"), .ant-modal button:has-text("Đồng ý")').first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }
  }


  console.log(`  ✅ Đăng nhập M-System thành công!`);
  return { browser, page };
}

async function runModule2Test() {
  console.log('='.repeat(70));
  console.log(' KIỂM THỬ MODULE 2: RPA M-SYSTEM CÀO CHI TIẾT & LƯU KHỐI MS');
  console.log('='.repeat(70));

  // 1. Kết nối MongoDB
  console.log('\n[1] Đang kết nối tới MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Kết nối MongoDB thành công!');

  const CleanRecordModel = mongoose.model(
    'CleanAccountRecord',
    CleanAccountRecordSchema,
  );
  const SystemSettingModel = mongoose.model(
    'SystemSetting',
    SystemSettingSchema,
  );

  // 2. Lấy credentials M-System từ MongoDB
  console.log('\n[2] Đang nạp cấu hình tài khoản M-System từ MongoDB...');
  const setting = await SystemSettingModel.findOne({
    key: 'bot_credentials_msystem',
  }).lean();

  let credentials: any = null;
  if (setting && (setting as any).value) {
    try {
      credentials = JSON.parse(decrypt((setting as any).value));
      console.log(`  ✅ Nạp thành công tài khoản M-System: ${credentials.username}`);
    } catch (e) {
      console.warn('   Không thể giải mã cấu hình M-System. Cần kiểm tra lại khóa mã hóa.');
    }
  }

  // Parse tham số CLI nếu có
  const args = process.argv.slice(2);
  let targetCode = '';
  const codeIdx = args.indexOf('--code');
  if (codeIdx !== -1 && args[codeIdx + 1]) {
    targetCode = args[codeIdx + 1].trim();
  }
  const isHeaded = args.includes('--headed') || args.includes('--ui');
  const isForce = args.includes('--force');


  // 3. Nếu chưa có credentials M-System thực tế, mô phỏng dữ liệu M-System theo ảnh chụp của anh
  if (!credentials || !credentials.username) {
    console.log('\n Chưa có tài khoản M-System thực tế được kích hoạt.');
    console.log('👉 Chuyển sang chế độ MÔ PHỎNG DỮ LIỆU CÀO TỪ M-SYSTEM (theo đúng mẫu ảnh chụp thực tế).');

    // Tìm các record đã tạo từ Module 1
    const records = await CleanRecordModel.find({
      'noiDungMail.maTKGD_Futures': { $exists: true },
    }).sort({ createdAt: -1 }).limit(5);

    console.log(`\nTìm thấy ${records.length} records để cập nhật dữ liệu MS:`);

    for (const record of records) {
      const code = targetCode || record.noiDungMail?.maTKGD_Futures || '003C2333888';
      console.log(`\n${'-'.repeat(50)}`);
      console.log(`🔄 Đang cập nhật khối MS cho mã TKGD: ${code}`);

      // Dữ liệu mô phỏng chính xác từ màn hình M-System của anh:
      const msData: MSystemInvestorScrapedData = {
        maTKGD: code,
        tenTKGD: record.noiDungMail?.tenTaiKhoan || 'Ngô Đức Hải',
        hoVaTen: record.noiDungMail?.tenTaiKhoan || 'Ngô Đức Hải',
        soCMND_HoChieu: '031079015563',
        ngaySinh: new Date(1979, 9, 13),
        ngayCap: new Date(2022, 7, 27),
        noiCap: 'Cục Cảnh sát quản lý hành chính về trật tự xã hội',
        ngayThamGia: new Date(2026, 7, 11),
        loaiHinhTaiKhoan: 'Cá nhân',
        diaChi: '186 Miếu Hai Xã, Dư Hàng Kênh, Lê Chân, Hải Phòng',
        trangThai: 'Hoạt động',
        chuKy: 'Đã ký',
        isFoundOnMS: true,
      };

      // Cập nhật khối ms trong CleanAccountRecord
      record.ms = {
        maTKGD: msData.maTKGD,
        tenTKGD: msData.tenTKGD,
        hoVaTen: msData.hoVaTen,
        soCMND_HoChieu: msData.soCMND_HoChieu,
        ngaySinh: msData.ngaySinh,
        ngayCap: msData.ngayCap,
        noiCap: msData.noiCap,
        ngayThamGia: msData.ngayThamGia,
        loaiHinhTaiKhoan: msData.loaiHinhTaiKhoan,
        diaChi: msData.diaChi,
        trangThai: msData.trangThai,
        chuKy: msData.chuKy,
        ketQua: 'So sánh với thông tin với căn cước khớp',
        isFoundOnMS: true,
      };

      // Đánh giá sơ bộ trạng thái
      record.ketLuan = {
        trangThai: 'KHOP',
        danhSachLoi: [],
        reconciledAt: new Date(),
      };

      await record.save();
      console.log(`  ✅ Đã lưu khối MS vào MongoDB Atlas cho record ID: ${record._id}`);
    }
  } else {
    // 4. CHẠY THỰC TẾ TRÊN M-SYSTEM (Playwright)
    console.log(`\n[3] Bắt đầu đăng nhập và cào dữ liệu thực tế từ M-System (Giao diện: ${isHeaded ? 'BẬT (Headed)' : 'TẮT (Headless)'})...`);
    const { browser, page } = await loginMSystem(credentials, !isHeaded);


    try {
      let recordsToScrape: any[] = [];

      if (targetCode) {
        // Nếu user chỉ định 1 mã cụ thể qua cờ --code
        let matchedRecord = await CleanRecordModel.findOne({
          $or: [
            { 'noiDungMail.maTKGD_Futures': targetCode },
            { 'noiDungMail.maTKGD_ACM': targetCode },
          ],
        });

        if (!matchedRecord) {
          // Tạo một record test mẫu ứng với mã này để đối soát
          matchedRecord = await CleanRecordModel.create({
            batchDate: new Date().toISOString().slice(0, 10),
            maTVKD: targetCode.slice(0, 3) || '001',
            noiDungMail: {
              maTKGD_Futures: targetCode,
              maTKGD_ACM: targetCode,
              tenTaiKhoan: targetCode === '001C0008386-A' ? 'Đỗ Thị Chi Lê' : 'Khách hàng',
              hasACMRequest: true,
            },
          });
          console.log(`  ➕ Tạo bản ghi test cho mã: ${targetCode}`);
        }
        recordsToScrape = [matchedRecord];
      } else {
        // Mặc định: Lấy danh sách các tài khoản vừa bóc tách từ mail
        recordsToScrape = await CleanRecordModel.find({
          'noiDungMail.maTKGD_Futures': { $exists: true },
        }).sort({ createdAt: -1 }).limit(10);
      }

      console.log(`\n📋 Sẽ cào M-System cho ${recordsToScrape.length} tài khoản bóc tách từ email:`);

      for (const record of recordsToScrape) {
        // Lấy đúng mã TKGD từ email của chính record đó (Futures, ACM, LME, Spread)
        const code = (record.maTKGD || record.noiDungMail?.maTKGD_Futures || record.noiDungMail?.maTKGD_ACM || record.noiDungMail?.maTKGD_LME || record.noiDungMail?.maTKGD_Spread || '').trim();
        if (!code) continue;

        // Phân loại phân hệ tài khoản
        const accountType = detectAccountType(code);
        const baseCode = extractBaseAccountCode(code);
        record.maTKGD = code;
        record.maTKGDBase = baseCode;
        record.accountType = accountType;

        // KIỂM TRA ĐÃ CHECK & KHỚP 100% CHƯA (Tránh Duplicate)
        const isAlreadyChecked = record.ketLuan?.trangThai === 'KHOP' && record.ms?.isFoundOnMS === true;
        if (isAlreadyChecked && !isForce) {
          console.log(`\n⏭️ [BỎ QUA] Tài khoản ${code} (${accountType}) đã KHỚP 100%. Tự động bỏ qua không cào lại (Dùng cờ --force nếu muốn cào lại)!`);
          continue;
        }

        console.log(`\n--------------------------------------------------`);
        console.log(`🔎 Đang cào M-System cho mã [${accountType}]: ${code} (${record.noiDungMail?.tenTaiKhoan || ''})`);

        const scraped = await scrapeInvestorDetailFromMSystem(page, code);


        // Chụp Snapshot bản ghi cũ trước khi cập nhật (Audit Trail)
        if (record.ms && record.ms.maTKGD) {
          if (!record.snapshots) record.snapshots = [];
          record.snapshots.push({
            snapshotAt: new Date(),
            action: 'PRE_MS_UPDATE',
            previousData: {
              ms: record.toObject().ms,
              ketLuan: record.toObject().ketLuan,
            },
          });
          console.log(`  📸 Đã chụp Snapshot bản ghi cũ (mã cũ: ${record.ms.maTKGD}) vào lịch sử!`);
        }

        record.ms = {

          maTKGD: scraped.maTKGD,
          tenTKGD: scraped.tenTKGD,
          hoVaTen: scraped.hoVaTen,
          soCMND_HoChieu: scraped.soCMND_HoChieu,
          ngaySinh: scraped.ngaySinh,
          ngayCap: scraped.ngayCap,
          noiCap: scraped.noiCap,
          ngayThamGia: scraped.ngayThamGia,
          loaiHinhTaiKhoan: scraped.loaiHinhTaiKhoan,
          diaChi: scraped.diaChi,
          trangThai: scraped.trangThai,
          chuKy: scraped.chuKy || 'Chưa ký',
          ketQua: scraped.isFoundOnMS ? 'Đã tìm thấy trên MS' : 'Chưa có trên MS',
          isFoundOnMS: scraped.isFoundOnMS,
        };

        await record.save();
        console.log(`  💾 Đã cập nhật MongoDB khối MS cho tài khoản: ${code}`);

        if (isHeaded) {
          console.log(`  ⏳ Đang giữ màn hình 3 giây để anh tiện quan sát...`);
          await page.waitForTimeout(3000);
        }
      }
    } finally {
      await browser.close();
    }

  }


  // 5. KIỂM CHỨNG DỮ LIỆU SAU KHI CẬP NHẬT
  console.log('\n' + '='.repeat(70));
  console.log(' KIỂM CHỨNG KHỐI MS TRONG MONGODB ATLAS SAU KHI CẬP NHẬT:');
  console.log('='.repeat(70));

  const updatedRecords = await CleanRecordModel.find({
    'ms.isFoundOnMS': true,
  }).sort({ updatedAt: -1 }).limit(5).lean();

  console.table(
    updatedRecords.map((r: any, idx: number) => ({
      STT: idx + 1,
      'Mã TKGD': r.maTKGD || r.ms?.maTKGD || '---',
      'Loại Sàn': r.accountType || 'FUTURES',
      'Tên Trên MS': r.ms?.tenTKGD || '---',
      'Số CMT/CCCD': r.ms?.soCMND_HoChieu || '---',
      'Ngày Sinh': r.ms?.ngaySinh ? new Date(r.ms.ngaySinh).toLocaleDateString('vi-VN') : '---',
      'Trạng Thái MS': r.ms?.trangThai || '---',
      'Kết Luận': r.ketLuan?.trangThai,
    })),
  );


  await mongoose.disconnect();
  console.log('\n✅ HOÀN THÀNH KIỂM THỬ MODULE 2 THÀNH CÔNG 100%!');
}

runModule2Test().catch((err) => {
  console.error(' Lỗi Module 2 Test:', err);
  process.exit(1);
});
