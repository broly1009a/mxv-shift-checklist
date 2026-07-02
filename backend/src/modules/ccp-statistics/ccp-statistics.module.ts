import { Module } from '@nestjs/common';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { CcpStatisticsController } from './ccp-statistics.controller';
import { CcpStatisticsService } from './ccp-statistics.service';

@Module({
  imports: [SystemSettingsModule],
  controllers: [CcpStatisticsController],
  providers: [CcpStatisticsService],
  exports: [CcpStatisticsService],
})
export class CcpStatisticsModule {}
