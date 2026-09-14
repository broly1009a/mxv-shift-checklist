import {
  Controller,
  Post,
  Get,
  Body,
  UseInterceptors,
  UploadedFiles,
  Res,
  HttpException,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as express from 'express';
import * as fs from 'fs';
import { CcpStatisticsService } from './ccp-statistics.service';
import { CcpLotStatisticsService } from './ccp-lot-statistics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['ccp-statistics', 'api/v1/ccp-statistics'])
export class CcpStatisticsController {
  constructor(
    private readonly ccpStatisticsService: CcpStatisticsService,
    private readonly ccpLotStatisticsService: CcpLotStatisticsService,
  ) {}

  // ─── Existing: CCP Pilot Statistics ──────────────────────────────────────

  @Get('config')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getConfig() {
    return this.ccpStatisticsService.getConfig();
  }

  @Post('config')
  @Permissions('ACCESS_AUTO_SHIFT')
  async saveConfig(@Body() config: any) {
    return this.ccpStatisticsService.saveConfig(config);
  }

  @Post('process')
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'dsgdCcp', maxCount: 1 },
      { name: 'dsgdMmCcp', maxCount: 1 },
      { name: 'dstkgd', maxCount: 1 },
      { name: 'nr', maxCount: 1 },
      { name: 'ttm', maxCount: 1 },
      { name: 'tttt', maxCount: 1 },
    ]),
  )
  async processCcp(
    @UploadedFiles()
    files: {
      dsgdCcp?: any[];
      dsgdMmCcp?: any[];
      dstkgd?: any[];
      nr?: any[];
      ttm?: any[];
      tttt?: any[];
    },
    @Body('date') dateStr: string,
    @Res() res: express.Response,
  ) {
    if (
      !files.dsgdCcp?.[0] ||
      !files.dsgdMmCcp?.[0] ||
      !files.dstkgd?.[0] ||
      !files.nr?.[0] ||
      !files.ttm?.[0] ||
      !files.tttt?.[0]
    ) {
      throw new HttpException(
        'Vui lòng tải lên đầy đủ 6 file Excel (DSGD CCP, DSGD MM CCP, DSTKGD, NR, TTM, TTTT).',
        HttpStatus.BAD_REQUEST,
      );
    }

    const selectedDate = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(selectedDate.getTime())) {
      throw new HttpException(
        'Ngày chọn không hợp lệ.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const outputPath = await this.ccpStatisticsService.processCcpData(
        {
          dsgdCcp: files.dsgdCcp[0].buffer,
          dsgdMmCcp: files.dsgdMmCcp[0].buffer,
          dstkgd: files.dstkgd[0].buffer,
          nr: files.nr[0].buffer,
          ttm: files.ttm[0].buffer,
          tttt: files.tttt[0].buffer,
        },
        selectedDate,
      );

      if (!fs.existsSync(outputPath)) {
        throw new HttpException(
          'Không tìm thấy file kết quả.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      res.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="Thong_ke_kich_ban_Pilot_Bac_Final.xlsx"',
      });

      const stream = fs.createReadStream(outputPath);
      stream.pipe(res);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ─── NEW: CCP Lot & Value Statistics ──────────────────────────────────────

  /**
   * GET /api/v1/ccp-statistics/lot-statistics/config
   * Lấy cấu hình đường dẫn file lũy kế + CCP API URL
   */
  @Get('lot-statistics/config')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getLotConfig() {
    return this.ccpLotStatisticsService.getConfig();
  }

  /**
   * POST /api/v1/ccp-statistics/lot-statistics/config
   * Lưu cấu hình đường dẫn file lũy kế + CCP API URL
   */
  @Post('lot-statistics/config')
  @Permissions('ACCESS_AUTO_SHIFT')
  async saveLotConfig(@Body() config: any) {
    return this.ccpLotStatisticsService.saveConfig(config);
  }

  /**
   * POST /api/v1/ccp-statistics/lot-statistics
   *
   * Upload files CCP để tính thống kê Lot + Giá trị giao dịch.
   *
   * Form fields:
   *   - dsgdCcp   (required)  : File DSGD từ CCP
   *   - dsgdMmCcp (optional)  : File DSGD Market Maker từ CCP
   *   - ttm       (optional)  : File TTM (Trạng thái mở) từ CCP
   *   - tttt      (optional)  : File TTTT (Tất toán) từ CCP
   *   - tyGia     (optional)  : File Tỷ giá xuất từ CCP
   *   - date      (required)  : Ngày giao dịch YYYY-MM-DD
   *
   * Response: JSON CcpLotResult
   *   { ngayGD, byTvkd[], totalSoLot, totalGiaTri, acmLot, tyGiaUsed, warnings }
   */
  @Post('lot-statistics')
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'dsgdCcp', maxCount: 1 },
      { name: 'dsgdMmCcp', maxCount: 1 },
      { name: 'ttm', maxCount: 1 },
      { name: 'tttt', maxCount: 1 },
      { name: 'tyGia', maxCount: 1 },
    ]),
  )
  async processLotStatistics(
    @UploadedFiles()
    files: {
      dsgdCcp?: any[];
      dsgdMmCcp?: any[];
      ttm?: any[];
      tttt?: any[];
      tyGia?: any[];
    },
    @Body('date') dateStr: string,
    @Body('hhOverrides') hhOverridesJson?: string,
  ) {
    if (!files.dsgdCcp?.[0]) {
      throw new HttpException(
        'Vui lòng tải lên file DSGD CCP (bắt buộc).',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!dateStr) {
      throw new HttpException(
        'Thiếu tham số date (YYYY-MM-DD).',
        HttpStatus.BAD_REQUEST,
      );
    }

    const ngayGD = new Date(dateStr);
    if (isNaN(ngayGD.getTime())) {
      throw new HttpException('Ngày giao dịch không hợp lệ.', HttpStatus.BAD_REQUEST);
    }

    // Parse hhOverrides nếu được truyền (JSON array CcpHhSpec[])
    let hhOverrides: any[] | undefined;
    if (hhOverridesJson) {
      try {
        hhOverrides = JSON.parse(hhOverridesJson);
      } catch {
        throw new HttpException('hhOverrides JSON không hợp lệ.', HttpStatus.BAD_REQUEST);
      }
    }

    try {
      const result = await this.ccpLotStatisticsService.processCcpLotStatistics(
        {
          dsgdCcp: files.dsgdCcp[0].buffer,
          dsgdMmCcp: files.dsgdMmCcp?.[0]?.buffer,
          ttm: files.ttm?.[0]?.buffer,
          tttt: files.tttt?.[0]?.buffer,
          tyGia: files.tyGia?.[0]?.buffer,
        },
        {
          ngayGD: dateStr,
          hhOverrides,
        },
      );

      return result;
    } catch (err) {
      throw new HttpException(
        `Lỗi xử lý thống kê lot CCP: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  /**
   * POST /api/v1/ccp-statistics/lot-statistics/write-accumulator
   *
   * Ghi kết quả tổng hợp lot CCP (CcpLotResult) vào file lũy kế Excel.
   *
   * Body: { result: CcpLotResult } – JSON kết quả từ endpoint lot-statistics
   *   Và tuỳ chọn: { pathAcmLot?: string, pathAcmGtgd?: string }
   *   Nếu không truyền path, sẽ lấy từ system_settings (cấu hình đường dẫn).
   */
  @Post('lot-statistics/write-accumulator')
  @Permissions('ACCESS_AUTO_SHIFT')
  async writeLotToAccumulator(
    @Body()
    body: {
      result: any;         // CcpLotResult (serialized)
      pathAcmLot?: string;
      pathAcmGtgd?: string;
    },
  ) {
    if (!body?.result) {
      throw new HttpException(
        'Thiếu dữ liệu result trong body.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Lấy paths: uu tiên từ body, fallback sang config trong DB
    let pathAcmLot = body.pathAcmLot;
    let pathAcmGtgd = body.pathAcmGtgd;

    if (!pathAcmLot || !pathAcmGtgd) {
      const config = await this.ccpLotStatisticsService.getConfig();
      pathAcmLot = pathAcmLot || config.pathAcmCumulative || '';
      pathAcmGtgd = pathAcmGtgd || config.pathGtgdAcm || '';
    }

    if (!pathAcmLot && !pathAcmGtgd) {
      throw new HttpException(
        'Chưa cấu hình đường dẫn file lũy kế (pathAcmLot / pathGtgdAcm). Vui lòng vào Cấu hình đường dẫn để thiết lập.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Deserialize ngayGD string → Date
    const result = {
      ...body.result,
      ngayGD: new Date(body.result.ngayGD),
    };

    const jobLogs: string[] = [];
    try {
      const writeResult = await this.ccpLotStatisticsService.writeToAccumulator(
        result,
        { pathAcmLot, pathAcmGtgd },
        jobLogs,
      );

      return {
        success: writeResult.errors.length === 0,
        lotUpdated: writeResult.lotUpdated,
        gtgdUpdated: writeResult.gtgdUpdated,
        errors: writeResult.errors,
        logs: jobLogs,
      };
    } catch (err) {
      throw new HttpException(
        `Lỗi ghi file lũy kế: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/ccp-statistics/lot-statistics/scan-daily?date=YYYY-MM-DD
   *
   * Tự động quét thư mục backup theo ngày phiên để kiểm tra các file báo cáo CCP có sẵn.
   */
  @Get('lot-statistics/scan-daily')
  @Permissions('ACCESS_AUTO_SHIFT')
  async scanDaily(
    @Query('date') date?: string,
  ) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    try {
      const scanResult = await this.ccpLotStatisticsService.scanDailyFiles(targetDate);
      return {
        success: true,
        data: scanResult,
      };
    } catch (err: any) {
      throw new HttpException(
        `Lỗi quét thư mục ngày: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/ccp-statistics/lot-statistics/process-daily
   *
   * Tự động đọc các file trong thư mục ngày và tính toán thống kê số lot & GTGD.
   * Body: { date: string }
   */
  @Post('lot-statistics/process-daily')
  @Permissions('ACCESS_AUTO_SHIFT')
  async processDaily(
    @Body() body: { date?: string },
  ) {
    const targetDate = body?.date || new Date().toISOString().split('T')[0];
    try {
      const result = await this.ccpLotStatisticsService.processDailyFiles(targetDate);
      return {
        success: true,
        data: result,
        message: `Đã tính toán thành công từ thư mục backup ngày ${targetDate}`,
      };
    } catch (err: any) {
      throw new HttpException(
        `Lỗi xử lý file từ thư mục ngày: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
