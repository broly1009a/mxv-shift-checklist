import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class WorkingCalendar extends Document {
  @Prop({ required: true, unique: true, index: true })
  date: string; // Format: YYYY-MM-DD

  @Prop({ required: true, type: Boolean, default: true })
  isTradingDay: boolean;

  @Prop({ required: true, type: Boolean, default: false })
  isHoliday: boolean;

  @Prop({ required: true, type: Boolean, default: false })
  isWeekend: boolean;

  @Prop({ type: String, required: false, default: '' })
  note?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, default: null })
  createdBy?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, default: null })
  updatedBy?: Types.ObjectId | null;
}

export const WorkingCalendarSchema =
  SchemaFactory.createForClass(WorkingCalendar);
WorkingCalendarSchema.virtual('id').get(function (this: WorkingCalendar) {
  return this._id.toHexString();
});
WorkingCalendarSchema.set('toJSON', { virtuals: true });
WorkingCalendarSchema.set('toObject', { virtuals: true });
