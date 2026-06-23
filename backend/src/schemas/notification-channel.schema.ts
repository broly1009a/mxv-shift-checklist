import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class NotificationChannel extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ required: true, enum: ['TELEGRAM', 'EMAIL', 'WEB'], index: true })
  type: string;

  @Prop({ required: true, type: Boolean, default: true, index: true })
  isActive: boolean;

  @Prop({ type: Map, of: String, default: {} })
  config: Map<string, any>;
}

export const NotificationChannelSchema =
  SchemaFactory.createForClass(NotificationChannel);
NotificationChannelSchema.virtual('id').get(function (this: NotificationChannel) {
  return this._id.toHexString();
});
NotificationChannelSchema.set('toJSON', { virtuals: true });
NotificationChannelSchema.set('toObject', { virtuals: true });
