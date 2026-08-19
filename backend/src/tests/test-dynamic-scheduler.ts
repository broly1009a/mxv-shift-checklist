import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SchedulerService } from '../modules/bot-engine/scheduler.service';
import { ShiftsService } from '../modules/shifts/shifts.service';
import { SystemSettingsService } from '../modules/system-settings/system-settings.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ShiftLog } from '../schemas/shift-log.schema';
import { ChecklistTemplate } from '../schemas/template.schema';
import { User } from '../schemas/user.schema';
import { BotJob } from '../schemas/bot-job.schema';

async function runTests() {
  console.log('Booting NestJS application context for scheduler tests...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const schedulerService = app.get(SchedulerService);
  const shiftsService = app.get(ShiftsService);
  const settingsService = app.get(SystemSettingsService);

  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const templateModel = app.get<Model<ChecklistTemplate>>(
    getModelToken(ChecklistTemplate.name),
  );
  const shiftLogModel = app.get<Model<ShiftLog>>(getModelToken(ShiftLog.name));
  const botJobModel = app.get<Model<BotJob>>(getModelToken(BotJob.name));
  const departmentModel = app.get<any>(getModelToken('Department'));

  console.log('\n--- TEST 1: Smart Seeding Verification ---');
  const seededConfigRaw = await settingsService.getSetting(
    'bot_scheduler_config',
    '',
  );
  if (seededConfigRaw) {
    console.log('✅ Scheduler configs seeded successfully in DB!');
    const parsed = JSON.parse(seededConfigRaw);
    console.log('Seeded tasks count:', parsed.length);
    parsed.forEach((t: any) =>
      console.log(
        ` - ID: ${t.id}, JobType: ${t.jobType}, Scheduled Time: ${t.time}, Enabled: ${t.enabled}`,
      ),
    );
  } else {
    throw new Error(
      'TEST 1 FAILED: bot_scheduler_config not found or empty in database.',
    );
  }

  console.log('\n--- TEST 2: Dynamic Scheduling & Task Linking ---');

  // 1. Fetch dependencies
  const adminUser = await userModel.findOne({ username: 'admin' }).exec();
  const dept = await departmentModel.findOne().exec();
  if (!adminUser) {
    throw new Error('Admin user required for test not found!');
  }

  // 2. Create a temporary template and pending shift log containing an automated task
  console.log(
    'Creating a temporary template containing an AUTO_CHECK_SOD task...',
  );
  const tempTemplate = new templateModel({
    title: 'Test Template Scheduler',
    departmentId: dept?._id || adminUser.departmentId || null,
    sessionType: 'OPEN',
    isActive: true,
    tasks: [
      {
        taskId: 'temp_check_sod',
        taskName: 'Đối chiếu số dư đầu ngày (SOD)',
        priority: 'MEDIUM',
        sortOrder: 1,
        isBotCheck: true,
        botCheckType: 'AUTO_CHECK_SOD',
      },
    ],
  });
  const savedTemplate = await tempTemplate.save();
  const shiftDate = new Date(Date.now() + 7 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  let shiftLog: ShiftLog | null = null;
  let backupSchedulerConfig: string | null = null;

  try {
    console.log(`Initializing shift log for date ${shiftDate}...`);
    shiftLog = await shiftsService.initializeShift(
      savedTemplate._id.toString(),
      adminUser,
      shiftDate,
    );
    console.log(`Shift log initialized. ID: ${shiftLog._id}`);

    // Verify task details
    const targetTask = shiftLog.details.find(
      (d) => d.taskId === 'temp_check_sod',
    );
    if (!targetTask) {
      throw new Error('Failed to initialize task temp_check_sod in shift log');
    }
    console.log(
      `Target task found: ${targetTask.taskNameSnapshot}, botCheckTypeSnapshot: ${targetTask.botCheckTypeSnapshot}`,
    );

    // Get current GMT+7 time for the scheduler trigger
    const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    const todayStr = nowVN.toISOString().split('T')[0];
    const currentHourStr = String(nowVN.getUTCHours()).padStart(2, '0');
    const currentMinStr = String(nowVN.getUTCMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHourStr}:${currentMinStr}`;
    console.log(
      `Current Vietnam Time (GMT+7) calculated: ${currentTimeStr} (${todayStr})`,
    );

    // Backup current scheduler configuration
    backupSchedulerConfig = await settingsService.getSetting(
      'bot_scheduler_config',
      '[]',
    );

    // Inject temporary scheduler config targeting the exact current time
    console.log(
      `Injecting temporary scheduler configuration for current time: ${currentTimeStr}...`,
    );
    const tempSchedules = [
      {
        id: 'TEST_AUTO_CHECK_SOD',
        name: 'Test Đối chiếu SOD tự động',
        enabled: true,
        time: currentTimeStr,
        jobType: 'AUTO_CHECK_SOD',
      },
    ];
    await settingsService.setSetting(
      'bot_scheduler_config',
      JSON.stringify(tempSchedules, null, 2),
    );

    // Clear scheduler lastRunMap for safety
    (schedulerService as any).lastRunMap.delete('TEST_AUTO_CHECK_SOD');

    // Run schedule checker
    console.log('Manually triggering SchedulerService.checkSchedule()...');
    await schedulerService.checkSchedule();

    // Verify job enqueuing
    console.log('Querying enqueued jobs in Database...');
    const enqueuedJob = await botJobModel
      .findOne({
        jobType: 'AUTO_CHECK_SOD',
        'payload.taskId': 'temp_check_sod',
        'payload.shiftLogId': shiftLog._id.toString(),
      })
      .exec();

    if (enqueuedJob) {
      const jobPayload =
        enqueuedJob.payload instanceof Map
          ? Object.fromEntries(enqueuedJob.payload)
          : enqueuedJob.payload || {};

      console.log('✅ Job enqueued successfully in bot_jobs collection!');
      console.log(` - Job ID: ${enqueuedJob._id}`);
      console.log(` - Job Type: ${enqueuedJob.jobType}`);
      console.log(` - Linked Task ID: ${jobPayload.taskId}`);
      console.log(` - Linked Shift Log ID: ${jobPayload.shiftLogId}`);
      console.log(` - Session Date: ${jobPayload.sessionDay}`);
    } else {
      throw new Error(
        'TEST 2 FAILED: Job was not enqueued or not linked correctly to shift log task!',
      );
    }

    // Verify duplicate prevention (lastRunMap)
    console.log('Checking lastRunMap duplicate execution guard...');
    const lastRunDate = (schedulerService as any).lastRunMap.get(
      'TEST_AUTO_CHECK_SOD',
    );
    if (lastRunDate === todayStr) {
      console.log(
        "✅ lastRunMap populated correctly with today's date:",
        lastRunDate,
      );
    } else {
      throw new Error(
        'TEST 2 FAILED: lastRunMap was not updated for the executed scheduled task!',
      );
    }

    // Triggering checkSchedule again should NOT enqueue another job (duplicate prevention)
    console.log(
      'Triggering checkSchedule again to verify duplicate execution prevention...',
    );
    const initialJobsCount = await botJobModel
      .countDocuments({
        jobType: 'AUTO_CHECK_SOD',
        'payload.taskId': 'temp_check_sod',
        'payload.shiftLogId': shiftLog._id.toString(),
      })
      .exec();

    await schedulerService.checkSchedule();

    const postJobsCount = await botJobModel
      .countDocuments({
        jobType: 'AUTO_CHECK_SOD',
        'payload.taskId': 'temp_check_sod',
        'payload.shiftLogId': shiftLog._id.toString(),
      })
      .exec();

    if (initialJobsCount === postJobsCount) {
      console.log(
        '✅ Duplicate execution blocked successfully! No additional jobs enqueued.',
      );
    } else {
      throw new Error(
        'TEST 2 FAILED: Duplicate execution was allowed, enqueued another job!',
      );
    }
  } finally {
    // 3. Clean up
    console.log('\nCleaning up test artifacts...');
    if (shiftLog) {
      await shiftLogModel.deleteOne({ _id: (shiftLog as any)._id }).exec();
      console.log('Deleted temporary shift log.');
    }
    if (savedTemplate) {
      await templateModel.deleteOne({ _id: savedTemplate._id }).exec();
      console.log('Deleted temporary template.');
    }
    if (backupSchedulerConfig !== null) {
      await settingsService.setSetting(
        'bot_scheduler_config',
        backupSchedulerConfig,
      );
      console.log('Restored original scheduler config in DB.');
    }
    // Delete any created bot job
    if (shiftLog) {
      await botJobModel
        .deleteMany({ 'payload.shiftLogId': (shiftLog as any)._id.toString() })
        .exec();
      console.log('Deleted temporary enqueued bot jobs.');
    }
  }

  console.log('\n🎉 ALL DYNAMIC SCHEDULER TESTS PASSED SUCCESSFULLY!');
  await app.close();
}

runTests().catch((err) => {
  console.error('❌ Scheduler Test execution failed:', err);
  process.exit(1);
});
