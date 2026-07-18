import { Module } from '@nestjs/common';
import { LotStatisticsController } from './lot-statistics.controller';
import { LotStatisticsService } from './lot-statistics.service';
import { ValueStatisticsService } from './value-statistics.service';
import { ValueStatisticsController } from './value-statistics.controller';

@Module({
  controllers: [LotStatisticsController, ValueStatisticsController],
  providers: [LotStatisticsService, ValueStatisticsService],
  exports: [LotStatisticsService, ValueStatisticsService],
})
export class LotStatisticsModule {}

