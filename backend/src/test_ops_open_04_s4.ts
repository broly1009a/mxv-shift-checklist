import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BotEngineService } from './modules/bot-engine/bot-engine.service';
import { getModelToken } from '@nestjs/mongoose';
import { ShiftLog } from './schemas/shift-log.schema';

async function main() {
  console.log('Booting NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const botEngineService = app.get(BotEngineService);
  const shiftLogModel = app.get<any>(getModelToken(ShiftLog.name));

  // Reset status of ops_open_04_s4 to WAITING so the bot checker processes it
  const activeShift = await shiftLogModel
    .findOne({ status: { $ne: 'COMPLETED' } })
    .exec();
  if (!activeShift) {
    console.log('No active shift log found!');
    await app.close();
    return;
  }

  console.log(
    `Active Shift Log: ${activeShift._id} date=${activeShift.shiftDate}`,
  );

  const task = activeShift.details.find(
    (d: any) => d.taskId === 'ops_open_04_s4',
  );
  if (!task) {
    console.log('Task ops_open_04_s4 not found in active shift!');
    await app.close();
    return;
  }

  console.log('Current state of ops_open_04_s4:');
  console.log(`- Status: ${task.status}`);
  console.log(`- IsChecked: ${task.isChecked}`);
  console.log(`- ResultNote: ${task.resultNote}`);

  // Set to WAITING so the check runs
  task.status = 'WAITING';
  task.isChecked = false;
  task.resultNote = '';
  activeShift.markModified('details');
  await activeShift.save();
  console.log('\nReset task state to WAITING. Running handleBotChecks()...');

  // Run bot check
  await botEngineService.handleBotChecks();

  // Refetch
  const updatedShift = await shiftLogModel.findById(activeShift._id).exec();
  const updatedTask = updatedShift.details.find(
    (d: any) => d.taskId === 'ops_open_04_s4',
  );

  console.log('\nUpdated state of ops_open_04_s4:');
  console.log(`- Status: ${updatedTask.status}`);
  console.log(`- IsChecked: ${updatedTask.isChecked}`);
  console.log(`- ResultNote: ${updatedTask.resultNote}`);

  await app.close();
}

main().catch(console.error);
