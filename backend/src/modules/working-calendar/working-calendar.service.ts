import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkingCalendar } from '../../schemas/working-calendar.schema';
import { SystemSettingsService } from '../system-settings/system-settings.service';

@Injectable()
export class WorkingCalendarService {
  constructor(
    @InjectModel(WorkingCalendar.name) private readonly workingCalendarModel: Model<WorkingCalendar>,
    private readonly settingsService: SystemSettingsService,
  ) {}

  async findAll(): Promise<WorkingCalendar[]> {
    return this.workingCalendarModel.find().sort({ date: 1 }).exec();
  }

  async findOne(dateStr: string): Promise<WorkingCalendar> {
    const calendar = await this.workingCalendarModel.findOne({ date: dateStr }).exec();
    if (!calendar) {
      throw new NotFoundException(`Calendar entry for date ${dateStr} not found`);
    }
    return calendar;
  }

  async create(data: any, userId?: string): Promise<WorkingCalendar> {
    const existing = await this.workingCalendarModel.findOne({ date: data.date }).exec();
    if (existing) {
      throw new ConflictException(`Calendar entry for date ${data.date} already exists`);
    }
    
    // Automatically calculate isWeekend dynamically
    const isWeekend = await this.checkWeekend(data.date);
    const newCalendar = new this.workingCalendarModel({
      ...data,
      isWeekend,
      createdBy: userId ? userId : null,
      updatedBy: userId ? userId : null,
    });
    return newCalendar.save();
  }

  async update(dateStr: string, data: any, userId?: string): Promise<WorkingCalendar> {
    const isWeekend = await this.checkWeekend(dateStr);
    const updated = await this.workingCalendarModel.findOneAndUpdate(
      { date: dateStr },
      {
        ...data,
        isWeekend,
        updatedBy: userId ? userId : null,
      },
      { new: true }
    ).exec();

    if (!updated) {
      throw new NotFoundException(`Calendar entry for date ${dateStr} not found`);
    }
    return updated;
  }

  async remove(dateStr: string): Promise<any> {
    const deleted = await this.workingCalendarModel.findOneAndDelete({ date: dateStr }).exec();
    if (!deleted) {
      throw new NotFoundException(`Calendar entry for date ${dateStr} not found`);
    }
    return { deleted: true };
  }

  async validateDate(dateStr: string): Promise<any> {
    // 1. Check for specific date override first
    let calendarRecord = await this.workingCalendarModel.findOne({ date: dateStr }).exec();
    
    // 2. If not found, check for recurring annual holiday (pattern: *-MM-DD)
    if (!calendarRecord) {
      const [, mm, dd] = dateStr.split('-');
      calendarRecord = await this.workingCalendarModel.findOne({ date: `*-${mm}-${dd}` }).exec();
    }

    if (calendarRecord) {
      return {
        date: dateStr,
        isTradingDay: calendarRecord.isTradingDay,
        isHoliday: calendarRecord.isHoliday,
        isWeekend: await this.checkWeekend(dateStr),
        note: calendarRecord.note || '',
        isCustomRecord: true,
      };
    }

    // Default computed fallback
    const isWeekendVal = await this.checkWeekend(dateStr);
    return {
      date: dateStr,
      isTradingDay: !isWeekendVal, // Weekday -> Trading day, Weekend -> Non-trading day
      isHoliday: false,
      isWeekend: isWeekendVal,
      note: 'Mặc định (Không có cấu hình tùy chỉnh)',
      isCustomRecord: false,
    };
  }

  private async checkWeekend(dateStr: string): Promise<boolean> {
    if (dateStr.startsWith('*-')) {
      return false;
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return false;
    }
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay(); // 0 Sunday, 1 Monday, ..., 6 Saturday

    // Load active rest days from settings (defaults to [0, 6] for Sunday, Saturday)
    const restDaysStr = await this.settingsService.getSetting('weekly_rest_days', '[0, 6]');
    try {
      const restDays: number[] = JSON.parse(restDaysStr);
      return restDays.includes(dayOfWeek);
    } catch {
      return dayOfWeek === 0 || dayOfWeek === 6;
    }
  }
}
