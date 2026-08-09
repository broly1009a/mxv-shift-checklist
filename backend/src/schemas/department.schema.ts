import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'departments' })
export class Department extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  code: string; // e.g., 'IT_CORE', 'RE_OPS', 'MARKET_SURV'

  @Prop({ type: Types.ObjectId, ref: 'Department', required: false, default: null })
  parentDepartmentId?: Types.ObjectId | null;

  @Prop({ required: true, type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: [String], default: [] })
  monitoredExchanges: string[]; // e.g., ['CME', 'LME', 'ICE_US']
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
DepartmentSchema.virtual('id').get(function (this: Department) {
  return this._id.toHexString();
});
DepartmentSchema.set('toJSON', { virtuals: true });
DepartmentSchema.set('toObject', { virtuals: true });

