import { Controller, Post, Get, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { OmsReconService } from '../services/oms-recon.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller([
  'api/v1/trading-ops/oms-recon',
  'api/v1/trading-ops',
])
export class OmsReconController {
  constructor(private readonly omsReconService: OmsReconService) {}

  /**
   * Kích hoạt chạy đối chiếu Ký quỹ TKGD giữa Monitor OMS và QLTTTKGD
   * POST /api/v1/trading-ops/oms-recon/check-margin
   */
  @Post(['check-margin', 'oms-recon/check-margin'])
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE')
  async checkOmsMargin(@Body('sessionDate') sessionDate?: string) {
    try {
      const result = await this.omsReconService.checkOmsMarginReconciliation(sessionDate);
      return {
        success: true,
        data: result,
      };
    } catch (err: any) {
      throw new BadRequestException(`Đối chiếu Ký quỹ OMS thất bại: ${err.message}`);
    }
  }

  /**
   * Lấy kết quả đối chiếu Ký quỹ OMS gần nhất
   * GET /api/v1/trading-ops/oms-recon/margin-summary
   */
  @Get(['margin-summary', 'oms-recon/margin-summary'])
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE')
  async getOmsMarginSummary(@Query('sessionDate') sessionDate?: string) {
    try {
      const result = this.omsReconService.getLatestResult(sessionDate);
      return {
        success: true,
        data: result,
      };
    } catch (err: any) {
      throw new BadRequestException(`Không thể lấy dữ liệu đối chiếu OMS: ${err.message}`);
    }
  }

  /**
   * Kích hoạt chạy đối chiếu TTM (Trạng thái mở) giữa Monitor OMS và File TTM
   * POST /api/v1/trading-ops/oms-recon/check-ttm
   */
  @Post(['check-ttm', 'oms-recon/check-ttm'])
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE')
  async checkOmsTtm(@Body('sessionDate') sessionDate?: string) {
    try {
      const result = await this.omsReconService.checkOmsTtmReconciliation(sessionDate);
      return {
        success: true,
        data: result,
      };
    } catch (err: any) {
      throw new BadRequestException(`Đối chiếu TTM OMS thất bại: ${err.message}`);
    }
  }

  /**
   * Lấy kết quả đối chiếu TTM OMS gần nhất
   * GET /api/v1/trading-ops/oms-recon/ttm-summary
   */
  @Get(['ttm-summary', 'oms-recon/ttm-summary'])
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE')
  async getOmsTtmSummary(@Query('sessionDate') sessionDate?: string) {
    try {
      const result = this.omsReconService.getLatestTtmResult(sessionDate);
      return {
        success: true,
        data: result,
      };
    } catch (err: any) {
      throw new BadRequestException(`Không thể lấy dữ liệu đối chiếu TTM OMS: ${err.message}`);
    }
  }

  /**
   * Kích hoạt chạy đối chiếu TTTT (Tất toán & Lãi lỗ) giữa Monitor OMS và File TTTT
   * POST /api/v1/trading-ops/oms-recon/check-tttt
   */
  @Post(['check-tttt', 'oms-recon/check-tttt'])
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE')
  async checkOmsTttt(@Body('sessionDate') sessionDate?: string) {
    try {
      const result = await this.omsReconService.checkOmsTtttReconciliation(sessionDate);
      return {
        success: true,
        data: result,
      };
    } catch (err: any) {
      throw new BadRequestException(`Đối chiếu TTTT OMS thất bại: ${err.message}`);
    }
  }

  /**
   * Lấy kết quả đối chiếu TTTT OMS gần nhất
   * GET /api/v1/trading-ops/oms-recon/tttt-summary
   */
  @Get(['tttt-summary', 'oms-recon/tttt-summary'])
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE')
  async getOmsTtttSummary(@Query('sessionDate') sessionDate?: string) {
    try {
      const result = this.omsReconService.getLatestTtttResult(sessionDate);
      return {
        success: true,
        data: result,
      };
    } catch (err: any) {
      throw new BadRequestException(`Không thể lấy dữ liệu đối chiếu TTTT OMS: ${err.message}`);
    }
  }
}


