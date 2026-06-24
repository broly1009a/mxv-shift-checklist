import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class IncidentTimelineEvent {
  @Prop({ required: true })
  status: string;

  @Prop({ required: true })
  comment: string;

  @Prop({ required: true, type: Date, default: Date.now })
  timestamp: Date;

  @Prop({ required: true })
  actor: string;
}

export const IncidentTimelineEventSchema = SchemaFactory.createForClass(IncidentTimelineEvent);

@Schema({ timestamps: true })
export class Incident extends Document {
  @Prop({ required: true, index: true })
  code: string;

  @Prop({ required: true, index: true })
  taskId: string;

  @Prop({ type: Types.ObjectId, ref: 'ShiftLog', required: true, index: true })
  shiftLogId: Types.ObjectId;

  @Prop({ required: true, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' })
  severity: string;

  @Prop({ required: true, default: '' })
  requiredAction: string;

  @Prop({ required: true, enum: ['PENDING', 'RESOLVED'], default: 'PENDING', index: true })
  status: string;

  @Prop({ required: true, type: Date, default: Date.now })
  detectedAt: Date;

  @Prop({ type: Date, default: null })
  resolvedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  resolvedBy?: Types.ObjectId | null;

  @Prop({
    type: String,
    required: false,
    enum: ['MISSING_CONFIGURATION', 'MESSAGE_SYNC_LOSS', 'SOFTWARE_BUG', 'NETWORK_DISRUPTION', 'OTHER', null],
    default: null
  })
  rootCause?: string | null;

  @Prop({ required: false, default: '' })
  remediationAction?: string;

  @Prop({ type: [String], default: [] })
  affectedAccounts?: string[];

  @Prop({ type: Date, default: null })
  slaDeadlineAt?: Date | null;

  @Prop({ type: [IncidentTimelineEventSchema], default: [] })
  timeline: IncidentTimelineEvent[];
}

export const IncidentSchema = SchemaFactory.createForClass(Incident);
IncidentSchema.virtual('id').get(function (this: Incident) {
  return this._id.toHexString();
});
IncidentSchema.set('toJSON', { virtuals: true });
IncidentSchema.set('toObject', { virtuals: true });
