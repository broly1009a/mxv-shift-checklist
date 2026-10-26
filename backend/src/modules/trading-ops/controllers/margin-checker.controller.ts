/**
 * margin-checker.controller.ts
 *
 * Controller chuyên trách Kiểm tra Ký quỹ âm & Rủi ro tài khoản (Margin Checker Domain).
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
import { MarginCheckerService } from '../services/recon/margin-checker.service';
import { ReconConsoleSummaryService } from '../services/console/recon-console-summary.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['api/v1/trading-ops', 'api/v1/reconciliation', 'reconciliation'])
export class MarginCheckerController {
  private readonly logger = new Logger(MarginCheckerController.name);

  constructor(
    private readonly marginCheckerService: MarginCheckerService,
    private readonly reconConsoleSummaryService: ReconConsoleSummaryService,
  ) {}

  /**
   * Quét và phân loại tài khoản âm ký quỹ từ file QLTKGD và eod.
   */
  @Post('negative-margin')
  @Permissions('ACCESS_MARGIN_CHANGE')
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
    @Body('sessionDate') sessionDate?: string,
    @Body('date') dateStr?: string,
    @Body('system') system?: string,
    @Body('scope') scope?: string,
  ) {
    const fileBuffers = {
      qltkgd: files?.qltkgd?.[0]?.buffer,
      eod: files?.eod?.[0]?.buffer,
    };

    if (!fileBuffers.qltkgd) {
      const isCcp = system === 'CCP' || scope === 'CCP' || scope === 'CCP_CE';
      return this.reconConsoleSummaryService.triggerConsoleRun(
        sessionDate || dateStr,
        isCcp ? 'CHECK_EOD_CCP' : 'SCAN_NEGATIVE_MARGIN',
      );
    }

    try {
      const result = await this.marginCheckerService.checkNegativeMargin({
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
      this.logger.error(
        `Lỗi lọc tài khoản âm ký quỹ: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Lỗi khi xử lý file: ${error.message}`);
    }
  }

  /**
   * Kiểm tra ký quỹ TKGD (4 nhóm vi phạm IMR)
   */
  @Post('check-imr')
  @Permissions('ACCESS_AUTO_SHIFT')
  async checkImr(@Body('sessionDate') sessionDate?: string) {
    return this.reconConsoleSummaryService.checkImr(sessionDate);
  }
}
