/**
 * partner-auth-telemetry.schema.ts
 *
 * Mongoose Schema cho việc lưu trữ dữ liệu Telemetry truy cập đối tác.
 * Tự động thu hồi và dọn rác bằng TTL Index sau 7 ngày để tối ưu lưu trữ.
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PartnerAuthTelemetryDocument = PartnerAuthTelemetry & Document;

@Schema({
  collection: 'partner_auth_telemetries',
  timestamps: false,
})
export class PartnerAuthTelemetry {
  @Prop({
    type: String,
    required: true,
    enum: ['CORECCP', 'COREEX', 'MS', 'CQG', 'ACM'],
    index: true,
  })
  partner: string;

  @Prop({
    type: String,
    required: true,
    enum: ['LOGIN', 'REFRESH_TOKEN', 'API_REQUEST', 'SFTP_CONNECT', 'CIRCUIT_BREAKER'],
  })
  eventType: string;

  @Prop({ required: true, default: true })
  success: boolean;

  @Prop({ required: false })
  statusCode?: number;

  @Prop({ required: true, default: 0 })
  durationMs: number;

  @Prop({ required: false })
  account?: string;

  @Prop({ required: false })
  errorMessage?: string;

  @Prop({ type: Object, required: false })
  metadata?: Record<string, any>;

  @Prop({ required: true, default: Date.now, index: true })
  timestamp: Date;
}

export const PartnerAuthTelemetrySchema = SchemaFactory.createForClass(PartnerAuthTelemetry);

// Compound index phục vụ truy vấn telemetry theo đối tác và thời gian
PartnerAuthTelemetrySchema.index({ partner: 1, timestamp: -1 });

// TTL Index: Tự động xóa bản ghi sau 7 ngày (604,800 giây)
PartnerAuthTelemetrySchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 },
);
