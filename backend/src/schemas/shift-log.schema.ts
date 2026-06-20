import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class ShiftLogDetail {
  @Prop({ required: true })
  taskId: string;

  @Prop({ required: true })
  taskNameSnapshot: string;

  @Prop({ required: true })
  prioritySnapshot: string;

  @Prop({ required: true, default: false })
  isChecked: boolean;

  @Prop({ type: Date, default: null })
  checkedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  note?: string | null;

  @Prop({ required: false, type: String, default: null })
  deadlineSnapshot?: string | null;

  @Prop({ required: false, type: String, default: '' })
  functionUrlSnapshot?: string;

  @Prop({ required: false, type: String, default: '' })
  urdReferenceSnapshot?: string;

  @Prop({ required: false, type: String, default: '' })
  fileLocationSnapshot?: string;

  @Prop({ required: false, type: String, default: '' })
  timetableSnapshot?: string;

  @Prop({ required: false, type: Boolean, default: false })
  isBotCheckSnapshot?: boolean;

  @Prop({ required: false, type: String, default: '' })
  botTriggerTimeSnapshot?: string;
}

export const ShiftLogDetailSchema =
  SchemaFactory.createForClass(ShiftLogDetail);

@Schema({ timestamps: true })
export class ShiftLog extends Document {
  @Prop({ type: Types.ObjectId, ref: 'ChecklistTemplate', required: true })
  templateId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, default: null })
  userId?: Types.ObjectId | null; // User who initialized the shift (nullable for system cron)

  @Prop({
    type: Types.ObjectId,
    ref: 'ShiftSlot',
    required: false,
    default: null,
  })
  shiftSlotId?: Types.ObjectId | null;

  @Prop({
    type: Types.ObjectId,
    ref: 'Department',
    required: false,
    default: null,
  })
  departmentId?: Types.ObjectId | null;

  @Prop({ required: true, index: true })
  shiftDate: string; // YYYY-MM-DD

  @Prop({ required: true, enum: ['PENDING', 'COMPLETED'], default: 'PENDING' })
  status: string;

  @Prop({ required: true, type: Number, default: 0.0 })
  progressPercentage: number;

  @Prop({ type: [ShiftLogDetailSchema], default: [] })
  details: ShiftLogDetail[];

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  closedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  closedAt?: Date | null;

  @Prop({ type: String, default: null })
  handoverNote?: string | null;

  @Prop({
    required: true,
    enum: ['SYSTEM_CRON', 'MANUAL_ADMIN', 'MANUAL_USER'],
    default: 'MANUAL_USER',
  })
  creationSource: string;

  @Prop({ required: true, enum: ['USER', 'SYSTEM'], default: 'USER' })
  createdByType: string;
}

export const ShiftLogSchema = SchemaFactory.createForClass(ShiftLog);
ShiftLogSchema.virtual('id').get(function (this: ShiftLog) {
  return this._id.toHexString();
});
ShiftLogSchema.set('toJSON', { virtuals: true });
ShiftLogSchema.set('toObject', { virtuals: true });
