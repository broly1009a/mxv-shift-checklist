/**
 * gtt-recon.controller.ts
 *
 * Controller chuyên trách Đối soát Giá thanh toán (GTT) giữa M-System và CQG.
 * Chuẩn Clean Architecture & Domain-Driven Design (DDD).
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  HttpException,
  HttpStatus,
  UseGuards,
  Logger,
  Optional,
  Inject,
  forwardRef,
  Req,
} from '@nestjs/common';
import type { Response } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { GttCheckerService } from '../services/recon/gtt-checker.service';
import { BotJobQueueService } from '../../bot-engine/bot-job-queue.service';
import { BotJob } from '../../../schemas/bot-job.schema';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['api/v1/trading-ops', 'api/v1/reconciliation', 'reconciliation'])
export class GttReconController {
  private readonly logger = new Logger(GttReconController.name);

  constructor(
    private readonly gttService: GttCheckerService,
    @Optional()
    @Inject(forwardRef(() => BotJobQueueService))
    private readonly botJobQueueService?: BotJobQueueService,
    @Optional()
    @InjectModel(BotJob.name)
    private readonly botJobModel?: Model<BotJob>,
  ) {}

  /**
   * Kích hoạt kiểm tra đối chiếu GTT giữa M-System và CQG.
   */
  @Post('run-gtt-check')
  async runGttCheck(
    @Body() body: { downloadMarketCsv?: boolean; async?: boolean; targetDate?: string; shiftLogId?: string } = {},
    @Req() req?: any,
  ) {
    if (this.gttService.getIsRunning()) {
      return {
        success: true,
        isRunning: true,
        message: 'Tiến trình kiểm tra GTT đang chạy ngầm.',
        report: this.gttService.getLatestReport(),
      };
    }

    if (body.async) {
      if (this.botJobQueueService) {
        const job = await this.botJobQueueService.enqueue('CHECK_GTT_LEGACY', {
          ...body,
          scope: body.shiftLogId ? 'CHECKLIST' : 'OPERATION_TOOL',
          userId: req?.user?.id || req?.user?.userId,
        });

        return {
          success: true,
          isRunning: true,
          jobId: job._id,
          message: 'Đã đưa yêu cầu đối chiếu GTT MS-CQG vào hàng đợi xử lý.',
          report: this.gttService.getLatestReport(),
        };
      }

      this.gttService.runGttCheck(body.downloadMarketCsv ?? true, body.targetDate).catch((err) => {
        this.logger.error(`[Background GTT Check] Lỗi: ${err.message}`, err.stack);
      });
      return {
        success: true,
        isRunning: true,
        message: 'Đã khởi động tiến trình kiểm tra GTT ngầm.',
        report: this.gttService.getLatestReport(),
      };
    }

    try {
      const report = await this.gttService.runGttCheck(body.downloadMarketCsv ?? true, body.targetDate);
      return { success: true, isRunning: false, report };
    } catch (err: any) {
      throw new HttpException(
        `Kiểm tra GTT thất bại: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Lấy báo cáo đối chiếu GTT mới nhất giữa M-System và CQG.
   */
  @Get('gtt-report')
  async getGttReport(
    @Query('date') dateQuery?: string,
    @Query('jobId') jobIdQuery?: string,
  ) {
    // 1. Kiểm tra Job đang chạy trong bot_jobs nếu có
    if (this.botJobModel) {
      const activeJob = jobIdQuery
        ? await this.botJobModel.findById(jobIdQuery).exec()
        : await this.botJobModel
            .findOne({
              jobType: 'CHECK_GTT_LEGACY',
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
          report: null,
        };
      }
    }

    // 2. Trả về kết quả từ service / cache
    const report = this.gttService.getLatestReport();
    const isRunning = this.gttService.getIsRunning();
    const currentLogs = this.gttService.getCurrentLogs();

    if (isRunning) {
      return { success: true, isRunning: true, currentLogs, report: null };
    }

    if (!report) {
      // 3. Phục hồi kết quả từ Job gần nhất nếu service vừa restart
      if (this.botJobModel) {
        const latestDoneJob = await this.botJobModel
          .findOne({ jobType: 'CHECK_GTT_LEGACY', status: 'COMPLETED' })
          .sort({ createdAt: -1 })
          .exec();
        if (latestDoneJob && (latestDoneJob.payload as any)?.result) {
          return {
            success: true,
            isRunning: false,
            currentLogs: latestDoneJob.logs || [],
            report: (latestDoneJob.payload as any).result,
          };
        }
      }

      return {
        success: false,
        isRunning: false,
        currentLogs: [],
        report: null,
        message: 'Chưa có báo cáo GTT nào. Hãy chạy kiểm tra GTT trước.',
      };
    }

    return { success: true, isRunning: false, currentLogs, report };
  }

  /**
   * Xuất file Excel điều chỉnh giá GTT (Dieu_Chinh_GTT.xlsx).
   */
  @Get('gtt-report/export-correction')
  async exportGttCorrection(
    @Query('type') type: 'settlement' | 'first_match' = 'settlement',
    @Res() res: Response,
  ) {
    try {
      const filePath = await this.gttService.generateCorrectionFile(type);
      const filename = path.basename(filePath);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      return res.download(filePath);
    } catch (err: any) {
      throw new HttpException(
        `Không thể xuất file sửa giá: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Đẩy dữ liệu sửa giá GTT trực tiếp lên M-System.
   */
  @Post('gtt-report/push-to-ms')
  async pushGttCorrectionToMs() {
    try {
      const result = await this.gttService.pushCorrectionToMSystem();
      if (!result.success) {
        throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
      }
      return result;
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        `Lỗi khi đẩy giá lên M-System: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
