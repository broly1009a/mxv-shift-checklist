import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class NotificationLog extends Document {
  @Prop({ required: true, index: true })
  eventType: string;

  @Prop({ required: true, index: true })
  channelType: string;

  @Prop({ type: Types.ObjectId, ref: 'NotificationChannel', default: null, index: true })
  channelId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'NotificationRule', default: null, index: true })
  ruleId?: Types.ObjectId | null;

  @Prop({ required: true, index: true })
  recipient: string;

  @Prop({
    required: true,
    enum: ['PENDING', 'SENT', 'FAILED', 'SKIPPED'],
    index: true,
  })
  status: string;

  @Prop({ type: Map, of: SchemaFactory.createForClass(Object), default: {} })
  payload: Map<string, any>;

  @Prop({ required: false, type: String, default: null })
  errorMessage?: string | null;

  @Prop({ type: Date, default: null })
  sentAt?: Date | null;
}

export const NotificationLogSchema =
  SchemaFactory.createForClass(NotificationLog);
NotificationLogSchema.virtual('id').get(function (this: NotificationLog) {
  return this._id.toHexString();
});
NotificationLogSchema.set('toJSON', { virtuals: true });
NotificationLogSchema.set('toObject', { virtuals: true });
