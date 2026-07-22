import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BotJobQueueService } from './modules/bot-engine/bot-job-queue.service';
import { SystemSettingsService } from './modules/system-settings/system-settings.service';
import { decrypt, encrypt } from './modules/bot-engine/utils/crypto';
import { getModelToken } from '@nestjs/mongoose';
import { BotJob } from './schemas/bot-job.schema';
import { Model } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';

async function runCqgBackupTest() {
  console.log('====================================================');
  console.log('🚀 KHỞI CHẠY KIỂM THỬ JOB DOWNLOAD_CQG_BACKUP');
  console.log('====================================================');

  // 1. Khởi chạy NestJS application context
  console.log('Đang kết nối cơ sở dữ liệu và khởi tạo context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const botJobQueueService = app.get(BotJobQueueService);
  const settingsService = app.get(SystemSettingsService);
  const botJobModel = app.get<Model<BotJob>>(getModelToken(BotJob.name));

  // 2. Kiểm tra/Thiết lập credentials CQG để chạy test
  console.log('Đang kiểm tra cấu hình bot_credentials_cqg trong CSDL...');
  const credRaw = await settingsService.getSetting('bot_credentials_cqg', '');
  let creds: any = null;

  if (credRaw) {
    try {
      creds = JSON.parse(decrypt(credRaw));
      console.log('✅ Tìm thấy thông tin cấu hình bot_credentials_cqg trong CSDL.');
      console.log(`- URL: ${creds.url || 'Mặc định'}`);
      console.log(`- Username CQG1: ${creds.username1 || creds.usernameCQG1 || creds.username || 'Không cấu hình'}`);
      console.log(`- Username CQG2: ${creds.username2 || creds.usernameCQG2 || 'Không cấu hình'}`);
    } catch (e) {
      console.warn('⚠️ Lỗi giải mã credentials trong CSDL. Sẽ dùng biến môi trường nếu có.');
    }
  }

  // Cho phép ghi đè/cung cấp qua env nếu CSDL chưa cấu hình hoặc muốn ghi đè
  const envUser1 = process.env.CQG_USER || process.env.CQG_USER1;
  const envPass1 = process.env.CQG_PASS || process.env.CQG_PASS1;
  const envUser2 = process.env.CQG_USER2;
  const envPass2 = process.env.CQG_PASS2;
  const envUrl = process.env.CQG_URL;

  if (envUser1 && envPass1) {
    console.log('📝 Phát hiện thông tin tài khoản CQG từ biến môi trường. Đang cập nhật/ghi đè...');
    const newCreds = {
      url: envUrl || (creds ? creds.url : 'https://m.cqg.com/cqg/desktop/logon?ref=forced'),
      username1: envUser1,
      password1: envPass1,
      username2: envUser2 || (creds ? creds.username2 : ''),
      password2: envPass2 || (creds ? creds.password2 : ''),
    };
    await settingsService.setSetting('bot_credentials_cqg', encrypt(JSON.stringify(newCreds)));
    console.log('✅ Đã cập nhật bot_credentials_cqg vào CSDL.');
    creds = newCreds;
  }

  if (!creds || (!creds.username1 && !creds.usernameCQG1 && !creds.username)) {
    console.log('\n❌ THẤT BẠI: Chưa cấu hình thông tin tài khoản CQG!');
    console.log('Vui lòng thiết lập biến môi trường để chạy test, ví dụ:');
    console.log('   $env:CQG_USER="account1"; $env:CQG_PASS="pass1"; cmd.exe /c npm run test:cqg-backup');
    console.log('Hoặc cấu hình qua CSDL.');
    await app.close();
    process.exit(1);
  }

  // 3. Tạo một temporary BotJob trong CSDL để lưu log và kết quả
  console.log('\nĐang tạo job PENDING: DOWNLOAD_CQG_BACKUP...');
  const testJob = new botJobModel({
    jobType: 'DOWNLOAD_CQG_BACKUP',
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 1,
    logs: [`[${new Date().toISOString()}] Bắt đầu chạy test job.`],
    payload: {
      targetDate: new Date().toISOString().split('T')[0],
      reports: {
        FR1: true,
        PS1: true,
        OP1: true,
        OD1: true,
        AS: true,
      },
      skipMerge: false, // Chạy cả bước merge
    },
  });
  await testJob.save();
  console.log(`✅ Đã tạo test job trong CSDL với ID: ${testJob._id}`);

  // 4. Chạy job trực tiếp bằng botJobQueueService
  console.log('\n====================================================');
  console.log('🏃 BẮT ĐẦU CHẠY THỰC THI JOB...');
  console.log('====================================================');

  try {
    // Chuyển status sang PROCESSING
    testJob.status = 'PROCESSING' as any;
    testJob.attempts = 1;
    await testJob.save();

    await botJobQueueService.executeJobDirectly(testJob);

    testJob.status = 'COMPLETED' as any;
    testJob.logs.push(`[${new Date().toISOString()}] Job hoàn thành thành công.`);
    await testJob.save();
    console.log('\n🎉 KẾT QUẢ: JOB CHẠY THÀNH CÔNG RỰC RỠ!');
  } catch (err: any) {
    testJob.status = 'FAILED' as any;
    testJob.logs.push(`[${new Date().toISOString()}] Job thất bại: ${err.message}`);
    await testJob.save();
    console.error('\n❌ KẾT QUẢ: JOB THẤT BẠI!');
    console.error(`Chi tiết lỗi: ${err.message}`);
  } finally {
    // In log của job
    console.log('\n====================================================');
    console.log('📜 LOGS CỦA JOB:');
    console.log('====================================================');
    const updatedJob = await botJobModel.findById(testJob._id).exec();
    if (updatedJob) {
      updatedJob.logs.forEach((line) => console.log(line));
    }

    // Dọn dẹp job test
    console.log('\nĐang dọn dẹp job test...');
    await botJobModel.deleteOne({ _id: testJob._id }).exec();
    console.log('Đã dọn dẹp.');

    console.log('Đang ngắt kết nối database...');
    await app.close();
    console.log('Hoàn tất!');
  }
}

runCqgBackupTest().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
