import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog extends Document {
  @Prop({ type: Types.ObjectId, ref: 'ShiftLog', required: true, index: true })
  shiftLogId: Types.ObjectId;

  @Prop({ required: true })
  taskId: string;

  @Prop({ required: true })
  taskName: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['CHECK', 'UNCHECK', 'NOTE_UPDATE'] })
  action: 'CHECK' | 'UNCHECK' | 'NOTE_UPDATE';

  @Prop({ required: true })
  details: string;

  createdAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.virtual('id').get(function (this: AuditLog) {
  return this._id.toHexString();
});
AuditLogSchema.set('toJSON', { virtuals: true });
AuditLogSchema.set('toObject', { virtuals: true });
