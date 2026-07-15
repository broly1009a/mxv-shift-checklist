import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFiles,
  Body,
  BadRequestException,
  Logger,
  Query,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ReconciliationService } from './reconciliation.service';
import { ShiftsService } from '../shifts/shifts.service';
import { RpaDownloaderService } from '../bot-engine/rpa-downloader.service';
import * as fs from 'fs';

@Controller('reconciliation')
export class ReconciliationController {
  private readonly logger = new Logger(ReconciliationController.name);

  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly shiftsService: ShiftsService,
    private readonly rpaService: RpaDownloaderService,
  ) {}

  @Post('upload-klgd')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'dsgd', maxCount: 1 },
      { name: 'fr1', maxCount: 1 },
      { name: 'fr2', maxCount: 1 },
      { name: 'nano', maxCount: 1 },
      { name: 'ttm', maxCount: 1 },
      { name: 'op1', maxCount: 1 },
      { name: 'op2', maxCount: 1 },
      { name: 'tttt', maxCount: 1 },
      { name: 'ps1', maxCount: 1 },
      { name: 'ps2', maxCount: 1 },
    ]),
  )
  async uploadAndReconcile(
    @UploadedFiles()
    files: {
      dsgd?: any[];
      fr1?: any[];
      fr2?: any[];
      nano?: any[];
      ttm?: any[];
      op1?: any[];
      op2?: any[];
      tttt?: any[];
      ps1?: any[];
      ps2?: any[];
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
      fr1: files?.fr1?.[0]?.buffer,
      fr2: files?.fr2?.[0]?.buffer,
      nano: files?.nano?.[0]?.buffer,
      ttm: files?.ttm?.[0]?.buffer,
      op1: files?.op1?.[0]?.buffer,
      op2: files?.op2?.[0]?.buffer,
      tttt: files?.tttt?.[0]?.buffer,
      ps1: files?.ps1?.[0]?.buffer,
      ps2: files?.ps2?.[0]?.buffer,
    };

    if (!fileBuffers.dsgd) {
      throw new BadRequestException('File dsgd (M-System) là bắt buộc để đối chiếu.');
    }

    try {
      const result = await this.reconciliationService.checkKLGD(fileBuffers, tradingDate, [], sessionStartStr || '05:00');

      const systemUser = {
        id: '000000000000000000000000',
        fullName: 'Hệ thống tự động (Bot)',
        username: 'system_bot',
        role: 'ADMIN',
      };

      const hasDiscrepancy =
        result.totals.differ > 0 ||
        result.totals.differACM > 0 ||
        result.mismatchedTrades.length > 0 ||
        result.mismatchedTTM.length > 0 ||
        (result.totals.differTTTT !== undefined && result.totals.differTTTT > 0) ||
        (result.mismatchedTTTT && result.mismatchedTTTT.length > 0);

      const status = hasDiscrepancy ? 'NEEDS_ATTENTION' : 'PASSED';
      
      let note = `[ĐỐI CHIẾU TỰ ĐỘNG]\n`;
      note += `• Khớp lệnh thường (MS vs CQG): ${result.totals.totalDSGD} vs ${result.totals.totalFR} lot (Chênh lệch: ${result.totals.differ} lot)\n`;
      note += `• Khớp lệnh tự doanh (MS vs ACM): ${result.totals.totalACM} vs ${result.totals.totalNano} lot (Chênh lệch: ${result.totals.differACM} lot)\n`;
      
      if (result.totals.totalTTTT !== undefined) {
        note += `• Khớp lệnh tất toán (TTTT vs PS): ${result.totals.totalTTTT} vs ${result.totals.totalPS} lot (Chênh lệch: ${result.totals.differTTTT} lot)\n`;
      }

      if (result.mismatchedTrades.length > 0) {
        note += `⚠️ Phát hiện ${result.mismatchedTrades.length} giao dịch bị lệch chi tiết:\n`;
        result.mismatchedTrades.slice(0, 10).forEach(m => {
          note += `  - [${m.source}] TK ${m.maTKGD}, HĐ ${m.maHD}, Giá ${m.giaKhop}, Qty ${m.klGiaoDich}: ${m.reason}\n`;
        });
        if (result.mismatchedTrades.length > 10) {
          note += `  ... và ${result.mismatchedTrades.length - 10} giao dịch khác.\n`;
        }
      } else {
        note += `✓ Không có lệch chi tiết khớp lệnh.\n`;
      }

      if (result.mismatchedTTM.length > 0) {
        note += `⚠️ Phát hiện chênh lệch TTM (Trạng thái mở) tại ${result.mismatchedTTM.length} tài khoản:\n`;
        result.mismatchedTTM.slice(0, 10).forEach(m => {
          note += `  - TK ${m.maTKGD}: MS ${m.ttmValue} vs CQG ${m.opValue} (Lệch: ${m.differ})\n`;
        });
      }

      if (result.mismatchedTTTT && result.mismatchedTTTT.length > 0) {
        note += `⚠️ Phát hiện chênh lệch TTTT (Khớp lệnh thanh toán) tại ${result.mismatchedTTTT.length} tài khoản:\n`;
        result.mismatchedTTTT.slice(0, 10).forEach(m => {
          note += `  - TK ${m.maTKGD}: MS ${m.ttttValue} vs CQG ${m.psValue} (Lệch: ${m.differ})\n`;
        });
      }

      // Update the checklist task status using ShiftsService
      await this.shiftsService.updateTaskStatus(shiftLogId, taskId, status, systemUser, note);

      return {
        success: !hasDiscrepancy,
        message: hasDiscrepancy ? 'Đối chiếu hoàn thành có chênh lệch.' : 'Đối chiếu hoàn thành khớp hoàn toàn.',
        result,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi đối chiếu upload: ${error.message}`, error.stack);
      throw new BadRequestException(`Lỗi khi xử lý file đối chiếu: ${error.message}`);
    }
  }

  @Post('upload-eod')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'qltkgd', maxCount: 1 },
      { name: 'eod', maxCount: 1 },
      { name: 'tttt', maxCount: 1 },
      { name: 'accountsBalances', maxCount: 1 },
    ]),
  )
  async uploadAndReconcileEOD(
    @UploadedFiles()
    files: {
      qltkgd?: any[];
      eod?: any[];
      tttt?: any[];
      accountsBalances?: any[];
    },
    @Body('shiftLogId') shiftLogId: string,
    @Body('taskId') taskId: string,
    @Body('usdRate') usdRateStr?: string,
  ) {
    if (!shiftLogId || !taskId) {
      throw new BadRequestException('Thiếu shiftLogId hoặc taskId');
    }

    const usdRate = usdRateStr ? parseFloat(usdRateStr) : 25220;

    const fileBuffers = {
      qltkgd: files?.qltkgd?.[0]?.buffer,
      eod: files?.eod?.[0]?.buffer,
      tttt: files?.tttt?.[0]?.buffer,
      accountsBalances: files?.accountsBalances?.[0]?.buffer,
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
          throw new BadRequestException('File QLTKGD.xlsx là bắt buộc để đối chiếu số dư CQG.');
        }

        const result = await this.reconciliationService.checkEODCQG({
          qltkgd: fileBuffers.qltkgd,
          accountsBalances: fileBuffers.accountsBalances,
          qltkgdName: files?.qltkgd?.[0]?.originalname,
          accountsBalancesName: files?.accountsBalances?.[0]?.originalname,
        }, usdRate);

        const hasDiscrepancy = result.length > 0;
        const status = hasDiscrepancy ? 'NEEDS_ATTENTION' : 'PASSED';

        let note = `[ĐỐI CHIẾU SỐ DƯ CQG TỰ ĐỘNG]\n`;
        note += `• Số tài khoản chênh lệch (> 100 USD): ${result.length}\n`;
        if (result.length > 0) {
          note += `⚠️ Danh sách tài khoản lệch:\n`;
          result.slice(0, 10).forEach(r => {
            note += `  - TK ${r.maTKGD}: MS $${r.calculatedBalance} vs CQG $${r.cqgBalance} (Chênh lệch: $${r.differ.toFixed(2)})\n`;
          });
          if (result.length > 10) {
            note += `  ... và ${result.length - 10} tài khoản khác.\n`;
          }
        } else {
          note += `✓ Số dư khớp hoàn toàn giữa M-System và CQG.\n`;
        }

        await this.shiftsService.updateTaskStatus(shiftLogId, taskId, status, systemUser, note);

        return {
          success: !hasDiscrepancy,
          type: 'CQG',
          message: hasDiscrepancy ? 'Đối chiếu số dư CQG có chênh lệch.' : 'Đối chiếu số dư CQG khớp hoàn toàn.',
          result,
        };
      }

      // Case B: M-System EOD Check (if qltkgd is uploaded and accountsBalances is not)
      if (fileBuffers.qltkgd && !fileBuffers.accountsBalances) {
        const result = await this.reconciliationService.checkEOD({
          qltkgd: fileBuffers.qltkgd,
          eod: fileBuffers.eod,
          tttt: fileBuffers.tttt,
          qltkgdName: files?.qltkgd?.[0]?.originalname,
          eodName: files?.eod?.[0]?.originalname,
          ttttName: files?.tttt?.[0]?.originalname,
        });

        const negativeIMRAccCount = result.negativeIMRAcc.length;
        const negativeBalanceAccsCount = result.negativeBalanceAccs?.length || 0;
        const hasDiscrepancy = negativeIMRAccCount > 0 || negativeBalanceAccsCount > 0;
        const status = hasDiscrepancy ? 'NEEDS_ATTENTION' : 'PASSED';

        let note = `[ĐỐI CHIẾU SỐ DƯ EOD (LỌC TK ÂM KÝ QUỸ)]\n`;
        note += `• Số tài khoản âm số dư hiện tại (QLTKGD): ${negativeBalanceAccsCount}\n`;
        note += `• Số tài khoản âm ký quỹ khả dụng (EOD): ${negativeIMRAccCount}\n`;

        if (negativeBalanceAccsCount > 0) {
          note += `🚨 Tài khoản âm số dư hiện tại: ${result.negativeBalanceAccs?.join(', ')}\n`;
        }
        if (negativeIMRAccCount > 0) {
          note += `🚨 Tài khoản âm ký quỹ khả dụng: ${result.negativeIMRAcc.join(', ')}\n`;
        }
        if (!hasDiscrepancy) {
          note += `✓ Không phát hiện tài khoản âm số dư / âm ký quỹ.\n`;
        }

        await this.shiftsService.updateTaskStatus(shiftLogId, taskId, status, systemUser, note);

        return {
          success: !hasDiscrepancy,
          type: 'EOD',
          message: hasDiscrepancy ? 'Phát hiện tài khoản âm ký quỹ/âm số dư.' : 'Không phát hiện tài khoản âm ký quỹ.',
          result,
        };
      }

      throw new BadRequestException('Không nhận diện được loại đối chiếu. Vui lòng tải lên đúng bộ tệp tin.');
    } catch (error: any) {
      this.logger.error(`Lỗi đối chiếu EOD/CQG: ${error.message}`, error.stack);
      throw new BadRequestException(`Lỗi khi xử lý file đối chiếu EOD/CQG: ${error.message}`);
    }
  }

  @Post('negative-margin')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'qltkgd', maxCount: 1 },
      { name: 'eod', maxCount: 1 },
    ]),
  )
  async checkNegativeMargin(
    @UploadedFiles()
    files: {
      qltkgd?: any[];
      eod?: any[];
    },
  ) {
    const fileBuffers = {
      qltkgd: files?.qltkgd?.[0]?.buffer,
      eod: files?.eod?.[0]?.buffer,
    };

    if (!fileBuffers.qltkgd) {
      throw new BadRequestException('File QLTKGD.xlsx là bắt buộc.');
    }

    try {
      const result = await this.reconciliationService.checkNegativeMargin({
        qltkgd: fileBuffers.qltkgd,
        eod: fileBuffers.eod,
        qltkgdName: files?.qltkgd?.[0]?.originalname,
        eodName: files?.eod?.[0]?.originalname,
      });
      return {
        success: true,
        message: 'Lọc tài khoản âm ký quỹ thành công.',
        result,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi lọc tài khoản âm ký quỹ: ${error.message}`, error.stack);
      throw new BadRequestException(`Lỗi khi xử lý file: ${error.message}`);
    }
  }

  // =========================================================================
  // AUTO RECONCILIATION ENDPOINTS
  // =========================================================================

  /**
   * List available sample date directories from local BackupMS folder.
   */
  @Get('sample-dates')
  async listSampleDates() {
    const nodePath = require('path');
    const baseBackupDir = nodePath.join(process.cwd(), '..', 'it-tool-src', 'operate-transaction-app', 'bin', 'Debug', 'Download', 'BackupMS');

    const dates: { label: string; samplePath: string; year: string; month: string; day: string }[] = [];

    if (!fs.existsSync(baseBackupDir)) {
      return { success: false, message: 'Thư mục BackupMS không tồn tại', dates: [] };
    }

    try {
      const years = fs.readdirSync(baseBackupDir).filter(y => /^\d{4}$/.test(y));
      for (const year of years) {
        const yearPath = nodePath.join(baseBackupDir, year);
        const months = fs.readdirSync(yearPath).filter(m => /^T\d{2}/.test(m));
        for (const month of months) {
          const monthPath = nodePath.join(yearPath, month);
          const days = fs.readdirSync(monthPath).filter(d => /^\d{2}\.\d{2}$/.test(d));
          for (const day of days) {
            const dayPath = nodePath.join(monthPath, day);
            const [dd, mm] = day.split('.');
            const label = `${dd}/${mm}/${year}`;
            dates.push({ label, samplePath: dayPath, year, month, day });
          }
        }
      }
      dates.sort((a, b) => {
        const da = `${a.year}-${a.day.split('.')[1]}-${a.day.split('.')[0]}`;
        const db = `${b.year}-${b.day.split('.')[1]}-${b.day.split('.')[0]}`;
        return db.localeCompare(da);
      });
      return { success: true, dates };
    } catch (err: any) {
      return { success: false, message: err.message, dates: [] };
    }
  }

  /**
   * Run all 3 reconciliation checks using local sample files from BackupMS directory.
   * No bot/login required.
   */
  @Post('run-test-local')
  async runTestFromLocalFiles(
    @Body('samplePath') samplePath: string,
    @Body('usdRate') usdRateRaw?: number,
    @Body('sessionStart') sessionStartStr?: string,
  ) {
    if (!samplePath) {
      throw new BadRequestException('Vui lòng cung cấp đường dẫn thư mục (samplePath).');
    }
    if (!fs.existsSync(samplePath)) {
      throw new BadRequestException(`Thư mục không tồn tại: ${samplePath}`);
    }

    const nodePath = require('path');
    const usdRate = usdRateRaw ? Number(usdRateRaw) : 25220;

    const readIfExists = (prefix: string, ext: string): Buffer | null => {
      const direct = nodePath.join(samplePath, `${prefix}.${ext}`);
      if (fs.existsSync(direct)) return fs.readFileSync(direct);
      // Partial match for files like "eod.2025-08-05.csv"
      const files = fs.readdirSync(samplePath);
      const match = files.find((f: string) => f.startsWith(prefix) && f.endsWith(`.${ext}`));
      if (match) return fs.readFileSync(nodePath.join(samplePath, match));
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
        fr1: readIfExists('FR1', 'xlsx') || undefined,
        fr2: readIfExists('FR2', 'xlsx') || undefined,
        op1: readIfExists('OP1', 'xlsx') || undefined,
        op2: readIfExists('OP2', 'xlsx') || undefined,
        ttm: readIfExists('TTM', 'xlsx') || undefined,
      };
      results.klgd = await this.reconciliationService.checkKLGD(klgdFiles, new Date(), [], sessionStartStr || '05:00');
    } catch (err: any) {
      errors.klgd = err.message;
    }

    // 2. EOD Check
    try {
      const qltkgd = readIfExists('QLTKGD', 'xlsx');
      const eod = readIfExists('eod', 'csv');
      if (!qltkgd) throw new Error('Thiếu file QLTKGD.xlsx');
      results.eod = await this.reconciliationService.checkEOD({ qltkgd, eod: eod || undefined });
    } catch (err: any) {
      errors.eod = err.message;
    }

    // 3. CQG Check
    try {
      const qltkgd = readIfExists('QLTKGD', 'xlsx');
      const accountsBalances = readIfExists('Accounts_Balances', 'xlsx');
      if (!qltkgd) throw new Error('Thiếu file QLTKGD.xlsx');
      if (!accountsBalances) throw new Error('Thiếu file Accounts_Balances.xlsx');
      results.cqg = await this.reconciliationService.checkEODCQG({ qltkgd, accountsBalances }, usdRate);
    } catch (err: any) {
      errors.cqg = err.message;
    }

    return { success: Object.keys(errors).length === 0, samplePath, usdRate, results, errors };
  }

  /**
   * Run EOD reconciliation by downloading files from M-System via RPA bot.
   */
  @Post('run-auto')
  async runAutoReconciliation(
    @Body('targetDate') targetDate?: string,
    @Body('usdRate') usdRateRaw?: number,
  ) {
    const usdRate = usdRateRaw ? Number(usdRateRaw) : 25220;
    this.logger.log(`Starting auto reconciliation via RPA for date: ${targetDate || 'today'}`);

    let downloadedFiles: { qltkgdPath: string; ttttPath: string; eodPath: string; downloadDir: string };
    try {
      downloadedFiles = await this.rpaService.downloadReconciliationFiles(targetDate);
    } catch (err: any) {
      throw new BadRequestException(`Không thể tải file từ M-System: ${err.message}`);
    }

    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};

    try {
      const qltkgd = fs.readFileSync(downloadedFiles.qltkgdPath);
      const tttt = downloadedFiles.ttttPath && fs.existsSync(downloadedFiles.ttttPath) ? fs.readFileSync(downloadedFiles.ttttPath) : undefined;
      const eod = downloadedFiles.eodPath && fs.existsSync(downloadedFiles.eodPath) ? fs.readFileSync(downloadedFiles.eodPath) : undefined;
      results.eod = await this.reconciliationService.checkEOD({ qltkgd, tttt, eod });
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
    },
    @Body('usdRate') usdRateStr?: string,
    @Body('tradingDate') tradingDateStr?: string,
    @Body('sessionStart') sessionStartStr?: string,
  ) {
    const usdRate = usdRateStr ? parseFloat(usdRateStr) : 25220;
    if (usdRateStr && !isNaN(usdRate)) {
      await this.reconciliationService.saveUsdRate(usdRate);
    }
    const tradingDate = tradingDateStr ? new Date(tradingDateStr) : new Date();

    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};

    const fileBuffers = {
      dsgd: files?.dsgd?.[0]?.buffer,
      fr1: files?.fr1?.[0]?.buffer,
      fr2: files?.fr2?.[0]?.buffer,
      nano: files?.nano?.[0]?.buffer,
      ttm: files?.ttm?.[0]?.buffer,
      op1: files?.op1?.[0]?.buffer,
      op2: files?.op2?.[0]?.buffer,
      qltkgd: files?.qltkgd?.[0]?.buffer,
      eod: files?.eod?.[0]?.buffer,
      tttt: files?.tttt?.[0]?.buffer,
      accountsBalances: files?.accountsBalances?.[0]?.buffer,
    };

    // 1. KLGD Check
    if (fileBuffers.dsgd) {
      try {
        const klgdFiles = {
          dsgd: fileBuffers.dsgd,
          fr1: fileBuffers.fr1,
          fr2: fileBuffers.fr2,
          nano: fileBuffers.nano,
          ttm: fileBuffers.ttm,
          op1: fileBuffers.op1,
          op2: fileBuffers.op2,
        };
        results.klgd = await this.reconciliationService.checkKLGD(klgdFiles, tradingDate, [], sessionStartStr || '05:00');
      } catch (err: any) {
        errors.klgd = err.message;
      }
    }

    // 2. EOD Check
    if (fileBuffers.qltkgd && !fileBuffers.accountsBalances) {
      try {
        results.eod = await this.reconciliationService.checkEOD({
          qltkgd: fileBuffers.qltkgd,
          eod: fileBuffers.eod,
          tttt: fileBuffers.tttt,
          qltkgdName: files?.qltkgd?.[0]?.originalname,
          eodName: files?.eod?.[0]?.originalname,
          ttttName: files?.tttt?.[0]?.originalname,
        });
      } catch (err: any) {
        errors.eod = err.message;
      }
    }

    // 3. CQG Balance Check
    if (fileBuffers.qltkgd && fileBuffers.accountsBalances) {
      try {
        results.cqg = await this.reconciliationService.checkEODCQG({
          qltkgd: fileBuffers.qltkgd,
          accountsBalances: fileBuffers.accountsBalances,
          qltkgdName: files?.qltkgd?.[0]?.originalname,
          accountsBalancesName: files?.accountsBalances?.[0]?.originalname,
        }, usdRate);
      } catch (err: any) {
        errors.cqg = err.message;
      }
    }

    const hasAnyResults = Object.keys(results).length > 0;
    if (!hasAnyResults && Object.keys(errors).length === 0) {
      throw new BadRequestException(
        'Vui lòng tải lên tối thiểu file DSGD (cho KLGD), hoặc QLTKGD (cho EOD), hoặc QLTKGD+Accounts_Balances (cho CQG).',
      );
    }

    return {
      success: Object.keys(errors).length === 0,
      usdRate,
      results,
      errors,
    };
  }

  @Post('upload-pre-eod')
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
      const result = await this.reconciliationService.checkPreEOD(
        fileBuffers as any,
        acmTradesName,
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

      const status = result.passed ? 'PASSED' : 'NEEDS_ATTENTION';

      let note = `[ĐỐI CHIẾU TRƯỚC EOD]\n`;
      note += `• Khớp lệnh tự doanh (MS vs Straits): ${result.totals.totalACM_MS} vs ${result.totals.totalACM_Straits} lot (Chênh lệch: ${result.totals.differACM} lot)\n`;
      note += `• Khớp lệnh thường (MS vs CQG): ${result.totals.totalCQG_MS} vs ${result.totals.totalCQG_FR} lot (Chênh lệch: ${result.totals.differCQG} lot)\n`;
      note += `• Chênh lệch vị thế net position (MS vs CQG): ${result.mismatchedPositions.length} tài khoản\n`;

      if (result.mismatchedTrades.length > 0) {
        note += `⚠️ Phát hiện ${result.mismatchedTrades.length} giao dịch bị lệch chi tiết:\n`;
        result.mismatchedTrades.slice(0, 10).forEach((m: any) => {
          note += `  - [${m.source}] TK ${m.maTKGD}, HĐ ${m.maHD}, Giá ${m.giaKhop}, Qty ${m.klGiaoDich}: ${m.reason}\n`;
        });
        if (result.mismatchedTrades.length > 10) {
          note += `  - ... và ${result.mismatchedTrades.length - 10} giao dịch khác.\n`;
        }
      }

      if (result.mismatchedPositions.length > 0) {
        note += `⚠️ Phát hiện ${result.mismatchedPositions.length} chênh lệch vị thế ròng (net position) chi tiết:\n`;
        result.mismatchedPositions.slice(0, 10).forEach((m: any) => {
          note += `  - TK ${m.account}, HĐ ${m.symbol}: MS ${m.msPosition} vs CQG ${m.cqgPosition} (Chênh lệch: ${m.differ})\n`;
        });
        if (result.mismatchedPositions.length > 10) {
          note += `  - ... và ${result.mismatchedPositions.length - 10} chênh lệch khác.\n`;
        }
      }

      await this.shiftsService.updateTaskStatus(shiftLogId, taskId, status, systemUser, note);

      return {
        success: true,
        result,
      };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Post('sync-usd-rate')
  async syncUsdRate() {
    try {
      const rate = await this.reconciliationService.syncUsdRateFromMSystem();
      return { success: true, rate };
    } catch (err: any) {
      throw new BadRequestException(`Không thể đồng bộ tỷ giá: ${err.message}`);
    }
  }

  @Get('usd-rate')
  async getUsdRate() {
    try {
      const rate = await this.reconciliationService.getCurrentUsdRate();
      return { success: true, rate };
    } catch (err: any) {
      throw new BadRequestException(`Không thể lấy tỷ giá: ${err.message}`);
    }
  }

  @Get('maturity-manual-messages')
  async getMaturityManualMessages(
    @Query('shiftLogId') shiftLogId: string,
  ) {
    if (!shiftLogId) {
      throw new BadRequestException('Thiếu shiftLogId');
    }
    const log = await this.shiftsService.getShiftById(shiftLogId, { role: 'ADMIN' });
    if (!log) {
      throw new BadRequestException('Không tìm thấy ca trực');
    }

    const shiftDate = log.shiftDate; // e.g. "15/07/2026"
    let formattedDate = '';
    if (shiftDate && shiftDate.includes('/')) {
      const [d, m, y] = shiftDate.split('/');
      formattedDate = `${y}-${m}-${d}`;
    } else {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      formattedDate = `${yyyy}-${mm}-${dd}`;
    }

    const nodePath = require('path');
    const dailyTextPath = nodePath.join(process.cwd(), 'temp', 'reconciliation', formattedDate, 'teams_manual_messages.txt');
    const dailyJsonPath = nodePath.join(process.cwd(), 'temp', 'reconciliation', formattedDate, 'teams_manual_messages.json');
    const fallbackTextPath = nodePath.join(process.cwd(), 'temp', 'downloads', 'teams_manual_messages.txt');
    const fallbackJsonPath = nodePath.join(process.cwd(), 'temp', 'downloads', 'teams_manual_messages.json');

    let textContent = '';
    let jsonContent: any[] = [];

    if (fs.existsSync(dailyTextPath)) {
      textContent = fs.readFileSync(dailyTextPath, 'utf8');
    } else if (fs.existsSync(fallbackTextPath)) {
      textContent = fs.readFileSync(fallbackTextPath, 'utf8');
    }

    if (fs.existsSync(dailyJsonPath)) {
      try {
        jsonContent = JSON.parse(fs.readFileSync(dailyJsonPath, 'utf8'));
      } catch (e) {}
    } else if (fs.existsSync(fallbackJsonPath)) {
      try {
        jsonContent = JSON.parse(fs.readFileSync(fallbackJsonPath, 'utf8'));
      } catch (e) {}
    }

    return {
      success: true,
      shiftDate,
      formattedDate,
      textContent,
      jsonContent,
    };
  }
}
