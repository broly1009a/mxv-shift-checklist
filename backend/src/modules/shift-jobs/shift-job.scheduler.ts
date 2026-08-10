import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ShiftJobsService } from './shift-jobs.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

@Injectable()
export class ShiftJobScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(ShiftJobScheduler.name);

  constructor(
    private readonly shiftJobsService: ShiftJobsService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log(
      'Application started. Running startup check for daily shift generation...',
    );
    await this.runStartupGeneration();
  }

  // Run every minute to check if current time matches dynamic shift generation time setting
  @Cron('* * * * *', {
    name: 'daily-shift-job-generation',
    timeZone: 'Asia/Saigon',
  })
  async handleDailyGeneration() {
    const timeParts = this.getSaigonTimeParts(new Date());
    const currentTimeStr = timeParts.timeStr;

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

    const todayStr = timeParts.dateStr;

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

  private async runStartupGeneration() {
    const timeParts = this.getSaigonTimeParts(new Date());
    const todayStr = timeParts.dateStr;

    this.logger.log(
      `Checking if shifts need to be generated for today: ${todayStr}...`,
    );

    try {
      const result = await this.shiftJobsService.generateShiftsForDate(
        todayStr,
        'SYSTEM',
      );
      this.logger.log(
        `Startup shift job check completed. Result: ${JSON.stringify(result)}`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to run startup shift job generation check',
        error,
      );
    }
  }

  private getSaigonTimeParts(date: Date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Saigon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23', // Force 24-hour cycle to start at 00
    });
    const parts = formatter.formatToParts(date);
    const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

    let hh = partMap.hour;
    if (hh === '24') {
      hh = '00'; // Safety fallback for Node/OS timezone formatting differences
    }
    const mm = partMap.minute;

    return {
      year: partMap.year,
      month: partMap.month,
      day: partMap.day,
      hour: hh,
      minute: mm,
      timeStr: `${hh}:${mm}`,
      dateStr: `${partMap.year}-${partMap.month}-${partMap.day}`,
    };
  }
}

