import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { CcpClearingLog, CcpClearingLogSchema } from './schemas/ccp-clearing-log.schema';
import { CcpClearingLogController } from './controllers/ccp-clearing-log.controller';
import { LotStatisticsService } from './services/lot-statistics.service';
import { ValueStatisticsService } from './services/value-statistics.service';
import { CcpClearingConfigService } from './services/ccp-clearing-config.service';
import { CcpEodService } from './services/ccp-eod.service';
import { CcpLotWorker } from './workers/ccp-lot.worker';
import { CcpValueWorker } from './workers/ccp-value.worker';
import { CcpEodWorker } from './workers/ccp-eod.worker';

@Module({
  imports: [
    SystemSettingsModule,
    MongooseModule.forFeature([
      { name: CcpClearingLog.name, schema: CcpClearingLogSchema },
    ]),
  ],
  controllers: [CcpClearingLogController],
  providers: [
    LotStatisticsService,
    ValueStatisticsService,
    CcpClearingConfigService,
    CcpEodService,
    CcpLotWorker,
    CcpValueWorker,
    CcpEodWorker,
  ],
  exports: [
    LotStatisticsService,
    ValueStatisticsService,
    CcpClearingConfigService,
    CcpEodService,
    CcpLotWorker,
    CcpValueWorker,
    CcpEodWorker,
    MongooseModule,
  ],
})
export class CcpClearingModule {}
