/**
 * pre-eod-recon.controller.ts
 *
 * Controller chuyên trách Chốt đối chiếu 3 bên cuối ngày (Pre-EOD / EOD Recon Domain).
 * Chuẩn Clean Architecture & Domain-Driven Design (DDD).
 */

import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { ShiftsService } from '../../shifts/shifts.service';
import { PreEodReconService } from '../services/pre-eod-recon.service';
import { CqgMergerService } from '../services/cqg-merger.service';
import { ReconConsoleSummaryService } from '../services/recon-console-summary.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['api/v1/trading-ops', 'api/v1/reconciliation', 'reconciliation'])
export class PreEodReconController {
  private readonly logger = new Logger(PreEodReconController.name);

  constructor(
    private readonly preEodReconService: PreEodReconService,
    private readonly reconConsoleSummaryService: ReconConsoleSummaryService,
    private readonly cqgMergerService: CqgMergerService,
    private readonly shiftsService: ShiftsService,
  ) {}

  /**
   * Upload file và thực hiện đối chiếu EOD cuối ngày (Số dư CQG & EOD M-System vs CCP).
   */
  @Post('upload-eod')
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'qltkgd', maxCount: 1 },
      { name: 'eod', maxCount: 1 },
      { name: 'tttt', maxCount: 1 },
      { name: 'accountsBalances', maxCount: 1 },
      { name: 'qltkgdCcp', maxCount: 1 },
      { name: 'eodCcp', maxCount: 1 },
      { name: 'ttttCcp', maxCount: 1 },
    ]),
  )
  async uploadAndReconcileEOD(
    @UploadedFiles()
    files: {
      qltkgd?: any[];
      eod?: any[];
      tttt?: any[];
      accountsBalances?: any[];
      qltkgdCcp?: any[];
      eodCcp?: any[];
      ttttCcp?: any[];
    },
    @Body('shiftLogId') shiftLogId: string,
    @Body('taskId') taskId: string,
    @Body('usdRate') usdRateStr?: string,
  ) {
    if (!shiftLogId || !taskId) {
      throw new BadRequestException('Thiếu shiftLogId hoặc taskId');
    }

    const usdRate = usdRateStr
      ? parseFloat(usdRateStr)
      : await this.reconConsoleSummaryService.getCurrentUsdRate();

    const fileBuffers = {
      qltkgd: files?.qltkgd?.[0]?.buffer,
      eod: files?.eod?.[0]?.buffer,
      tttt: files?.tttt?.[0]?.buffer,
      accountsBalances: files?.accountsBalances?.[0]?.buffer,
      qltkgdCcp: files?.qltkgdCcp?.[0]?.buffer,
      eodCcp: files?.eodCcp?.[0]?.buffer,
      ttttCcp: files?.ttttCcp?.[0]?.buffer,
    };

    const systemUser = {
      id: '000000000000000000000000',
      fullName: 'Hệ thống tự động (Bot)',
      username: 'system_bot',
      role: 'ADMIN',
    };

    try {
      // Case A: CQG EOD Balance check (if accountsBalances is uploaded)
      if (fileBuffers.accountsBalances) {
        if (!fileBuffers.qltkgd) {
          throw new BadRequestException(
            'File QLTKGD.xlsx là bắt buộc để đối chiếu số dư CQG.',
          );
        }

        const result = await this.cqgMergerService.checkEODCQG(
          {
            qltkgd: fileBuffers.qltkgd,
            accountsBalances: fileBuffers.accountsBalances,
            qltkgdName: files?.qltkgd?.[0]?.originalname,
            accountsBalancesName: files?.accountsBalances?.[0]?.originalname,
          },
          usdRate,
        );

        const hasDiscrepancy = result.length > 0;
        const status = hasDiscrepancy ? 'NEEDS_ATTENTION' : 'PASSED';

        let note = `[ĐỐI CHIẾU SỐ DƯ CQG TỰ ĐỘNG]\n`;
        note += `• Số tài khoản chênh lệch (> 100 USD): ${result.length}\n`;
        if (result.length > 0) {
          note += ` Danh sách tài khoản lệch:\n`;
          result.slice(0, 10).forEach((r) => {
            note += `  - TK ${r.maTKGD}: MS $${r.calculatedBalance} vs CQG $${r.cqgBalance} (Chênh lệch: $${r.differ.toFixed(2)})\n`;
          });
          if (result.length > 10) {
            note += `  ... và ${result.length - 10} tài khoản khác.\n`;
          }
        } else {
          note += `✓ Số dư khớp hoàn toàn giữa M-System và CQG.\n`;
        }

        const noteJson = JSON.stringify({
          success: !hasDiscrepancy,
          message: note,
          result,
          type: 'CQG',
          usdRate,
          attempts: 1,
          maxAttempts: 1,
          executedAt: new Date().toISOString(),
        });

        await this.shiftsService.updateTaskStatus(
          shiftLogId,
          taskId,
          status,
          systemUser,
          noteJson,
          true,
        );

        return {
          success: !hasDiscrepancy,
          type: 'CQG',
          message: hasDiscrepancy
            ? 'Đối chiếu số dư CQG có chênh lệch.'
            : 'Đối chiếu số dư CQG khớp hoàn toàn.',
          result,
        };
      }

      // Case B: EOD Check song song MS & CCP (if qltkgd or qltkgdCcp is uploaded and accountsBalances is not)
      if ((fileBuffers.qltkgd || fileBuffers.qltkgdCcp) && !fileBuffers.accountsBalances) {
        const result = await this.preEodReconService.checkEOD({
          qltkgd: fileBuffers.qltkgd,
          eod: fileBuffers.eod,
          tttt: fileBuffers.tttt,
          qltkgdName: files?.qltkgd?.[0]?.originalname,
          eodName: files?.eod?.[0]?.originalname,
          ttttName: files?.tttt?.[0]?.originalname,
          qltkgdCcp: fileBuffers.qltkgdCcp,
          eodCcp: fileBuffers.eodCcp,
          ttttCcp: fileBuffers.ttttCcp,
          qltkgdCcpName: files?.qltkgdCcp?.[0]?.originalname,
          eodCcpName: files?.eodCcp?.[0]?.originalname,
          ttttCcpName: files?.ttttCcp?.[0]?.originalname,
        });

        const negativeIMRAccCount = result.negativeIMRAcc.length;
        const negativeBalanceAccsCount =
          result.negativeBalanceAccs?.length || 0;
        const mismatchedCount = result.mismatchedEOD?.length || 0;
        const hasDiscrepancy =
          negativeIMRAccCount > 0 || negativeBalanceAccsCount > 0 || mismatchedCount > 0;
        const status = hasDiscrepancy ? 'NEEDS_ATTENTION' : 'PASSED';

        let note = `[ĐỐI CHIẾU SỐ DƯ EOD (MS & CCP)]\n`;
        note += `• Số tài khoản âm số dư hiện tại: ${negativeBalanceAccsCount}\n`;
        note += `• Số tài khoản âm ký quỹ khả dụng (IMR): ${negativeIMRAccCount}\n`;
        note += `• Số tài khoản lệch công thức EOD: ${mismatchedCount}\n`;

        if (negativeBalanceAccsCount > 0) {
          note += `• Tài khoản âm số dư: ${result.negativeBalanceAccs?.join(', ')}\n`;
        }
        if (negativeIMRAccCount > 0) {
          note += `• Tài khoản âm ký quỹ: ${result.negativeIMRAcc.join(', ')}\n`;
        }
        if (mismatchedCount > 0) {
          note += `• Chi tiết chênh lệch EOD:\n`;
          result.mismatchedEOD.slice(0, 10).forEach((m) => {
            const tag = m.system ? `[${m.system}]` : '[MS]';
            note += `  - ${tag} TK ${m.maTKGD}: Tính toán ${m.calculatedBalance} vs EOD ${m.eodBalance} (Lệch: ${m.differ})\n`;
          });
          if (mismatchedCount > 10) {
            note += `  ... và ${mismatchedCount - 10} tài khoản khác.\n`;
          }
        }
        if (!hasDiscrepancy) {
          note += `✓ Không phát hiện tài khoản âm số dư / âm ký quỹ / lệch công thức EOD.\n`;
        }

        const noteJson = JSON.stringify({
          success: !hasDiscrepancy,
          message: note,
          result: {
            negativeBalanceAccs: result.negativeBalanceAccs || [],
            negativeIMRAcc: result.negativeIMRAcc || [],
            mismatchedEOD: result.mismatchedEOD || [],
            cqgResult: [],
          },
          type: 'EOD',
          attempts: 1,
          maxAttempts: 1,
          executedAt: new Date().toISOString(),
        });

        await this.shiftsService.updateTaskStatus(
          shiftLogId,
          taskId,
          status,
          systemUser,
          noteJson,
          true,
        );

        return {
          success: !hasDiscrepancy,
          type: 'EOD',
          message: hasDiscrepancy
            ? 'Đối chiếu EOD phát hiện chênh lệch / âm tiền.'
            : 'Đối chiếu EOD khớp hoàn toàn.',
          result,
        };
      }

      throw new BadRequestException('Không nhận diện được loại đối chiếu EOD hợp lệ.');
    } catch (err: any) {
      throw new BadRequestException(
        `Lỗi trong quá trình đối chiếu EOD: ${err.message}`,
      );
    }
  }

  /**
   * Upload file và thực hiện đối chiếu Pre-EOD chốt 3 bên (MS vs CQG vs Straits).
   */
  @Post('upload-pre-eod')
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'dsgd', maxCount: 1 },
      { name: 'acmTrades', maxCount: 1 },
      { name: 'cqgFr', maxCount: 1 },
      { name: 'tttt', maxCount: 1 },
      { name: 'cqgPs', maxCount: 1 },
    ]),
  )
  async uploadAndReconcilePreEOD(
    @UploadedFiles()
    files: {
      dsgd?: any[];
      acmTrades?: any[];
      cqgFr?: any[];
      tttt?: any[];
      cqgPs?: any[];
    },
    @Body('shiftLogId') shiftLogId: string,
    @Body('taskId') taskId: string,
    @Body('tradingDate') tradingDateStr?: string,
    @Body('sessionStart') sessionStartStr?: string,
  ) {
    if (!shiftLogId || !taskId) {
      throw new BadRequestException('Thiếu shiftLogId hoặc taskId');
    }

    const fileBuffers = {
      dsgd: files?.dsgd?.[0]?.buffer,
      acmTrades: files?.acmTrades?.[0]?.buffer,
      cqgFr: files?.cqgFr?.[0]?.buffer,
      tttt: files?.tttt?.[0]?.buffer,
      cqgPs: files?.cqgPs?.[0]?.buffer,
    };

    if (!fileBuffers.dsgd) {
      throw new BadRequestException('Thiếu file M-System DSGD.xlsx');
    }
    if (!fileBuffers.acmTrades) {
      throw new BadRequestException('Thiếu file ACM Trades (EOD FO trades...)');
    }
    if (!fileBuffers.cqgFr) {
      throw new BadRequestException('Thiếu file CQG FR.xlsx');
    }
    if (!fileBuffers.tttt) {
      throw new BadRequestException('Thiếu file M-System TTTT.xlsx');
    }
    if (!fileBuffers.cqgPs) {
      throw new BadRequestException('Thiếu file CQG PS.xlsx');
    }

    const tradingDate = tradingDateStr ? new Date(tradingDateStr) : new Date();

    try {
      const acmTradesName = files?.acmTrades?.[0]?.originalname || '';
      const result = await this.preEodReconService.checkPreEOD(
        fileBuffers,
        acmTradesName,
        tradingDate,
        [],
      );

      const systemUser = {
        id: '000000000000000000000000',
        fullName: 'Hệ thống tự động (Bot)',
        username: 'system_bot',
        role: 'ADMIN',
      };

      const status = result.passed ? 'PASSED' : 'NEEDS_ATTENTION';

      let note = `[ĐỐI CHIẾU TRƯỚC EOD]\n`;
      if (result.targetDate) {
        const t1Str = new Date(result.targetDate).toLocaleDateString('vi-VN');
        note += `• Ngày phiên đối chiếu T-1: ${t1Str}\n`;
      }
      note += `• Khớp lệnh tự doanh (MS vs Straits): ${result.totals.totalACM_MS} vs ${result.totals.totalACM_Straits} lot (Chênh lệch: ${result.totals.differACM} lot)\n`;
      note += `• Khớp lệnh thường (MS vs CQG): ${result.totals.totalCQG_MS} vs ${result.totals.totalCQG_FR} lot (Chênh lệch: ${result.totals.differCQG} lot)\n`;
      note += `• Chênh lệch vị thế net position (MS vs CQG): ${result.mismatchedPositions.length} tài khoản\n`;

      if (result.mismatchedTrades.length > 0) {
        note += ` Phát hiện ${result.mismatchedTrades.length} giao dịch bị lệch chi tiết:\n`;
        result.mismatchedTrades.slice(0, 10).forEach((m: any) => {
          note += `  - [${m.source}] TK ${m.maTKGD}, HĐ ${m.maHD}, Giá ${m.giaKhop}, Qty ${m.klGiaoDich}: ${m.reason}\n`;
        });
        if (result.mismatchedTrades.length > 10) {
          note += `  - ... và ${result.mismatchedTrades.length - 10} giao dịch khác.\n`;
        }
      }

      if (result.mismatchedPositions.length > 0) {
        note += ` Phát hiện ${result.mismatchedPositions.length} chênh lệch vị thế ròng (net position) chi tiết:\n`;
        result.mismatchedPositions.slice(0, 10).forEach((m: any) => {
          note += `  - TK ${m.account}, HĐ ${m.symbol}: MS ${m.msPosition} vs CQG ${m.cqgPosition} (Chênh lệch: ${m.differ})\n`;
        });
        if (result.mismatchedPositions.length > 10) {
          note += `  - ... và ${result.mismatchedPositions.length - 10} chênh lệch khác.\n`;
        }
      }
      if (result.passed) {
        note += `✓ Dữ liệu khớp lệnh và vị thế khớp hoàn toàn 100% giữa 3 bên.\n`;
      }

      const noteJson = JSON.stringify({
        success: result.passed,
        message: note,
        result,
        type: 'CHECK_PRE_EOD',
        attempts: 1,
        maxAttempts: 1,
        executedAt: new Date().toISOString(),
      });

      await this.shiftsService.updateTaskStatus(
        shiftLogId,
        taskId,
        status,
        systemUser,
        noteJson,
        true,
      );

      return {
        success: true,
        message: 'Đối chiếu Pre-EOD hoàn thành và đã cập nhật ca trực!',
        status,
        result,
      };
    } catch (err: any) {
      throw new BadRequestException(
        `Lỗi trong quá trình đối chiếu Pre-EOD: ${err.message}`,
      );
    }
  }
}
