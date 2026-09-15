import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SystemSettingsService } from '../modules/system-settings/system-settings.service';
import { RpaDownloaderService } from '../modules/bot-engine/rpa-downloader.service';
import { decrypt } from '../modules/bot-engine/utils/crypto';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Script độc lập kiểm tra tải Sổ lệnh (OD1, OD2 - Orders) từ CQG
 * Chạy lệnh: npx ts-node src/scripts/test_download_cqg_od.ts
 */
async function run() {
  console.log('====================================================');
  console.log('  KIỂM TRA TẢI SỔ LỆNH (ORDERS: OD1, OD2) TỪ CQG   ');
  console.log('====================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const settingsService = app.get(SystemSettingsService);
  const rpaDownloader = app.get(RpaDownloaderService);

  const credRaw = await settingsService.getSetting('bot_credentials_cqg', '');
  if (!credRaw) {
    console.error(' Chưa cấu hình bot_credentials_cqg trong Settings.');
    await app.close();
    process.exit(1);
  }

  let creds: any;
  try {
    creds = JSON.parse(decrypt(credRaw));
  } catch (err: any) {
    console.error(` Lỗi giải mã bot_credentials_cqg: ${err.message}`);
    await app.close();
    process.exit(1);
  }

  const today = new Date();
  const year = today.getFullYear().toString();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

  const defaultCqgPath = path.join(process.cwd(), 'data', 'backup', 'cqg', 'futures');
  const cqgBackupBase = await settingsService.getSetting('bot_backup_path_cqg', defaultCqgPath);
  const destDir = path.join(cqgBackupBase, subFolder);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  console.log(` Thư mục lưu file: ${destDir}`);
  console.log(`🔑 Tài khoản CQG1: ${creds.username1 || creds.usernameCQG1 || 'Chưa cấu hình'}`);
  console.log(`🔑 Tài khoản CQG2: ${creds.username2 || creds.usernameCQG2 || 'Chưa cấu hình'}\n`);

  console.log('⏳ Đang gọi RpaDownloaderService.downloadCqgBackup để tải riêng OD1 và OD2...');

  try {
    const result = await rpaDownloader.downloadCqgBackup(
      { OD1: true, OD2: true },
      destDir,
    );

    console.log('\n================== KẾT QUẢ ==================');
    if (result.downloaded.length > 0) {
      console.log(`✅ Tải thành công các file: ${result.downloaded.join(', ')}`);
      result.downloaded.forEach((file) => {
        const filePath = path.join(destDir, file);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          console.log(`   📄 ${file}: Kích thước ${stats.size} bytes (${(stats.size / 1024).toFixed(1)} KB)`);
        }
      });
    } else {
      console.log(' Không có file OD nào được tải về.');
    }

    if (result.errors.length > 0) {
      console.log(` Các lỗi ghi nhận:`);
      result.errors.forEach((err) => console.log(`   - ${err}`));
    }
  } catch (err: any) {
    console.error(` Quá trình chạy bị lỗi: ${err.message}`);
  } finally {
    await app.close();
    console.log('\nHoàn tất phiên kiểm thử.');
  }
}

run();
