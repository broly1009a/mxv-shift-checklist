import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ShiftSlot extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ required: true })
  startTime: string; // Format: HH:mm

  @Prop({ required: true })
  endTime: string; // Format: HH:mm

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
ShiftSlotSchema.set('toJSON', { virtuals: true });
ShiftSlotSchema.set('toObject', { virtuals: true });
