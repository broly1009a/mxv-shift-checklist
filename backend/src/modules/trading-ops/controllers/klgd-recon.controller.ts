/**
 * klgd-recon.controller.ts
 *
 * Controller chuyên trách Giám sát & Đối soát Khớp lệnh trong phiên (KLGD Recon Domain).
 * Chuẩn Clean Architecture & Domain-Driven Design (DDD).
 */

import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  UseGuards,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TradingReconLog } from '../schemas/trading-recon-log.schema';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { ShiftsService } from '../../shifts/shifts.service';
import { RpaScraperService } from '../../ingress';
import { KlgdReconService } from '../services/klgd-recon.service';
import { MsEodReconService } from '../services/ms-eod-recon.service';
import { CqgMergerService } from '../services/cqg-merger.service';
import { DsgdBeforeEodService } from '../services/dsgd-before-eod.service';
import { ReconConsoleSummaryService } from '../services/recon-console-summary.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['api/v1/trading-ops', 'api/v1/reconciliation', 'reconciliation'])
export class KlgdReconController {
  private readonly logger = new Logger(KlgdReconController.name);

  constructor(
    private readonly klgdReconService: KlgdReconService,
    private readonly msEodReconService: MsEodReconService,
    private readonly reconConsoleSummaryService: ReconConsoleSummaryService,
    private readonly cqgMergerService: CqgMergerService,
    private readonly dsgdBeforeEodService: DsgdBeforeEodService,
    private readonly shiftsService: ShiftsService,
    private readonly rpaService: RpaScraperService,
    @Optional()
    @InjectModel(TradingReconLog.name)
    private readonly reconLogModel?: Model<TradingReconLog>,
  ) {}

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

      // Theo chuẩn C# CheckKLGD (TransactionCheckingService.cs#L368-L383):
      // Đánh giá trạng thái PASSED / NEEDS_ATTENTION của ca Khớp Lệnh căn cứ vào KLGD thường, ACM và các lệnh lệch.
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

  /**
   * Run full local reconciliation pipeline against a sample data directory.
   */
  @Post('run-test-local')
  @Permissions('ACCESS_AUTO_SHIFT')
  async runTestLocal(
    @Body('samplePath') samplePath?: string,
    @Body('sessionStart') sessionStartStr?: string,
    @Body('usdRate') usdRateRaw?: number,
  ) {
    const usdRate = usdRateRaw ? Number(usdRateRaw) : await this.reconConsoleSummaryService.getCurrentUsdRate();
    const targetDir =
      samplePath ||
      path.resolve(
        process.cwd(),
        '../../Tool_Kiem_Tra_Du_Lieu/08.07 QLGD/08.07 Test',
      );

    if (!fs.existsSync(targetDir)) {
      throw new BadRequestException(
        `Thư mục mẫu không tồn tại: ${targetDir}. Vui lòng truyền samplePath hợp lệ.`,
      );
    }

    const readIfExists = (base: string, ext: string = 'xlsx'): Buffer | null => {
      const p1 = path.join(targetDir, `${base}.${ext}`);
      if (fs.existsSync(p1)) return fs.readFileSync(p1);
      return null;
    };

    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};

    // 1. KLGD Check
    try {
      const dsgd = readIfExists('DSGD', 'xlsx');
      if (!dsgd) throw new Error('Thiếu file DSGD.xlsx');
      const klgdFiles = {
        dsgd,
        fr: readIfExists('FR', 'xlsx') || undefined,
        fr1: readIfExists('FR1', 'xlsx') || undefined,
        fr2: readIfExists('FR2', 'xlsx') || undefined,
        nano:
          readIfExists('Straits', 'csv') ||
          readIfExists('Nano', 'xls') ||
          readIfExists('Nano', 'xlsx') ||
          undefined,
        op: readIfExists('OP', 'xlsx') || undefined,
        op1: readIfExists('OP1', 'xlsx') || undefined,
        op2: readIfExists('OP2', 'xlsx') || undefined,
        ttm: readIfExists('TTM', 'xlsx') || undefined,
        tttt: readIfExists('TTTT', 'xlsx') || undefined,
        ps: readIfExists('PS', 'xlsx') || undefined,
        ps1: readIfExists('PS1', 'xlsx') || undefined,
        ps2: readIfExists('PS2', 'xlsx') || undefined,
        dsgdCcp:
          readIfExists('DSGD CCP', 'xlsx') ||
          readIfExists('DSGD_CCP', 'xlsx') ||
          undefined,
        ttmCcp:
          readIfExists('TTM CCP', 'xlsx') ||
          readIfExists('TTM_CCP', 'xlsx') ||
          undefined,
        ttttCcp:
          readIfExists('TTTT CCP', 'xlsx') ||
          readIfExists('TTTT', 'xlsx') ||
          undefined,
      };
      results.klgd = await this.klgdReconService.checkKLGD(
        klgdFiles,
        new Date(),
        [],
        sessionStartStr || '05:00',
      );
    } catch (err: any) {
      errors.klgd = err.message;
    }

    // 2. EOD Check
    try {
      const qltkgd = readIfExists('QLTKGD', 'xlsx');
      const eod = readIfExists('eod', 'csv');
      if (!qltkgd) throw new Error('Thiếu file QLTKGD.xlsx');
      results.eod = await this.msEodReconService.checkEOD({
        qltkgd,
        eod: eod || undefined,
      });
    } catch (err: any) {
      errors.eod = err.message;
    }

    // 3. CQG Check
    try {
      const qltkgd = readIfExists('QLTKGD', 'xlsx');
      const accountsBalances = readIfExists('Accounts_Balances', 'xlsx');
      if (!qltkgd) throw new Error('Thiếu file QLTKGD.xlsx');
      if (!accountsBalances)
        throw new Error('Thiếu file Accounts_Balances.xlsx');
      results.cqg = await this.cqgMergerService.checkEODCQG(
        { qltkgd, accountsBalances },
        usdRate,
      );
    } catch (err: any) {
      errors.cqg = err.message;
    }

    return {
      success: Object.keys(errors).length === 0,
      samplePath,
      usdRate,
      results,
      errors,
    };
  }

  /**
   * Run EOD reconciliation by downloading files from M-System via RPA bot.
   */
  @Post('run-auto')
  @Permissions('ACCESS_AUTO_SHIFT')
  async runAutoReconciliation(
    @Body('targetDate') targetDate?: string,
    @Body('usdRate') usdRateRaw?: number,
  ) {
    const usdRate = usdRateRaw ? Number(usdRateRaw) : await this.reconConsoleSummaryService.getCurrentUsdRate();
    this.logger.log(
      `Starting auto reconciliation via RPA for date: ${targetDate || 'today'}`,
    );

    let downloadedFiles: {
      qltkgdPath: string;
      ttttPath: string;
      eodPath: string;
      downloadDir: string;
    };
    try {
      downloadedFiles =
        await this.rpaService.downloadReconciliationFiles(targetDate);
    } catch (err: any) {
      throw new BadRequestException(
        `Không thể tải file từ M-System: ${err.message}`,
      );
    }

    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};

    try {
      const qltkgd = fs.readFileSync(downloadedFiles.qltkgdPath);
      const tttt =
        downloadedFiles.ttttPath && fs.existsSync(downloadedFiles.ttttPath)
          ? fs.readFileSync(downloadedFiles.ttttPath)
          : undefined;
      const eod =
        downloadedFiles.eodPath && fs.existsSync(downloadedFiles.eodPath)
          ? fs.readFileSync(downloadedFiles.eodPath)
          : undefined;
      results.eod = await this.msEodReconService.checkEOD({
        qltkgd,
        tttt,
        eod,
      });
    } catch (err: any) {
      errors.eod = err.message;
    }

    return {
      success: Object.keys(errors).length === 0,
      downloadDir: downloadedFiles.downloadDir,
      usdRate,
      results,
      errors,
      message: 'Đối chiếu tự động hoàn thành!',
    };
  }

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
    @Body('usdRate') usdRateStr?: string,
    @Body('sessionStart') sessionStartStr?: string,
  ) {
    const usdRate = usdRateStr ? parseFloat(usdRateStr) : await this.reconConsoleSummaryService.getCurrentUsdRate();
    if (!isNaN(usdRate) && usdRate > 0) {
      await this.reconConsoleSummaryService.saveUsdRate(usdRate);
    }

    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};

    // 1. KLGD Check
    if (files?.dsgd?.[0]) {
      try {
        const klgdFiles = {
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
          klgdFiles,
          new Date(),
          [],
          sessionStartStr || '05:00',
        );
      } catch (err: any) {
        errors.klgd = err.message;
      }
    }

    // 2. EOD Check
    if (files?.qltkgd?.[0]) {
      try {
        results.eod = await this.msEodReconService.checkEOD({
          qltkgd: files.qltkgd[0].buffer,
          eod: files.eod?.[0]?.buffer,
          tttt: files.tttt?.[0]?.buffer,
        });
      } catch (err: any) {
        errors.eod = err.message;
      }
    }

    // 3. CQG Check
    if (files?.qltkgd?.[0] && files?.accountsBalances?.[0]) {
      try {
        results.cqg = await this.cqgMergerService.checkEODCQG(
          {
            qltkgd: files.qltkgd[0].buffer,
            accountsBalances: files.accountsBalances[0].buffer,
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

  /**
   * Endpoint 1: Nhận file DSGD snapshot trước EOD tải lên thủ công hoặc từ script.
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
    ]),
  )
  async uploadDsgdBeforeEOD(
    @UploadedFiles()
    files: {
      dsgdOriginal?: any[];
      dsgd?: any[];
      dsgdTemp?: any[];
      dsgdSnapshot?: any[];
      acmTrades?: any[];
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
      files?.dsgdTemp?.[0]?.buffer || files?.dsgdSnapshot?.[0]?.buffer;
    const acmBuf = files?.acmTrades?.[0]?.buffer;

    try {
      const result = this.dsgdBeforeEodService.checkDSGDBeforeEODFromBuffers(
        {
          dsgdOriginal: originalBuf,
          dsgdTemp: tempBuf,
          acmTrades: acmBuf,
        },
        {
          timeSuffix,
          sessionDate: tradingDateStr,
        },
      );

      if (shiftLogId && taskId) {
        const systemUser = {
          id: '000000000000000000000000',
          fullName: 'Hệ thống tự động (Bot)',
          username: 'system_bot',
          role: 'ADMIN',
        };
        const status = result.passed ? 'PASSED' : 'NEEDS_ATTENTION';

        let note = `[KIỂM TRA DSGD TRƯỚC EOD]\n`;
        if (result.isSnapshotMissing) {
          note += ` CẢNH BÁO AN TOÀN DỮ LIỆU: THIẾU FILE SNAPSHOT TRƯỚC EOD!\n`;
          note += `• Hệ thống đã chặn so sánh file gốc với chính nó để ngăn chặn báo thành công ảo.\n`;
        }
        note += `• Khối lượng DSGD gốc: ${result.totalOriginal} lot\n`;
        note += `• Khối lượng DSGD snapshot: ${result.isSnapshotMissing ? 'Không có (Thiếu file)' : `${result.totalTemp} lot (Chênh lệch: ${result.differTotal} lot)`}\n`;
        note += `• Khối lượng ACM MS vs Straits: ${result.totalACMMS} vs ${result.totalACMSFTP} lot (Chênh lệch: ${result.differACM} lot)\n`;
        note += `• Kết luận: ${result.messages.join(' | ')}\n`;

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
        success: result.passed,
        message: result.messages.join(' | '),
        result,
      };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Endpoint 2: Tự động kiểm tra DSGD trước EOD từ thư mục Backup Server/SFTP.
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
