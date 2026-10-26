/**
 * dsgd-before-eod-recon.controller.ts
 *
 * Controller chuyên trách Chốt đối chiếu 3 bên cuối ngày (Dsgd-Before-EOD Domain).
 * Chuẩn Clean Architecture & Domain-Driven Design (DDD).
 * Quản lý các endpoint điều phối tự động và truy vấn kết quả đối soát DSGD trước EOD.
 */

import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  BadRequestException,
  UseGuards,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TradingReconLog } from '../schemas/trading-recon-log.schema';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { ShiftsService } from '../../shifts/shifts.service';
import { DsgdBeforeEodService } from '../services/recon/dsgd-before-eod.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['api/v1/trading-ops', 'api/v1/reconciliation', 'reconciliation'])
export class DsgdBeforeEodReconController {
  private readonly logger = new Logger(DsgdBeforeEodReconController.name);

  constructor(
    private readonly dsgdBeforeEodService: DsgdBeforeEodService,
    private readonly shiftsService: ShiftsService,
    @Optional()
    @InjectModel(TradingReconLog.name)
    private readonly reconLogModel?: Model<TradingReconLog>,
  ) {}

  /**
   * Tự động kiểm tra DSGD trước EOD từ thư mục Backup Server/SFTP.
   */
  @Post('check-dsgd-before-eod')
  @Permissions('ACCESS_AUTO_SHIFT')
  async runAutoCheckDSGDBeforeEOD(
    @Body('system') system?: 'MS' | 'CCP',
    @Body('tradingDate') tradingDateStr?: string,
    @Body('timeSuffix') timeSuffix?: string,
    @Body('triggerDownload') triggerDownload?: boolean,
    @Body('exactDate') exactDate?: boolean,
    @Body('shiftLogId') shiftLogId?: string,
    @Body('taskId') taskId?: string,
  ) {
    const startTime = Date.now();
    try {
      const result = await this.dsgdBeforeEodService.runAutoCheckDSGDBeforeEOD({
        system,
        tradingDate: tradingDateStr ? new Date(tradingDateStr) : new Date(),
        timeSuffix,
        triggerDownload: Boolean(triggerDownload),
        exactDate: Boolean(exactDate),
      });

      const durationMs = Date.now() - startTime;
      const executedAt = new Date().toISOString();

      if (this.reconLogModel) {
        try {
          const dateStr = tradingDateStr
            ? new Date(tradingDateStr).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
          await this.reconLogModel.create({
            reconType: 'DSGD_BEFORE_EOD',
            tradingDate: dateStr,
            shiftLogId,
            taskId,
            passed: result.passed,
            totals: {
              system: result.system || system || 'MS',
              totalOriginal: result.totalOriginal,
              totalTemp: result.totalTemp,
              differTotal: result.differTotal,
              totalACMMS: result.totalACMMS,
              totalACMSFTP: result.totalACMSFTP,
              differACM: result.differACM,
              durationMs,
              executedAt,
            },
            dsgdBeforeEod: {
              ...result,
              system: result.system || system || 'MS',
              durationMs,
              executedAt,
            },
          });
        } catch (dbErr: any) {
          this.logger.warn(`Lỗi lưu TradingReconLog cho DSGD_BEFORE_EOD: ${dbErr.message}`);
        }
      }

      if (shiftLogId && taskId) {
        const systemUser = {
          id: '000000000000000000000000',
          fullName: 'Hệ thống tự động (Bot)',
          username: 'system_bot',
          role: 'ADMIN',
        };
        const status = result.passed ? 'PASSED' : 'NEEDS_ATTENTION';

        let note = `[KIỂM TRA DSGD TRƯỚC EOD (${result.system || 'MS'}) - TỰ ĐỘNG]\n`;
        if (result.sessionDate) {
          note += `• Ngày phiên đối chiếu: ${result.sessionDate}\n`;
        }
        if (result.isSnapshotMissing) {
          note += ` CẢNH BÁO AN TOÀN DỮ LIỆU: THIẾU FILE SNAPSHOT TRƯỚC EOD!\n`;
          note += `• Hệ thống đã chặn so sánh file gốc với chính nó để ngăn chặn báo thành công ảo.\n`;
        }
        note += `• Khối lượng DSGD gốc: ${result.totalOriginal} lot\n`;
        note += `• Khối lượng DSGD snapshot/tươi (${result.timeSuffix || 'mới nhất'}): ${result.isSnapshotMissing ? 'Không tìm thấy file snapshot' : `${result.totalTemp} lot (Chênh lệch: ${result.differTotal} lot)`}\n`;
        note += `• Khối lượng ACM ${result.system === 'CCP' ? 'CCP' : 'MS'} vs Straits: ${result.totalACMMS} vs ${result.totalACMSFTP} lot (Chênh lệch: ${result.differACM} lot)\n`;
        note += `• Kết luận: ${result.messages.join(' | ')}\n`;

        const noteJson = JSON.stringify({
          success: result.passed,
          message: note,
          result,
          type: 'CHECK_DSGD_BEFORE_EOD',
          system: result.system || 'MS',
          attempts: 1,
          maxAttempts: 1,
          executedAt,
          durationMs,
        });

        await this.shiftsService.updateTaskStatus(
          shiftLogId,
          taskId,
          status,
          systemUser,
          noteJson,
          true,
        );
      }

      return {
        success: result.passed,
        message: result.messages.join(' | '),
        result: {
          ...result,
          durationMs,
          executedAt,
        },
        durationMs,
        executedAt,
      };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Lấy kết quả kiểm tra DSGD trước EOD mới nhất của một phiên và phân hệ.
   */
  @Get('latest-dsgd-before-eod')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getLatestDsgdBeforeEod(
    @Query('system') system?: 'MS' | 'CCP',
    @Query('tradingDate') tradingDateStr?: string,
  ) {
    const targetSystem = system || 'MS';
    const dateStr = tradingDateStr
      ? new Date(tradingDateStr).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    if (this.reconLogModel) {
      const log = await this.reconLogModel
        .findOne({
          reconType: 'DSGD_BEFORE_EOD',
          tradingDate: dateStr,
          $or: [
            { 'totals.system': targetSystem },
            { 'dsgdBeforeEod.system': targetSystem },
          ],
        })
        .sort({ createdAt: -1 })
        .lean()
        .exec();

      if (log && log.dsgdBeforeEod) {
        return {
          success: true,
          result: log.dsgdBeforeEod,
          executedAt: (log.totals as any)?.executedAt || (log.dsgdBeforeEod as any)?.executedAt || log.createdAt,
          durationMs: (log.totals as any)?.durationMs || (log.dsgdBeforeEod as any)?.durationMs,
        };
      }
    }

    return {
      success: false,
      result: null,
      message: 'Chưa có kết quả đối chiếu DSGD trước EOD cho phiên này.',
    };
  }
}
