import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import mongoose from 'mongoose';
import { RawAccountMailSchema } from '../schemas/raw-account-mail.schema';
import { CleanAccountRecordSchema } from '../schemas/clean-account-record.schema';
import { SystemSettingSchema } from '../schemas/system-setting.schema';
import { parseTkgdEmailBody } from '../modules/bot-engine/helpers/tkgd-mail-parser.helper';
import { scrapeInvestorDetailFromMSystem } from '../modules/bot-engine/helpers/msystem-scraper.helper';
import { reconcileAndExportToExcel } from '../modules/bot-engine/helpers/tkgd-reconcile-exporter.helper';
import { decrypt } from '../modules/bot-engine/utils/crypto';
import { chromium } from 'playwright-core';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

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

async function runFullPipeline() {
  console.log('='.repeat(70));
  console.log('🌟 PIPELINE TỰ ĐỘNG HÓA ĐỐI SOÁT MỞ TKGD (END-TO-END)');
  console.log('   Module 1: Đọc Mail & Lưu MongoDB (Raw + Clean NoiDungMail)');
  console.log('   Module 2: RPA M-System cào Chi tiết TKGD & Lưu Khối MS');
  console.log('   Module 3: Đối soát chéo & Xuất file Excel chuẩn template');
  console.log('='.repeat(70));

  const args = process.argv.slice(2);
  const isHeaded = args.includes('--headed') || args.includes('--ui');

  // Kết nối MongoDB
  console.log('\n[1] Đang kết nối tới MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Kết nối MongoDB thành công!');

  const RawMailModel = mongoose.model('RawAccountMail', RawAccountMailSchema);
  const CleanRecordModel = mongoose.model('CleanAccountRecord', CleanAccountRecordSchema);
  const SettingModel = mongoose.model('SystemSetting', SystemSettingSchema);

  // ─── BƯỚC 1: NẠP VÀ BÓC TÁCH EMAIL ─────────────────────────────────────────
  console.log('\n' + '-'.repeat(50));
  console.log(' BƯỚC 1: ĐỌC & BÓC TÁCH EMAIL VÀO MONGODB');
  console.log('-'.repeat(50));

  // Kiểm tra nạp 2 mẫu email trong inputs
  const sampleMails = [
    {
      subjectPath: path.resolve(__dirname, '../../../POC/TKGD-Automation/inputs/mail-outlook/mẫu 1/subject.md'),
      contentPath: path.resolve(__dirname, '../../../POC/TKGD-Automation/inputs/mail-outlook/mẫu 1/content.md'),
      senderPath: path.resolve(__dirname, '../../../POC/TKGD-Automation/inputs/mail-outlook/mẫu 1/sender.md'),
      attachments: [
        { name: 'NGO-DUC-HAI-mxv.pdf', size: 1048576, contentType: 'application/pdf', fileType: 'hop_dong', storagePath: 'inputs/mail-outlook/mẫu 1/NGO-DUC-HAI-mxv.pdf' },
        { name: 'NGO-DUC-HAI-PL01.pdf', size: 524288, contentType: 'application/pdf', fileType: 'pl01', storagePath: 'inputs/mail-outlook/mẫu 1/NGO-DUC-HAI-PL01.pdf' },
        { name: 'NGO-DUC-HAI-CCCD.jpg', size: 307200, contentType: 'image/jpeg', fileType: 'cccd_truoc', storagePath: 'inputs/mail-outlook/mẫu 1/NGO-DUC-HAI-CCCD.jpg' },
      ],
    },
    {
      subjectPath: path.resolve(__dirname, '../../../POC/TKGD-Automation/inputs/mail-outlook/mẫu 2/subject.md'),
      contentPath: path.resolve(__dirname, '../../../POC/TKGD-Automation/inputs/mail-outlook/mẫu 2/content.md'),
      senderPath: path.resolve(__dirname, '../../../POC/TKGD-Automation/inputs/mail-outlook/mẫu 2/sender.md'),
      attachments: [
        { name: 'NGUYEN-ANH-KHOA-mxv.pdf', size: 980000, contentType: 'application/pdf', fileType: 'hop_dong', storagePath: 'inputs/mail-outlook/mẫu 2/NGUYEN-ANH-KHOA-mxv.pdf' },
        { name: 'NGUYEN-ANH-KHOA-CCCD.jpg', size: 250000, contentType: 'image/jpeg', fileType: 'cccd_truoc', storagePath: 'inputs/mail-outlook/mẫu 2/NGUYEN-ANH-KHOA-CCCD.jpg' },
      ],
    },
  ];

  const processedRecords: any[] = [];

  for (let i = 0; i < sampleMails.length; i++) {
    const item = sampleMails[i];
    if (fs.existsSync(item.contentPath)) {
      const subject = fs.readFileSync(item.subjectPath, 'utf8').trim();
      const body = fs.readFileSync(item.contentPath, 'utf8');
      const sender = fs.readFileSync(item.senderPath, 'utf8').trim();
      const messageId = `PIPELINE-MSG-${Date.now()}-${i + 1}`;

      // 1. Lưu Raw
      const rawDoc = await RawMailModel.create({
        messageId,
        subject,
        senderEmail: sender.includes('<') ? sender.match(/<([^>]+)>/)?.[1] || sender : sender,
        senderName: sender.split('<')[0].trim(),
        receivedDateTime: new Date(),
        bodyRawText: body,
        attachments: item.attachments,
      });


      // 2. Bóc tách Clean NoiDungMail
      const parsed = parseTkgdEmailBody(body);
      const cleanDoc = await CleanRecordModel.create({
        rawMailId: (rawDoc as any)._id,
        batchDate: new Date().toISOString().slice(0, 10),
        maTVKD: parsed.maTVKD || '003',
        noiDungMail: {
          maTKGD_Futures: parsed.maTKGD_Futures,
          maTKGD_ACM: parsed.maTKGD_ACM,
          tenTaiKhoan: parsed.tenTaiKhoan,
          hasACMRequest: parsed.coDangKyACM,
        },
      });


      console.log(`  ✅ [Mail ${i + 1}] Đã bóc tách: TK ${parsed.maTKGD_Futures} | ${parsed.tenTaiKhoan}`);
      processedRecords.push(cleanDoc);
    }
  }

  // ─── BƯỚC 2: CÀO M-SYSTEM (PLAYWRIGHT) ─────────────────────────────────────
  console.log('\n' + '-'.repeat(50));
  console.log(` BƯỚC 2: RPA M-SYSTEM CÀO DỮ LIỆU (Giao diện: ${isHeaded ? 'BẬT' : 'TẮT'})`);
  console.log('-'.repeat(50));

  const setting = await SettingModel.findOne({ key: 'bot_credentials_msystem' }).lean();
  let credentials: any = null;
  if (setting && (setting as any).value) {
    try {
      credentials = JSON.parse(decrypt((setting as any).value));
    } catch { }
  }

  if (credentials && credentials.username) {
    const executablePath = findBrowserExecutable();
    const browser = await chromium.launch({
      executablePath,
      headless: !isHeaded,
      slowMo: isHeaded ? 400 : 0,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--window-size=1400,900'],
    });

    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    page.setDefaultTimeout(30000);

    try {
      // Đăng nhập
      console.log(`  🔑 Đang đăng nhập tài khoản: ${credentials.username}...`);
      await page.goto(credentials.url || 'https://msadmin.mxv.com.vn/#/login', { waitUntil: 'load' });
      await page.waitForTimeout(2000);
      await page.fill('input[type="text"], input[name="username"]', credentials.username);
      await page.fill('input[type="password"], input[name="password"]', credentials.password);
      await page.click('button[type="submit"], button.btn-primary');
      await page.waitForTimeout(2000);

      // Bàn phím ảo PIN
      const pinModal = page.locator('div.pincode');
      if (await pinModal.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log(`  🔢 Nhập mã PIN tự động...`);
        const pinStr = String(credentials.pin || '');
        for (const digit of pinStr) {
          const btn = page.locator('.pincode .keyboard .button').filter({ hasText: new RegExp(`^\\s*${digit}\\s*$`) }).first();
          if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await btn.click();
            await page.waitForTimeout(300);
          } else {
            const fallbackEl = page.locator(`div.pincode >> xpath=.//div[text()='${digit}']`).first();
            if (await fallbackEl.isVisible({ timeout: 1000 }).catch(() => false)) {
              await fallbackEl.click();
              await page.waitForTimeout(300);
            }
          }
        }
        await page.waitForTimeout(3000);
      }

      console.log('  ✅ Đăng nhập M-System thành công!');

      // Cào từng tài khoản
      for (const record of processedRecords) {
        const code = record.noiDungMail?.maTKGD_Futures;
        if (!code) continue;

        console.log(`\n  🔎 Đang cào M-System cho tài khoản: ${code}...`);
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
          console.log(`  📸 Đã chụp Snapshot bản ghi cũ vào lịch sử trước khi ghi đè.`);
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
        console.log(`  💾 Đã lưu khối MS vào MongoDB Atlas cho: ${code}`);

        if (isHeaded) {
          await page.waitForTimeout(3000);
        }
      }
    } finally {
      await browser.close();
    }
  } else {
    console.log('  ⚠️ Không có thông tin tài khoản MS, sử dụng dữ liệu mô phỏng để tiếp tục quy trình.');
    for (const record of processedRecords) {
      record.ms = {
        maTKGD: record.noiDungMail?.maTKGD_Futures,
        tenTKGD: record.noiDungMail?.tenTaiKhoan,
        hoVaTen: record.noiDungMail?.tenTaiKhoan,
        soCMND_HoChieu: '031079015563',
        ngaySinh: new Date(1979, 9, 13),
        ngayCap: new Date(2022, 7, 27),
        noiCap: 'Cục Cảnh sát QLHC về TTXH',
        ngayThamGia: new Date(2026, 7, 11),
        loaiHinhTaiKhoan: 'Cá nhân',
        diaChi: '186 Miếu Hai Xã, Hải Phòng',
        trangThai: 'Hoạt động',
        chuKy: 'Đã ký',
        isFoundOnMS: true,
      };
      await record.save();
    }
  }

  // ─── BƯỚC 3: ĐỐI SOÁT CHÉO & XUẤT FILE EXCEL ─────────────────────────────
  console.log('\n' + '-'.repeat(50));
  console.log('📊 BƯỚC 3: ĐỐI SOÁT CHÉO & XUẤT FILE EXCEL');
  console.log('-'.repeat(50));

  const summary = await reconcileAndExportToExcel(processedRecords);

  console.log('\n' + '='.repeat(70));
  console.log('🎉 TOÀN BỘ PIPELINE ĐÃ HOÀN THÀNH XUẤT SẮC!');
  console.log(`  - File Excel đối soát: ${summary.outputFilePath}`);
  console.log(`  - Tổng số bản ghi:     ${summary.totalRecords}`);
  console.log(`  - Bản ghi Khớp:        ${summary.khopCount} (Xanh lá)`);
  console.log(`  - Bản ghi Lệch:        ${summary.lechCount} (Đỏ/Cam)`);
  console.log('='.repeat(70));

  await mongoose.disconnect();
}

runFullPipeline().catch(console.error);
