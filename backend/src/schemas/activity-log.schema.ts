import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ActivityLog extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false, default: null, index: true })
  userId?: Types.ObjectId | null;

  @Prop({ required: true })
  action: string; // e.g. 'POST /api/v1/departments', 'PUT /api/v1/users/id'

  @Prop({ required: true })
  details: string; // JSON string containing body/params/response metadata

  @Prop()
  ipAddress: string;

  @Prop()
  userAgent: string;

  createdAt: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
ActivityLogSchema.virtual('id').get(function (this: ActivityLog) {
  return this._id.toHexString();
});
ActivityLogSchema.set('toJSON', { virtuals: true });
ActivityLogSchema.set('toObject', { virtuals: true });
