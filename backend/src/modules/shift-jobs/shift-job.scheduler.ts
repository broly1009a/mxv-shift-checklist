import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ShiftJobsService } from './shift-jobs.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

@Injectable()
export class ShiftJobScheduler {
  private readonly logger = new Logger(ShiftJobScheduler.name);

  constructor(
    private readonly shiftJobsService: ShiftJobsService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  // Run every minute to check if current time matches dynamic shift generation time setting
  @Cron('* * * * *', {
    name: 'daily-shift-job-generation',
    timeZone: 'Asia/Saigon',
  })
  async handleDailyGeneration() {
    // Get current time in Asia/Saigon timezone
    const now = new Date();
    const saigonTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Saigon' }));
    
    const hh = String(saigonTime.getHours()).padStart(2, '0');
    const mm = String(saigonTime.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hh}:${mm}`;

    // Get target time setting (defaults to 00:01)
    const targetTimeStr = await this.settingsService.getSetting('shift_generation_time', '00:01');

    if (currentTimeStr !== targetTimeStr) {
      return; // Not the configured generation time
    }

    this.logger.log(`Cron triggered: Target generation time (${targetTimeStr}) reached. Starting shift job generation...`);
    
    const yyyy = saigonTime.getFullYear();
    const month = String(saigonTime.getMonth() + 1).padStart(2, '0');
    const day = String(saigonTime.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${month}-${day}`;

    try {
      const result = await this.shiftJobsService.generateShiftsForDate(todayStr, 'SYSTEM');
      this.logger.log(`Daily shift job generation completed. Result: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error('Failed to run daily shift job generation cron', error);
    }
  }
}
