import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TkgdActivityLogDocument = TkgdActivityLog & Document;

@Schema({
  timestamps: true,
  collection: 'tkgd_activity_logs',
})
export class TkgdActivityLog {
  @Prop({ required: true, index: true })
  action: string; // 'SYNC_MAIL' | 'SYNC_MSYSTEM' | 'REPARSE_ACCOUNT' | 'RUN_PIPELINE' | 'RECONCILE' | 'MANUAL_APPROVE' | 'REVERT_APPROVE' | 'CONFIG_UPDATE' | 'AUTO_PIPELINE_RUN'

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  details: string;

  @Prop({
    default: 'SUCCESS',
    enum: ['SUCCESS', 'FAILED', 'WARNING', 'INFO'],
    index: true,
  })
  status: string;

  @Prop({ default: 'clearing.acc@mxv.vn', index: true })
  userEmail: string;

  @Prop({ default: '' })
  userName: string;

  @Prop({ default: '' })
  ipAddress: string;

  @Prop({ default: '' })
  userAgent: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const TkgdActivityLogSchema = SchemaFactory.createForClass(TkgdActivityLog);
TkgdActivityLogSchema.index({ createdAt: -1 });
TkgdActivityLogSchema.index({ action: 1, createdAt: -1 });
TkgdActivityLogSchema.index({ userEmail: 1, createdAt: -1 });
TkgdActivityLogSchema.virtual('id').get(function (this: TkgdActivityLogDocument) {
  return this._id?.toHexString();
});
TkgdActivityLogSchema.set('toJSON', { virtuals: true });
TkgdActivityLogSchema.set('toObject', { virtuals: true });
