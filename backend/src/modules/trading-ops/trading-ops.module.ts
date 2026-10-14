import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { TradingReconLog, TradingReconLogSchema } from './schemas/trading-recon-log.schema';
import { TradingReconLogController } from './controllers/trading-recon-log.controller';
import { CqgMergerService } from './services/cqg-merger.service';
import { KlgdReconService } from './services/klgd-recon.service';
import { PreEodReconService } from './services/pre-eod-recon.service';
import { MarginCheckerService } from './services/margin-checker.service';
import { TradingOpsConfigService } from './services/trading-ops-config.service';
import { DsgdBeforeEodService } from './services/dsgd-before-eod.service';
import { KlgdReconWorker } from './workers/klgd-recon.worker';
import { PreEodReconWorker } from './workers/pre-eod-recon.worker';
import { NegativeMarginWorker } from './workers/negative-margin.worker';

@Module({
  imports: [
    SystemSettingsModule,
    MongooseModule.forFeature([
      { name: TradingReconLog.name, schema: TradingReconLogSchema },
    ]),
  ],
  controllers: [TradingReconLogController],
  providers: [
    CqgMergerService,
    KlgdReconService,
    PreEodReconService,
    MarginCheckerService,
    TradingOpsConfigService,
    DsgdBeforeEodService,
    KlgdReconWorker,
    PreEodReconWorker,
    NegativeMarginWorker,
  ],
  exports: [
    CqgMergerService,
    KlgdReconService,
    PreEodReconService,
    MarginCheckerService,
    TradingOpsConfigService,
    DsgdBeforeEodService,
    KlgdReconWorker,
    PreEodReconWorker,
    NegativeMarginWorker,
    MongooseModule,
  ],
})
export class TradingOpsModule {}
