import { Module } from '@nestjs/common';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { CcpStatisticsController } from './ccp-statistics.controller';
import { CcpStatisticsService } from './ccp-statistics.service';
import { CcpLotStatisticsService } from './ccp-lot-statistics.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SystemSettingsModule, AuthModule],
  controllers: [CcpStatisticsController],
  providers: [CcpStatisticsService, CcpLotStatisticsService],
  exports: [CcpStatisticsService, CcpLotStatisticsService],
})
export class CcpStatisticsModule {}
