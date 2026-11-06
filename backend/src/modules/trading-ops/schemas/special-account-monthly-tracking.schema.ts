import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'special_account_monthly_tracking', timestamps: true })
export class SpecialAccountMonthlyTracking extends Document {
  /** Tháng năm theo dõi, định dạng 'YYYY-MM' (ví dụ: '2026-09') */
  @Prop({ required: true, index: true })
  monthYear: string;

  /** Phân loại sản phẩm chuyên biệt: SPREAD, LME, OPTIONS */
  @Prop({ required: true, enum: ['SPREAD', 'LME', 'OPTIONS'], index: true })
  category: 'SPREAD' | 'LME' | 'OPTIONS';

  /** Mã TVKD 3 số (ví dụ: '045', '001') */
  @Prop({ required: true, index: true })
  tvkdCode: string;

  /** Tên đầy đủ TVKD (ví dụ: 'Hàng hoá ĐNÁ - 045') */
  @Prop({ required: true })
  tvkdFullName: string;

  /** Số lượng TKGD Active tính đến hết tháng trước (Cột F) */
  @Prop({ required: true, default: 0 })
  activeBeforeMonth: number;

  /** Số lượng TKGD Active phát sinh mới trong tháng này (Cột G) */
  @Prop({ required: true, default: 0 })
  newActiveInMonth: number;

  /** Tổng số lượng TKGD Active lũy kế (Cột H = F + G) */
  @Prop({ required: true, default: 0 })
  totalActiveCumulative: number;
}

export const SpecialAccountMonthlyTrackingSchema = SchemaFactory.createForClass(SpecialAccountMonthlyTracking);
SpecialAccountMonthlyTrackingSchema.index({ monthYear: 1, category: 1, tvkdCode: 1 }, { unique: true });

