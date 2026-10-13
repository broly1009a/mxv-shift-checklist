import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { CcpClearingLog, CcpClearingLogSchema } from './schemas/ccp-clearing-log.schema';
import { CcpClearingLogController } from './controllers/ccp-clearing-log.controller';
import { LotStatisticsService } from './services/lot-statistics.service';
import { CcpClearingConfigService } from './services/ccp-clearing-config.service';
import { CcpLotWorker } from './workers/ccp-lot.worker';

@Module({
  imports: [
    SystemSettingsModule,
    MongooseModule.forFeature([
      { name: CcpClearingLog.name, schema: CcpClearingLogSchema },
    ]),
  ],
  controllers: [CcpClearingLogController],
  providers: [LotStatisticsService, CcpClearingConfigService, CcpLotWorker],
  exports: [LotStatisticsService, CcpClearingConfigService, CcpLotWorker, MongooseModule],
})
export class CcpClearingModule {}
