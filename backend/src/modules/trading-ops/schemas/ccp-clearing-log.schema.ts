import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'ccp_clearing_logs' })
export class CcpClearingLog extends Document {
  @Prop({ required: true, index: true })
  tradingDate: string; // YYYY-MM-DD

  @Prop({ required: false, index: true })
  shiftLogId?: string;

  @Prop({ required: false, index: true })
  taskId?: string;

  @Prop({ required: true, default: false })
  passed: boolean;

  @Prop({ type: Object, default: {} })
  summary: Record<string, any>;

  @Prop({ type: Array, default: [] })
  byProduct: Array<{ maSP: string; klm: number; klb: number; total: number }>;

  @Prop({ type: Array, default: [] })
  byTvkd: Array<{ tvkd: string; klm: number; klb: number; total: number }>;

  @Prop({ type: Array, default: [] })
  validations: Array<{ field: string; expected: number; actual: number; passed: boolean }>;

  createdAt: Date;
  updatedAt: Date;
}

export const CcpClearingLogSchema = SchemaFactory.createForClass(CcpClearingLog);
CcpClearingLogSchema.index({ tradingDate: 1 });
CcpClearingLogSchema.index({ shiftLogId: 1, taskId: 1 });
