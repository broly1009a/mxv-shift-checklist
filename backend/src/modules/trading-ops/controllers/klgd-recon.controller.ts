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
  /**
   * @deprecated Thử nghiệm cục bộ cũ - Không sử dụng trong sản xuất.
   */
  @Post('run-test-local')
  @Permissions('ACCESS_AUTO_SHIFT')
  async runTestLocal() {
    throw new BadRequestException('Endpoint run-test-local đã ngừng hoạt động. Toàn bộ đối chiếu chạy tự động qua Bot Worker hoặc màn hình Trading Manager.');
  }

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
