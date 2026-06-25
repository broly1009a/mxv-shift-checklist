import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'system_settings' })
export class SystemSetting extends Document {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop({ required: true, type: String })
  value: string;
}

export const SystemSettingSchema = SchemaFactory.createForClass(SystemSetting);
SystemSettingSchema.virtual('id').get(function (this: SystemSetting) {
  return this._id.toHexString();
});
SystemSettingSchema.set('toJSON', { virtuals: true });
SystemSettingSchema.set('toObject', { virtuals: true });
