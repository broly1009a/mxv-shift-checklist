import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'shift_slots' })
export class ShiftSlot extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ required: true })
  startTime: string; // Format: HH:mm

  @Prop({ required: true })
  endTime: string; // Format: HH:mm

  @Prop({ type: [Object], default: [] })
  seasonalHours?: Array<{
    name: string;
    startTime: string;
    endTime: string;
    timezoneRef?: string;
  }>;

  startTimeSummer?: string;
  endTimeSummer?: string;
  startTimeWinter?: string;
  endTimeWinter?: string;

  @Prop({ required: true, type: Boolean, default: false })
  isOvernight: boolean;

  @Prop({ required: true, type: Boolean, default: true })
  isActive: boolean;

  @Prop({ required: true, type: Number, default: 0 })
  sortOrder: number;

  @Prop({ required: false, type: Number, default: 0 })
  gracePeriodMinutes?: number;
}

export const ShiftSlotSchema = SchemaFactory.createForClass(ShiftSlot);
ShiftSlotSchema.virtual('id').get(function (this: ShiftSlot) {
  return this._id.toHexString();
});
ShiftSlotSchema.virtual('startTimeSummer').get(function (this: ShiftSlot) {
  return this.seasonalHours?.find(h => h.name === 'SUMMER')?.startTime || '';
});
ShiftSlotSchema.virtual('endTimeSummer').get(function (this: ShiftSlot) {
  return this.seasonalHours?.find(h => h.name === 'SUMMER')?.endTime || '';
});
ShiftSlotSchema.virtual('startTimeWinter').get(function (this: ShiftSlot) {
  return this.seasonalHours?.find(h => h.name === 'WINTER')?.startTime || '';
});
ShiftSlotSchema.virtual('endTimeWinter').get(function (this: ShiftSlot) {
  return this.seasonalHours?.find(h => h.name === 'WINTER')?.endTime || '';
});
ShiftSlotSchema.set('toJSON', { virtuals: true });
ShiftSlotSchema.set('toObject', { virtuals: true });


