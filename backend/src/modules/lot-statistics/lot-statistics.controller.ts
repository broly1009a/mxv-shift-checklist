import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseInterceptors,
  UploadedFiles,
  HttpException,
  HttpStatus,
  Res,
  Logger,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as express from 'express';
import * as fs from 'fs';
import { LotStatisticsService } from './lot-statistics.service';
import { ProcessLotDto, LotConfigDto } from './dto/lot-statistics.dto';
import { saveTempExcel } from './helpers/excel-writer.helper';

@Controller('lot-statistics')
export class LotStatisticsController {
  private readonly logger = new Logger(LotStatisticsController.name);

  constructor(private readonly lotStatisticsService: LotStatisticsService) {}

  // ─── Config endpoints ───────────────────────────────────────────────────────

  @Get('config')
  async getConfig() {
    return this.lotStatisticsService.getConfig();
  }

  @Put('config')
  async saveConfig(@Body() config: LotConfigDto) {
    return this.lotStatisticsService.saveConfig(config as Record<string, string>);
  }

  // ─── Process endpoints ──────────────────────────────────────────────────────

  /**
   * POST /lot-statistics/process
   * Upload các file Excel, trả về JSON kết quả
   *
   * Multipart fields:
   *   fileDsgd  (required)
   *   fileFr    (required)
   *   fileTtm   (optional)
   *   fileTttt  (optional)
   *   fileOp    (optional)
   *   filePs    (optional)
   *
   * Body fields (form-data):
   *   ngayGD         "2026-07-16"
   *   truDates       JSON array string
   *   fefDates       JSON array string
   *   zftDates       JSON array string
   *   filterLmeKyHan "M26"
   *   deadline       number
   */
  @Post('process')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'fileDsgd', maxCount: 1 },
      { name: 'fileFr', maxCount: 1 },
      { name: 'fileTtm', maxCount: 1 },
      { name: 'fileTttt', maxCount: 1 },
      { name: 'fileOp', maxCount: 1 },
      { name: 'filePs', maxCount: 1 },
    ]),
  )
  async process(
    @UploadedFiles()
    files: {
      fileDsgd?: any[];
      fileFr?: any[];
      fileTtm?: any[];
      fileTttt?: any[];
      fileOp?: any[];
      filePs?: any[];
    },
    @Body('ngayGD') ngayGD: string,
    @Body('truDates') truDatesStr: string,
    @Body('fefDates') fefDatesStr: string,
    @Body('zftDates') zftDatesStr: string,
    @Body('filterLmeKyHan') filterLmeKyHan: string,
    @Body('deadline') deadlineStr: string,
  ) {
    // Validate required files
    if (!files?.fileDsgd?.[0]) {
      throw new HttpException(
        'Thiếu file DSGD (fileDsgd). Vui lòng upload file DSGD từ CQG.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!files?.fileFr?.[0]) {
      throw new HttpException(
        'Thiếu file FR (fileFr). Vui lòng upload file FR từ MXV system.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!ngayGD) {
      throw new HttpException(
        'Thiếu ngày giao dịch (ngayGD). Format: YYYY-MM-DD.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (isNaN(new Date(ngayGD).getTime())) {
      throw new HttpException(
        `Ngày giao dịch không hợp lệ: "${ngayGD}". Format: YYYY-MM-DD.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const params: ProcessLotDto = {
      ngayGD,
      truDates: this.parseJsonArray(truDatesStr),
      fefDates: this.parseJsonArray(fefDatesStr),
      zftDates: this.parseJsonArray(zftDatesStr),
      filterLmeKyHan: filterLmeKyHan || undefined,
      deadline: deadlineStr ? parseFloat(deadlineStr) : undefined,
    };

    try {
      const result = await this.lotStatisticsService.processLotStatistics(
        {
          fileDsgd: files.fileDsgd[0].buffer,
          fileFr: files.fileFr[0].buffer,
          fileTtm: files.fileTtm?.[0]?.buffer,
          fileTttt: files.fileTttt?.[0]?.buffer,
          fileOp: files.fileOp?.[0]?.buffer,
          filePs: files.filePs?.[0]?.buffer,
        },
        params,
      );
      return result;
    } catch (err) {
      this.logger.error('Lỗi xử lý lot statistics', err?.stack);
      throw new HttpException(
        err?.message ?? 'Lỗi xử lý file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /lot-statistics/process/download
   * Giống /process nhưng trả về file Excel để download
   */
  @Post('process/download')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'fileDsgd', maxCount: 1 },
      { name: 'fileFr', maxCount: 1 },
      { name: 'fileTtm', maxCount: 1 },
      { name: 'fileTttt', maxCount: 1 },
      { name: 'fileOp', maxCount: 1 },
      { name: 'filePs', maxCount: 1 },
    ]),
  )
  async processAndDownload(
    @UploadedFiles()
    files: {
      fileDsgd?: any[];
      fileFr?: any[];
      fileTtm?: any[];
      fileTttt?: any[];
      fileOp?: any[];
      filePs?: any[];
    },
    @Body('ngayGD') ngayGD: string,
    @Body('truDates') truDatesStr: string,
    @Body('fefDates') fefDatesStr: string,
    @Body('zftDates') zftDatesStr: string,
    @Body('filterLmeKyHan') filterLmeKyHan: string,
    @Body('deadline') deadlineStr: string,
    @Res() res: express.Response,
  ) {
    if (!files?.fileDsgd?.[0]) {
      throw new HttpException('Thiếu file DSGD', HttpStatus.BAD_REQUEST);
    }
    if (!files?.fileFr?.[0]) {
      throw new HttpException('Thiếu file FR', HttpStatus.BAD_REQUEST);
    }
    if (!ngayGD || isNaN(new Date(ngayGD).getTime())) {
      throw new HttpException('Ngày giao dịch không hợp lệ', HttpStatus.BAD_REQUEST);
    }

    const params: ProcessLotDto = {
      ngayGD,
      truDates: this.parseJsonArray(truDatesStr),
      fefDates: this.parseJsonArray(fefDatesStr),
      zftDates: this.parseJsonArray(zftDatesStr),
      filterLmeKyHan: filterLmeKyHan || undefined,
      deadline: deadlineStr ? parseFloat(deadlineStr) : undefined,
    };

    try {
      const result = await this.lotStatisticsService.processLotStatistics(
        {
          fileDsgd: files.fileDsgd[0].buffer,
          fileFr: files.fileFr[0].buffer,
          fileTtm: files.fileTtm?.[0]?.buffer,
          fileTttt: files.fileTttt?.[0]?.buffer,
          fileOp: files.fileOp?.[0]?.buffer,
          filePs: files.filePs?.[0]?.buffer,
        },
        params,
      );

      // Tạo tên file theo ngày GD
      const dateStr = ngayGD.replace(/-/g, '');
      const filename = `Thong_ke_so_lot_${dateStr}.xlsx`;
      const tmpPath = await saveTempExcel(result, filename);

      if (!fs.existsSync(tmpPath)) {
        throw new Error('Không tạo được file Excel kết quả');
      }

      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });

      const stream = fs.createReadStream(tmpPath);
      stream.on('end', () => {
        // Xóa file tạm sau khi gửi
        fs.unlink(tmpPath, () => {});
      });
      stream.pipe(res);
    } catch (err) {
      this.logger.error('Lỗi tạo file Excel kết quả', err?.stack);
      throw new HttpException(
        err?.message ?? 'Lỗi tạo file Excel',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private parseJsonArray(str: string | undefined): string[] | undefined {
    if (!str) return undefined;
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
}
