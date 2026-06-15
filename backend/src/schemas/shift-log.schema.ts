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
}

export const ShiftLogDetailSchema = SchemaFactory.createForClass(ShiftLogDetail);

@Schema({ timestamps: true })
export class ShiftLog extends Document {
  @Prop({ type: Types.ObjectId, ref: 'ChecklistTemplate', required: true })
  templateId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId; // User who initialized the shift

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
}

export const ShiftLogSchema = SchemaFactory.createForClass(ShiftLog);
ShiftLogSchema.virtual('id').get(function (this: ShiftLog) {
  return this._id.toHexString();
});
ShiftLogSchema.set('toJSON', { virtuals: true });
ShiftLogSchema.set('toObject', { virtuals: true });
