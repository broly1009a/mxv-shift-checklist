import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EmailWatcherService } from '../modules/bot-engine/email-watcher.service';
import { SystemSettingsService } from '../modules/system-settings/system-settings.service';
import { PostEodHandlerService } from '../modules/bot-engine/post-eod-handler.service';
import * as fs from 'fs';
import * as path from 'path';

async function testPostEod() {
  console.log('=== KHỞI ĐỘNG KIỂM THỬ POST-EOD & OUTLOOK 365 DOWNLOAD ===');
  process.env.SIMULATE_BOT_CHECKS = 'true';

  const app = await NestFactory.createApplicationContext(AppModule);

  const emailWatcherService = app.get(EmailWatcherService);
  const settingsService = app.get(SystemSettingsService);
  const postEodHandlerService = app.get(PostEodHandlerService);

  // 1. Cấu hình thư mục tải file tạm trong workspace
  const tempDownloadDir = path.join(
    process.cwd(),
    'temp',
    'test_eod_downloads',
  );
  console.log(`Cấu hình m365_download_directory: ${tempDownloadDir}`);
  await settingsService.setSetting('m365_download_directory', tempDownloadDir);

  // Dọn dẹp thư mục nếu đã tồn tại
  if (fs.existsSync(tempDownloadDir)) {
    const files = fs.readdirSync(tempDownloadDir);
    for (const file of files) {
      fs.unlinkSync(path.join(tempDownloadDir, file));
    }
  }

  // 2. Chạy thử nghiệm checkEmailTask với email đối chiếu EOD (Mô phỏng hòm thư Outlook)
  console.log('\n--- BƯỚC 1: Quét Email và Tải file đính kèm ---');
  const targetFilter = JSON.stringify({
    subject: 'đối chiếu',
    sender: 'backoffice@mxv.vn',
  });

  // Chúng ta sẽ add một mock email vào mock-emails.json để đảm bảo khớp
  const mockEmailsPath = path.join(
    __dirname,
    'modules',
    'bot-engine',
    'mock-emails.json',
  );
  const testMockEmails = [
    {
      id: 'eod-test-1',
      sender: 'backoffice@mxv.vn',
      subject: 'Báo cáo chênh lệch KLGD CQG vs M-System - Đối chiếu EOD',
      body: 'Kết quả đối chiếu EOD thành công: SUCCESS.',
      receivedDateTime: new Date().toISOString(),
    },
  ];
  fs.writeFileSync(
    mockEmailsPath,
    JSON.stringify(testMockEmails, null, 2),
    'utf8',
  );
  console.log(`Đã ghi mock email vào: ${mockEmailsPath}`);

  const checkResult = await emailWatcherService.checkEmailTask(
    targetFilter,
    'SUCCESS',
  );
  console.log('Kết quả check email:', checkResult);

  if (!checkResult.success) {
    throw new Error('Không quét được email mẫu EOD!');
  }

  // 3. Kiểm tra xem file đính kèm đã được tải/sinh ra trong thư mục chưa
  console.log('\n--- BƯỚC 2: Kiểm tra file đính kèm đã lưu trữ ---');
  if (!fs.existsSync(tempDownloadDir)) {
    throw new Error('Thư mục download không được tạo tự động!');
  }

  const downloadedFiles = fs.readdirSync(tempDownloadDir);
  console.log('Các file có trong thư mục:', downloadedFiles);
  if (downloadedFiles.length === 0) {
    throw new Error('Không thấy file đính kèm nào được tải về!');
  }

  const eodReportFile = downloadedFiles.find((f) => f.includes('EOD_report'));
  if (!eodReportFile) {
    throw new Error('Không tìm thấy file báo cáo EOD!');
  }

  const eodFilePath = path.join(tempDownloadDir, eodReportFile);

  // 4. Kiểm tra tài khoản âm ký quỹ đầu ngày
  console.log('\n--- BƯỚC 3: Đọc file EOD quét tài khoản âm ký quỹ ---');
  const negativeAccounts =
    await postEodHandlerService.scanNegativeMarginAccounts(eodFilePath);
  console.log(
    'Danh sách tài khoản âm ký quỹ phát hiện được:',
    negativeAccounts,
  );

  // File mock sinh ra bởi email-watcher.service.ts ở dòng:
  // Account,InitialMargin\nTK001,-50000\nTK002,150000\nTK003,-12000\nTK004,-450000
  // Nên có đúng 3 tài khoản âm: TK001, TK003, TK004
  if (negativeAccounts.length !== 3) {
    throw new Error(
      `Số lượng tài khoản âm không khớp! Kỳ vọng: 3, Thực tế: ${negativeAccounts.length}`,
    );
  }

  console.log(
    '\n✅ KIỂM THỬ POST-EOD HOÀN TẤT THÀNH CÔNG VỚI KẾT QUẢ CHÍNH XÁC!',
  );

  // Dọn dẹp
  try {
    fs.unlinkSync(eodFilePath);
    fs.rmdirSync(tempDownloadDir);
    fs.unlinkSync(mockEmailsPath);
  } catch { }

  await app.close();
}

testPostEod().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
