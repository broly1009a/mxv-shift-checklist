import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ShiftsService } from './modules/shifts/shifts.service';
import { BotEngineService } from './modules/bot-engine/bot-engine.service';
import { SeedService } from './database/seed.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { ChecklistTemplate } from './schemas/template.schema';
import { ShiftLog } from './schemas/shift-log.schema';

async function runBotTests() {
  console.log('Force activating Bot Simulation Mode...');
  process.env.SIMULATE_BOT_CHECKS = 'true';

  console.log('Booting NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const shiftsService = app.get(ShiftsService);
  const botEngineService = app.get(BotEngineService);
  const seedService = app.get(SeedService);
  const userModel = app.get<any>(getModelToken(User.name));
  const templateModel = app.get<any>(getModelToken(ChecklistTemplate.name));
  const shiftLogModel = app.get<any>(getModelToken(ShiftLog.name));

  console.log('Clearing templates to trigger fresh seeding...');
  await templateModel.deleteMany({}).exec();
  await seedService.onApplicationBootstrap();

  console.log('Fetching admin user...');
  const adminUser = await userModel.findOne({ username: 'admin' }).exec();
  if (!adminUser) {
    throw new Error('Admin user not found!');
  }

  // 1. Test IT Core Open template which has it_open_03 API Check
  console.log('Fetching Checklist Mở Cửa - IT Vận Hành Core template...');
  const template = await templateModel.findOne({ title: 'Checklist Mở Cửa - IT Vận Hành Core' }).exec();
  if (!template) {
    throw new Error('IT Core Open template not found!');
  }

  const shiftDate = '2026-06-25';
  console.log(`Initializing shift log for ${shiftDate}...`);
  await shiftLogModel.deleteMany({ shiftDate, templateId: template._id }).exec();
  const shiftLog = await shiftsService.initializeShift(template._id.toString(), adminUser, shiftDate);

  console.log('Forcing trigger times to 00:00 to guarantee execution...');
  for (const t of shiftLog.details) {
    if (t.isBotCheckSnapshot) {
      t.botTriggerTimeSnapshot = '00:00';
    }
  }
  await shiftLog.save();

  console.log('--- Initialized Details State ---');
  for (const t of shiftLog.details) {
    console.log(`Task: ${t.taskId}, Name: ${t.taskNameSnapshot}, isBotCheck: ${t.isBotCheckSnapshot}, status: ${t.status}`);
  }
  console.log('---------------------------------');

  console.log('Running handleBotChecks() loop...');
  await botEngineService.handleBotChecks();

  console.log('Fetching updated shift log...');
  const updatedLog = await shiftLogModel.findById(shiftLog._id).exec();
  
  console.log('--- Post-Execution Details State ---');
  let passCount = 0;
  for (const t of updatedLog.details) {
    console.log(`Task: ${t.taskId}, status: ${t.status}, note: ${t.note}`);
    if (t.isBotCheckSnapshot && t.status === 'PASSED') {
      passCount++;
    }
  }
  console.log('------------------------------------');

  if (passCount > 0) {
    console.log(`✅ Test PASSED: Verified that ${passCount} automated task(s) successfully processed to PASSED status!`);
  } else {
    throw new Error('Test FAILED: No automated tasks were processed successfully.');
  }

  console.log('Cleaning up test shift logs...');
  await shiftLogModel.deleteOne({ _id: shiftLog._id }).exec();

  console.log('\n🎉 BOT ENGINE TESTS COMPLETED SUCCESSFULLY!');
  await app.close();
}

runBotTests().catch(err => {
  console.error('❌ Bot Test execution failed:', err);
  process.exit(1);
});
