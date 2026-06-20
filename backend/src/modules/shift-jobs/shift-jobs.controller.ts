import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ShiftJobsService } from './shift-jobs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/shift-jobs')
export class ShiftJobsController {
  constructor(private readonly shiftJobsService: ShiftJobsService) {}

  @Roles('ADMIN')
  @Post('generate')
  async generateShifts(@Body() body: { date?: string }, @Request() req: any) {
    let targetDate = body.date;
    if (!targetDate) {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Saigon',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.formatToParts(now);
      const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      targetDate = `${partMap.year}-${partMap.month}-${partMap.day}`;
    }

    // Basic date validation YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(targetDate)) {
      throw new BadRequestException(
        'Định dạng ngày không hợp lệ. Vui lòng sử dụng YYYY-MM-DD',
      );
    }

    const userId = req.user._id || req.user.id;
    return this.shiftJobsService.generateShiftsForDate(
      targetDate,
      'USER',
      userId,
    );
  }
}
