/**
 * klgd-recon.controller.ts
 *
 * Controller chuyên trách Giám sát & Đối soát Khớp lệnh trong phiên (KLGD Recon Domain).
 * Chuẩn Clean Architecture & Domain-Driven Design (DDD).
 * Quản lý các endpoint chạy kiểm tra cục bộ và điều phối tự động đối soát KLGD.
 */

import {
  Controller,
  Post,
  Body,
  BadRequestException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { RpaScraperService } from '../../ingress';
import { KlgdReconService } from '../services/recon/klgd-recon.service';
import { MsEodReconService } from '../services/recon/ms-eod-recon.service';
import { CqgMergerService } from '../services/merger/cqg-merger.service';
import { ReconConsoleSummaryService } from '../services/console/recon-console-summary.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['api/v1/trading-ops', 'api/v1/reconciliation', 'reconciliation'])
export class KlgdReconController {
  private readonly logger = new Logger(KlgdReconController.name);

  constructor(
    private readonly klgdReconService: KlgdReconService,
    private readonly msEodReconService: MsEodReconService,
    private readonly reconConsoleSummaryService: ReconConsoleSummaryService,
    private readonly cqgMergerService: CqgMergerService,
    private readonly rpaService: RpaScraperService,
  ) {}

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
}
