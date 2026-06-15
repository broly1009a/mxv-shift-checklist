import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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
}

export const TaskItemSchema = SchemaFactory.createForClass(TaskItem);

@Schema({ timestamps: true })
export class ChecklistTemplate extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: true })
  departmentId: Types.ObjectId;

  @Prop({ required: true, enum: ['OPEN', 'DURING', 'CLOSE'] })
  sessionType: string;

  @Prop({ type: [TaskItemSchema], default: [] })
  tasks: TaskItem[];
}

export const ChecklistTemplateSchema = SchemaFactory.createForClass(ChecklistTemplate);
ChecklistTemplateSchema.virtual('id').get(function (this: ChecklistTemplate) {
  return this._id.toHexString();
});
ChecklistTemplateSchema.set('toJSON', { virtuals: true });
ChecklistTemplateSchema.set('toObject', { virtuals: true });
