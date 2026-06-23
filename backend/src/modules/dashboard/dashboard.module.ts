import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { Department, DepartmentSchema } from '../../schemas/department.schema';
import { AuditLog, AuditLogSchema } from '../../schemas/audit-log.schema';
import { SystemLog, SystemLogSchema } from '../../schemas/system-log.schema';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShiftLog.name, schema: ShiftLogSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: SystemLog.name, schema: SystemLogSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
