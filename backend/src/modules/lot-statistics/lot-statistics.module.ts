import { Module } from '@nestjs/common';
import { LotStatisticsController } from './lot-statistics.controller';
import { LotStatisticsService } from './lot-statistics.service';

@Module({
  controllers: [LotStatisticsController],
  providers: [LotStatisticsService],
  exports: [LotStatisticsService],
})
export class LotStatisticsModule {}
