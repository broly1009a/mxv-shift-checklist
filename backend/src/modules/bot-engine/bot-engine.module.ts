import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { BotJob, BotJobSchema } from '../../schemas/bot-job.schema';
import { ShiftsModule } from '../shifts/shifts.module';
import { BotEngineService } from './bot-engine.service';
import { EmailWatcherService } from './email-watcher.service';
import { FileWatcherService } from './file-watcher.service';
import { ApiWatcherService } from './api-watcher.service';
import { RpaDownloaderService } from './rpa-downloader.service';
import { GttCheckerService } from './gtt-checker.service';
import { BotJobQueueService } from './bot-job-queue.service';
import { BotEngineController } from './bot-engine.controller';
import { CqgSyncService } from './cqg-sync.service';
import { PostEodHandlerService } from './post-eod-handler.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShiftLog.name, schema: ShiftLogSchema },
      { name: BotJob.name, schema: BotJobSchema },
    ]),
    ShiftsModule,
  ],
  providers: [
    EmailWatcherService,
    FileWatcherService,
    ApiWatcherService,
    RpaDownloaderService,
    GttCheckerService,
    BotJobQueueService,
    CqgSyncService,
    PostEodHandlerService,
    BotEngineService,
  ],
  controllers: [
    BotEngineController,
  ],
  exports: [
    BotEngineService,
    BotJobQueueService,
    RpaDownloaderService,
    GttCheckerService,
    CqgSyncService,
    PostEodHandlerService,
  ],
})
export class BotEngineModule {}


