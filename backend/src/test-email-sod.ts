import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ReconciliationService } from './modules/reconciliation/reconciliation.service';
import { MarginCheckerService } from './modules/margin-checker/margin-checker.service';
import { SystemSettingsService } from './modules/system-settings/system-settings.service';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

async function testEmailSod() {
  console.log('=== KHỞI ĐỘNG KIỂM THỬ GỬI EMAIL BÁO CÁO ĐỐI CHIẾU SOD ===');

  const app = await NestFactory.createApplicationContext(AppModule);
  const reconciliationService = app.get(ReconciliationService);
  const marginCheckerService = app.get(MarginCheckerService);
  const settingsService = app.get(SystemSettingsService);

  const today = new Date();
  const year = today.getFullYear().toString();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  // 1. Tạo thư mục tạm để chứa file test
  const tempTestDir = path.join(process.cwd(), 'temp', 'test_email_sod_dir');
  if (!fs.existsSync(tempTestDir)) {
    fs.mkdirSync(tempTestDir, { recursive: true });
  }

  // Backup folder structure: Year/TMonth.Year/Day.Month
  const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
  const mockMsBackupPath = path.join(tempTestDir, 'BackupMS');
  const mockDailyPath = path.join(mockMsBackupPath, subFolder);
  if (!fs.existsSync(mockDailyPath)) {
    fs.mkdirSync(mockDailyPath, { recursive: true });
  }

  const mockCastDownloadsDir = path.join(
    process.cwd(),
    'temp',
    'cast-downloads',
  );
  if (!fs.existsSync(mockCastDownloadsDir)) {
    fs.mkdirSync(mockCastDownloadsDir, { recursive: true });
  }

  // Cấu hình tạm thời các đường dẫn trong DB
  const originalBackupPath = await settingsService.getSetting(
    'bot_backup_path_ms',
    '',
  );
  await settingsService.setSetting('bot_backup_path_ms', mockMsBackupPath);
  await settingsService.setSetting('usd_exchange_rate', '25000');

  // 2. Tạo file mock QLTKGD.xlsx (M-System)
  // Cột: Mã TKGD, Lãi lỗ thực tế chờ đáo hạn, Lãi lỗ thực tế Futures (VND), Số dư TKKQ hiện tại
  const qltkgdData = [
    [
      'Mã TKGD',
      'Lãi lỗ thực tế chờ đáo hạn',
      'Lãi lỗ thực tế Futures (VND)',
      'Số dư TKKQ hiện tại',
    ],
    ['000100', 0, 0, 250000000], // $10,000 USD
    ['000200', 0, 0, 125000000], // $5,000 USD
    ['000300', 0, 0, 500000000], // $20,000 USD -> Sẽ giả lập lệch bên CQG
  ];
  const qltkgdSheet = XLSX.utils.aoa_to_sheet(qltkgdData);
  const qltkgdWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(qltkgdWorkbook, qltkgdSheet, 'Sheet1');
  const qltkgdFilePath = path.join(mockDailyPath, 'QLTKGD.xlsx');
  XLSX.writeFile(qltkgdWorkbook, qltkgdFilePath);
  console.log(`Đã tạo file mock QLTKGD: ${qltkgdFilePath}`);

  // 3. Tạo file mock Accounts_Balances.xlsx (CQG CAST)
  // Cột: Account Number, End Cash Balance, Record Description
  const castData = [
    ['Account Number', 'End Cash Balance', 'Record Description'],
    ['000100F', 10000, 'Current-day Balance'],
    ['000200L', 5000, 'Current-day Balance'],
    ['000300S', 18500, 'Current-day Balance'], // Lệch $1,500 so với $20,000
    ['000400F', 3000, 'Current-day Balance'], // Chỉ có trên CQG, không có bên M-System
  ];
  const castSheet = XLSX.utils.aoa_to_sheet(castData);
  const castWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(castWorkbook, castSheet, 'Sheet1');

  const castFileName = `Accounts_Balances_${year}${month}${day}_${Date.now()}.xlsx`;
  const castFilePath = path.join(mockCastDownloadsDir, castFileName);
  XLSX.writeFile(castWorkbook, castFilePath);
  console.log(`Đã tạo file mock Accounts_Balances: ${castFilePath}`);

  // 4. Intercept gửi email để xuất ra file HTML xem trước
  let capturedHtml = '';
  let capturedRecipients: string[] = [];
  let capturedSubject = '';

  marginCheckerService.sendEmailNotification = async (
    config: any,
    toEmails: string[],
    subject: string,
    htmlBody: string,
  ) => {
    capturedHtml = htmlBody;
    capturedRecipients = toEmails;
    capturedSubject = subject;
    console.log('Intercepted sendEmailNotification successfully!');
    return { success: true, messageId: 'mock-sod-email-id-12345' };
  };

  // 5. Chạy hàm runAutoCheckSOD
  console.log('\n--- Bắt đầu chạy đối chiếu SOD... ---');
  const result = await reconciliationService.runAutoCheckSOD(today);
  console.log('Kết quả đối chiếu:', result);

  // 6. Ghi file HTML Preview
  const previewPath = path.join(
    process.cwd(),
    'temp',
    'sod-email-preview.html',
  );
  if (capturedHtml) {
    fs.writeFileSync(previewPath, capturedHtml, 'utf8');
    console.log(`\n🎉 THÀNH CÔNG! Đã lưu email preview tại: ${previewPath}`);
    console.log(`- To: ${capturedRecipients.join(', ')}`);
    console.log(`- Subject: ${capturedSubject}`);
  } else {
    throw new Error('Không bắt được HTML email gửi đi!');
  }

  // 7. Dọn dẹp
  console.log('\n--- Đang dọn dẹp các file tạm... ---');
  try {
    fs.unlinkSync(qltkgdFilePath);
    fs.unlinkSync(castFilePath);
    fs.rmdirSync(mockDailyPath);
    fs.rmdirSync(path.join(mockMsBackupPath, year, `T${month}.${year}`));
    fs.rmdirSync(path.join(mockMsBackupPath, year));
    fs.rmdirSync(mockMsBackupPath);
    fs.rmdirSync(tempTestDir);

    // Khôi phục cài đặt gốc
    if (originalBackupPath) {
      await settingsService.setSetting(
        'bot_backup_path_ms',
        originalBackupPath,
      );
    }
  } catch (err: any) {
    console.warn('Lỗi khi dọn dẹp:', err.message);
  }

  await app.close();
}

testEmailSod().catch((err) => {
  console.error('❌ Test email SOD thất bại:', err);
  process.exit(1);
});
