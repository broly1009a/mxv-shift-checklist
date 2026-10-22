import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'ce_lot_run_histories',
})
export class CeLotRunHistory extends Document {
  /** Ngày phiên giao dịch, dạng 'YYYY-MM-DD' */
  @Prop({ required: true, index: true })
  sessionDate: string;

  /** Loại hành động: PROCESS = tổng hợp, WRITE = ghi lũy kế */
  @Prop({ required: true, enum: ['PROCESS', 'WRITE'] })
  action: 'PROCESS' | 'WRITE';

  /** Phân loại chạy: 'LOT' | 'VALUE' | 'ALL' */
  @Prop({ enum: ['LOT', 'VALUE', 'ALL'], default: 'LOT' })
  runType?: 'LOT' | 'VALUE' | 'ALL';

  /** Kết quả tổng hợp (CeLotResult serialized) */
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

export const CeLotRunHistorySchema = SchemaFactory.createForClass(CeLotRunHistory);

// Compound index: truy vấn theo ngày + sắp xếp mới nhất trước
CeLotRunHistorySchema.index({ sessionDate: 1, createdAt: -1 });

// TTL Index: tự động xóa bản ghi cũ hơn 180 ngày (6 tháng)
CeLotRunHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

CeLotRunHistorySchema.virtual('id').get(function (this: CeLotRunHistory) {
  return this._id.toHexString();
});
CeLotRunHistorySchema.set('toJSON', { virtuals: true });
CeLotRunHistorySchema.set('toObject', { virtuals: true });
