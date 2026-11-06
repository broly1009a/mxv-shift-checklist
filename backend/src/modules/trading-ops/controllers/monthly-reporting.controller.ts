import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Res,
  ParseIntPipe,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { MonthlyReportingService } from '../services/reporting/monthly-reporting.service';

@Controller('api/v1/trading-ops/monthly-report')
export class MonthlyReportingController {
  private readonly logger = new Logger(MonthlyReportingController.name);

  constructor(private readonly monthlyReportingService: MonthlyReportingService) {}

  /**
   * Lấy dữ liệu Báo Cáo Tháng (JSON hiển thị Dashboard Web)
   */
  @Get(':year/:month')
  async getMonthlyReport(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Query('forceRefresh') forceRefresh?: string,
  ) {
    const isForce = forceRefresh === 'true' || forceRefresh === '1';
    const reportData = await this.monthlyReportingService.getMonthlyReport(year, month, isForce);
    const formatted = this.monthlyReportingService.formatForFrontend(reportData, year, month);
    return {
      success: true,
      data: formatted,
      raw: reportData,
    };
  }

  /**
   * Tải File Excel Báo Cáo Tháng (.xlsx) chuẩn 100% template gốc
   */
  @Get(':year/:month/export-excel')
  async exportMonthlyReportExcel(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Query('forceRefresh') forceRefresh: string,
    @Res() res: Response,
  ) {
    const isForce = forceRefresh === 'true' || forceRefresh === '1';
    const { buffer, filename } = await this.monthlyReportingService.exportMonthlyReportExcel(
      year,
      month,
      isForce,
    );

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  /**
   * Khóa sổ Báo Cáo Tháng chính thức (OFFICIAL Snapshot)
   */
  @Post(':year/:month/lock-snapshot')
  async lockSnapshot(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body('note') note?: string,
  ) {
    const data = await this.monthlyReportingService.lockMonthlySnapshot(year, month, note, 'OPERATOR');
    return {
      success: true,
      message: `Đã khóa sổ thành công kỳ Tháng ${month}/${year}!`,
      data,
    };
  }
}

