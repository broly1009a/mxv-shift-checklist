import { Module } from '@nestjs/common';
import { MarginCheckerService } from './margin-checker.service';
import { MarginCheckerController } from './margin-checker.controller';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [ShiftsModule],
  providers: [MarginCheckerService],
  controllers: [MarginCheckerController],
  exports: [MarginCheckerService],
})
export class MarginCheckerModule {}
