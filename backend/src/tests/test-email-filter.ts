import * as dotenv from 'dotenv';
dotenv.config();

// Thiết lập HEADLESS_BOT=false để hiển thị giao diện UI Chrome trên máy người dùng
process.env.HEADLESS_BOT = 'false';

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RpaDownloaderService } from '../modules/bot-engine/rpa-downloader.service';
import * as path from 'path';
import * as fs from 'fs';

async function run() {
  console.log('🚀 Khởi tạo ứng dụng NestJS (Headed Mode)...');
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const rpaDownloader = appContext.get(RpaDownloaderService);

  const tempDir = path.join(process.cwd(), 'temp', 'test-email-filter');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Sử dụng ngày ca trực hôm trước (ví dụ ngày 13/07/2026) để kiểm tra tính năng filter
  const targetDate = '2026-07-13';
  console.log(
    `📅 Chạy test tự động đăng nhập MS, lọc ngày: ${targetDate} và tải file...`,
  );

  try {
    const filePath = await rpaDownloader.downloadEmailHistoryReport(
      tempDir,
      targetDate,
    );
    console.log(`\n✅ THÀNH CÔNG! Đã tải file lịch sử email về: ${filePath}`);
  } catch (err: any) {
    console.error(`\n❌ THẤT BẠI:`, err.message);
  } finally {
    // Giữ trình duyệt hiển thị 5 giây trước khi đóng context ứng dụng
    console.log('⌛ Sẽ đóng ứng dụng sau 5 giây...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await appContext.close();
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('❌ Lỗi nghiêm trọng:', err);
  process.exit(1);
});
