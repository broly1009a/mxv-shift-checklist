import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class SystemLog extends Document {
  @Prop({ required: true, index: true })
  eventType: string;

  @Prop({
    required: true,
    enum: ['SYSTEM', 'CRON', 'USER', 'NOTIFICATION', 'BOT_PLACEHOLDER'],
    index: true,
  })
  source: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  actorUserId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'ShiftLog', default: null, index: true })
  jobId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Department', default: null, index: true })
  departmentId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'ShiftSlot', default: null, index: true })
  shiftSlotId?: Types.ObjectId | null;

  @Prop({ required: true, enum: ['SUCCESS', 'FAILED', 'SKIPPED'], index: true })
  status: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Map, of: SchemaFactory.createForClass(Object), default: {} })
  metadata: Map<string, any>;

  createdAt: Date;
}

export const SystemLogSchema = SchemaFactory.createForClass(SystemLog);
SystemLogSchema.virtual('id').get(function (this: SystemLog) {
  return this._id.toHexString();
});
SystemLogSchema.set('toJSON', { virtuals: true });
SystemLogSchema.set('toObject', { virtuals: true });
