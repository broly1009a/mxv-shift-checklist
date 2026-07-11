import { Module, forwardRef } from '@nestjs/common';
import { MarginCheckerService } from './margin-checker.service';
import { MarginCheckerController } from './margin-checker.controller';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [
    forwardRef(() => ShiftsModule),
  ],
  providers: [MarginCheckerService],
  controllers: [MarginCheckerController],
  exports: [MarginCheckerService],
})
export class MarginCheckerModule {}
