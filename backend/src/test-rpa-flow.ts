import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ShiftsService } from './modules/shifts/shifts.service';
import { BotEngineService } from './modules/bot-engine/bot-engine.service';
import { BotJobQueueService } from './modules/bot-engine/bot-job-queue.service';
import { SeedService } from './database/seed.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { ChecklistTemplate } from './schemas/template.schema';
import { ShiftLog } from './schemas/shift-log.schema';
import { BotJob } from './schemas/bot-job.schema';

async function runRpaTests() {
  console.log('Booting NestJS application context for RPA verification...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const shiftsService = app.get(ShiftsService);
  const botEngineService = app.get(BotEngineService);
  const botJobQueueService = app.get(BotJobQueueService);
  const seedService = app.get(SeedService);
  const userModel = app.get<any>(getModelToken(User.name));
  const templateModel = app.get<any>(getModelToken(ChecklistTemplate.name));
  const shiftLogModel = app.get<any>(getModelToken(ShiftLog.name));
  const botJobModel = app.get<any>(getModelToken(BotJob.name));

  console.log('Re-seeding database to ensure fresh RPA task exists...');
  await templateModel.deleteMany({}).exec();
  await botJobModel.deleteMany({}).exec();
  await shiftLogModel.deleteMany({}).exec();
  await seedService.onApplicationBootstrap();

  console.log('Fetching admin user...');
  const adminUser = await userModel.findOne({ username: 'admin' }).exec();
  if (!adminUser) {
    throw new Error('Admin user not found!');
  }

  console.log('Fetching Checklist Mở Cửa - Trading Operations template...');
  const template = await templateModel.findOne({ title: 'Checklist Mở Cửa - Trading Operations' }).exec();
  if (!template) {
    throw new Error('Trading Operations Open template not found!');
  }

  const shiftDate = '2026-07-02';
  console.log(`Initializing shift log for ${shiftDate}...`);
  await shiftLogModel.deleteMany({ shiftDate, templateId: template._id }).exec();
  const shiftLog = await shiftsService.initializeShift(template._id.toString(), adminUser, shiftDate);

  // Force trigger time to 00:00 to run immediately
  const rpaTask = shiftLog.details.find((t: any) => t.taskId === 'ops_open_rpa_download');
  if (!rpaTask) {
    throw new Error('ops_open_rpa_download task not found in template details!');
  }
  // Force trigger time to 00:00 to run immediately, and set SLA to end of day to avoid breach
  rpaTask.botTriggerTimeSnapshot = '00:00';
  rpaTask.slaDeadlineSnapshot = '23:59';
  await shiftLog.save();

  console.log('--- Initial State ---');
  console.log(`Task: ${rpaTask.taskId}, status: ${rpaTask.status}`);

  console.log('\nRunning first handleBotChecks() tick (this should enqueue a job)...');
  await botEngineService.handleBotChecks();

  // Fetch the created BotJob using nested payload query
  const job = await botJobModel.findOne({
    'payload.taskId': 'ops_open_rpa_download',
    'payload.shiftLogId': shiftLog._id.toString()
  }).exec();
  if (!job) {
    throw new Error('RPA BotJob was not enqueued in MongoDB!');
  }
  console.log(`✅ Job enqueued successfully in state: ${job.status}`);

  // Fetch shift log state after first check
  let updatedLog = await shiftLogModel.findById(shiftLog._id).exec();
  let updatedRpaTask = updatedLog.details.find((t: any) => t.taskId === 'ops_open_rpa_download');
  console.log(`Task state after enqueuing: ${updatedRpaTask.status} (Note: ${updatedRpaTask.note})`);

  if (updatedRpaTask.status !== 'WAITING') {
    throw new Error(`RPA task should be WAITING but is ${updatedRpaTask.status}`);
  }

  console.log('\nSimulating background RPA completion...');
  job.status = 'COMPLETED';
  job.logs.push('[Playwright] Logged in successfully');
  job.logs.push('[Playwright] Downloaded report: NKTTHT');
  await job.save();

  console.log('Running second handleBotChecks() tick...');
  await botEngineService.handleBotChecks();

  // Fetch updated shift log state
  updatedLog = await shiftLogModel.findById(shiftLog._id).exec();
  updatedRpaTask = updatedLog.details.find((t: any) => t.taskId === 'ops_open_rpa_download');
  console.log(`Task state after job completion: ${updatedRpaTask.status} (Note: ${updatedRpaTask.note})`);

  if (updatedRpaTask.status !== 'PASSED') {
    throw new Error(`RPA task should be PASSED but is ${updatedRpaTask.status}`);
  }

  console.log('\nCleaning up test shift logs & jobs...');
  await shiftLogModel.deleteOne({ _id: shiftLog._id }).exec();
  await botJobModel.deleteOne({ _id: job._id }).exec();

  console.log('\n🎉 RPA BOT E2E WORKFLOW TESTS PASSED SUCCESSFULLY!');
  await app.close();
}

runRpaTests().catch((err) => {
  console.error('❌ RPA Test execution failed:', err);
  process.exit(1);
});
