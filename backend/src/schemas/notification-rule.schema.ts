import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class RuleTemplate {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;
}

const RuleTemplateSchema = SchemaFactory.createForClass(RuleTemplate);

@Schema({ timestamps: true, collection: 'notification_rules' })
export class NotificationRule extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ required: true, index: true })
  eventType: string;

  @Prop({ type: Types.ObjectId, ref: 'Department', default: null, index: true })
  departmentId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'ShiftSlot', default: null, index: true })
  shiftSlotId?: Types.ObjectId | null;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'NotificationChannel' }], default: [] })
  channelIds: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  recipientUsers?: Types.ObjectId[];

  @Prop({ type: [String], default: [] })
  recipientRoles?: string[];

  @Prop({ required: true, type: Boolean, default: true, index: true })
  isActive: boolean;

  @Prop({ type: Map, of: SchemaFactory.createForClass(Object), default: {} })
  conditions: Map<string, any>;

  @Prop({ type: RuleTemplateSchema, required: true })
  template: RuleTemplate;
}

export const NotificationRuleSchema =
  SchemaFactory.createForClass(NotificationRule);
NotificationRuleSchema.virtual('id').get(function (this: NotificationRule) {
  return this._id.toHexString();
});
NotificationRuleSchema.set('toJSON', { virtuals: true });
NotificationRuleSchema.set('toObject', { virtuals: true });
