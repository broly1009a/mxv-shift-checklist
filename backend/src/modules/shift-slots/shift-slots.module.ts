import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShiftSlot, ShiftSlotSchema } from '../../schemas/shift-slot.schema';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import {
  ChecklistTemplate,
  ChecklistTemplateSchema,
} from '../../schemas/template.schema';
import { ShiftSlotsController } from './shift-slots.controller';
import { ShiftSlotsService } from './shift-slots.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShiftSlot.name, schema: ShiftSlotSchema },
      { name: ShiftLog.name, schema: ShiftLogSchema },
      { name: ChecklistTemplate.name, schema: ChecklistTemplateSchema },
    ]),
    AuthModule,
  ],
  controllers: [ShiftSlotsController],
  providers: [ShiftSlotsService],
  exports: [ShiftSlotsService, MongooseModule],
})
export class ShiftSlotsModule {}
