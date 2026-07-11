import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ShiftsService } from './modules/shifts/shifts.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { ChecklistTemplate } from './schemas/template.schema';
import { ShiftLog } from './schemas/shift-log.schema';
import { BadRequestException } from '@nestjs/common';

async function runTests() {
  console.log('Booting NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const shiftsService = app.get(ShiftsService);
  const userModel = app.get<any>(getModelToken(User.name));
  const templateModel = app.get<any>(getModelToken(ChecklistTemplate.name));
  const shiftLogModel = app.get<any>(getModelToken(ShiftLog.name));

  console.log('Fetching test users...');
  const adminUser = await userModel.findOne({ username: 'admin' }).exec();
  const staffUser = await userModel.findOne({ username: 'sonhh' }).exec();
  const departmentModel = app.get<any>(getModelToken('Department'));
  const dept = await departmentModel.findOne().exec();

  if (!adminUser || !staffUser) {
    throw new Error('Required test users (admin and sonhh) not found in database!');
  }

  // Create a temporary checklist template with parent-child tasks
  console.log('Creating a temporary template with parent-child tasks...');
  const tempTemplate = new templateModel({
    title: 'Test Template Parent-Child',
    departmentId: dept?._id || adminUser.departmentId || null,
    sessionType: 'OPEN',
    isActive: true,
    tasks: [
      {
        taskId: 'parent_task_1',
        taskName: 'Tác vụ tổng hợp: Đối chiếu số dư đầu ngày',
        priority: 'MEDIUM',
        sortOrder: 1,
      },
      {
        taskId: 'child_task_1',
        taskName: '[RPA] Tải báo cáo CQG CAST',
        priority: 'MEDIUM',
        sortOrder: 2,
        parentTaskId: 'parent_task_1',
      },
      {
        taskId: 'child_task_2',
        taskName: '[Ca trực] Xác nhận chênh lệch SOD',
        priority: 'MEDIUM',
        sortOrder: 3,
        parentTaskId: 'parent_task_1',
      }
    ]
  });

  const savedTemplate = await tempTemplate.save();
  const shiftDate = '2026-06-25';

  try {
    console.log(`Initializing shift log for template: ${savedTemplate.title}...`);
    const shiftLog = await shiftsService.initializeShift(savedTemplate._id.toString(), adminUser, shiftDate);
    console.log(`Shift log initialized. ID: ${shiftLog._id}`);

    // Print initialized task parent details
    console.log('--- Initialized Details ---');
    for (const d of shiftLog.details) {
      console.log(`Task: ${d.taskId}, ParentTaskIdSnapshot: ${d.parentTaskIdSnapshot}, isChecked: ${d.isChecked}, Status: ${d.status}`);
    }
    console.log('---------------------------');

    console.log('Test 1: Attempting to manually toggle the parent task (should be blocked)...');
    try {
      await shiftsService.updateTaskStatus(shiftLog._id.toString(), 'parent_task_1', 'PASSED', staffUser);
      throw new Error('Test 1 FAILED: Allowed manual update of a parent/aggregated task!');
    } catch (err) {
      if (err instanceof BadRequestException) {
        console.log('✅ Test 1 PASSED: Successfully blocked manual update. Msg:', err.message);
      } else {
        throw err;
      }
    }

    console.log('Test 2: Completing child_task_1 only...');
    let updatedLog = await shiftsService.updateTaskStatus(shiftLog._id.toString(), 'child_task_1', 'PASSED', staffUser);
    let parent = updatedLog.details.find(d => d.taskId === 'parent_task_1');
    console.log(`Parent task status: isChecked = ${parent?.isChecked}, Status = ${parent?.status}`);
    if (parent && !parent.isChecked && parent.status === 'PENDING') {
      console.log('✅ Test 2 PASSED: Parent task is still PENDING since child_task_2 is not completed.');
    } else {
      throw new Error('Test 2 FAILED: Parent task checked too early!');
    }

    console.log('Test 3: Completing child_task_2 (both children now complete)...');
    updatedLog = await shiftsService.updateTaskStatus(shiftLog._id.toString(), 'child_task_2', 'PASSED', staffUser);
    parent = updatedLog.details.find(d => d.taskId === 'parent_task_1');
    console.log(`Parent task status: isChecked = ${parent?.isChecked}, Status = ${parent?.status}`);
    if (parent && parent.isChecked && parent.status === 'PASSED') {
      console.log('✅ Test 3 PASSED: Parent task automatically marked as PASSED!');
    } else {
      throw new Error('Test 3 FAILED: Parent task was not automatically completed!');
    }

    console.log('Test 4: Unchecking child_task_1...');
    updatedLog = await shiftsService.updateTaskStatus(shiftLog._id.toString(), 'child_task_1', 'PENDING', staffUser);
    parent = updatedLog.details.find(d => d.taskId === 'parent_task_1');
    console.log(`Parent task status: isChecked = ${parent?.isChecked}, Status = ${parent?.status}`);
    if (parent && !parent.isChecked && parent.status === 'PENDING') {
      console.log('✅ Test 4 PASSED: Parent task automatically reset to PENDING because a child was unchecked!');
    } else {
      throw new Error('Test 4 FAILED: Parent task was not automatically unchecked!');
    }

    // Clean up shift log
    console.log('Cleaning up temporary shift log...');
    await shiftLogModel.deleteOne({ _id: shiftLog._id }).exec();

  } finally {
    console.log('Cleaning up temporary template...');
    await templateModel.deleteOne({ _id: savedTemplate._id }).exec();
  }

  console.log('\n🎉 ALL PARENT-CHILD TASKS TESTS PASSED SUCCESSFULLY!');
  await app.close();
}

runTests().catch(err => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
