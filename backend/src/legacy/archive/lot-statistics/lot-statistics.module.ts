import { Module } from '@nestjs/common';
import { LotStatisticsController } from './lot-statistics.controller';
import { LotStatisticsService } from './lot-statistics.service';
import { ValueStatisticsService } from './value-statistics.service';
import { ValueStatisticsController } from './value-statistics.controller';
import { AuthModule } from '../auth/auth.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [AuthModule, SystemSettingsModule],
  controllers: [LotStatisticsController, ValueStatisticsController],
  providers: [LotStatisticsService, ValueStatisticsService],
  exports: [LotStatisticsService, ValueStatisticsService],
})
export class LotStatisticsModule {}
