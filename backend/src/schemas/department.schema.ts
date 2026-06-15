import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Department extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  code: string; // e.g., 'IT_CORE', 'RE_OPS', 'MARKET_SURV'

  @Prop({ type: Types.ObjectId, ref: 'Division', required: false, default: null })
  divisionId?: Types.ObjectId | null;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
DepartmentSchema.virtual('id').get(function (this: Department) {
  return this._id.toHexString();
});
DepartmentSchema.set('toJSON', { virtuals: true });
DepartmentSchema.set('toObject', { virtuals: true });
