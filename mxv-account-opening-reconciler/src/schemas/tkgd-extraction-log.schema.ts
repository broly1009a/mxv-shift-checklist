import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TkgdExtractionLogDocument = TkgdExtractionLog & Document;

@Schema({
  timestamps: true,
  collection: 'tkgd_extraction_logs',
})
export class TkgdExtractionLog {
  @Prop({ required: true, index: true })
  maTKGD: string; // Mã TKGD cụ thể (vd: 085C0453406)

  @Prop({ index: true })
  batchDate?: string; // Ngày đối soát (vd: 2026-09-30)

  @Prop({
    required: true,
    enum: [
      'MAIL_INGEST',       // Nạp & bóc tách email Outlook
      'EXTRACT_CONTRACT',  // Trích xuất PDF Hợp đồng
      'EXTRACT_CCCD',      // Bóc tách OCR / QR / MRZ ảnh CCCD
      'SCRAPE_MSYSTEM',    // Cào dữ liệu từ M-System (bao gồm raw inputs)
      'RECONCILE',         // Đối soát chéo 3 bên & Ra kết luận
      'MANUAL_OVERRIDE',   // Phê duyệt thủ công
    ],
    index: true,
  })
  stage: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  details: string;

  @Prop({
    default: 'SUCCESS',
    enum: ['SUCCESS', 'WARNING', 'ERROR', 'INFO'],
    index: true,
  })
  status: string;

  @Prop({ type: Object, default: {} })
  extractedData?: Record<string, any>; // Dữ liệu có cấu trúc bóc tách được

  @Prop({ type: [String], default: [] })
  rawInputsLog?: string[]; // Mảng raw log thô của màn hình (vd: [Tên thành viên]="Phú Quý", [Số CMT]="001305005055"...)

  @Prop({ default: '' })
  rawText?: string; // Đoạn text thô (OCR raw text hoặc PDF raw text)

  @Prop({ default: 0 })
  durationMs?: number; // Thời gian chạy bước này (ms)

  @Prop({ default: 'SYSTEM' })
  performer?: string; // Người thực hiện: SYSTEM, CRAWLER, hoặc user email
}

export const TkgdExtractionLogSchema = SchemaFactory.createForClass(TkgdExtractionLog);
TkgdExtractionLogSchema.index({ maTKGD: 1, createdAt: 1 });
TkgdExtractionLogSchema.index({ batchDate: 1, stage: 1 });
TkgdExtractionLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 3600 }); // Tự động dọn dẹp sau 180 ngày (Enterprise TTL)
TkgdExtractionLogSchema.virtual('id').get(function (this: TkgdExtractionLogDocument) {
  return this._id?.toHexString();
});
TkgdExtractionLogSchema.set('toJSON', { virtuals: true });
TkgdExtractionLogSchema.set('toObject', { virtuals: true });
