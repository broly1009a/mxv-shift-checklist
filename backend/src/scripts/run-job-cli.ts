import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BotJobQueueService } from '../modules/bot-engine/bot-job-queue.service';
import { getModelToken } from '@nestjs/mongoose';
import { BotJob } from '../schemas/bot-job.schema';

async function main() {
  // Usage: npx ts-node src/scripts/run-job-cli.ts <job_id>
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Lỗi: Thiếu tham số ID của Job (jobId)');
    process.exit(1);
  }

  // Force local mode in this CLI context so Windows-specific checks run directly
  process.env.RPA_AGENT_MODE = 'local';

  console.log(`[CLI] Khởi chạy NestJS Application Context cho Job ID: ${jobId}...`);
  let app;
  try {
    app = await NestFactory.createApplicationContext(AppModule);
    const botJobModel = app.get<any>(getModelToken(BotJob.name));
    const jobQueueService = app.get(BotJobQueueService);

    // Fetch the job from MongoDB
    const job = await botJobModel.findById(jobId).exec();
    if (!job) {
      console.error(`[CLI] Lỗi: Không tìm thấy Job với ID: ${jobId} trong cơ sở dữ liệu.`);
      await app.close();
      process.exit(1);
    }

    console.log(`[CLI] Đang xử lý Job: ${job.jobType} (Attempts: ${job.attempts})`);
    
    // Set status to PROCESSING
    job.status = 'PROCESSING';
    job.attempts += 1;
    job.logs.push(`[${new Date().toISOString()}] [CLI] Bắt đầu thực thi job qua Windows RPA Agent CLI (Attempt ${job.attempts})`);
    await job.save();

    try {
      // Execute the job directly
      await jobQueueService.executeJobDirectly(job);
      
      // Update job status to COMPLETED
      job.status = 'COMPLETED';
      job.logs.push(`[${new Date().toISOString()}] [CLI] Job hoàn thành thành công.`);
      await job.save();
      
      console.log(`[CLI] Job ${jobId} hoàn thành thành công.`);
      await app.close();
      process.exit(0);
    } catch (err: any) {
      // Update job status to FAILED
      job.status = 'FAILED';
      job.logs.push(`[${new Date().toISOString()}] [CLI] Job thất bại: ${err.message}`);
      await job.save();
      
      console.error(`[CLI] Job ${jobId} thất bại:`, err.message);
      await app.close();
      process.exit(1);
    }
  } catch (err: any) {
    console.error('[CLI] Lỗi khởi động NestJS hoặc kết nối Database:', err.message);
    if (app) {
      await app.close();
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[CLI] Lỗi không mong muốn:', err);
  process.exit(1);
});
