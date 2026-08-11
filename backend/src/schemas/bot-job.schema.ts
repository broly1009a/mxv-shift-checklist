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

  @Prop({
    type: MongooseSchema.Types.Map,
    of: MongooseSchema.Types.Mixed,
    default: {},
  })
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

// ──────────────────────────────────────────────────────────────────────────────
// Indexes: giải quyết lỗi "Sort exceeded memory limit" khi query + sort trên
// collection bot_jobs lớn mà không có index hỗ trợ (MongoDB in-memory sort = 32MB limit).
// ──────────────────────────────────────────────────────────────────────────────

// (1) Dùng cho: .find(query).sort({ createdAt: -1 }) và .sort({ createdAt: 1 })
//     → GET /jobs, processQueue(), poll()
BotJobSchema.index({ createdAt: -1 });

// (2) Dùng cho: .find({ status, jobType }).sort({ createdAt: 1 })
//     → processQueue() với jobFilter, poll() với REMOTE_JOB_TYPES
BotJobSchema.index({ status: 1, createdAt: 1 });
BotJobSchema.index({ status: 1, jobType: 1, createdAt: 1 });

// (3) Dùng cho: getJobForTask() tìm theo payload.taskId + payload.shiftLogId + sort
//     MongoDB không index nested Map fields trực tiếp; dùng toán tử trên
//     các field được flatten khi ghi vào payload document.
BotJobSchema.index({ 'payload.taskId': 1, 'payload.shiftLogId': 1, createdAt: -1 });

// (4) TTL index: Tự động xóa các job đã hoàn thành/thất bại sau 90 ngày
//     để collection không tăng vô hạn. PENDING/PROCESSING sẽ không bị xóa
//     vì Mongoose TTL chỉ xóa khi field tồn tại và đã quá hạn.
BotJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 ngày
