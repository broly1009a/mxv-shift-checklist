import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs' })
export class AuditLog extends Document {
  @Prop({ type: Types.ObjectId, ref: 'ShiftLog', required: true, index: true })
  shiftLogId: Types.ObjectId;

  @Prop({ required: true })
  taskId: string;

  @Prop({ required: true })
  taskName: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['CHECK', 'UNCHECK', 'NOTE_UPDATE', 'INCIDENT_CREATED', 'INCIDENT_RESOLVED', 'ADD_TASK'] })
  action: 'CHECK' | 'UNCHECK' | 'NOTE_UPDATE' | 'INCIDENT_CREATED' | 'INCIDENT_RESOLVED' | 'ADD_TASK';

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
