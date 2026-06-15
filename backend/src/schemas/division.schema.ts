import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Division extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  code: string; // e.g., 'IT_DIVISION', 'TRADE_DIVISION', 'HR_DIVISION'
}

export const DivisionSchema = SchemaFactory.createForClass(Division);
DivisionSchema.virtual('id').get(function (this: Division) {
  return this._id.toHexString();
});
DivisionSchema.set('toJSON', { virtuals: true });
DivisionSchema.set('toObject', { virtuals: true });
