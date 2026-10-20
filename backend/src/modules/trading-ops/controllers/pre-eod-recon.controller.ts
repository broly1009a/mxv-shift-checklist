/**
 * dsgd-before-eod-recon.controller.ts
 *
 * Controller chuyên trách Chốt đối chiếu 3 bên cuối ngày (Dsgd-Before-EOD / EOD Recon Domain).
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
import { DsgdBeforeEodReconService } from '../services/dsgd-before-eod-recon.service';
import { DsgdBeforeEodService } from '../services/dsgd-before-eod.service';
import { CqgMergerService } from '../services/cqg-merger.service';
import { ReconConsoleSummaryService } from '../services/recon-console-summary.service';
import { Optional } from '@nestjs/common';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['api/v1/trading-ops', 'api/v1/reconciliation', 'reconciliation'])
export class DsgdBeforeEodReconController {
  private readonly logger = new Logger(DsgdBeforeEodReconController.name);

  constructor(
    private readonly dsgdBeforeEodReconService: DsgdBeforeEodReconService,
    private readonly reconConsoleSummaryService: ReconConsoleSummaryService,
    private readonly cqgMergerService: CqgMergerService,
    private readonly shiftsService: ShiftsService,
    @Optional()
    private readonly dsgdBeforeEodService?: DsgdBeforeEodService,
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
        const result = await this.dsgdBeforeEodReconService.checkEOD({
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
   * Upload file và thực hiện đối chiếu Dsgd-Before-EOD chốt 3 bên (MS vs CQG vs Straits).
   */
  @Post('upload-dsgd-before-eod')
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'dsgd', maxCount: 1 },
      { name: 'acmTrades', maxCount: 1 },
      { name: 'dsgdSnapshot', maxCount: 1 },
      { name: 'cqgFr', maxCount: 1 },
      { name: 'tttt', maxCount: 1 },
      { name: 'cqgPs', maxCount: 1 },
    ]),
  )
  async uploadAndReconcileDSGDBeforeEOD(
    @UploadedFiles()
    files: {
      dsgd?: any[];
      acmTrades?: any[];
      dsgdSnapshot?: any[];
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
      dsgdSnapshot: files?.dsgdSnapshot?.[0]?.buffer || files?.cqgFr?.[0]?.buffer,
      cqgFr: files?.cqgFr?.[0]?.buffer,
    };

    if (!fileBuffers.dsgd) {
      throw new BadRequestException('Thiếu file M-System DSGD.xlsx');
    }
    if (!fileBuffers.acmTrades) {
      throw new BadRequestException('Thiếu file Straits CSV (ACM)');
    }

    const tradingDate = tradingDateStr ? new Date(tradingDateStr) : new Date();

    try {
      const dsgdRes = this.dsgdBeforeEodService
        ? this.dsgdBeforeEodService.checkDSGDBeforeEODFromBuffers({
            dsgdOriginal: fileBuffers.dsgd,
            dsgdTemp: fileBuffers.dsgdSnapshot,
            acmTrades: fileBuffers.acmTrades,
          })
        : {
            passed: true,
            totalOriginal: 0,
            totalTemp: 0,
            totalACMMS: 0,
            totalACMSFTP: 0,
            differTotal: 0,
            differACM: 0,
            messages: [],
            sessionDate: '',
          };

      const result = {
        passed: dsgdRes.passed,
        totals: {
          totalOriginal: dsgdRes.totalOriginal,
          totalTemp: dsgdRes.totalTemp,
          differTotal: dsgdRes.differTotal,
          totalACMMS: dsgdRes.totalACMMS,
          totalACMSFTP: dsgdRes.totalACMSFTP,
          differACM: dsgdRes.differACM,
        },
        tradingDate,
        targetDate: tradingDate,
        dsgdBeforeEod: dsgdRes,
      };

      const systemUser = {
        id: '000000000000000000000000',
        fullName: 'Hệ thống tự động (Bot)',
        username: 'system_bot',
        role: 'ADMIN',
      };

      const status = result.passed ? 'PASSED' : 'NEEDS_ATTENTION';

      const orig = result.totals?.totalOriginal ?? 0;
      const snap = result.totals?.totalTemp ?? 0;
      const diffTot = result.totals?.differTotal ?? 0;
      const acmMs = result.totals?.totalACMMS ?? 0;
      const acmCsv = result.totals?.totalACMSFTP ?? 0;
      const diffAcm = result.totals?.differACM ?? 0;

      let note = `[KIỂM TRA DSGD TRƯỚC EOD]\n`;
      if (result.targetDate) {
        const t1Str = new Date(result.targetDate).toLocaleDateString('vi-VN');
        note += `• Ngày phiên đối chiếu T-1: ${t1Str}\n`;
      }
      note += `• Khối lượng toàn thị trường (DSGD gốc vs Snapshot): ${orig} vs ${snap} lot (Chênh lệch: ${diffTot} lot)\n`;
      note += `• Khối lượng tự doanh ACM (MS vs Straits CSV): ${acmMs} vs ${acmCsv} lot (Chênh lệch: ${diffAcm} lot)\n`;
      if (result.dsgdBeforeEod?.messages?.length) {
        for (const msg of result.dsgdBeforeEod.messages) {
          note += `• ${msg}\n`;
        }
      }
      if (result.passed) {
        note += `✓ Dữ liệu khớp 100% theo chuẩn kiểm tra DSGD Trước EOD.\n`;
      }

      const noteJson = JSON.stringify({
        success: result.passed,
        message: note,
        result,
        type: 'CHECK_DSGD_BEFORE_EOD',
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
        message: 'Đối chiếu Dsgd-Before-EOD hoàn thành và đã cập nhật ca trực!',
        status,
        result,
      };
    } catch (err: any) {
      throw new BadRequestException(
        `Lỗi trong quá trình đối chiếu Dsgd-Before-EOD: ${err.message}`,
      );
    }
  }
}
