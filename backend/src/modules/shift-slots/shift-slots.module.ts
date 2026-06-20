import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShiftSlot, ShiftSlotSchema } from '../../schemas/shift-slot.schema';
import { ShiftSlotsController } from './shift-slots.controller';
import { ShiftSlotsService } from './shift-slots.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShiftSlot.name, schema: ShiftSlotSchema },
    ]),
  ],
  controllers: [ShiftSlotsController],
  providers: [ShiftSlotsService],
  exports: [ShiftSlotsService, MongooseModule],
})
export class ShiftSlotsModule {}
