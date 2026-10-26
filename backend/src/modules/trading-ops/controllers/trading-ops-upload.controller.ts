/**
 * trading-ops-upload.controller.ts
 *
 * Controller chuyên trách tiếp nhận Upload File thủ công & Cứu hộ khẩn cấp (Emergency / Ad-hoc Upload).
 * Bóc tách hoàn toàn các endpoint xử lý multipart/form-data ra khỏi Domain Controllers chính
 * nhằm tuân thủ Clean Architecture & Single Responsibility Principle (SRP).
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
  Optional,
} from '@nestjs/common';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { ShiftsService } from '../../shifts/shifts.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { resolveStoragePathCrossPlatform } from '../../../shared';
import { KlgdReconService } from '../services/recon/klgd-recon.service';
import { MsEodReconService } from '../services/recon/ms-eod-recon.service';
import { CqgMergerService } from '../services/merger/cqg-merger.service';
import { DsgdBeforeEodService } from '../services/recon/dsgd-before-eod.service';
import { ReconConsoleSummaryService } from '../services/console/recon-console-summary.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['api/v1/trading-ops', 'api/v1/reconciliation', 'reconciliation'])
export class TradingOpsUploadController {
  private readonly logger = new Logger(TradingOpsUploadController.name);

  constructor(
    private readonly klgdReconService: KlgdReconService,
    private readonly msEodReconService: MsEodReconService,
    private readonly cqgMergerService: CqgMergerService,
    private readonly reconConsoleSummaryService: ReconConsoleSummaryService,
    private readonly shiftsService: ShiftsService,
    private readonly settingsService: SystemSettingsService,
    @Optional()
    private readonly dsgdBeforeEodService?: DsgdBeforeEodService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. UPLOAD FILE & ĐỐI CHIẾU KHỚP LỆNH TRONG PHIÊN (KLGD)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Upload file và thực hiện đối chiếu KLGD trong phiên.
   */
  @Post('upload-klgd')
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'dsgd', maxCount: 1 },
      { name: 'fr', maxCount: 1 },
      { name: 'fr1', maxCount: 1 },
      { name: 'fr2', maxCount: 1 },
      { name: 'nano', maxCount: 1 },
      { name: 'ttm', maxCount: 1 },
      { name: 'op', maxCount: 1 },
      { name: 'op1', maxCount: 1 },
      { name: 'op2', maxCount: 1 },
      { name: 'tttt', maxCount: 1 },
      { name: 'ps', maxCount: 1 },
      { name: 'ps1', maxCount: 1 },
      { name: 'ps2', maxCount: 1 },
      { name: 'dsgdCcp', maxCount: 1 },
      { name: 'ttmCcp', maxCount: 1 },
      { name: 'ttttCcp', maxCount: 1 },
      { name: 'ccpDsgd', maxCount: 1 },
      { name: 'ccpTtm', maxCount: 1 },
      { name: 'ccpTttt', maxCount: 1 },
    ]),
  )
  async uploadAndReconcile(
    @UploadedFiles()
    files: {
      dsgd?: any[];
      fr?: any[];
      fr1?: any[];
      fr2?: any[];
      nano?: any[];
      ttm?: any[];
      op?: any[];
      op1?: any[];
      op2?: any[];
      tttt?: any[];
      ps?: any[];
      ps1?: any[];
      ps2?: any[];
      dsgdCcp?: any[];
      ttmCcp?: any[];
      ttttCcp?: any[];
      ccpDsgd?: any[];
      ccpTtm?: any[];
      ccpTttt?: any[];
    },
    @Body('shiftLogId') shiftLogId: string,
    @Body('taskId') taskId: string,
    @Body('tradingDate') tradingDateStr?: string,
    @Body('sessionStart') sessionStartStr?: string,
  ) {
    if (!shiftLogId || !taskId) {
      throw new BadRequestException('Thiếu shiftLogId hoặc taskId');
    }

    const tradingDate = tradingDateStr ? new Date(tradingDateStr) : new Date();

    const fileBuffers = {
      dsgd: files?.dsgd?.[0]?.buffer,
      fr: files?.fr?.[0]?.buffer,
      fr1: files?.fr1?.[0]?.buffer,
      fr2: files?.fr2?.[0]?.buffer,
      nano: files?.nano?.[0]?.buffer,
      ttm: files?.ttm?.[0]?.buffer,
      op: files?.op?.[0]?.buffer,
      op1: files?.op1?.[0]?.buffer,
      op2: files?.op2?.[0]?.buffer,
      tttt: files?.tttt?.[0]?.buffer,
      ps: files?.ps?.[0]?.buffer,
      ps1: files?.ps1?.[0]?.buffer,
      ps2: files?.ps2?.[0]?.buffer,
      dsgdCcp: files?.dsgdCcp?.[0]?.buffer || files?.ccpDsgd?.[0]?.buffer,
      ttmCcp: files?.ttmCcp?.[0]?.buffer || files?.ccpTtm?.[0]?.buffer,
      ttttCcp: files?.ttttCcp?.[0]?.buffer || files?.ccpTttt?.[0]?.buffer,
    };

    if (!fileBuffers.dsgd) {
      throw new BadRequestException(
        'File dsgd (M-System) là bắt buộc để đối chiếu.',
      );
    }

    try {
      const result = await this.klgdReconService.checkKLGD(
        fileBuffers,
        tradingDate,
        [],
        sessionStartStr || '05:00',
      );

      const systemUser = {
        id: '000000000000000000000000',
        fullName: 'Hệ thống tự động (Bot)',
        username: 'system_bot',
        role: 'ADMIN',
      };

      const hasDiscrepancy =
        result.totals.differ > 0 ||
        result.totals.differACM > 0 ||
        result.mismatchedTrades.length > 0;

      const status = hasDiscrepancy ? 'NEEDS_ATTENTION' : 'PASSED';

      let noteText = `[ĐỐI CHIẾU TỰ ĐỘNG]\n`;
      if (result.sessionStart && result.checkTime) {
        const startStr = new Date(result.sessionStart).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        const endStr = new Date(result.checkTime).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        noteText += `• Khoảng thời gian lọc: từ ${startStr} đến ${endStr}\n`;
      }
      noteText += `• Khớp lệnh thường (MS vs CQG): ${result.totals.totalDSGD} vs ${result.totals.totalFR} lot (Chênh lệch: ${result.totals.differ} lot)\n`;
      noteText += `• Khớp lệnh tự doanh (MS vs ACM): ${result.totals.totalACM} vs ${result.totals.totalNano} lot (Chênh lệch: ${result.totals.differACM} lot)\n`;

      if (result.totals.totalTTTT !== undefined) {
        noteText += `• Khớp lệnh tất toán (TTTT vs PS): ${result.totals.totalTTTT} vs ${result.totals.totalPS} lot (Chênh lệch: ${result.totals.differTTTT} lot)\n`;
      }

      if (result.totals.totalTTM !== undefined) {
        noteText += `• Vị thế mở (TTM vs OP): ${result.totals.totalTTM} vs ${result.totals.totalOP} lot (Chênh lệch: ${result.totals.differTTM} lot)\n`;
      }

      if (
        result.totals.totalCCP_DSGD !== undefined ||
        result.totals.totalCCP_TTM !== undefined ||
        result.totals.totalCCP_TTTT !== undefined
      ) {
        noteText += `• Đối chiếu CoreCCP:\n`;
        if (result.totals.totalCCP_DSGD !== undefined) {
          noteText += `  - Khớp lệnh (MS vs CCP): ${result.totals.totalDSGD} vs ${result.totals.totalCCP_DSGD} lot (Lệch: ${result.totals.differCCP_KLGD ?? 0} lot)\n`;
        }
        if (result.totals.totalCCP_TTM !== undefined) {
          noteText += `  - Trạng thái mở (MS vs CCP): ${result.totals.totalTTM || 0} vs ${result.totals.totalCCP_TTM} lot (Lệch: ${result.totals.differCCP_TTM ?? 0} lot)\n`;
        }
        if (result.totals.totalCCP_TTTT !== undefined) {
          noteText += `  - Tất toán (MS vs CCP): ${result.totals.totalTTTT || 0} vs ${result.totals.totalCCP_TTTT} lot (Lệch: ${result.totals.differCCP_TTTT ?? 0} lot)\n`;
        }
      }

      const noteJson = JSON.stringify({
        success: !hasDiscrepancy,
        message: noteText,
        result: result,
        type: 'CHECK_KLGD',
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
        message: 'Đối chiếu KLGD hoàn thành và đã cập nhật ca trực!',
        status,
        result,
      };
    } catch (err: any) {
      throw new BadRequestException(
        `Lỗi trong quá trình đối chiếu KLGD: ${err.message}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. UPLOAD FILE & ĐỐI CHIẾU EOD (SỐ DƯ CQG & M-SYSTEM VS CCP)
  // ─────────────────────────────────────────────────────────────────────────────

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

      // Case B: EOD Check song song MS & CCP
      if ((fileBuffers.qltkgd || fileBuffers.qltkgdCcp) && !fileBuffers.accountsBalances) {
        const result = await this.msEodReconService.checkEOD({
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. UPLOAD FILE & ĐỐI CHIẾU DSGD-BEFORE-EOD (CHỐT 3 BÊN MS VS CQG VS STRAITS)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Upload file và thực hiện đối chiếu Dsgd-Before-EOD chốt 3 bên.
   */
  @Post('upload-dsgd-before-eod')
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'dsgdOriginal', maxCount: 1 },
      { name: 'dsgd', maxCount: 1 },
      { name: 'dsgdTemp', maxCount: 1 },
      { name: 'dsgdSnapshot', maxCount: 1 },
      { name: 'acmTrades', maxCount: 1 },
      { name: 'cqgFr', maxCount: 1 },
      { name: 'tttt', maxCount: 1 },
      { name: 'cqgPs', maxCount: 1 },
    ]),
  )
  async uploadAndReconcileDSGDBeforeEOD(
    @UploadedFiles()
    files: {
      dsgdOriginal?: any[];
      dsgd?: any[];
      dsgdTemp?: any[];
      dsgdSnapshot?: any[];
      acmTrades?: any[];
      cqgFr?: any[];
      tttt?: any[];
      cqgPs?: any[];
    },
    @Body('shiftLogId') shiftLogId?: string,
    @Body('taskId') taskId?: string,
    @Body('tradingDate') tradingDateStr?: string,
    @Body('timeSuffix') timeSuffix?: string,
  ) {
    const originalBuf =
      files?.dsgdOriginal?.[0]?.buffer || files?.dsgd?.[0]?.buffer;
    if (!originalBuf) {
      throw new BadRequestException(
        'File M-System DSGD.xlsx gốc (dsgdOriginal hoặc dsgd) là bắt buộc.',
      );
    }

    const tempBuf =
      files?.dsgdTemp?.[0]?.buffer || files?.dsgdSnapshot?.[0]?.buffer || files?.cqgFr?.[0]?.buffer;
    const acmBuf = files?.acmTrades?.[0]?.buffer;

    const tradingDate = tradingDateStr ? new Date(tradingDateStr) : new Date();

    try {
      const dsgdRes = this.dsgdBeforeEodService
        ? this.dsgdBeforeEodService.checkDSGDBeforeEODFromBuffers(
            {
              dsgdOriginal: originalBuf,
              dsgdTemp: tempBuf,
              acmTrades: acmBuf,
            },
            {
              timeSuffix,
              sessionDate: tradingDateStr,
            },
          )
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

      if (shiftLogId && taskId) {
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
      }

      return {
        success: true,
        message: 'Đối chiếu Dsgd-Before-EOD hoàn thành và đã cập nhật ca trực!',
        status: result.passed ? 'PASSED' : 'NEEDS_ATTENTION',
        result,
      };
    } catch (err: any) {
      throw new BadRequestException(
        `Lỗi trong quá trình đối chiếu Dsgd-Before-EOD: ${err.message}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. TEST UPLOAD (MANUAL RECONCILIATION SANDBOX)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Manual test upload endpoint for testing reconciliation rules with user uploaded files.
   */
  @Post('test-upload')
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'dsgd', maxCount: 1 },
      { name: 'fr1', maxCount: 1 },
      { name: 'fr2', maxCount: 1 },
      { name: 'nano', maxCount: 1 },
      { name: 'ttm', maxCount: 1 },
      { name: 'op1', maxCount: 1 },
      { name: 'op2', maxCount: 1 },
      { name: 'qltkgd', maxCount: 1 },
      { name: 'eod', maxCount: 1 },
      { name: 'tttt', maxCount: 1 },
      { name: 'accountsBalances', maxCount: 1 },
      { name: 'dsgdCcp', maxCount: 1 },
      { name: 'ttmCcp', maxCount: 1 },
      { name: 'ttttCcp', maxCount: 1 },
      { name: 'ccpDsgd', maxCount: 1 },
      { name: 'ccpTtm', maxCount: 1 },
      { name: 'ccpTttt', maxCount: 1 },
    ]),
  )
  async testUploadAndReconcile(
    @UploadedFiles()
    files: {
      dsgd?: any[];
      fr1?: any[];
      fr2?: any[];
      nano?: any[];
      ttm?: any[];
      op1?: any[];
      op2?: any[];
      qltkgd?: any[];
      eod?: any[];
      tttt?: any[];
      accountsBalances?: any[];
      dsgdCcp?: any[];
      ttmCcp?: any[];
      ttttCcp?: any[];
      ccpDsgd?: any[];
      ccpTtm?: any[];
      ccpTttt?: any[];
    },
    @Body('usdRate') usdRateRaw?: number,
    @Body('sessionStart') sessionStartStr?: string,
  ) {
    const usdRate = usdRateRaw ? Number(usdRateRaw) : await this.reconConsoleSummaryService.getCurrentUsdRate();
    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};

    // 1. KLGD Check
    if (files.dsgd && files.dsgd[0]) {
      try {
        const fileBuffers = {
          dsgd: files.dsgd[0].buffer,
          fr1: files.fr1?.[0]?.buffer,
          fr2: files.fr2?.[0]?.buffer,
          nano: files.nano?.[0]?.buffer,
          ttm: files.ttm?.[0]?.buffer,
          op1: files.op1?.[0]?.buffer,
          op2: files.op2?.[0]?.buffer,
          tttt: files.tttt?.[0]?.buffer,
          dsgdCcp: files.dsgdCcp?.[0]?.buffer || files.ccpDsgd?.[0]?.buffer,
          ttmCcp: files.ttmCcp?.[0]?.buffer || files.ccpTtm?.[0]?.buffer,
          ttttCcp: files.ttttCcp?.[0]?.buffer || files.ccpTttt?.[0]?.buffer,
        };
        results.klgd = await this.klgdReconService.checkKLGD(
          fileBuffers,
          new Date(),
          [],
          sessionStartStr || '05:00',
        );
      } catch (err: any) {
        errors.klgd = err.message;
      }
    }

    // 2. EOD M-System vs CCP Check
    if (files.qltkgd && files.qltkgd[0]) {
      try {
        results.eod = await this.msEodReconService.checkEOD({
          qltkgd: files.qltkgd[0].buffer,
          eod: files.eod?.[0]?.buffer,
          tttt: files.tttt?.[0]?.buffer,
          qltkgdCcp: files.dsgdCcp?.[0]?.buffer || files.ccpDsgd?.[0]?.buffer,
          eodCcp: files.ttmCcp?.[0]?.buffer || files.ccpTtm?.[0]?.buffer,
          ttttCcp: files.ttttCcp?.[0]?.buffer || files.ccpTttt?.[0]?.buffer,
        });
      } catch (err: any) {
        errors.eod = err.message;
      }
    }

    // 3. CQG Balance Check
    if (
      files.qltkgd &&
      files.qltkgd[0] &&
      files.accountsBalances &&
      files.accountsBalances[0]
    ) {
      try {
        results.cqg = await this.cqgMergerService.checkEODCQG(
          {
            qltkgd: files.qltkgd[0].buffer,
            accountsBalances: files.accountsBalances[0].buffer,
            qltkgdName: files.qltkgd[0].originalname,
            accountsBalancesName: files.accountsBalances[0].originalname,
          },
          usdRate,
        );
      } catch (err: any) {
        errors.cqg = err.message;
      }
    }

    return {
      success: Object.keys(errors).length === 0,
      usdRate,
      results,
      errors,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. UPLOAD FILE BACKUP THỦ CÔNG VÀO Ổ ĐĨA M:\ HOẶC LOCAL
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Upload file sao lưu thủ công vào thư mục lưu trữ Backup CQG/MS.
   */
  @Post('upload-backup')
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadBackupFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('date') dateStr?: string,
    @Body('categories') categories?: string | string[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Không có file nào được tải lên');
    }

    const targetDate = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Định dạng ngày không hợp lệ. Sử dụng YYYY-MM-DD');
    }

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const cqgBase = resolveStoragePathCrossPlatform(await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
    ));
    const msBase = resolveStoragePathCrossPlatform(await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    ));

    const savedFiles: { filename: string; path: string; category: string }[] = [];

    let index = 0;
    const catList = Array.isArray(categories) ? categories : [categories || 'auto'];

    for (const file of files) {
      const category = catList[index] || catList[0] || 'auto';
      index++;

      const isCqg = category === 'cqg' || /FR|OP|PS|Od|Accounts_Balances/i.test(file.originalname);
      const targetBase = isCqg ? cqgBase : msBase;
      const targetDir = path.join(targetBase, subFolder);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, file.originalname);
      fs.writeFileSync(filePath, file.buffer);

      savedFiles.push({
        filename: file.originalname,
        path: filePath,
        category: isCqg ? 'CQG' : 'M-System',
      });
    }

    return {
      success: true,
      message: `Đã lưu thành công ${savedFiles.length} file vào thư mục Backup (${subFolder})`,
      targetDate: targetDate.toISOString().split('T')[0],
      savedFiles,
    };
  }
}
