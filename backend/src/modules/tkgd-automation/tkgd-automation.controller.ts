import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { TkgdAutomationService } from './tkgd-automation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller(['api/v1/tkgd', 'tkgd'])
export class TkgdAutomationController {
  private readonly logger = new Logger(TkgdAutomationController.name);

  constructor(private readonly tkgdService: TkgdAutomationService) {}

  /**
   * Helper lấy email của user từ request hoặc fallback
   */
  private getUserEmail(req: any): string {
    return req?.user?.email || req?.headers?.['x-user-email'] || 'hieptruong@mxv.vn';
  }

  /**
   * Lấy tiến trình thời gian thực khi đang xử lý TKGD (Real-time Progress Tracker)
   */
  @Get('progress')
  async getProgress(@Req() req: any) {
    const email = this.getUserEmail(req);
    return this.tkgdService.getProgress(email);
  }

  /**
   * Lấy cấu hình đối soát TKGD của User
   */
  @Get('config')
  async getConfig(@Req() req: any) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.getUserConfig(email);
  }

  /**
   * Lưu cấu hình đối soát TKGD cho User
   */
  @Post('config')
  async saveConfig(@Req() req: any, @Body() dto: any) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.saveUserConfig(email, dto);
  }

  /**
   * Kiểm tra kết nối M-System trực tiếp
   */
  @Post('test-ms')
  async testMSystem(@Req() req: any, @Body() body: any) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.testMSystemConnection(email, body);
  }

  /**
   * Khởi tạo URL chuyển hướng đăng nhập Microsoft OAuth2 độc lập cho TKGD
   */
  @Get('auth/microsoft')
  async microsoftOutlookAuth(@Req() req: any, @Res() res: any, @Query('userEmail') qUserEmail?: string) {
    const email = qUserEmail || this.getUserEmail(req);
    const userConfig = await this.tkgdService.getUserConfig(email);

    const tenantId =
      userConfig.outlook?.tenantId ||
      process.env.MICROSOFT_TENANT_ID ||
      'common';

    const clientId =
      userConfig.outlook?.clientId ||
      process.env.MICROSOFT_CLIENT_ID;

    const redirectUri = encodeURIComponent(
      process.env.MICROSOFT_CALLBACK_URL || 'http://localhost:3000/api/v1/auth/microsoft/callback',
    );

    const scope = encodeURIComponent('openid profile email Mail.Read Mail.ReadWrite offline_access User.Read');

    // Signed state: tkgd:${encodeURIComponent(email)}:${timestamp}:${hash}
    const timestamp = Date.now().toString();
    const secret = process.env.JWT_SECRET || 'trading_mxv_secret_key_2026';
    const hash = crypto.createHmac('sha256', secret).update(`tkgd:${email}:${timestamp}`).digest('hex');
    const state = `tkgd:${encodeURIComponent(email)}:${timestamp}:${hash}`;

    const authorizationUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&response_mode=query&scope=${scope}&state=${state}&prompt=select_account`;

    return res.redirect(authorizationUrl);
  }

  /**
   * Hủy kết nối / Đăng xuất tài khoản Outlook độc lập của TKGD
   */
  @Post('auth/microsoft/disconnect')
  async disconnectOutlook(@Req() req: any, @Body() body: any) {
    const email = body?.userEmail || this.getUserEmail(req);
    return await this.tkgdService.disconnectOutlook(email);
  }

  /**
   * Lấy danh sách hồ sơ đối soát
   */
  @Get('records')
  async getRecords(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('filter') filter?: string,
    @Query('batchDate') batchDate?: string,
    @Query('search') search?: string,
  ) {
    const l = parseInt(limit || '20', 10);
    const p = page ? parseInt(page, 10) : undefined;
    const s = p ? (p - 1) * l : parseInt(skip || '0', 10);
    return await this.tkgdService.getRecords({
      limit: l,
      skip: s,
      page: p || Math.floor(s / l) + 1,
      filter,
      batchDate,
      search,
    });
  }

  /**
   * Chạy quy trình đối soát chéo và xuất file Excel
   */
  @Post('run')
  async runReconciliation(@Req() req: any) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.runReconciliation(email);
  }

  /**
   * Nút 1: Nạp & bóc tách email Outlook
   */
  @Post('sync-mail')
  async syncMail(@Req() req: any, @Body() body: any) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.syncMailOpeningAccounts(email, body?.batchDate);
  }

  /**
   * Nút 2: Cào M-System (Hỗ trợ cào 1 hồ sơ hoặc cào toàn bộ danh sách chờ) + Tự động đối soát
   */
  @Post('sync-msystem')
  async syncMSystem(@Req() req: any, @Body() body: any) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.syncMSystemAccounts(email, {
      investorCode: body?.investorCode,
      downloadImages: body?.downloadImages,
      batchDate: body?.batchDate,
    });
  }

  /**
   * Quét lại Email & Bóc tách lại File đính kèm cho 1 hồ sơ tài khoản cụ thể
   */
  @Post('reparse-account')
  async reparseAccount(@Req() req: any, @Body() body: any) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.reparseAccount(email, {
      recordId: body?.recordId,
      accountCode: body?.accountCode,
      batchDate: body?.batchDate,
    });
  }

  /**
   * Nút 3: Chạy tổng hợp toàn bộ (All-in-One: Quét Mail -> Cào MS -> Đối soát -> Xuất Excel)
   */
  @Post('run-pipeline-all')
  async runPipelineAll(@Req() req: any, @Body() body: any) {
    const email = this.getUserEmail(req);
    // Kích hoạt chu trình trong nền (Async Job) để tránh HTTP Request Timeout khi cào nhiều hồ sơ
    this.tkgdService
      .runPipelineAll(email, {
        downloadImages: body?.downloadImages,
        batchDate: body?.batchDate,
        fromDateTime: body?.fromDateTime,
        toDateTime: body?.toDateTime,
        forceReparse: body?.forceReparse,
      })
      .catch((err) => {
        this.logger.error(`[TKGD-PIPELINE-ASYNC] Lỗi chu trình toàn bộ: ${err.message}`, err.stack);
      });

    return {
      success: true,
      message: 'Đã tiếp nhận yêu cầu và đang thực thi chu trình bóc tách trong nền. Vui lòng theo dõi thanh tiến độ!',
    };
  }

  /**
   * Lấy số lượng thống kê phục vụ Dynamic Badge (số hồ sơ chờ cào MS, số khớp, lệch)
   */
  @Get('stats')
  async getStats(@Req() req: any, @Query('batchDate') batchDate?: string) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.getTkgdStats(email, batchDate);
  }

  /**
   * Tải file Excel đối soát mới nhất về máy
   */
  @Get('download-excel')
  async downloadExcel(@Req() req: any, @Res() res: any) {
    const email = this.getUserEmail(req);
    const filePath = await this.tkgdService.getLatestExcelFilePath(email);
    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: 'Chưa có file Excel đối soát nào được tạo.',
      });
    }
    return res.download(filePath);
  }

  /**
   * Lấy bản đồ phân loại toàn bộ tệp đính kèm (CCCD, HĐ, Chữ ký từ Mail & MS) cho 1 tài khoản
   */
  @Get('files/manifest/:accountCode')
  async getAccountFilesManifest(
    @Req() req: any,
    @Param('accountCode') accountCode: string,
    @Query('batchDate') batchDate?: string,
  ) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.getAccountFilesManifest(email, accountCode, batchDate);
  }

  /**
   * Stream truyền tải ảnh CCCD, chữ ký và tệp PDF trực tiếp đến trình duyệt
   */
  @Get('files/stream')
  async streamFile(
    @Req() req: any,
    @Res() res: any,
    @Query('accountCode') accountCode?: string,
    @Query('batchDate') batchDate?: string,
    @Query('fileName') fileName?: string,
    @Query('filePath') filePath?: string,
  ) {
    const email = this.getUserEmail(req);
    const resolvedPath = await this.tkgdService.resolveAttachmentFilePath(email, {
      accountCode,
      batchDate,
      fileName,
      filePath,
    });

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tệp hồ sơ yêu cầu.',
      });
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.webp') contentType = 'image/webp';

    const safeBaseName = encodeURIComponent(path.basename(resolvedPath));
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${safeBaseName}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    return res.sendFile(path.resolve(resolvedPath));
  }

  /**
   * Cán bộ nghiệp vụ chủ động phê duyệt hồ sơ bằng tay (Manual Override)
   */
  @Post('records/:id/manual-approve')
  async manualApproveRecord(
    @Req() req: any,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.manualApproveRecord(id, email, reason);
  }

  /**
   * Hủy phê duyệt bằng tay, trả về để hệ thống đối soát máy lại
   */
  @Post('records/:id/revert-approve')
  async revertManualApprove(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.revertManualApprove(id, email);
  }

  /**
   * Bật/Tắt chế độ tự động hóa 24/7 (Quét mỗi 5 phút)
   */
  @Post('auto-pipeline/toggle')
  async toggleAutoPipeline(@Req() req: any, @Body('enabled') enabled?: boolean) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.toggleAutoPipeline(email, enabled);
  }

  /**
   * Lấy trạng thái hiện tại của Bot tự động hóa 24/7
   */
  @Get('auto-pipeline/status')
  async getAutoPipelineStatus(@Req() req: any) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.getAutoPipelineStatus(email);
  }

  /**
   * Kích hoạt quét vét dữ liệu lịch sử
   */
  @Post('auto-pipeline/backfill')
  async runHistoricalBackfill(
    @Req() req: any,
    @Body('fromDate') fromDate?: string,
    @Body('toDate') toDate?: string,
  ) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.runHistoricalBackfill(email, fromDate, toDate);
  }
}

