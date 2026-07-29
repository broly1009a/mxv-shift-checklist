import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Role extends Document {
  @Prop({ required: true, unique: true })
  code: string; // e.g. 'ADMIN', 'DEPARTMENT_HEAD', 'STAFF', 'CEO', 'CHAIRMAN'

  @Prop({ required: true })
  name: string; // e.g. 'Quản trị viên', 'Trưởng bộ phận', ...

  @Prop({ type: [String], default: [] })
  permissions: string[]; // e.g. ['VIEW_CHECKLIST', 'EDIT_CHECKLIST', 'ACCESS_MARGIN_CHANGE']
}

export const RoleSchema = SchemaFactory.createForClass(Role);
