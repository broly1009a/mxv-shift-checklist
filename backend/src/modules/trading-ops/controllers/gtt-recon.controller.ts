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
} from '@nestjs/common';
import type { Response } from 'express';
import * as path from 'path';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { GttCheckerService } from '../services/gtt-checker.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['api/v1/trading-ops', 'api/v1/reconciliation', 'reconciliation'])
export class GttReconController {
  private readonly logger = new Logger(GttReconController.name);

  constructor(private readonly gttService: GttCheckerService) {}

  /**
   * Kích hoạt kiểm tra đối chiếu GTT giữa M-System và CQG.
   */
  @Post('run-gtt-check')
  async runGttCheck(
    @Body() body: { downloadMarketCsv?: boolean; async?: boolean; targetDate?: string } = {},
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
  async getGttReport(@Query('date') dateQuery?: string) {
    const report = this.gttService.getLatestReport();
    const isRunning = this.gttService.getIsRunning();
    const currentLogs = this.gttService.getCurrentLogs();

    if (isRunning) {
      return { success: true, isRunning: true, currentLogs, report: null };
    }

    if (!report) {
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
