import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { TradingReportController } from './trading-report.controller';
import { TradingReportService } from './trading-report.service';
import {
  ExchangeRate,
  ExchangeRateSchema,
} from '../../schemas/exchange-rate.schema';

@Module({
  imports: [
    SystemSettingsModule,
    MongooseModule.forFeature([
      { name: ExchangeRate.name, schema: ExchangeRateSchema },
    ]),
  ],
  controllers: [TradingReportController],
  providers: [TradingReportService],
  exports: [TradingReportService],
})
export class TradingReportModule {}
