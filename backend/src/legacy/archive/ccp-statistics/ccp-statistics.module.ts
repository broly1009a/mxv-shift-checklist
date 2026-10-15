import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { CcpStatisticsController } from './ccp-statistics.controller';
import { CcpStatisticsService } from './ccp-statistics.service';
import { CcpLotStatisticsService } from './ccp-lot-statistics.service';
import { AuthModule } from '../auth/auth.module';
import { BotEngineModule } from '../bot-engine/bot-engine.module';
import {
  CcpLotRunHistory,
  CcpLotRunHistorySchema,
} from '../../schemas/ccp-lot-run-history.schema';

@Module({
  imports: [
    SystemSettingsModule,
    AuthModule,
    forwardRef(() => BotEngineModule),
    MongooseModule.forFeature([
      { name: CcpLotRunHistory.name, schema: CcpLotRunHistorySchema },
    ]),
  ],
  controllers: [CcpStatisticsController],
  providers: [CcpStatisticsService, CcpLotStatisticsService],
  exports: [CcpStatisticsService, CcpLotStatisticsService],
})
export class CcpStatisticsModule {}
