import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ShiftSlot } from './shift-slot.schema';

@Schema({ _id: false })
export class TaskItem {
  @Prop({ required: true })
  taskId: string;

  @Prop({ required: true })
  taskName: string;

  @Prop({ required: true, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  priority: string;

  @Prop({ required: true, type: Number })
  sortOrder: number;

  @Prop({ required: false, type: String })
  deadline?: string;

  @Prop({ required: false, type: String, default: '' })
  functionUrl?: string;

  @Prop({ required: false, type: String, default: '' })
  urdReference?: string;

  @Prop({ required: false, type: String, default: '' })
  fileLocation?: string;

  @Prop({ required: false, type: String, default: '' })
  timetable?: string;

  @Prop({ required: false, type: Boolean, default: false })
  isBotCheck?: boolean;

  @Prop({ required: false, type: String, default: '' })
  botTriggerTime?: string;

  @Prop({ required: false, type: String, default: '' })
  botCheckType?: string;

  @Prop({ required: false, type: String, default: '' })
  botCheckTarget?: string;

  @Prop({ required: false, type: String, default: '' })
  botSuccessCondition?: string;

  @Prop({ required: false, type: String, default: '' })
  botFailureAction?: string;

  @Prop({ required: false, type: String, default: null })
  sessionType?: string | null;

  @Prop({ required: false, type: String, default: null })
  triggerTime?: string | null;

  @Prop({ required: false, type: String, default: null })
  slaDeadline?: string | null;

  @Prop({ required: false, type: String, default: null })
  slaWindowStart?: string | null;

  @Prop({ required: false, type: String, default: null })
  slaWindowEnd?: string | null;

  @Prop({ required: false, type: String, default: '' })
  actionDescription?: string;

  @Prop({ required: false, type: String, default: '' })
  exceptionCode?: string;

  @Prop({ required: false, type: Number, default: null })
  frequencyMinutes?: number | null;

  @Prop({ required: false, type: String, default: '' })
  recurrenceGroupId?: string;

  @Prop({ required: false, type: [String], default: [] })
  dependsOnTaskIds?: string[];

  @Prop({ required: false, type: String, enum: ['FIXED_TIME', 'DYNAMIC_AFTER_TASK'], default: 'FIXED_TIME' })
  slaType?: string;
}

export const TaskItemSchema = SchemaFactory.createForClass(TaskItem);

@Schema({ timestamps: true, collection: 'checklist_templates' })
export class ChecklistTemplate extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: true })
  departmentId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'ShiftSlot',
    required: false,
    default: null,
  })
  shiftSlotId?: Types.ObjectId | null;

  @Prop({ required: true, enum: ['OPEN', 'DURING', 'CLOSE'] })
  sessionType: string;

  @Prop({ required: true, type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: [TaskItemSchema], default: [] })
  tasks: TaskItem[];
}

export const ChecklistTemplateSchema =
  SchemaFactory.createForClass(ChecklistTemplate);
ChecklistTemplateSchema.virtual('id').get(function (this: ChecklistTemplate) {
  return this._id.toHexString();
});
ChecklistTemplateSchema.set('toJSON', { virtuals: true });
ChecklistTemplateSchema.set('toObject', { virtuals: true });
