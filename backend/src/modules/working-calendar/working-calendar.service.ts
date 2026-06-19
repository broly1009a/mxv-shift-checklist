import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkingCalendar } from '../../schemas/working-calendar.schema';

@Injectable()
export class WorkingCalendarService {
  constructor(
    @InjectModel(WorkingCalendar.name) private readonly workingCalendarModel: Model<WorkingCalendar>,
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
    
    // Automatically calculate isWeekend
    const isWeekend = this.checkWeekend(data.date);
    const newCalendar = new this.workingCalendarModel({
      ...data,
      isWeekend,
      createdBy: userId ? userId : null,
      updatedBy: userId ? userId : null,
    });
    return newCalendar.save();
  }

  async update(dateStr: string, data: any, userId?: string): Promise<WorkingCalendar> {
    const isWeekend = this.checkWeekend(dateStr);
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
    const calendarRecord = await this.workingCalendarModel.findOne({ date: dateStr }).exec();
    if (calendarRecord) {
      return {
        date: dateStr,
        isTradingDay: calendarRecord.isTradingDay,
        isHoliday: calendarRecord.isHoliday,
        isWeekend: calendarRecord.isWeekend,
        note: calendarRecord.note || '',
        isCustomRecord: true,
      };
    }

    // Default computed fallback
    const isWeekendVal = this.checkWeekend(dateStr);
    return {
      date: dateStr,
      isTradingDay: !isWeekendVal, // Weekday -> Trading day, Weekend -> Non-trading day
      isHoliday: false,
      isWeekend: isWeekendVal,
      note: 'Mặc định (Không có cấu hình tùy chỉnh)',
      isCustomRecord: false,
    };
  }

  private checkWeekend(dateStr: string): boolean {
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 Sunday, 6 Saturday
  }
}
