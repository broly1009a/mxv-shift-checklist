import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { ShiftsModule } from '../shifts/shifts.module';
import { BotEngineService } from './bot-engine.service';
import { EmailWatcherService } from './email-watcher.service';
import { FileWatcherService } from './file-watcher.service';
import { ApiWatcherService } from './api-watcher.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShiftLog.name, schema: ShiftLogSchema },
    ]),
    ShiftsModule,
  ],
  providers: [
    EmailWatcherService,
    FileWatcherService,
    ApiWatcherService,
    BotEngineService,
  ],
  exports: [
    BotEngineService,
  ],
})
export class BotEngineModule {}
