import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { ChecklistTemplate, ChecklistTemplateSchema } from '../../schemas/template.schema';
import { AuditLog, AuditLogSchema } from '../../schemas/audit-log.schema';
import { ShiftsGateway } from './shifts.gateway';
import { TelegramService } from '../telegram/telegram.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShiftLog.name, schema: ShiftLogSchema },
      { name: ChecklistTemplate.name, schema: ChecklistTemplateSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  providers: [ShiftsService, ShiftsGateway, TelegramService],
  controllers: [ShiftsController],
  exports: [ShiftsService, TelegramService],
})
export class ShiftsModule {}
