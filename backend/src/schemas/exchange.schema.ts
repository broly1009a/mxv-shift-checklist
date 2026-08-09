import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'exchanges' })
export class Exchange extends Document {
  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  timezone: string;

  @Prop({ required: false, type: String, default: '' })
  description?: string;
}

export const ExchangeSchema = SchemaFactory.createForClass(Exchange);
ExchangeSchema.virtual('id').get(function (this: Exchange) {
  return this._id.toHexString();
});
ExchangeSchema.set('toJSON', { virtuals: true });
ExchangeSchema.set('toObject', { virtuals: true });
