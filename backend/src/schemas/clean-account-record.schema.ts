import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CleanAccountRecordDocument = CleanAccountRecord & Document;

// ─── SHEET 1: NoiDungMail ──────────────────────────────────────────────
@Schema({ _id: false })
export class NoiDungMailSubDoc {
  @Prop({ index: true })
  maTKGD_Futures?: string; // Mã TK Futures: 003C2333888

  @Prop({ index: true })
  maTKGD_ACM?: string; // Mã TK ACM: 003C2333888-A

  @Prop({ index: true })
  maTKGD_LME?: string; // Mã TK LME: 003C2333888-L

  @Prop({ index: true })
  maTKGD_Spread?: string; // Mã TK Spread: 003C2333888-S

  @Prop()
  tenTaiKhoan?: string; // Tên tài khoản: Ngô Đức Hải

  @Prop({ default: false })
  hasACMRequest: boolean;

  @Prop({ default: false })
  hasLMERequest: boolean;

  @Prop({ default: false })
  hasSpreadRequest: boolean;

  @Prop()
  ghiChuSoSanh?: string; // 'so sánh mã TKGD với bên HĐ, MS khớp'
}
export const NoiDungMailSubDocSchema = SchemaFactory.createForClass(NoiDungMailSubDoc);


// ─── SHEET 2: Cancuoc (OCR / QR) ───────────────────────────────────────
@Schema({ _id: false })
export class CanCuocSubDoc {
  @Prop()
  hoVaTen?: string; // Họ và tên: Ngô Đức Hải

  @Prop({ index: true })
  soCanCuoc?: string; // Số căn cước 12 số: 031079015563

  @Prop()
  ngaySinh?: Date; // Ngày sinh: 1979-10-13

  @Prop()
  coGiaTriDen?: Date; // Có giá trị đến: 2039-10-13

  @Prop()
  ngayCap?: Date; // Ngày cấp: 2022-08-27

  @Prop()
  noiCap?: string; // Cục Cảnh sát quản lý hành chính về trật tự xã hội

  @Prop()
  diaChiThuongTru?: string;

  @Prop()
  ocrConfidence?: string;
}
export const CanCuocSubDocSchema = SchemaFactory.createForClass(CanCuocSubDoc);

// ─── SHEET 3: HopDong (*-mxv.pdf) ──────────────────────────────────────
@Schema({ _id: false })
export class HopDongSubDoc {
  @Prop({ index: true })
  maTKGD?: string;

  @Prop()
  hoVaTen?: string;

  @Prop()
  soCanCuoc?: string;

  @Prop()
  ngaySinh?: Date;

  @Prop()
  ngayCap?: Date;

  @Prop()
  noiCap?: string;

  @Prop()
  ngayKyHD?: Date;

  @Prop({ default: 'Cá nhân' })
  loaiHinhTaiKhoan?: string;

  @Prop({ default: 'Đã ký' })
  chuKy?: string;

  @Prop()
  ketQua?: string; // 'So sánh với thông tin với căn cước khớp'
}
export const HopDongSubDocSchema = SchemaFactory.createForClass(HopDongSubDoc);

// ─── SHEET 4: Phuluc (*-PL01.pdf) ──────────────────────────────────────
@Schema({ _id: false })
export class PhuLucSubDoc {
  @Prop({ index: true })
  maTKGD?: string;

  @Prop()
  hoVaTen?: string;

  @Prop()
  soCanCuoc?: string;

  @Prop()
  ngaySinh?: Date;

  @Prop()
  ngayCap?: Date;

  @Prop()
  noiCap?: string;

  @Prop()
  ngayKyHD?: Date;

  @Prop({ default: 'Đã ký' })
  chuKy?: string;

  @Prop()
  ketQua?: string;
}
export const PhuLucSubDocSchema = SchemaFactory.createForClass(PhuLucSubDoc);

// ─── SHEET 5: MS (Cào từ M-System Chi Tiết TKGD) ───────────────────────
@Schema({ _id: false })
export class MSSubDoc {
  @Prop({ index: true })
  maTKGD?: string;

  @Prop()
  tenTKGD?: string;

  @Prop()
  hoVaTen?: string;

  @Prop({ index: true })
  soCMND_HoChieu?: string;

  @Prop()
  ngaySinh?: Date;

  @Prop()
  ngayCap?: Date;

  @Prop()
  noiCap?: string;

  @Prop()
  ngayThamGia?: Date;

  @Prop({ default: 'Cá nhân' })
  loaiHinhTaiKhoan?: string;

  @Prop()
  diaChi?: string;

  @Prop()
  trangThai?: string;

  @Prop({ default: 'Đã ký' })
  chuKy?: string;

  @Prop()
  ketQua?: string;

  @Prop({ default: false })
  isFoundOnMS: boolean;
}
export const MSSubDocSchema = SchemaFactory.createForClass(MSSubDoc);

// ─── KHỐI TỔNG HỢP KẾT QUẢ ĐỐI SOÁT ───────────────────────────────────
@Schema({ _id: false })
export class KetLuanDoiSoat {
  @Prop({
    enum: ['KHOP', 'LECH_TEN', 'LECH_CCCD', 'THIEU_ACM', 'CHUA_CO_TREN_MS', 'THIEU_HO_SO', 'CHUA_XU_LY'],
    default: 'CHUA_XU_LY',
    index: true,
  })
  trangThai: string;

  @Prop({ type: [String], default: [] })
  danhSachLoi: string[];

  @Prop()
  reconciledAt?: Date;
}
export const KetLuanDoiSoatSchema = SchemaFactory.createForClass(KetLuanDoiSoat);

// ─── KHỐI SNAPSHOT LƯU VẾT LỊCH SỬ THAY ĐỔI ─────────────────────────
@Schema({ _id: false })
export class RecordSnapshotSubDoc {
  @Prop({ default: () => new Date() })
  snapshotAt: Date;

  @Prop({ default: 'UPDATE' })
  action: string;

  @Prop({ type: Object })
  previousData: Record<string, any>;
}
export const RecordSnapshotSubDocSchema = SchemaFactory.createForClass(RecordSnapshotSubDoc);

// ─── MAIN CLEAN RECORD SCHEMA ──────────────────────────────────────────
@Schema({ timestamps: true, collection: 'clean_account_records' })
export class CleanAccountRecord {
  @Prop({ type: Types.ObjectId, ref: 'RawAccountMail', index: true })
  rawMailId?: Types.ObjectId;

  @Prop({ required: true, index: true })
  batchDate: string; // YYYY-MM-DD

  @Prop({ required: true, index: true })
  maTVKD: string; // 003, 001...

  @Prop({ index: true })
  maTKGD?: string; // Mã đầy đủ: 003C2333888, 003C2333888-A, 003C2333888-L, 003C2333888-S

  @Prop({ index: true })
  maTKGDBase?: string; // Mã gốc: 003C2333888

  @Prop({ enum: ['FUTURES', 'ACM', 'LME', 'SPREAD'], default: 'FUTURES', index: true })
  accountType?: string;

  @Prop({ type: NoiDungMailSubDocSchema, required: true })
  noiDungMail: NoiDungMailSubDoc;


  @Prop({ type: CanCuocSubDocSchema })
  canCuoc?: CanCuocSubDoc;

  @Prop({ type: HopDongSubDocSchema })
  hopDong?: HopDongSubDoc;

  @Prop({ type: PhuLucSubDocSchema })
  phuLuc?: PhuLucSubDoc;

  @Prop({ type: MSSubDocSchema })
  ms?: MSSubDoc;

  @Prop({ type: KetLuanDoiSoatSchema, default: () => ({ trangThai: 'CHUA_XU_LY', danhSachLoi: [] }) })
  ketLuan: KetLuanDoiSoat;

  @Prop({ type: [RecordSnapshotSubDocSchema], default: [] })
  snapshots: RecordSnapshotSubDoc[];
}

export const CleanAccountRecordSchema = SchemaFactory.createForClass(CleanAccountRecord);

