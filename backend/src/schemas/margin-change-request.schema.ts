import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

@Schema({ timestamps: true })
export class MarginChangeRequest extends Document {
  @Prop({ required: true })
  commodity: string;

  @Prop({ required: true, type: Number })
  oldMargin: number;

  @Prop({ required: true, type: Number })
  newMargin: number;

  @Prop({ required: true })
  effectiveSession: string;

  @Prop({
    required: true,
    enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
    default: 'PENDING_APPROVAL',
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId | User;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  approvedBy?: Types.ObjectId | User | null;

  @Prop({ type: String, default: null })
  rejectionReason?: string | null;

  @Prop({ type: String, default: null })
  comments?: string | null;
}

export const MarginChangeRequestSchema = SchemaFactory.createForClass(MarginChangeRequest);

MarginChangeRequestSchema.virtual('id').get(function (this: MarginChangeRequest) {
  return this._id.toHexString();
});
MarginChangeRequestSchema.set('toJSON', { virtuals: true });
MarginChangeRequestSchema.set('toObject', { virtuals: true });
