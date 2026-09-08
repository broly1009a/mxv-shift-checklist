import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type TkgdUserConfigDocument = TkgdUserConfig & Document;

export class MSystemCredentialsSubDoc {
  @Prop({ default: '' })
  username: string;

  @Prop({ default: '' })
  passwordEncrypted: string;

  @Prop({ default: '' })
  pinEncrypted: string;
}

export class OutlookConfigSubDoc {
  @Prop({ default: 'clearing.acc@mxv.vn' })
  targetMailbox: string;

  @Prop({ default: '' })
  refreshToken: string;

  @Prop({ default: '' })
  clientId: string;

  @Prop({ default: '' })
  tenantId: string;

  @Prop({ default: '' })
  clientSecret: string;

  @Prop({ default: '' })
  authorizedEmail: string;

  @Prop({ default: '' })
  tokenRenewedAt: string;
}

export class StorageConfigSubDoc {
  @Prop({ default: 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD' })
  windowsPath: string;

  @Prop({ default: '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD' })
  linuxPath: string;

  @Prop({ default: '' })
  templatePath: string;
}

export class PreferencesSubDoc {
  @Prop({ default: true })
  autoHighlightExcel: boolean;

  @Prop({ default: true })
  saveToAtlas: boolean;
}

export class DocumentProcessingConfigSubDoc {
  @Prop({ default: true })
  autoDownloadMailAttachments: boolean; // Tự động tải tệp đính kèm & ảnh từ Mail về thư mục

  @Prop({ default: true })
  autoSaveMSystemImages: boolean; // Tự động bóc tách & lưu ảnh CCCD, Chữ ký từ M-System

  @Prop({ default: '' })
  attachmentSavePath: string; // Thư mục lưu riêng nếu muốn, để trống = lưu theo M:\.../HoSo_DinhKem

  @Prop({ default: true })
  autoExtractPdf: boolean; // Tự động đọc nội dung PDF Hợp đồng & Phụ lục PL01

  @Prop({ default: true })
  enableOcrCccd: boolean; // Tự động quét OCR nhận diện ảnh CCCD

  @Prop({ default: true })
  enableTripleCheckCccd: boolean; // Bật đối chiếu chéo 3 chiều (Ảnh Mail vs Ảnh MS vs Form MS)

  @Prop({ default: true })
  checkSignatureRequired: boolean; // Cảnh báo nếu chưa có chữ ký mẫu trên M-System
}

export class AutoPipelineConfigSubDoc {
  @Prop({ default: false })
  enabled: boolean; // Bật/Tắt chế độ tự động 24/7

  @Prop({ default: 5 })
  intervalMinutes: number; // Chu kỳ quét (mặc định 5 phút)

  @Prop({ default: 50 })
  batchSize: number; // Số lượng hồ sơ mỗi mẻ

  @Prop({ default: true })
  autoSyncMSystem: boolean; // Tự động cào M-System sau khi bóc tách mail

  @Prop({ default: true })
  autoExportExcel: boolean; // Tự động cập nhật file Excel hàng ngày

  @Prop({ default: 0 })
  lastRunTime: number; // Timestamp lần chạy gần nhất

  @Prop({ default: 0 })
  lastProcessedCount: number; // Số hồ sơ xử lý được trong lần gần nhất
}

@Schema({ timestamps: true, collection: 'tkgd_user_configs' })
export class TkgdUserConfig {
  @Prop({ required: true, unique: true, index: true })
  userEmail: string;

  @Prop({ required: true })
  fullName: string;

  @Prop({ default: 'Thanh toán bù trừ' })
  department: string;

  @Prop({ type: MSystemCredentialsSubDoc, default: () => ({}) })
  msystem: MSystemCredentialsSubDoc;

  @Prop({ type: OutlookConfigSubDoc, default: () => ({}) })
  outlook: OutlookConfigSubDoc;

  @Prop({ type: StorageConfigSubDoc, default: () => ({}) })
  storage: StorageConfigSubDoc;

  @Prop({ type: PreferencesSubDoc, default: () => ({}) })
  preferences: PreferencesSubDoc;

  @Prop({ type: DocumentProcessingConfigSubDoc, default: () => ({}) })
  documentProcessing: DocumentProcessingConfigSubDoc;

  @Prop({ type: AutoPipelineConfigSubDoc, default: () => ({}) })
  autoPipeline: AutoPipelineConfigSubDoc;

  @Prop({ default: true })
  isActive: boolean;
}

export const TkgdUserConfigSchema = SchemaFactory.createForClass(TkgdUserConfig);
