import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true, collection: 'bot_jobs' })
export class BotJob extends Document {
  @Prop({ required: true, index: true })
  jobType: string; // e.g., 'RPA_DOWNLOAD_ALL', 'RPA_DOWNLOAD_NKTTHT', etc.

  @Prop({ required: true, default: 'PENDING', index: true })
  status: string; // 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

  @Prop({ required: true, default: 0 })
  attempts: number;

  @Prop({ required: true, default: 3 })
  maxAttempts: number;

  @Prop({ type: [String], default: [] })
  logs: string[];

  @Prop({ type: MongooseSchema.Types.Map, of: MongooseSchema.Types.Mixed, default: {} })
  payload: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export const BotJobSchema = SchemaFactory.createForClass(BotJob);
BotJobSchema.virtual('id').get(function (this: BotJob) {
  return this._id.toHexString();
});
BotJobSchema.set('toJSON', { virtuals: true });
BotJobSchema.set('toObject', { virtuals: true });
