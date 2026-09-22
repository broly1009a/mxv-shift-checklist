import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'ccp_lot_run_histories',
})
export class CcpLotRunHistory extends Document {
  /** Ngày phiên giao dịch, dạng 'YYYY-MM-DD' */
  @Prop({ required: true, index: true })
  sessionDate: string;

  /** Loại hành động: PROCESS = tổng hợp, WRITE = ghi lũy kế */
  @Prop({ required: true, enum: ['PROCESS', 'WRITE'] })
  action: 'PROCESS' | 'WRITE';

  /** Kết quả tổng hợp (CcpLotResult serialized) */
  @Prop({ type: Object, required: true })
  result: Record<string, any>;

  /** Log ghi file lũy kế (chỉ khi action = 'WRITE') */
  @Prop({ type: [String], default: [] })
  accumulatorLogs: string[];

  /** Đường dẫn file đã ghi (chỉ khi action = 'WRITE') */
  @Prop({ type: Object })
  accumulatorPaths?: Record<string, string>;

  /** User thực hiện */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  /** Tên user (cached để hiển thị nhanh) */
  @Prop()
  username?: string;

  /** Đường dẫn file JSON backup trên ổ đĩa (nếu ghi thành công) */
  @Prop()
  jsonBackupPath?: string;

  createdAt: Date;
}

export const CcpLotRunHistorySchema = SchemaFactory.createForClass(CcpLotRunHistory);

// Compound index: truy vấn theo ngày + sắp xếp mới nhất trước
CcpLotRunHistorySchema.index({ sessionDate: 1, createdAt: -1 });

// TTL Index: tự động xóa bản ghi cũ hơn 180 ngày (6 tháng)
CcpLotRunHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

CcpLotRunHistorySchema.virtual('id').get(function (this: CcpLotRunHistory) {
  return this._id.toHexString();
});
CcpLotRunHistorySchema.set('toJSON', { virtuals: true });
CcpLotRunHistorySchema.set('toObject', { virtuals: true });
