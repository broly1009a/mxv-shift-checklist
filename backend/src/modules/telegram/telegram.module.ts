import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TelegramService } from './telegram.service';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShiftLog.name, schema: ShiftLogSchema },
    ]),
  ],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
