import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkingCalendar } from '../../schemas/working-calendar.schema';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { Exchange } from '../../schemas/exchange.schema';
import { ExchangeHoliday } from '../../schemas/exchange-holiday.schema';

@Injectable()
export class WorkingCalendarService {
  constructor(
    @InjectModel(WorkingCalendar.name)
    private readonly workingCalendarModel: Model<WorkingCalendar>,
    @InjectModel(Exchange.name)
    private readonly exchangeModel: Model<Exchange>,
    @InjectModel(ExchangeHoliday.name)
    private readonly exchangeHolidayModel: Model<ExchangeHoliday>,
    private readonly settingsService: SystemSettingsService,
  ) {}


  async findAll(): Promise<WorkingCalendar[]> {
    return this.workingCalendarModel.find().sort({ date: 1 }).exec();
  }

  async findOne(dateStr: string): Promise<WorkingCalendar> {
    const calendar = await this.workingCalendarModel
      .findOne({ date: dateStr })
      .exec();
    if (!calendar) {
      throw new NotFoundException(
        `Calendar entry for date ${dateStr} not found`,
      );
    }
    return calendar;
  }

  async create(data: any, userId?: string): Promise<WorkingCalendar> {
    const existing = await this.workingCalendarModel
      .findOne({ date: data.date })
      .exec();
    if (existing) {
      throw new ConflictException(
        `Calendar entry for date ${data.date} already exists`,
      );
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

  async update(
    dateStr: string,
    data: any,
    userId?: string,
  ): Promise<WorkingCalendar> {
    const isWeekend = await this.checkWeekend(dateStr);
    const updated = await this.workingCalendarModel
      .findOneAndUpdate(
        { date: dateStr },
        {
          ...data,
          isWeekend,
          updatedBy: userId ? userId : null,
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(
        `Calendar entry for date ${dateStr} not found`,
      );
    }
    return updated;
  }

  async remove(dateStr: string): Promise<any> {
    const deleted = await this.workingCalendarModel
      .findOneAndDelete({ date: dateStr })
      .exec();
    if (!deleted) {
      throw new NotFoundException(
        `Calendar entry for date ${dateStr} not found`,
      );
    }
    return { deleted: true };
  }

  async validateDate(dateStr: string): Promise<any> {
    // 1. Check for specific date override first
    let calendarRecord = await this.workingCalendarModel
      .findOne({ date: dateStr })
      .exec();

    // 2. If not found, check for recurring annual holiday (pattern: *-MM-DD)
    if (!calendarRecord) {
      const [, mm, dd] = dateStr.split('-');
      calendarRecord = await this.workingCalendarModel
        .findOne({ date: `*-${mm}-${dd}` })
        .exec();
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

  async isExchangeClosed(exchangeCode: string, dateStr: string): Promise<boolean> {
    // 1. Check exact date holiday
    let holiday = await this.exchangeHolidayModel.findOne({
      exchangeCode,
      date: dateStr,
    }).exec();

    // 2. Check recurring holiday (e.g. *-12-25)
    if (!holiday) {
      const [, mm, dd] = dateStr.split('-');
      holiday = await this.exchangeHolidayModel.findOne({
        exchangeCode,
        date: `*-${mm}-${dd}`,
      }).exec();
    }

    return holiday ? holiday.isClosed : false;
  }

  async getExchangeTimezone(exchangeCode: string): Promise<string> {
    const exchange = await this.exchangeModel.findOne({ code: exchangeCode }).exec();
    return exchange ? exchange.timezone : 'Asia/Saigon';
  }

  async isDepartmentClosedOnDate(monitoredExchanges: string[], dateStr: string): Promise<boolean> {
    if (!monitoredExchanges || monitoredExchanges.length === 0) {
      return this.checkWeekend(dateStr);
    }

    // If day is a weekend, they are closed.
    const isWeekendVal = await this.checkWeekend(dateStr);
    if (isWeekendVal) {
      return true;
    }

    // Check if ALL monitored exchanges are closed on this date
    let allClosed = true;
    for (const exCode of monitoredExchanges) {
      const closed = await this.isExchangeClosed(exCode, dateStr);
      if (!closed) {
        allClosed = false;
        break;
      }
    }

    return allClosed;
  }

  isDaylightSavingTime(dateStr: string, timezone: string): boolean {
    if (!timezone) return false;
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    // US DST (America/Chicago, America/New_York)
    if (timezone.startsWith('America/')) {
      const dstStart = this.getNthSundayOfMonth(year, 3, 2);
      const dstEnd = this.getNthSundayOfMonth(year, 11, 1);
      return date >= dstStart && date < dstEnd;
    }

    // UK/Europe DST (Europe/London)
    if (timezone.startsWith('Europe/')) {
      const dstStart = this.getLastSundayOfMonth(year, 3);
      const dstEnd = this.getLastSundayOfMonth(year, 10);
      return date >= dstStart && date < dstEnd;
    }

    return false;
  }

  private getNthSundayOfMonth(year: number, month: number, n: number): Date {
    const date = new Date(year, month - 1, 1);
    let count = 0;
    while (count < n) {
      if (date.getDay() === 0) {
        count++;
        if (count === n) return date;
      }
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  private getLastSundayOfMonth(year: number, month: number): Date {
    const date = new Date(year, month, 0);
    while (date.getDay() !== 0) {
      date.setDate(date.getDate() - 1);
    }
    return date;
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
    const restDaysStr = await this.settingsService.getSetting(
      'weekly_rest_days',
      '[0, 6]',
    );
    try {
      const restDays: number[] = JSON.parse(restDaysStr);
      return restDays.includes(dayOfWeek);
    } catch {
      return dayOfWeek === 0 || dayOfWeek === 6;
    }
  }
}

