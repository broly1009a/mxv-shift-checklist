import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ShiftsService } from '../modules/shifts/shifts.service';
import { BotEngineService } from '../modules/bot-engine/bot-engine.service';
import { SeedService } from '../database/seed.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../schemas/user.schema';
import { ChecklistTemplate } from '../schemas/template.schema';
import { ShiftLog } from '../schemas/shift-log.schema';
import { SystemSettingsService } from '../modules/system-settings/system-settings.service';
import { NotificationLog } from '../schemas/notification-log.schema';
import { NotificationChannel } from '../schemas/notification-channel.schema';

async function runMaturityTest() {
  console.log('Force activating Bot Simulation Mode...');
  process.env.SIMULATE_BOT_CHECKS = 'true';

  console.log('Booting NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const shiftsService = app.get(ShiftsService);
  const botEngineService = app.get(BotEngineService);
  const settingsService = app.get(SystemSettingsService);
  const seedService = app.get(SeedService);

  const userModel = app.get<any>(getModelToken(User.name));
  const templateModel = app.get<any>(getModelToken(ChecklistTemplate.name));
  const shiftLogModel = app.get<any>(getModelToken(ShiftLog.name));
  const logModel = app.get<any>(getModelToken(NotificationLog.name));
  const channelModel = app.get<any>(getModelToken(NotificationChannel.name));

  console.log('Seeding fresh database rules and templates...');
  await templateModel.deleteMany({}).exec();
  await seedService.onApplicationBootstrap();

  console.log('Seeding sub-tasks...');
  const { execSync } = require('child_process');
  execSync('node src/scripts/seed-subtasks.js', { stdio: 'inherit' });

  // Create a Teams webhook config in System Settings
  console.log('Configuring default Teams webhook in System Settings...');
  await settingsService.setSetting(
    'default_teams_webhook',
    'https://httpbin.org/post',
  );

  // Also create a channel-specific Teams config for member '002' to test dynamic resolution
  console.log('Creating specific Teams channel for Member 002...');
  await channelModel.deleteMany({ code: { $regex: /^TEAMS_/ } }).exec();
  const testChannel = new channelModel({
    name: 'Teams Alert Member 002',
    code: 'TEAMS_002',
    type: 'TEAMS',
    isActive: true,
    config: {
      webhookUrl: 'https://httpbin.org/post',
    },
  });
  await testChannel.save();

  console.log('Fetching admin user...');
  const adminUser = await userModel.findOne({ username: 'admin' }).exec();
  if (!adminUser) {
    throw new Error('Admin user not found!');
  }

  // Find the template that contains the NOTIFY_MATURITY task
  console.log('Finding Checklist Trong Phiên - Trading Operations template...');
  const template = await templateModel
    .findOne({ title: 'Checklist Trong Phiên - Trading Operations' })
    .exec();
  if (!template) {
    throw new Error('Khối Quản lý Giao dịch in-session template not found!');
  }

  const shiftDate = new Date().toISOString().split('T')[0];
  console.log(`Initializing shift log for ${shiftDate}...`);
  await shiftLogModel
    .deleteMany({ shiftDate, templateId: template._id })
    .exec();
  const shiftLog = await shiftsService.initializeShift(
    template._id.toString(),
    adminUser,
    shiftDate,
  );

  // Force trigger times to 00:00 to guarantee immediate execution
  console.log('--- Initialized Shift Log Details: ---');
  for (const t of shiftLog.details) {
    console.log(
      `Task: ${t.taskId}, Name: ${t.taskNameSnapshot}, isBotCheck: ${t.isBotCheckSnapshot}, botCheckType: ${t.botCheckTypeSnapshot}`,
    );
    if (t.isBotCheckSnapshot) {
      t.botTriggerTimeSnapshot = '00:00';
    }
  }
  console.log('--------------------------------------');
  await shiftLog.save();

  console.log('Clearing old notification logs...');
  await logModel.deleteMany({ eventType: 'MATURITY_ALERT' }).exec();

  console.log('Running handleBotChecks() loop...');
  await botEngineService.handleBotChecks();

  console.log('Fetching updated shift log...');
  const updatedLog = await shiftLogModel.findById(shiftLog._id).exec();

  let maturityTaskStatus = 'NOT_FOUND';
  let maturityTaskNote = '';
  for (const t of updatedLog.details) {
    if (t.botCheckTypeSnapshot === 'NOTIFY_MATURITY') {
      maturityTaskStatus = t.status;
      maturityTaskNote = t.note || '';
    }
  }

  console.log(`Maturity Task status: ${maturityTaskStatus}`);
  console.log(`Maturity Task note: ${maturityTaskNote}`);

  console.log('Checking generated notification logs...');
  const notificationLogs = await logModel
    .find({ eventType: 'MATURITY_ALERT' })
    .exec();
  console.log(`Found ${notificationLogs.length} Teams notification logs.`);
  for (const log of notificationLogs) {
    console.log(
      `- Recipient: ${log.recipient}, Status: ${log.status}, Error: ${log.errorMessage}`,
    );
    if (log.payload) {
      console.log(`  Payload body title: ${log.payload.body?.[0]?.text}`);
    }
  }

  // Cleanup
  await shiftLogModel.deleteOne({ _id: shiftLog._id }).exec();
  await channelModel.deleteOne({ _id: testChannel._id }).exec();

  if (notificationLogs.length > 0) {
    console.log(
      '✅ End-to-End Microsoft Teams Contract Maturity Alert Test passed successfully!',
    );
  } else {
    throw new Error('❌ Test failed: No Teams notifications were dispatched.');
  }

  await app.close();
}

runMaturityTest().catch((err) => {
  console.error('❌ Maturity Test execution failed:', err);
  process.exit(1);
});
