import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  Req,
  Res,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { CeLotStatisticsService } from '../services/ce-lot-statistics.service';
import { TradingOpsPreflightService } from '../services/trading-ops-preflight.service';
import { BotJobQueueService } from '../../bot-engine/bot-job-queue.service';
import { BotJob } from '../../../schemas/bot-job.schema';

/**
 * Controller chuyên biệt quản lý nghiệp vụ Thống kê Số Lot & Giá trị Giao dịch Core Exchange (CE)
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller([
  'api/v1/ce-clearing',
  'api/v1/ce-statistics',
])
export class CeReconController {
  private readonly logger = new Logger(CeReconController.name);

  constructor(
    private readonly ceLotStatisticsService: CeLotStatisticsService,
    private readonly preflightService: TradingOpsPreflightService,
    @Optional()
    @Inject(forwardRef(() => BotJobQueueService))
    private readonly botJobQueueService?: BotJobQueueService,
    @Optional()
    @InjectModel(BotJob.name)
    private readonly botJobModel?: Model<BotJob>,
  ) {}

  /**
   * GET /api/v1/ce-clearing/lot-statistics/scan-daily?date=YYYY-MM-DD
   * Tự động quét thư mục backup CE theo ngày phiên để kiểm tra các file báo cáo sẵn sàng.
   */
  @Get('lot-statistics/scan-daily')
  @Permissions('ACCESS_AUTO_SHIFT')
  async scanDaily(@Query('date') date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    try {
      const scanResult = await this.ceLotStatisticsService.scanDailyFiles(targetDate);
      return {
        success: true,
        data: scanResult,
      };
    } catch (err: any) {
      this.logger.error(`Lỗi quét thư mục CE ngày ${targetDate}: ${err.message}`);
      throw new HttpException(
        `Lỗi quét thư mục CE: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/ce-clearing/lot-statistics/process-daily
   * Tự động đọc file trong thư mục ngày của CE và tính toán thống kê Số Lot & GTGD.
   */
  @Post('lot-statistics/process-daily')
  @Permissions('ACCESS_AUTO_SHIFT')
  async processDaily(@Body() body: { date?: string }) {
    const targetDate = body?.date || new Date().toISOString().split('T')[0];
    try {
      const result = await this.ceLotStatisticsService.processDailyFiles(targetDate);
      return {
        success: true,
        data: result,
        message: `Đã tính toán thành công thống kê CE từ thư mục backup ngày ${targetDate}`,
      };
    } catch (err: any) {
      this.logger.error(`Lỗi xử lý file CE từ thư mục ngày ${targetDate}: ${err.message}`);
      throw new HttpException(
        `Lỗi xử lý file CE: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/ce-clearing/lot-statistics/run-lot
   * Tính toán và GHI TRỰC TIẾP vào file lũy kế Số Lot ACM.
   */
  /**
   * POST /api/v1/ce-clearing/lot-statistics/run-lot
   * Tính toán và GHI TRỰC TIẾP vào file lũy kế Số Lot ACM (hỗ trợ cờ forceOverwrite và exportDraft).
   */
  @Post('lot-statistics/run-lot')
  @Permissions('ACCESS_AUTO_SHIFT')
  async runLotDirect(
    @Body() body: { date?: string; forceOverwrite?: boolean; exportDraft?: boolean; async?: boolean; shiftLogId?: string } = {},
    @Req() req: any,
  ) {
    const targetDate = body?.date || new Date().toISOString().split('T')[0];

    if (body.async) {
      if (this.botJobQueueService) {
        const job = await this.botJobQueueService.enqueue('CE_LOT_STATS', {
          targetDate,
          ...body,
          scope: body.shiftLogId ? 'CHECKLIST' : 'OPERATION_TOOL',
          userId: req?.user?.userId || req?.user?.id || req?.user?._id,
          username: req?.user?.username || 'SYSTEM',
        });

        return {
          success: true,
          isRunning: true,
          jobId: job._id,
          message: `Đã đưa yêu cầu thống kê Số Lot CoreEX ngày ${targetDate} vào hàng đợi xử lý.`,
        };
      }
    }

    try {
      const user = req?.user ? { id: req.user.userId || req.user._id, username: req.user.username } : undefined;
      const result = await this.ceLotStatisticsService.runLotStatisticsDirect(
        targetDate,
        { forceOverwrite: body?.forceOverwrite, exportDraft: body?.exportDraft },
        user,
      );

      // Nếu cần xác nhận ghi đè từ người dùng
      if (result.requiresConfirmation) {
        return {
          success: false,
          requiresConfirmation: true,
          hasExistingData: true,
          existingTotal: result.existingTotal,
          existingRow: result.existingRow,
          message: result.message,
          type: 'LOT',
          date: targetDate,
          logs: result.logs,
        };
      }

      // Nếu là xuất file Draft
      if (result.isDraft) {
        return {
          success: true,
          isDraft: true,
          draftFile: result.draftFile,
          draftPath: result.draftPath,
          message: result.message,
          logs: result.logs,
        };
      }

      return {
        success: true,
        message: result.message || `Đã hoàn tất thống kê và ghi file lũy kế Số Lot CE cho ngày ${targetDate}`,
        logs: result.logs,
      };
    } catch (err: any) {
      this.logger.error(`Lỗi ghi file Số Lot CE: ${err.message}`);
      throw new HttpException(
        `Lỗi ghi file Số Lot CE: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/ce-clearing/lot-statistics/run-value
   * Tính toán và GHI TRỰC TIẾP vào file lũy kế Giá Trị Giao Dịch ACM (hỗ trợ cờ forceOverwrite và exportDraft).
   */
  @Post('lot-statistics/run-value')
  @Permissions('ACCESS_AUTO_SHIFT')
  async runValueDirect(
    @Body() body: { date?: string; forceOverwrite?: boolean; exportDraft?: boolean; async?: boolean; shiftLogId?: string } = {},
    @Req() req: any,
  ) {
    const targetDate = body?.date || new Date().toISOString().split('T')[0];

    if (body.async) {
      if (this.botJobQueueService) {
        const job = await this.botJobQueueService.enqueue('CE_VALUE_STATS', {
          targetDate,
          ...body,
          scope: body.shiftLogId ? 'CHECKLIST' : 'OPERATION_TOOL',
          userId: req?.user?.userId || req?.user?.id || req?.user?._id,
          username: req?.user?.username || 'SYSTEM',
        });

        return {
          success: true,
          isRunning: true,
          jobId: job._id,
          message: `Đã đưa yêu cầu thống kê Giá Trị CoreEX ngày ${targetDate} vào hàng đợi xử lý.`,
        };
      }
    }

    try {
      const user = req?.user ? { id: req.user.userId || req.user._id, username: req.user.username } : undefined;
      const result = await this.ceLotStatisticsService.runValueStatisticsDirect(
        targetDate,
        { forceOverwrite: body?.forceOverwrite, exportDraft: body?.exportDraft },
        user,
      );

      // Nếu cần xác nhận ghi đè từ người dùng
      if (result.requiresConfirmation) {
        return {
          success: false,
          requiresConfirmation: true,
          hasExistingData: true,
          existingTotal: result.existingTotal,
          existingRow: result.existingRow,
          message: result.message,
          type: 'GTGD',
          date: targetDate,
          logs: result.logs,
        };
      }

      // Nếu là xuất file Draft
      if (result.isDraft) {
        return {
          success: true,
          isDraft: true,
          draftFile: result.draftFile,
          draftPath: result.draftPath,
          message: result.message,
          logs: result.logs,
        };
      }

      return {
        success: true,
        message: result.message || `Đã hoàn tất thống kê và ghi file lũy kế GTGD CE cho ngày ${targetDate}`,
        logs: result.logs,
      };
    } catch (err: any) {
      this.logger.error(`Lỗi ghi file GTGD CE: ${err.message}`);
      throw new HttpException(
        `Lỗi ghi file GTGD CE: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/ce-clearing/lot-statistics/run-macro
   * Tự động tổng hợp và GHI TRỰC TIẾP toàn bộ Số Lot & Giá trị Giao dịch CoreEX (ACM Nano Macro).
   */
  @Post(['lot-statistics/run-macro', 'lot-statistics/run-all'])
  @Permissions('ACCESS_AUTO_SHIFT')
  async runMacroDirect(
    @Body() body: { date?: string; forceOverwrite?: boolean; exportDraft?: boolean; async?: boolean; shiftLogId?: string } = {},
    @Req() req: any,
  ) {
    const targetDate = body?.date || new Date().toISOString().split('T')[0];

    if (body.async) {
      if (this.botJobQueueService) {
        const job = await this.botJobQueueService.enqueue('RUN_MACRO_CE', {
          targetDate,
          ...body,
          scope: body.shiftLogId ? 'CHECKLIST' : 'OPERATION_TOOL',
          userId: req?.user?.userId || req?.user?.id || req?.user?._id,
          username: req?.user?.username || 'SYSTEM',
        });

        return {
          success: true,
          isRunning: true,
          jobId: job._id,
          message: `Đã đưa yêu cầu chạy Macro CoreEX toàn diện ngày ${targetDate} vào hàng đợi xử lý.`,
        };
      }
    }

    try {
      const user = req?.user ? { id: req.user.userId || req.user._id, username: req.user.username } : undefined;
      const lotRes = await this.ceLotStatisticsService.runLotStatisticsDirect(
        targetDate,
        { forceOverwrite: body?.forceOverwrite, exportDraft: body?.exportDraft },
        user,
      );
      const valRes = await this.ceLotStatisticsService.runValueStatisticsDirect(
        targetDate,
        { forceOverwrite: body?.forceOverwrite, exportDraft: body?.exportDraft },
        user,
      );
      return {
        success: lotRes.success !== false && valRes.success !== false,
        message: `${lotRes.message || ''} | ${valRes.message || ''}`,
        lotResult: lotRes,
        valueResult: valRes,
        logs: [...(lotRes.logs || []), ...(valRes.logs || [])],
      };
    } catch (err: any) {
      this.logger.error(`Lỗi chạy Macro CoreEX: ${err.message}`);
      throw new HttpException(
        `Lỗi chạy Macro CoreEX: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/ce-clearing/lot-statistics/run-history
   * Truy vấn danh sách lịch sử thực thi thống kê Số Lot & Giá Trị CoreEX gần nhất
   */
  @Get('lot-statistics/run-history')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getLotRunHistory(
    @Query('date') date?: string,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Math.min(50, Math.max(1, parseInt(limit, 10))) : 20;
    return this.ceLotStatisticsService.getRunHistory(date, lim);
  }

  /**
   * GET /api/v1/ce-clearing/lot-statistics/latest-run
   * Truy vấn bản ghi chạy gần nhất (cho phiên giao dịch nếu chỉ định)
   */
  @Get('lot-statistics/latest-run')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getLatestLotRun(
    @Query('date') date?: string,
    @Query('jobId') jobIdQuery?: string,
  ) {
    if (this.botJobModel) {
      const activeJob = jobIdQuery
        ? await this.botJobModel.findById(jobIdQuery).exec()
        : await this.botJobModel
            .findOne({
              jobType: { $in: ['RUN_MACRO_CE', 'CE_STATISTICS', 'CE_LOT_STATS', 'CE_VALUE_STATS'] },
              status: { $in: ['PENDING', 'PROCESSING'] },
            })
            .sort({ createdAt: -1 })
            .exec();

      if (activeJob) {
        return {
          success: true,
          isRunning: true,
          jobId: activeJob._id,
          status: activeJob.status,
          currentLogs: activeJob.logs || [],
          data: null,
        };
      }
    }

    const runs = await this.ceLotStatisticsService.getRunHistory(date, 1);
    return runs.length > 0 ? runs[0] : null;
  }

  /**
   * GET /api/v1/ce-clearing/lot-statistics/preflight
   * Kiểm tra thông tin các file sẽ chạy và kiểm tra đường dẫn lưu file có hợp lý không
   */
  @Get('lot-statistics/preflight')
  @Permissions('ACCESS_AUTO_SHIFT')
  async inspectPreFlight(
    @Query('date') date?: string,
    @Query('type') type?: 'LOT' | 'VALUE' | 'ALL',
  ) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.preflightService.inspect({
      taskKey: 'CE_STATISTICS',
      dateStr: targetDate,
      filterScope: type || 'ALL',
    });
  }

  /**
   * GET /api/v1/ce-clearing/lot-statistics/download-draft?filename=...
   * Tải trực tiếp file bản nháp Draft về máy
   */
  @Get('lot-statistics/download-draft')
  @Permissions('ACCESS_AUTO_SHIFT')
  async downloadDraft(@Query('filename') filename: string, @Res() res: any) {
    if (!filename) {
      throw new HttpException('Thiếu tham số tên file bản nháp', HttpStatus.BAD_REQUEST);
    }
    const safeName = path.basename(filename);
    const draftPath = await this.ceLotStatisticsService.getDraftFilePath(safeName);
    if (!fs.existsSync(draftPath)) {
      throw new HttpException(`Không tìm thấy file bản nháp: ${safeName}`, HttpStatus.NOT_FOUND);
    }
    return res.download(draftPath, safeName);
  }

  /**
   * GET /api/v1/ce-clearing/lot-statistics/config
   */
  @Get('lot-statistics/config')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getConfig() {
    try {
      const config = await this.ceLotStatisticsService.getConfig();
      return {
        success: true,
        data: config,
      };
    } catch (err: any) {
      throw new HttpException(
        `Lỗi đọc cấu hình thống kê CE: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /api/v1/ce-clearing/lot-statistics/config
   */
  @Put('lot-statistics/config')
  @Permissions('ACCESS_AUTO_SHIFT')
  async saveConfig(@Body() body: Record<string, any>) {
    try {
      const result = await this.ceLotStatisticsService.saveConfig(body);
      return {
        success: true,
        message: 'Đã lưu cấu hình thống kê CE thành công',
      };
    } catch (err: any) {
      throw new HttpException(
        `Lỗi lưu cấu hình thống kê CE: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
