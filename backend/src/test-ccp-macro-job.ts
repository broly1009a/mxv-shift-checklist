import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BotJobQueueService } from './modules/bot-engine/bot-job-queue.service';
import { getModelToken } from '@nestjs/mongoose';
import { BotJob } from './schemas/bot-job.schema';
import * as fs from 'fs';
import * as path from 'path';

async function runCcpTest() {
  console.log('Booting NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const jobQueueService = app.get(BotJobQueueService);
  const botJobModel = app.get<any>(getModelToken(BotJob.name));

  const targetDate = '2026-07-22';
  console.log(`Setting target date to: ${targetDate}`);

  // Delete any existing job for the task to avoid collision
  const taskId = 'TASK_CCP_STATISTICS_s1';
  await botJobModel.deleteMany({ taskId }).exec();

  console.log('Enqueuing RUN_MACRO job...');
  const job = await jobQueueService.enqueue('RUN_MACRO', {
    taskId,
    shiftLogId: '600000000000000000000001',
    targetDate,
  });

  console.log(`Job enqueued. ID: ${job._id}, Status: ${job.status}`);

  console.log('Processing the queue manually...');
  // Force RpaAgentMode to local if needed, so Windows-only jobs are not skipped
  process.env.RPA_AGENT_MODE = 'local';
  
  // Clear processing flag if stuck
  (jobQueueService as any).isProcessing = false;

  await (jobQueueService as any).processQueue();

  // Wait a few seconds for async tasks if any
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('Fetching job status after processing...');
  const updatedJob = await botJobModel.findById(job._id).exec();
  console.log('----------------------------------------------------');
  console.log(`Job ID: ${updatedJob._id}`);
  console.log(`Job Type: ${updatedJob.jobType}`);
  console.log(`Status: ${updatedJob.status}`);
  console.log(`Attempts: ${updatedJob.attempts}`);
  console.log('Logs:');
  updatedJob.logs.forEach((logLine: string) => console.log(`  ${logLine}`));
  console.log('----------------------------------------------------');

  const expectedOutputFile = path.join(process.cwd(), 'uploads', 'ccp-statistics', 'Thong_ke_kich_ban_Pilot_Bac_Final.xlsx');
  const exists = fs.existsSync(expectedOutputFile);
  console.log(`Output file exists at ${expectedOutputFile}: ${exists}`);
  if (exists) {
    const stats = fs.statSync(expectedOutputFile);
    console.log(`Output file size: ${stats.size} bytes, Last modified: ${stats.mtime}`);
  }

  if (updatedJob.status === 'COMPLETED' && exists) {
    console.log('✅ TEST PASSED: RUN_MACRO executed successfully!');
  } else {
    console.error('❌ TEST FAILED: Job not completed or output file missing.');
  }

  // Clean up test job
  await botJobModel.deleteMany({ _id: job._id }).exec();
  console.log('Cleaned up test job from database.');

  await app.close();
}

runCcpTest().catch(err => {
  console.error('❌ CCP Macro test execution failed:', err);
  process.exit(1);
});
