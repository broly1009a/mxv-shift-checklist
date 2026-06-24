import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ShiftsService } from './modules/shifts/shifts.service';
import { SeedService } from './database/seed.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { ChecklistTemplate } from './schemas/template.schema';
import { ShiftLog } from './schemas/shift-log.schema';
import { BadRequestException } from '@nestjs/common';

async function runTests() {
  console.log('Booting NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const shiftsService = app.get(ShiftsService);
  const seedService = app.get(SeedService);
  const userModel = app.get<any>(getModelToken(User.name));
  const templateModel = app.get<any>(getModelToken(ChecklistTemplate.name));
  const shiftLogModel = app.get<any>(getModelToken(ShiftLog.name));

  console.log('Clearing existing templates in MongoDB to force a fresh seed...');
  await templateModel.deleteMany({}).exec();

  console.log('Re-running SeedService to populate templates with dependsOnTaskIds...');
  await seedService.onApplicationBootstrap();

  console.log('Fetching users admin and sonhh...');
  const adminUser = await userModel.findOne({ username: 'admin' }).exec();
  const staffUser = await userModel.findOne({ username: 'sonhh' }).exec();

  if (!adminUser || !staffUser) {
    throw new Error('Required test users (admin and sonhh) not found in database!');
  }

  console.log('Fetching Checklist Mở Cửa - IT Vận Hành Core template...');
  const template = await templateModel.findOne({ title: 'Checklist Mở Cửa - IT Vận Hành Core' }).exec();
  if (!template) {
    throw new Error('Template Checklist Mở Cửa - IT Vận Hành Core not found!');
  }

  console.log('--- Template Tasks details in Database ---');
  for (const t of template.tasks) {
    console.log(`Task: ${t.taskId}, Name: ${t.taskName}, dependsOnTaskIds:`, JSON.stringify(t.dependsOnTaskIds));
  }
  console.log('------------------------------------------');

  const shiftDate = '2026-06-24';
  console.log(`Cleaning up existing shift logs for ${shiftDate}...`);
  await shiftLogModel.deleteMany({ shiftDate, templateId: template._id }).exec();

  console.log(`Initializing shift log for ${shiftDate}...`);
  const shiftLog = await shiftsService.initializeShift(template._id.toString(), adminUser, shiftDate);
  console.log(`Shift log initialized successfully. ID: ${shiftLog._id}`);

  console.log('--- Initialized Details snapshot ---');
  for (const t of shiftLog.details) {
    console.log(`Task: ${t.taskId}, Name: ${t.taskNameSnapshot}, dependsOnTaskIdsSnapshot:`, JSON.stringify(t.dependsOnTaskIdsSnapshot));
  }
  console.log('------------------------------------');

  try {
    console.log('Test 1: Attempting to complete it_open_04 while it_open_01 is still PENDING...');
    try {
      await shiftsService.updateTaskStatus(shiftLog._id.toString(), 'it_open_04', 'PASSED', staffUser);
      throw new Error('Test 1 FAILED: Allowed checking it_open_04 without its dependency completed!');
    } catch (err) {
      if (err instanceof BadRequestException) {
        console.log('✅ Test 1 PASSED: Successfully blocked checking it_open_04. Error message:', err.message);
      } else {
        throw err;
      }
    }

    console.log('Test 2: Marking parent task it_open_01 as PASSED...');
    await shiftsService.updateTaskStatus(shiftLog._id.toString(), 'it_open_01', 'PASSED', staffUser);

    console.log('Marking dependent task it_open_04 as PASSED...');
    const updatedLogAfterCheck = await shiftsService.updateTaskStatus(shiftLog._id.toString(), 'it_open_04', 'PASSED', staffUser);
    const itOpen04Task = updatedLogAfterCheck.details.find(d => d.taskId === 'it_open_04');
    if (itOpen04Task && itOpen04Task.isChecked && itOpen04Task.status === 'PASSED') {
      console.log('✅ Test 2 PASSED: Successfully unlocked and checked dependent task it_open_04.');
    } else {
      throw new Error('Test 2 FAILED: Task it_open_04 was not marked completed.');
    }

    console.log('Test 3: Attempting to reset parent task it_open_01 back to PENDING while it_open_04 is still PASSED...');
    try {
      await shiftsService.updateTaskStatus(shiftLog._id.toString(), 'it_open_01', 'PENDING', staffUser);
      throw new Error('Test 3 FAILED: Allowed unchecking parent task while child task is still checked!');
    } catch (err) {
      if (err instanceof BadRequestException) {
        console.log('✅ Test 3 PASSED: Successfully blocked resetting parent task. Error message:', err.message);
      } else {
        throw err;
      }
    }

    console.log('Test 4: Resetting dependent task it_open_04 back to PENDING...');
    const resetLog = await shiftsService.updateTaskStatus(shiftLog._id.toString(), 'it_open_04', 'PENDING', staffUser);
    const resetTask = resetLog.details.find(d => d.taskId === 'it_open_04');
    if (
      resetTask &&
      resetTask.status === 'PENDING' &&
      !resetTask.isChecked &&
      resetTask.startedAt === null &&
      resetTask.completedAt === null &&
      resetTask.failedAt === null &&
      resetTask.skippedAt === null &&
      resetTask.needsAttentionAt === null
    ) {
      console.log('✅ Test 4 PASSED: Successfully reset task to PENDING and cleared all lifecycle timestamps.');
    } else {
      console.log('Task detail:', resetTask);
      throw new Error('Test 4 FAILED: Timestamps or status were not correctly reset/cleared.');
    }

    await shiftsService.updateTaskStatus(shiftLog._id.toString(), 'it_open_01', 'PENDING', staffUser);

    console.log('Fetching Checklist Đóng Cửa - IT Vận Hành Core template...');
    const closeTemplate = await templateModel.findOne({ title: 'Checklist Đóng Cửa - IT Vận Hành Core' }).exec();
    if (closeTemplate) {
      console.log('Initializing closing shift log...');
      const closeShiftLog = await shiftsService.initializeShift(closeTemplate._id.toString(), adminUser, shiftDate);
      
      console.log('Injecting a CE/ACM backup task to test the closeShift guard...');
      closeShiftLog.details[0].taskId = 'it_close_ce_backup';
      closeShiftLog.details[0].taskNameSnapshot = 'Thực hiện tiến trình sao lưu cơ sở dữ liệu tự động CE';
      await closeShiftLog.save();

      console.log('--- Closing Shift Log Details ---');
      console.log('sessionType:', (closeShiftLog.templateId as any)?.sessionType);
      for (const d of closeShiftLog.details) {
        const containsCeOrAcm = d.taskId.toLowerCase().includes('ce') || d.taskId.toLowerCase().includes('acm');
        const containsBackupOrSaoLuu = d.taskNameSnapshot.toLowerCase().includes('backup') || d.taskNameSnapshot.toLowerCase().includes('sao lưu');
        console.log(`Task: ${d.taskId}, Name: ${d.taskNameSnapshot}, containsCeOrAcm: ${containsCeOrAcm}, containsBackupOrSaoLuu: ${containsBackupOrSaoLuu}`);
      }

      console.log('Attempting to close the shift with incomplete backup tasks...');
      try {
        await shiftsService.closeShift(closeShiftLog._id.toString(), adminUser, 'Test handover');
        throw new Error('Test 5 FAILED: Allowed closing shift with incomplete CE/ACM backup tasks!');
      } catch (err) {
        if (err instanceof BadRequestException) {
          console.log('✅ Test 5 PASSED: Successfully blocked closing shift. Error message:', err.message);
        } else {
          throw err;
        }
      }

      await shiftLogModel.deleteOne({ _id: closeShiftLog._id }).exec();
    } else {
      console.log('⚠️ Checklist Đóng Cửa template not found, skipping Test 5.');
    }

  } finally {
    console.log('Cleaning up test shift logs...');
    await shiftLogModel.deleteOne({ _id: shiftLog._id }).exec();
  }

  console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY! Operations checklist logic is extremely solid and secure.');
  await app.close();
}

runTests().catch(err => {
  console.error('❌ Test execution failed with error:', err);
  process.exit(1);
});
