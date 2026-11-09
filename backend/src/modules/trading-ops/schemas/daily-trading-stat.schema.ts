import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'daily_trading_stats', timestamps: true })
export class DailyTradingStat extends Document {
  /** Ngày giao dịch, định dạng 'YYYY-MM-DD' */
  @Prop({ required: true, index: true })
  date: string;

  /** Phân hệ giao dịch: CQG (Quốc tế) hoặc ACM (Straits Financial) */
  @Prop({ required: true, enum: ['CQG', 'ACM'], index: true })
  system: 'CQG' | 'ACM';

  /** Mã TVKD 3 chữ số: '080', '003', '012'... */
  @Prop({ required: true, index: true })
  tvkdCode: string;

  /** Tên rút gọn TVKD: 'APEX', 'Gia Cát Lợi'... */
  @Prop({ required: true })
  tvkdName: string;

  /** Mã mặt hàng cơ sở (Symbol chuẩn): 'ZCE', 'SI5CO', 'CLE'... */
  @Prop({ required: true, index: true })
  productCode: string;

  /** Tên tiếng Việt quy chuẩn của mặt hàng: 'Ngô', 'Bạc Nano ACM'... */
  @Prop({ required: true })
  productNameVi: string;

  /** Khối lượng mua khớp (Số lot) */
  @Prop({ required: true, default: 0 })
  lotBuy: number;

  /** Khối lượng bán khớp (Số lot) */
  @Prop({ required: true, default: 0 })
  lotSell: number;

  /** Tổng khối lượng khớp (Số lot = lotBuy + lotSell) */
  @Prop({ required: true, default: 0 })
  lotTotal: number;

  /** Giá trị giao dịch quy đổi VND */
  @Prop({ required: true, default: 0 })
  gtgdVnd: number;

  /** Cờ phân loại: Hợp đồng chênh lệch giá Spread (Tài khoản đuôi -S) */
  @Prop({ default: false, index: true })
  isSpread: boolean;

  /** Cờ phân loại: Sở Kim loại London LME (Tài khoản đuôi L / -L) */
  @Prop({ default: false, index: true })
  isLme: boolean;

  /** Cờ phân loại: Hợp đồng Quyền chọn Options (Mã HĐ C. / P.) */
  @Prop({ default: false, index: true })
  isOptions: boolean;
}

export const DailyTradingStatSchema = SchemaFactory.createForClass(DailyTradingStat);
DailyTradingStatSchema.index({ date: 1, system: 1, tvkdCode: 1 });
DailyTradingStatSchema.index({ date: 1, productCode: 1 });
DailyTradingStatSchema.index({ date: 1, isSpread: 1 });
DailyTradingStatSchema.index({ date: 1, isLme: 1 });
DailyTradingStatSchema.index({ date: 1, isOptions: 1 });

