import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ShiftsService } from '../modules/shifts/shifts.service';
import { BotEngineService } from '../modules/bot-engine/bot-engine.service';
import { getModelToken } from '@nestjs/mongoose';
import { ShiftLog } from '../schemas/shift-log.schema';

async function run() {
  console.log('Booting NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const shiftsService = app.get(ShiftsService);
  const botEngineService = app.get(BotEngineService);
  const shiftLogModel = app.get<any>(getModelToken(ShiftLog.name));

  // Find the active shift log for today
  console.log('Finding shift log...');
  const shiftLog = await shiftLogModel
    .findOne({
      'details.taskId': 'TASK_CHECK_CQG_s1',
    })
    .sort({ createdAt: -1 })
    .exec();

  if (!shiftLog) {
    console.error('No shift log found with TASK_CHECK_CQG_s1');
    await app.close();
    return;
  }

  console.log(
    `Found shift log: ID=${shiftLog._id}, Date=${shiftLog.shiftDate}`,
  );

  // Find the subtask TASK_CHECK_CQG_s1
  const task = shiftLog.details.find(
    (t: any) => t.taskId === 'TASK_CHECK_CQG_s1',
  );
  if (!task) {
    console.error('Subtask TASK_CHECK_CQG_s1 not found in shift log');
    await app.close();
    return;
  }

  console.log(`Current status: ${task.status}`);
  console.log(
    `Current resultNote snippet: ${task.resultNote?.substring(0, 100)}...`,
  );

  // Reset status to WAITING to force execution
  console.log('Resetting task status to WAITING...');
  task.status = 'WAITING';
  task.note = 'Đang chờ bot chạy lại đối chiếu...';
  task.resultNote = 'Đang chờ bot chạy lại đối chiếu...';
  await shiftLog.save();

  // Run handleBotChecks()
  console.log('Running handleBotChecks()...');
  await botEngineService.handleBotChecks();

  // Refresh shift log
  const updatedShiftLog = await shiftLogModel.findById(shiftLog._id).exec();
  const updatedTask = updatedShiftLog.details.find(
    (t: any) => t.taskId === 'TASK_CHECK_CQG_s1',
  );

  console.log('\n--- AFTER BOT CHECK TICK ---');
  console.log(`Updated status: ${updatedTask.status}`);
  console.log('Updated resultNote:\n', updatedTask.resultNote);
  console.log('----------------------------');

  await app.close();
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
