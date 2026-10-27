import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { TradingReconLog, TradingReconLogSchema } from './schemas/trading-recon-log.schema';
import { CcpClearingLog, CcpClearingLogSchema } from './schemas/ccp-clearing-log.schema';
import { TradingReconLogController } from './controllers/trading-recon-log.controller';
import { CcpReconController } from './controllers/ccp-recon.controller';
import { CqgMergerService } from './services/merger/cqg-merger.service';
import { KlgdReconService } from './services/recon/klgd-recon.service';
import { MsEodReconService } from './services/recon/ms-eod-recon.service';
import { MarginCheckerService } from './services/recon/margin-checker.service';
import { TradingOpsConfigService } from './services/config/trading-ops-config.service';
import { DsgdBeforeEodService } from './services/recon/dsgd-before-eod.service';
import { GttCheckerService } from './services/recon/gtt-checker.service';
import { ReconConsoleSummaryService } from './services/console/recon-console-summary.service';
import { LotStatisticsService } from './services/statistics/lot-statistics.service';
import { ValueStatisticsService } from './services/statistics/value-statistics.service';
import { CcpAccumulatorService } from './services/statistics/ccp-accumulator.service';
import { CcpClearingConfigService } from './services/config/ccp-clearing-config.service';
import { CcpEodService } from './services/recon/ccp-eod.service';
import { CeCcpGttCheckerService } from './services/recon/ce-ccp-gtt.service';
import { QlgdDashboardService } from './services/console/qlgd-dashboard.service';
import { QlgdExcelExportService } from './services/console/qlgd-excel-export.service';
import { KlgdReconWorker } from './workers/klgd-recon.worker';
import { DsgdBeforeEodReconWorker } from './workers/dsgd-before-eod-recon.worker';
import { NegativeMarginWorker } from './workers/negative-margin.worker';
import { CcpLotWorker } from './workers/ccp-lot.worker';
import { CcpValueWorker } from './workers/ccp-value.worker';
import { CcpEodWorker } from './workers/ccp-eod.worker';
import { SodReconWorker } from './workers/sod-recon.worker';
import { CqgSyncWorker } from './workers/cqg-sync.worker';
import { EodMsWorker } from './workers/eod-ms.worker';
import { CeCcpGttWorker } from './workers/ce-ccp-gtt.worker';
import { MsCqgGttWorker } from './workers/ms-cqg-gtt.worker';
import { CeLotWorker } from './workers/ce-lot.worker';

import { IngressModule } from '../ingress/ingress.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AuthModule } from '../auth/auth.module';
import { WorkingCalendarModule } from '../working-calendar/working-calendar.module';
import { ChecklistHubModule } from '../checklist-hub/checklist-hub.module';
import { BotJob, BotJobSchema } from '../../schemas/bot-job.schema';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { CcpLotRunHistory, CcpLotRunHistorySchema } from '../../schemas/ccp-lot-run-history.schema';
import { CeLotRunHistory, CeLotRunHistorySchema } from '../../schemas/ce-lot-run-history.schema';
import { CcpLotStatisticsService } from './services/statistics/ccp-lot-statistics.service';
import { CcpStatisticsService } from './services/statistics/ccp-statistics.service';
import { CeLotStatisticsService } from './services/statistics/ce-lot-statistics.service';
import { CcpAdHocStatisticsService } from './services/statistics/ccp-adhoc-statistics.service';
import { TradingOpsPreflightService } from './services/console/trading-ops-preflight.service';

import { KlgdReconController } from './controllers/klgd-recon.controller';
import { DsgdBeforeEodReconController } from './controllers/dsgd-before-eod-recon.controller';
import { TradingOpsUploadController } from './controllers/trading-ops-upload.controller';
import { MarginCheckerController } from './controllers/margin-checker.controller';
import { GttReconController } from './controllers/gtt-recon.controller';
import { GttUploadController } from './controllers/gtt-upload.controller';
import { MacroExecutionController } from './controllers/macro-execution.controller';
import { TradingOpsMiscController } from './controllers/trading-ops-misc.controller';
import { CeReconController } from './controllers/ce-recon.controller';
import { OmsReconController } from './controllers/oms-recon.controller';
import { OmsWatcherService } from './services/oms/oms-watcher.service';
import { VerifyEmailJobHandler } from './handlers/verify-email.handler';
import { OmsReconService } from './services/recon/oms-recon.service';
import { ReconPipelineService } from './services/pipeline/recon-pipeline.service';
import { RECON_PIPELINE_PORT } from '../../shared';

@Module({
  imports: [
    AuthModule,
    SystemSettingsModule,
    TelegramModule,
    IngressModule,
    ShiftsModule,
    WorkingCalendarModule,
    ChecklistHubModule,
    MongooseModule.forFeature([
      { name: TradingReconLog.name, schema: TradingReconLogSchema },
      { name: CcpClearingLog.name, schema: CcpClearingLogSchema },
      { name: BotJob.name, schema: BotJobSchema },
      { name: ShiftLog.name, schema: ShiftLogSchema },
      { name: CcpLotRunHistory.name, schema: CcpLotRunHistorySchema },
      { name: CeLotRunHistory.name, schema: CeLotRunHistorySchema },
    ]),
  ],
  controllers: [
    KlgdReconController,
    DsgdBeforeEodReconController,
    TradingOpsUploadController,
    MarginCheckerController,
    GttReconController,
    GttUploadController,
    MacroExecutionController,
    TradingOpsMiscController,
    TradingReconLogController,
    CcpReconController,
    CeReconController,
    OmsReconController,
  ],
  providers: [
    OmsWatcherService,
    VerifyEmailJobHandler,
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
    CeCcpGttWorker,
    MsCqgGttWorker,
    CeLotWorker,
    CcpLotStatisticsService,
    CcpStatisticsService,
    CeLotStatisticsService,
    CcpAdHocStatisticsService,
    TradingOpsPreflightService,
    OmsReconService,
    ReconPipelineService,
    {
      provide: RECON_PIPELINE_PORT,
      useClass: ReconPipelineService,
    },
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
    CeCcpGttWorker,
    MsCqgGttWorker,
    CeLotWorker,
    CcpLotStatisticsService,
    CcpStatisticsService,
    CcpAdHocStatisticsService,
    TradingOpsPreflightService,
    OmsReconService,
    OmsWatcherService,
    ReconPipelineService,
    RECON_PIPELINE_PORT,
    MongooseModule,
  ],
})
export class TradingOpsModule {}

