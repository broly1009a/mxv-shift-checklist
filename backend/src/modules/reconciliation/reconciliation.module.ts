import { Module } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { ShiftsModule } from '../shifts/shifts.module';
import { BotEngineModule } from '../bot-engine/bot-engine.module';

@Module({
  imports: [ShiftsModule, BotEngineModule],
  providers: [ReconciliationService],
  controllers: [ReconciliationController],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
