import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ShiftJobsService } from './shift-jobs.service';

@Injectable()
export class ShiftJobScheduler {
  private readonly logger = new Logger(ShiftJobScheduler.name);

  constructor(private readonly shiftJobsService: ShiftJobsService) {}

  // Run at 00:01 daily in Asia/Saigon timezone
  @Cron('1 0 * * *', {
    name: 'daily-shift-job-generation',
    timeZone: 'Asia/Saigon',
  })
  async handleDailyGeneration() {
    this.logger.log('Cron triggered: Starting daily shift job generation...');
    
    // Get current date in Asia/Saigon timezone
    const now = new Date();
    const saigonTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Saigon' }));
    const yyyy = saigonTime.getFullYear();
    const mm = String(saigonTime.getMonth() + 1).padStart(2, '0');
    const dd = String(saigonTime.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    try {
      const result = await this.shiftJobsService.generateShiftsForDate(todayStr, 'SYSTEM');
      this.logger.log(`Daily shift job generation completed. Result: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error('Failed to run daily shift job generation cron', error);
    }
  }
}
