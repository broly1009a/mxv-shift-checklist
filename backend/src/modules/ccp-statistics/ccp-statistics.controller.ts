import {
  Controller,
  Post,
  Get,
  Body,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  Res,
  HttpException,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import * as express from 'express';
import * as fs from 'fs';
import { CcpStatisticsService } from './ccp-statistics.service';
import { CcpLotStatisticsService } from './ccp-lot-statistics.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['ccp-statistics', 'api/v1/ccp-statistics'])
export class CcpStatisticsController {
  constructor(
    private readonly ccpStatisticsService: CcpStatisticsService,
    private readonly ccpLotStatisticsService: CcpLotStatisticsService,
    private readonly settingsService: SystemSettingsService,
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
      pathNormalLot?: string;
      pathSpreadLot?: string;
      pathLmeLot?: string;
      pathOptionsLot?: string;
      pathDsgdCumulative?: string;
      pathGtgdNormal?: string;
      pathGtgdSpread?: string;
      pathGtgdLme?: string;
      pathGtgdOptions?: string;
    },
  ) {
    if (!body?.result) {
      throw new HttpException(
        'Thiếu dữ liệu result trong body.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const config = await this.ccpLotStatisticsService.getConfig();
    const paths = {
      pathAcmLot: body.pathAcmLot || config.pathAcmLot || config.pathAcmCumulative || '',
      pathAcmGtgd: body.pathAcmGtgd || config.pathAcmGtgd || config.pathGtgdAcm || '',
      pathNormalLot: body.pathNormalLot || config.pathNormalLot || config.pathNormalCumulative || '',
      pathSpreadLot: body.pathSpreadLot || config.pathSpreadLot || config.pathSpreadCumulative || '',
      pathLmeLot: body.pathLmeLot || config.pathLmeLot || config.pathLmeCumulative || '',
      pathOptionsLot: body.pathOptionsLot || config.pathOptionsLot || config.pathOptionsCumulative || '',
      pathDsgdCumulative: body.pathDsgdCumulative || config.pathDsgdCumulative || '',
      pathGtgdNormal: body.pathGtgdNormal || config.pathGtgdNormal || '',
      pathGtgdSpread: body.pathGtgdSpread || config.pathGtgdSpread || '',
      pathGtgdLme: body.pathGtgdLme || config.pathGtgdLme || '',
      pathGtgdOptions: body.pathGtgdOptions || config.pathGtgdOptions || '',
    };

    const hasAnyPath = Object.values(paths).some((p) => p && String(p).trim().length > 0);
    if (!hasAnyPath) {
      throw new HttpException(
        'Chưa cấu hình bất kỳ đường dẫn file lũy kế nào. Vui lòng vào Cấu hình đường dẫn để thiết lập.',
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
        paths,
        undefined, // dsgdBuffer (nếu upload)
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

  /**
   * POST /api/v1/ccp-statistics/lot-statistics/sync-exchange-rate
   *
   * Đồng bộ và lưu tỷ giá mới nhất từ tệp ngày CoreCCP (hoặc file tỷ giá tải lên) vào CSDL MongoDB.
   * Body: { date?: string }
   */
  @Post('lot-statistics/sync-exchange-rate')
  @Permissions('ACCESS_AUTO_SHIFT')
  async syncExchangeRate(@Body() body: { date?: string }) {
    const targetDate = body?.date || new Date().toISOString().split('T')[0];
    try {
      const result = await this.ccpLotStatisticsService.syncAndSaveExchangeRates(targetDate);
      return {
        success: result.success,
        data: result,
        message: result.message,
      };
    } catch (err: any) {
      throw new HttpException(
        `Lỗi đồng bộ tỷ giá: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/ccp-statistics/lot-statistics/upload-tygia
   *
   * Tải lên riêng lẻ file tỷ giá Excel/CSV, bóc tách và tự động lưu ngay vào CSDL MongoDB.
   */
  @Post('lot-statistics/upload-tygia')
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTyGiaFile(@UploadedFile() file: any) {
    if (!file || !file.buffer) {
      throw new HttpException('Vui lòng chọn file tỷ giá.', HttpStatus.BAD_REQUEST);
    }
    try {
      const rates = this.ccpLotStatisticsService.parseTyGiaFile(file.buffer);
      const nowIso = new Date().toISOString();
      const usdRate = rates['USD'] || 0;
      if (usdRate > 0) {
        await this.settingsService.setSetting('ccp_usd_exchange_rate', String(usdRate));
        await this.settingsService.setSetting('ccp_rates_last_synced', nowIso);
        await this.settingsService.setSetting('exchange_rate_source', `Tệp tải lên: ${file.originalname}`);
        if (rates['JPY']) await this.settingsService.setSetting('ccp_jpy_exchange_rate', String(rates['JPY']));
        if (rates['MYR']) await this.settingsService.setSetting('ccp_myr_exchange_rate', String(rates['MYR']));
        if (rates['CNY'] || rates['RMB']) {
          const rmbVal = rates['CNY'] || rates['RMB'];
          await this.settingsService.setSetting('ccp_rmb_exchange_rate', String(rmbVal));
        }

        // Cập nhật ma trận động ccp_exchange_rates_matrix
        const matrixStr = await this.settingsService.getSetting('ccp_exchange_rates_matrix', '{}');
        let matrix: Record<string, any> = {};
        try { matrix = JSON.parse(matrixStr || '{}'); } catch { matrix = {}; }
        for (const [curr, rate] of Object.entries(rates)) {
          if (curr === 'VND') continue;
          matrix[curr] = {
            currencyCode: curr,
            conversionRate: rate,
            buyRate: matrix[curr]?.buyRate ?? rate,
            sellRate: matrix[curr]?.sellRate ?? rate,
            effectiveDate: nowIso.split('T')[0],
          };
        }
        await this.settingsService.setSetting('ccp_exchange_rates_matrix', JSON.stringify(matrix));
      }
      return {
        success: true,
        rates,
        lastSynced: nowIso,
        message: `Đã bóc tách thành công tỷ giá từ tệp ${file.originalname}: 1 USD = ${usdRate.toLocaleString('vi-VN')} đ`,
      };
    } catch (err: any) {
      throw new HttpException(`Lỗi xử lý file tỷ giá: ${err.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
