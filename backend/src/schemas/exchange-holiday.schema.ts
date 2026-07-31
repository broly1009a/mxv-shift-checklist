import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'exchange_holidays' })
export class ExchangeHoliday extends Document {
  @Prop({ required: true, index: true })
  exchangeCode: string;

  @Prop({ required: true, index: true })
  date: string; // Format: YYYY-MM-DD or *-MM-DD

  @Prop({ required: true, type: Boolean, default: true })
  isClosed: boolean; // true = Closed, false = Early Close

  @Prop({ required: false, type: String, default: '' })
  closeTime?: string; // Format: HH:mm (e.g. "12:00")

  @Prop({ required: false, type: String, default: '' })
  note?: string;
}

export const ExchangeHolidaySchema = SchemaFactory.createForClass(ExchangeHoliday);
ExchangeHolidaySchema.virtual('id').get(function (this: ExchangeHoliday) {
  return this._id.toHexString();
});
ExchangeHolidaySchema.set('toJSON', { virtuals: true });
ExchangeHolidaySchema.set('toObject', { virtuals: true });
