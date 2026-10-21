import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'trading_recon_logs' })
export class TradingReconLog extends Document {
  @Prop({ required: true, index: true })
  reconType: 'KLGD' | 'DSGD_BEFORE_EOD' | 'NEGATIVE_MARGIN' | 'SOD_RECON' | 'CQG_SYNC' | 'EOD_MS' | string;

  @Prop({ required: true, index: true })
  tradingDate: string; // YYYY-MM-DD

  @Prop({ required: false, index: true })
  shiftLogId?: string;

  @Prop({ required: false, index: true })
  taskId?: string;

  @Prop({ required: true, default: false })
  passed: boolean;

  @Prop({ type: Object, default: {} })
  totals: Record<string, any>;

  @Prop({ type: Object, default: null })
  dsgdBeforeEod?: Record<string, any>;

  @Prop({ type: Array, default: [] })
  mismatchedTrades: Array<{
    source: string;
    maLenh?: string;
    maTKGD: string;
    maHD: string;
    giaKhop: number;
    klGiaoDich: number;
    ngayGio: string;
    reason: string;
  }>;

  @Prop({ type: Array, default: [] })
  mismatchedPositions: Array<{
    account: string;
    symbol: string;
    msPosition: number;
    cqgPosition: number;
    differ: number;
  }>;

  @Prop({ type: Array, default: [] })
  negativeMarginAccounts: Array<{ account: string; margin: number }>;

  @Prop({ type: Date, default: null })
  cutoffTime?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const TradingReconLogSchema = SchemaFactory.createForClass(TradingReconLog);
TradingReconLogSchema.index({ reconType: 1, tradingDate: 1 });
TradingReconLogSchema.index({ shiftLogId: 1, taskId: 1 });
