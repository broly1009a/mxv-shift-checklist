import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import * as express from 'express';
import * as fs from 'fs';
import { TradingReportService } from './trading-report.service';

@Controller('trading-report')
export class TradingReportController {
  constructor(private readonly tradingReportService: TradingReportService) {}

  @Get('config')
  async getConfig() {
    return this.tradingReportService.getConfig();
  }

  @Post('config')
  async saveConfig(@Body() config: any) {
    return this.tradingReportService.saveConfig(config);
  }

  @Get('exchange-rates')
  async getExchangeRates() {
    return this.tradingReportService.getExchangeRates();
  }

  @Post('exchange-rates')
  async saveExchangeRate(@Body() body: any) {
    return this.tradingReportService.saveExchangeRate(body);
  }

  @Delete('exchange-rates/:id')
  async deleteExchangeRate(@Param('id') id: string) {
    return this.tradingReportService.deleteExchangeRate(id);
  }

  @Post('import-exchange-rates')
  @UseInterceptors(FileInterceptor('file'))
  async importExchangeRates(@UploadedFile() file: any) {
    if (!file) {
      throw new HttpException('Vui lòng tải lên file Excel tỷ giá.', HttpStatus.BAD_REQUEST);
    }
    return this.tradingReportService.importExchangeRates(file.buffer);
  }

  @Post('process-month')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'monthDSGDT', maxCount: 20 },
      { name: 'monthDSGDT1', maxCount: 20 },
    ]),
  )
  async processMonth(
    @UploadedFiles()
    files: {
      monthDSGDT?: any[];
      monthDSGDT1?: any[];
    },
    @Body('startSession') startSession: string,
    @Body('endSession') endSession: string,
    @Body('month') monthStr: string,
    @Body('year') yearStr: string,
    @Body('reportTypes') reportTypesStr: string,
    @Res() res: express.Response,
  ) {
    if (!files?.monthDSGDT || files.monthDSGDT.length === 0) {
      throw new HttpException('Thiếu danh sách giao dịch tháng này (DSGDT).', HttpStatus.BAD_REQUEST);
    }
    if (!files?.monthDSGDT1 || files.monthDSGDT1.length === 0) {
      throw new HttpException('Thiếu danh sách giao dịch tháng trước (DSGDT1).', HttpStatus.BAD_REQUEST);
    }

    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    if (isNaN(month) || isNaN(year)) {
      throw new HttpException('Tháng/Năm không hợp lệ.', HttpStatus.BAD_REQUEST);
    }

    let reportTypes: Record<string, boolean> = {
      Member: true,
      Commodity: true,
      Spread: true,
      LME: true,
      Option: true,
    };
    if (reportTypesStr) {
      try {
        reportTypes = JSON.parse(reportTypesStr);
      } catch (err) {
        // use default
      }
    }

    try {
      const outputPath = await this.tradingReportService.processMonthReport(
        files.monthDSGDT.map((f) => f.buffer),
        files.monthDSGDT1.map((f) => f.buffer),
        startSession || '07:00:00',
        endSession || '06:00:00',
        month,
        year,
        reportTypes,
      );

      if (!fs.existsSync(outputPath)) {
        throw new HttpException('Không tạo được file báo cáo tháng.', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Bao_cao_giao_dich_thang_${month}_${year}.xlsx"`,
      });

      const stream = fs.createReadStream(outputPath);
      stream.pipe(res);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('process-quarter')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'quarterDSGD', maxCount: 20 },
      { name: 'quarterConvertExchange', maxCount: 20 },
      { name: 'quarterTTTT', maxCount: 20 },
      { name: 'quarterWaitingTTTT', maxCount: 20 },
    ]),
  )
  async processQuarter(
    @UploadedFiles()
    files: {
      quarterDSGD?: any[];
      quarterConvertExchange?: any[];
      quarterTTTT?: any[];
      quarterWaitingTTTT?: any[];
    },
    @Body('startDate') startDateStr: string,
    @Body('endDate') endDateStr: string,
    @Res() res: express.Response,
  ) {
    if (!files?.quarterDSGD || files.quarterDSGD.length === 0) {
      throw new HttpException('Thiếu file Danh sách giao dịch (DSGD).', HttpStatus.BAD_REQUEST);
    }
    if (!files?.quarterTTTT || files.quarterTTTT.length === 0) {
      throw new HttpException('Thiếu file Trạng thái tất toán (TTTT).', HttpStatus.BAD_REQUEST);
    }
    if (!files?.quarterWaitingTTTT || files.quarterWaitingTTTT.length === 0) {
      throw new HttpException('Thiếu file Chờ tất toán (Waiting TTTT).', HttpStatus.BAD_REQUEST);
    }

    if (!startDateStr || !endDateStr) {
      throw new HttpException('Thiếu ngày bắt đầu hoặc ngày kết thúc.', HttpStatus.BAD_REQUEST);
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new HttpException('Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.', HttpStatus.BAD_REQUEST);
    }

    try {
      const outputPath = await this.tradingReportService.processQuarterReport(
        files.quarterDSGD.map((f) => f.buffer),
        files.quarterConvertExchange ? files.quarterConvertExchange.map((f) => f.buffer) : [],
        files.quarterTTTT.map((f) => f.buffer),
        files.quarterWaitingTTTT.map((f) => f.buffer),
        startDate,
        endDate,
      );

      if (!fs.existsSync(outputPath)) {
        throw new HttpException('Không tạo được file báo cáo quý.', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Bao_cao_khoi_luong_doanh_thu_quy.xlsx"',
      });

      const stream = fs.createReadStream(outputPath);
      stream.pipe(res);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('process-tttt')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'ttttT', maxCount: 20 },
      { name: 'ttttT1', maxCount: 20 },
    ]),
  )
  async processTttt(
    @UploadedFiles()
    files: {
      ttttT?: any[];
      ttttT1?: any[];
    },
    @Body('reportTypes') reportTypesStr: string,
    @Res() res: express.Response,
  ) {
    if (!files?.ttttT || files.ttttT.length === 0) {
      throw new HttpException('Thiếu file tất toán tháng này (TTTT T).', HttpStatus.BAD_REQUEST);
    }
    if (!files?.ttttT1 || files.ttttT1.length === 0) {
      throw new HttpException('Thiếu file tất toán tháng trước (TTTT T-1).', HttpStatus.BAD_REQUEST);
    }

    let reportTypes: Record<string, boolean> = {
      Member: true,
      Commodity: true,
    };
    if (reportTypesStr) {
      try {
        reportTypes = JSON.parse(reportTypesStr);
      } catch (err) {
        // use default
      }
    }

    try {
      const outputPath = await this.tradingReportService.processTtttReport(
        files.ttttT.map((f) => f.buffer),
        files.ttttT1.map((f) => f.buffer),
        reportTypes,
      );

      if (!fs.existsSync(outputPath)) {
        throw new HttpException('Không tạo được file báo cáo tất toán.', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Bao_cao_tat_toan_doi_chieu.xlsx"',
      });

      const stream = fs.createReadStream(outputPath);
      stream.pipe(res);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
