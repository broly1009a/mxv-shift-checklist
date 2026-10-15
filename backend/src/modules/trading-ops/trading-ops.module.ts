import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { TradingReconLog, TradingReconLogSchema } from './schemas/trading-recon-log.schema';
import { CcpClearingLog, CcpClearingLogSchema } from './schemas/ccp-clearing-log.schema';
import { TradingReconLogController } from './controllers/trading-recon-log.controller';
import { CcpReconController } from './controllers/ccp-recon.controller';
import { CqgMergerService } from './services/cqg-merger.service';
import { KlgdReconService } from './services/klgd-recon.service';
import { PreEodReconService } from './services/pre-eod-recon.service';
import { MarginCheckerService } from './services/margin-checker.service';
import { TradingOpsConfigService } from './services/trading-ops-config.service';
import { DsgdBeforeEodService } from './services/dsgd-before-eod.service';
import { GttCheckerService } from './services/gtt-checker.service';
import { ReconConsoleSummaryService } from './services/recon-console-summary.service';
import { LotStatisticsService } from './services/lot-statistics.service';
import { ValueStatisticsService } from './services/value-statistics.service';
import { CcpClearingConfigService } from './services/ccp-clearing-config.service';
import { CcpEodService } from './services/ccp-eod.service';
import { CeCcpGttCheckerService } from './services/ce-ccp-gtt.service';
import { KlgdReconWorker } from './workers/klgd-recon.worker';
import { PreEodReconWorker } from './workers/pre-eod-recon.worker';
import { NegativeMarginWorker } from './workers/negative-margin.worker';
import { CcpLotWorker } from './workers/ccp-lot.worker';
import { CcpValueWorker } from './workers/ccp-value.worker';
import { CcpEodWorker } from './workers/ccp-eod.worker';

import { IngressModule } from '../ingress/ingress.module';
import { BotEngineModule } from '../bot-engine/bot-engine.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { TelegramModule } from '../telegram/telegram.module';
import { BotJob, BotJobSchema } from '../../schemas/bot-job.schema';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';

// Controllers Domain Chuyên Biệt V2
import { KlgdReconController } from './controllers/klgd-recon.controller';
import { PreEodReconController } from './controllers/pre-eod-recon.controller';
import { MarginCheckerController } from './controllers/margin-checker.controller';
import { GttReconController } from './controllers/gtt-recon.controller';
import { TradingOpsMiscController } from './controllers/trading-ops-misc.controller';

@Module({
  imports: [
    SystemSettingsModule,
    TelegramModule,
    IngressModule,
    ShiftsModule,
    forwardRef(() => BotEngineModule),
    MongooseModule.forFeature([
      { name: TradingReconLog.name, schema: TradingReconLogSchema },
      { name: CcpClearingLog.name, schema: CcpClearingLogSchema },
      { name: BotJob.name, schema: BotJobSchema },
      { name: ShiftLog.name, schema: ShiftLogSchema },
    ]),
  ],
  controllers: [
    KlgdReconController,
    PreEodReconController,
    MarginCheckerController,
    GttReconController,
    TradingOpsMiscController,
    TradingReconLogController,
    CcpReconController,
  ],
  providers: [
    CqgMergerService,
    KlgdReconService,
    PreEodReconService,
    MarginCheckerService,
    TradingOpsConfigService,
    DsgdBeforeEodService,
    GttCheckerService,
    ReconConsoleSummaryService,
    LotStatisticsService,
    ValueStatisticsService,
    CcpClearingConfigService,
    CcpEodService,
    CeCcpGttCheckerService,
    KlgdReconWorker,
    PreEodReconWorker,
    NegativeMarginWorker,
    CcpLotWorker,
    CcpValueWorker,
    CcpEodWorker,
  ],
  exports: [
    CqgMergerService,
    KlgdReconService,
    PreEodReconService,
    MarginCheckerService,
    TradingOpsConfigService,
    DsgdBeforeEodService,
    GttCheckerService,
    ReconConsoleSummaryService,
    LotStatisticsService,
    ValueStatisticsService,
    CcpClearingConfigService,
    CcpEodService,
    CeCcpGttCheckerService,
    KlgdReconWorker,
    PreEodReconWorker,
    NegativeMarginWorker,
    CcpLotWorker,
    CcpValueWorker,
    CcpEodWorker,
    MongooseModule,
  ],
})
export class TradingOpsModule {}

