import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class SlaPolicy extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'Department', default: null, index: true })
  departmentId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'ShiftSlot', default: null, index: true })
  shiftSlotId?: Types.ObjectId | null;

  @Prop({ required: false, type: String, default: null, index: true })
  taskPriority?: string | null;

  @Prop({ required: true, type: Number })
  thresholdMinutes: number;

  @Prop({ required: true, type: Boolean, default: true, index: true })
  isActive: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'NotificationRule' }], default: [] })
  notificationRuleIds: Types.ObjectId[];
}

export const SlaPolicySchema = SchemaFactory.createForClass(SlaPolicy);
SlaPolicySchema.virtual('id').get(function (this: SlaPolicy) {
  return this._id.toHexString();
});
SlaPolicySchema.set('toJSON', { virtuals: true });
SlaPolicySchema.set('toObject', { virtuals: true });
