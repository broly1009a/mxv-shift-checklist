import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'exchange_rates' })
export class ExchangeRate extends Document {
  @Prop({ required: true })
  fromCurrency: string; // e.g. USD, JPY, MYR

  @Prop({ required: true, default: 'VND' })
  toCurrency: string;

  @Prop({ required: true, type: Number })
  rate: number;

  @Prop({ required: true, type: Date })
  effectiveFrom: Date;

  @Prop({ type: Date })
  effectiveTo?: Date;
}

export const ExchangeRateSchema = SchemaFactory.createForClass(ExchangeRate);
ExchangeRateSchema.virtual('id').get(function (this: ExchangeRate) {
  return this._id.toHexString();
});
ExchangeRateSchema.set('toJSON', { virtuals: true });
ExchangeRateSchema.set('toObject', { virtuals: true });
