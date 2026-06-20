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
    // Get current time in Asia/Saigon timezone components safely
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Saigon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

    const hh = partMap.hour;
    const mm = partMap.minute;
    const currentTimeStr = `${hh}:${mm}`;

    // Get target time setting (defaults to 00:01)
    const targetTimeStr = await this.settingsService.getSetting(
      'shift_generation_time',
      '00:01',
    );

    if (currentTimeStr !== targetTimeStr) {
      return; // Not the configured generation time
    }

    this.logger.log(
      `Cron triggered: Target generation time (${targetTimeStr}) reached. Starting shift job generation...`,
    );

    const yyyy = partMap.year;
    const month = partMap.month;
    const day = partMap.day;
    const todayStr = `${yyyy}-${month}-${day}`;

    try {
      const result = await this.shiftJobsService.generateShiftsForDate(
        todayStr,
        'SYSTEM',
      );
      this.logger.log(
        `Daily shift job generation completed. Result: ${JSON.stringify(result)}`,
      );
    } catch (error) {
      this.logger.error('Failed to run daily shift job generation cron', error);
    }
  }
}
