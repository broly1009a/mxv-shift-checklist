import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'monthly_report_snapshots', timestamps: true })
export class MonthlyReportSnapshot extends Document {
  /** Tháng năm chốt báo cáo, định dạng 'YYYY-MM' (ví dụ: '2026-09') */
  @Prop({ required: true, unique: true, index: true })
  monthYear: string;

  /** Trạng thái báo cáo: DRAFT (Bản nháp), OFFICIAL (Chính thức khóa sổ), HISTORICAL_SEED (Nạp nền tảng) */
  @Prop({
    required: true,
    enum: ['DRAFT', 'OFFICIAL', 'HISTORICAL_SEED'],
    default: 'DRAFT',
  })
  status: 'DRAFT' | 'OFFICIAL' | 'HISTORICAL_SEED';

  /** Dữ liệu Phần I: Tình hình giao dịch theo TVKD (CQG & ACM) */
  @Prop({ type: Object, required: true })
  section1Tvkd: {
    cqg: {
      totalMembers: number;
      items: Array<any>;
      summary: any;
    };
    acm: {
      totalMembers: number;
      items: Array<any>;
      summary: any;
    };
  };

  /** Dữ liệu Phần II: Tình hình giao dịch theo Mặt hàng (CQG & ACM) */
  @Prop({ type: Object, required: true })
  section2Commodities: {
    cqg: {
      totalCommodities: number;
      items: Array<any>;
      summary: any;
    };
    acm: {
      totalCommodities: number;
      items: Array<any>;
      summary: any;
    };
  };

  /** Dữ liệu Phần III: Sản phẩm đặc thù (Spread, LME, Options) */
  @Prop({ type: Object, required: true })
  section3Specials: {
    spread: {
      totalMembers: number;
      items: Array<any>;
      summary: any;
    };
    lme: {
      totalMembers: number;
      items: Array<any>;
      summary: any;
    };
    options: {
      totalMembers: number;
      items: Array<any>;
      summary: any;
    };
  };

  /** Người thực hiện tạo / chốt báo cáo */
  @Prop({ required: true, default: 'SYSTEM' })
  generatedBy: string;

  /** Ghi chú chốt sổ */
  @Prop({ default: '' })
  note?: string;

  /** Thời điểm tạo snapshot */
  @Prop({ required: true, default: Date.now })
  generatedAt: Date;
}

export const MonthlyReportSnapshotSchema = SchemaFactory.createForClass(MonthlyReportSnapshot);

