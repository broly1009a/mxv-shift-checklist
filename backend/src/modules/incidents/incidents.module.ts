import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Incident, IncidentSchema } from '../../schemas/incident.schema';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { AuditLog, AuditLogSchema } from '../../schemas/audit-log.schema';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { ShiftsModule } from '../shifts/shifts.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Incident.name, schema: IncidentSchema },
      { name: ShiftLog.name, schema: ShiftLogSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    forwardRef(() => ShiftsModule),
    AuthModule,
  ],
  providers: [IncidentsService],
  controllers: [IncidentsController],
  exports: [IncidentsService],
})
export class IncidentsModule {}
