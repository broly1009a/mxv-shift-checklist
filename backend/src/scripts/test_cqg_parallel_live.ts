import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SystemSettingsService } from '../modules/system-settings/system-settings.service';
import { RpaDownloaderService } from '../modules/bot-engine/rpa-downloader.service';
import { CqgSyncService } from '../modules/bot-engine/cqg-sync.service';
import { decrypt } from '../modules/bot-engine/utils/crypto';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Script kiểm tra tải song song đồng thời 2 tài khoản CQG (CQG1 & CQG2)
 * Đo lường chính xác thời gian tải và kiểm tra đồng bộ mtime giữa FR1 và FR2.
 * 
 * Cách chạy:
 * npx ts-node -r tsconfig-paths/register backend/src/scripts/test_cqg_parallel_live.ts
 */
async function run() {
  console.log('================================================================');
  console.log('  KIỂM TRA TẢI SONG SONG ĐỒNG THỜI 2 TÀI KHOẢN CQG (CQG1 & CQG2)');
  console.log('================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const settingsService = app.get(SystemSettingsService);
  const rpaDownloader = app.get(RpaDownloaderService);
  const cqgSyncService = app.get(CqgSyncService);

  const credRaw = await settingsService.getSetting('bot_credentials_cqg', '');
  if (!credRaw) {
    console.error('❌ Chưa cấu hình bot_credentials_cqg trong Settings.');
    await app.close();
    process.exit(1);
  }

  let creds: any;
  try {
    creds = JSON.parse(decrypt(credRaw));
  } catch (err: any) {
    console.error(`❌ Lỗi giải mã bot_credentials_cqg: ${err.message}`);
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

  console.log(`📁 Thư mục lưu file: ${destDir}`);
  console.log(`🔑 Tài khoản CQG1: ${creds.username1 || creds.usernameCQG1 || 'Chưa cấu hình'}`);
  console.log(`🔑 Tài khoản CQG2: ${creds.username2 || creds.usernameCQG2 || 'Chưa cấu hình'}\n`);

  console.log('🚀 Bắt đầu kích hoạt tải song song FR1 và FR2...');
  const startTime = Date.now();

  try {
    const result = await rpaDownloader.downloadCqgBackup(
      { FR1: true, FR2: true },
      destDir,
    );

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️ TỔNG THỜI GIAN HOÀN TẤT TẢI SONG SONG: ${elapsedSeconds}s (Trước đây: ~148s)`);
    console.log(`✅ Danh sách file đã tải: ${result.downloaded.join(', ')}`);

    if (result.errors.length > 0) {
      console.warn(`⚠️ Có lỗi trong quá trình tải: ${result.errors.join(' | ')}`);
    }

    // Kiểm tra timestamp mtime giữa 2 file FR1 và FR2
    const fr1Path = path.join(destDir, 'FR1.xlsx');
    const fr2Path = path.join(destDir, 'FR2.xlsx');

    if (fs.existsSync(fr1Path) && fs.existsSync(fr2Path)) {
      const stat1 = fs.statSync(fr1Path);
      const stat2 = fs.statSync(fr2Path);
      const diffMs = Math.abs(stat1.mtimeMs - stat2.mtimeMs);
      console.log(`\n📊 KIỂM TRA ĐỒNG BỘ THỜI GIAN XUẤT FILE:`);
      console.log(` - FR1 mtime: ${stat1.mtime.toLocaleTimeString('vi-VN')} (${stat1.mtime.toISOString()})`);
      console.log(` - FR2 mtime: ${stat2.mtime.toLocaleTimeString('vi-VN')} (${stat2.mtime.toISOString()})`);
      console.log(` - Độ chênh lệch giữa 2 file: ${(diffMs / 1000).toFixed(2)}s (Mục tiêu: < 5s)`);

      // Thử nghiệm ghép file tự động
      console.log('\n🔄 Kích hoạt tự động ghép file FR1 + FR2 -> FR.xlsx...');
      const mergeRes = await cqgSyncService.autoMergeMissingFiles(today, ['FR'], true);
      console.log(` Ghép file thành công: ${mergeRes.success}`);
      for (const l of mergeRes.logs) {
        console.log(`   ${l}`);
      }
    } else {
      console.warn('⚠️ Không tìm thấy đủ cả 2 file FR1.xlsx và FR2.xlsx để so sánh mtime.');
    }

    console.log('\n====================================================');
    console.log('         KIỂM TRA HOÀN TẤT THÀNH CÔNG!              ');
    console.log('====================================================');
  } catch (err: any) {
    console.error(`\n❌ Quá trình kiểm tra thất bại: ${err.message}`);
  } finally {
    await app.close();
  }
}

run();
