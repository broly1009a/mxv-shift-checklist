import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import {
  ChecklistTemplate,
  ChecklistTemplateSchema,
} from '../../schemas/template.schema';
import {
  WorkingCalendar,
  WorkingCalendarSchema,
} from '../../schemas/working-calendar.schema';
import {
  ActivityLog,
  ActivityLogSchema,
} from '../../schemas/activity-log.schema';
import { ShiftJobsService } from './shift-jobs.service';
import { ShiftJobsController } from './shift-jobs.controller';
import { ShiftJobScheduler } from './shift-job.scheduler';
import { WorkingCalendarModule } from '../working-calendar/working-calendar.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShiftLog.name, schema: ShiftLogSchema },
      { name: ChecklistTemplate.name, schema: ChecklistTemplateSchema },
      { name: WorkingCalendar.name, schema: WorkingCalendarSchema },
      { name: ActivityLog.name, schema: ActivityLogSchema },
    ]),
    WorkingCalendarModule,
  ],
  controllers: [ShiftJobsController],
  providers: [ShiftJobsService, ShiftJobScheduler],
  exports: [ShiftJobsService],
})
export class ShiftJobsModule {}
