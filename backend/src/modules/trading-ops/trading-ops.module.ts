import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { TradingReconLog, TradingReconLogSchema } from './schemas/trading-recon-log.schema';
import { CcpClearingLog, CcpClearingLogSchema } from './schemas/ccp-clearing-log.schema';
import { TradingReconLogController } from './controllers/trading-recon-log.controller';
import { CcpReconController } from './controllers/ccp-recon.controller';
import { CqgMergerService } from './services/cqg-merger.service';
import { KlgdReconService } from './services/klgd-recon.service';
import { MsEodReconService } from './services/ms-eod-recon.service';
import { MarginCheckerService } from './services/margin-checker.service';
import { TradingOpsConfigService } from './services/trading-ops-config.service';
import { DsgdBeforeEodService } from './services/dsgd-before-eod.service';
import { GttCheckerService } from './services/gtt-checker.service';
import { ReconConsoleSummaryService } from './services/recon-console-summary.service';
import { LotStatisticsService } from './services/lot-statistics.service';
import { ValueStatisticsService } from './services/value-statistics.service';
import { CcpAccumulatorService } from './services/ccp-accumulator.service';
import { CcpClearingConfigService } from './services/ccp-clearing-config.service';
import { CcpEodService } from './services/ccp-eod.service';
import { CeCcpGttCheckerService } from './services/ce-ccp-gtt.service';
import { QlgdDashboardService } from './services/qlgd-dashboard.service';
import { QlgdExcelExportService } from './services/qlgd-excel-export.service';
import { KlgdReconWorker } from './workers/klgd-recon.worker';
import { DsgdBeforeEodReconWorker } from './workers/dsgd-before-eod-recon.worker';
import { NegativeMarginWorker } from './workers/negative-margin.worker';
import { CcpLotWorker } from './workers/ccp-lot.worker';
import { CcpValueWorker } from './workers/ccp-value.worker';
import { CcpEodWorker } from './workers/ccp-eod.worker';
import { SodReconWorker } from './workers/sod-recon.worker';
import { CqgSyncWorker } from './workers/cqg-sync.worker';
import { EodMsWorker } from './workers/eod-ms.worker';

import { IngressModule } from '../ingress/ingress.module';
import { BotEngineModule } from '../bot-engine/bot-engine.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AuthModule } from '../auth/auth.module';
import { WorkingCalendarModule } from '../working-calendar/working-calendar.module';
import { BotJob, BotJobSchema } from '../../schemas/bot-job.schema';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { CcpLotRunHistory, CcpLotRunHistorySchema } from '../../schemas/ccp-lot-run-history.schema';
import { CcpLotStatisticsService } from './services/ccp-lot-statistics.service';
import { CcpStatisticsService } from './services/ccp-statistics.service';
import { CeLotStatisticsService } from './services/ce-lot-statistics.service';
import { CcpAdHocStatisticsService } from './services/ccp-adhoc-statistics.service';

// Controllers Domain Chuyên Biệt V2
import { KlgdReconController } from './controllers/klgd-recon.controller';
import { DsgdBeforeEodReconController } from './controllers/dsgd-before-eod-recon.controller';
import { MarginCheckerController } from './controllers/margin-checker.controller';
import { GttReconController } from './controllers/gtt-recon.controller';
import { TradingOpsMiscController } from './controllers/trading-ops-misc.controller';
import { CeReconController } from './controllers/ce-recon.controller';

@Module({
  imports: [
    AuthModule,
    SystemSettingsModule,
    TelegramModule,
    IngressModule,
    ShiftsModule,
    WorkingCalendarModule,
    forwardRef(() => BotEngineModule),
    MongooseModule.forFeature([
      { name: TradingReconLog.name, schema: TradingReconLogSchema },
      { name: CcpClearingLog.name, schema: CcpClearingLogSchema },
      { name: BotJob.name, schema: BotJobSchema },
      { name: ShiftLog.name, schema: ShiftLogSchema },
      { name: CcpLotRunHistory.name, schema: CcpLotRunHistorySchema },
    ]),
  ],
  controllers: [
    KlgdReconController,
    DsgdBeforeEodReconController,
    MarginCheckerController,
    GttReconController,
    TradingOpsMiscController,
    TradingReconLogController,
    CcpReconController,
    CeReconController,
  ],
  providers: [
    CqgMergerService,
    KlgdReconService,
    MsEodReconService,
    MarginCheckerService,
    TradingOpsConfigService,
    DsgdBeforeEodService,
    GttCheckerService,
    ReconConsoleSummaryService,
    LotStatisticsService,
    ValueStatisticsService,
    CcpAccumulatorService,
    CcpClearingConfigService,
    CcpEodService,
    CeCcpGttCheckerService,
    QlgdDashboardService,
    QlgdExcelExportService,
    KlgdReconWorker,
    DsgdBeforeEodReconWorker,
    NegativeMarginWorker,
    CcpLotWorker,
    CcpValueWorker,
    CcpEodWorker,
    SodReconWorker,
    CqgSyncWorker,
    EodMsWorker,
    CcpLotStatisticsService,
    CcpStatisticsService,
    CeLotStatisticsService,
    CcpAdHocStatisticsService,
  ],
  exports: [
    CqgMergerService,
    KlgdReconService,
    MsEodReconService,
    MarginCheckerService,
    TradingOpsConfigService,
    DsgdBeforeEodService,
    GttCheckerService,
    CeLotStatisticsService,
    ReconConsoleSummaryService,
    LotStatisticsService,
    ValueStatisticsService,
    CcpAccumulatorService,
    CcpClearingConfigService,
    CcpEodService,
    CeCcpGttCheckerService,
    QlgdDashboardService,
    QlgdExcelExportService,
    KlgdReconWorker,
    DsgdBeforeEodReconWorker,
    NegativeMarginWorker,
    CcpLotWorker,
    CcpValueWorker,
    CcpEodWorker,
    SodReconWorker,
    CqgSyncWorker,
    EodMsWorker,
    CcpLotStatisticsService,
    CcpStatisticsService,
    CcpAdHocStatisticsService,
    MongooseModule,
  ],
})
export class TradingOpsModule {}

