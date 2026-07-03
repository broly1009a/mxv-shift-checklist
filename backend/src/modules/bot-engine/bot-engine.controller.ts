import { Controller, Get, Post, Body, Param, UseGuards, HttpException, HttpStatus, UploadedFile, UseInterceptors, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { BotJobQueueService } from './bot-job-queue.service';
import { RpaDownloaderService } from './rpa-downloader.service';
import { GttCheckerService } from './gtt-checker.service';
import { BotJob } from '../../schemas/bot-job.schema';
import { ShiftLog } from '../../schemas/shift-log.schema';
import { encrypt, decrypt } from './utils/crypto';

@Controller('api/v1/bot-engine')
@UseGuards(JwtAuthGuard)
export class BotEngineController {
  private readonly logger = new Logger(BotEngineController.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly jobQueueService: BotJobQueueService,
    private readonly rpaService: RpaDownloaderService,
    private readonly gttService: GttCheckerService,
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    @InjectModel(BotJob.name) private readonly botJobModel: Model<BotJob>,
  ) {}

  /**
   * Retrieves bot configurations, URLs, and masked credentials.
   */
  @Get('config')
  async getConfig() {
    const msystemRaw = await this.settingsService.getSetting('bot_credentials_msystem', '');
    const cqgRaw = await this.settingsService.getSetting('bot_credentials_cqg', '');

    let msystem = { url: 'https://msystem.mxv.vn/', username: '', password: '', pin: '' };
    let cqg = { url: 'https://m.cqg.com/cqg/desktop/logon?ref=forced', username: '', password: '' };

    if (msystemRaw) {
      try {
        const decrypted = JSON.parse(decrypt(msystemRaw));
        msystem = {
          url: decrypted.url || 'https://msystem.mxv.vn/',
          username: decrypted.username || '',
          password: decrypted.password ? '********' : '',
          pin: decrypted.pin ? '****' : '',
        };
      } catch (err) {}
    }

    if (cqgRaw) {
      try {
        const decrypted = JSON.parse(decrypt(cqgRaw));
        cqg = {
          url: decrypted.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced',
          username: decrypted.username || '',
          password: decrypted.password ? '********' : '',
        };
      } catch (err) {}
    }

    return { msystem, cqg };
  }

  /**
   * Updates M-System and CQG credentials (encrypted in DB).
   */
  @Post('config')
  async saveConfig(@Body() body: any) {
    const { msystem, cqg } = body;

    if (msystem) {
      const msystemRaw = await this.settingsService.getSetting('bot_credentials_msystem', '');
      let currentMsystem: any = {};
      if (msystemRaw) {
        try {
          currentMsystem = JSON.parse(decrypt(msystemRaw));
        } catch (err) {}
      }

      const mergedMsystem = {
        url: msystem.url || currentMsystem.url || 'https://msystem.mxv.vn/',
        username: msystem.username !== undefined ? msystem.username : currentMsystem.username,
        password: msystem.password && msystem.password !== '********' ? msystem.password : currentMsystem.password,
        pin: msystem.pin && msystem.pin !== '****' ? msystem.pin : currentMsystem.pin,
      };

      await this.settingsService.setSetting('bot_credentials_msystem', encrypt(JSON.stringify(mergedMsystem)));
    }

    if (cqg) {
      const cqgRaw = await this.settingsService.getSetting('bot_credentials_cqg', '');
      let currentCqg: any = {};
      if (cqgRaw) {
        try {
          currentCqg = JSON.parse(decrypt(cqgRaw));
        } catch (err) {}
      }

      const mergedCqg = {
        url: cqg.url || currentCqg.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced',
        username: cqg.username !== undefined ? cqg.username : currentCqg.username,
        password: cqg.password && cqg.password !== '********' ? cqg.password : currentCqg.password,
      };

      await this.settingsService.setSetting('bot_credentials_cqg', encrypt(JSON.stringify(mergedCqg)));
    }

    return { success: true, message: 'Cấu hình tài khoản robot đã được cập nhật thành công.' };
  }

  /**
   * Retrieves all recent jobs and their execution logs.
   */
  @Get('jobs')
  async getJobs() {
    return this.botJobModel.find().sort({ createdAt: -1 }).limit(50).exec();
  }

  /**
   * Manually triggers a task's RPA download.
   */
  @Post('trigger/:shiftLogId/:taskId')
  async triggerTaskRpa(@Param('shiftLogId') shiftLogId: string, @Param('taskId') taskId: string) {
    const log = await this.shiftLogModel.findById(shiftLogId).exec();
    if (!log) {
      throw new HttpException('Không tìm thấy ca trực tương ứng.', HttpStatus.NOT_FOUND);
    }

    const task = log.details.find((t) => t.taskId === taskId);
    if (!task) {
      throw new HttpException('Không tìm thấy tác vụ tương ứng trong ca trực.', HttpStatus.NOT_FOUND);
    }

    const targetStr = task.botCheckTargetSnapshot || '';
    let targets: string[] = ['NKTTHT'];
    try {
      if (targetStr.trim().startsWith('[')) {
        targets = JSON.parse(targetStr);
      } else if (targetStr) {
        targets = targetStr.split(',').map((t) => t.trim());
      }
    } catch (e) {
      targets = [targetStr];
    }

    // Force enqueue a fresh RPA job
    const job = await this.jobQueueService.enqueue('RPA_DOWNLOAD_REPORTS', {
      taskId: task.taskId,
      shiftLogId: log._id.toString(),
      targets,
      sessionDay: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0],
      maxAttempts: 1, // Only 1 attempt for manual trigger
    });

    return { success: true, message: 'Đã đưa yêu cầu chạy RPA tải báo cáo vào hàng đợi.', jobId: job._id };
  }

  /**
   * Performs an instant headless trial login to M-System to verify configurations.
   */
  @Post('test-connection')
  async testConnection() {
    const tempDir = path.join(process.cwd(), 'temp', 'test-connection');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      const { browser } = await this.rpaService.loginMSystem(tempDir);
      await browser.close();
      return { success: true, message: 'Kết nối thử nghiệm thành công! Robot đăng nhập M-System và vượt mã PIN ảo hoàn tất.' };
    } catch (err: any) {
      throw new HttpException(
        `Kết nối thử nghiệm thất bại: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Performs an instant headless trial login to CQG to verify configurations.
   */
  @Post('test-connection-cqg')
  async testConnectionCQG() {
    const tempDir = path.join(process.cwd(), 'temp', 'test-connection-cqg');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      const { browser } = await this.rpaService.loginCQG(tempDir);
      await browser.close();
      return { success: true, message: 'Kết nối thử nghiệm CQG thành công! Robot đăng nhập CQG hoàn tất.' };
    } catch (err: any) {
      throw new HttpException(
        `Kết nối thử nghiệm CQG thất bại: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // =========================================================================
  // GTT CHECK ENDPOINTS
  // =========================================================================

  /**
   * Upload GTT.xlsx file (generated by VBA macro) to server for contract list reading.
   */
  @Post('gtt-upload')
  async uploadGttFile(@Body() body: { base64: string; filename?: string }) {
    try {
      const workDir = this.gttService.getWorkDir();
      const targetPath = this.gttService.getGttXlsxPath();

      if (!body.base64) {
        throw new Error('Không có dữ liệu file được gửi lên.');
      }

      const buffer = Buffer.from(body.base64, 'base64');
      fs.writeFileSync(targetPath, buffer);

      this.logger.log(`GTT.xlsx uploaded successfully to: ${targetPath}`);
      return { success: true, message: 'Upload GTT.xlsx thành công!', path: targetPath };
    } catch (err: any) {
      throw new HttpException(
        `Upload GTT.xlsx thất bại: ${err.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Upload market.csv file manually (alternative to auto-download).
   */
  @Post('market-csv-upload')
  async uploadMarketCsv(@Body() body: { base64: string; filename?: string }) {
    try {
      const targetPath = this.gttService.getMarketCsvPath();

      if (!body.base64) {
        throw new Error('Không có dữ liệu file được gửi lên.');
      }

      const buffer = Buffer.from(body.base64, 'base64');
      fs.writeFileSync(targetPath, buffer);

      this.logger.log(`market.csv uploaded successfully to: ${targetPath}`);
      return { success: true, message: 'Upload market.csv thành công!', path: targetPath };
    } catch (err: any) {
      throw new HttpException(
        `Upload market.csv thất bại: ${err.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Trigger the full GTT check pipeline:
   * 1. Optionally download market.csv from M-System
   * 2. Read contract list from GTT.xlsx
   * 3. Fetch settlement prices from CQG
   * 4. Compare and return report
   */
  @Post('run-gtt-check')
  async runGttCheck(@Body() body: { downloadMarketCsv?: boolean } = {}) {
    try {
      const report = await this.gttService.runFullGttCheck({
        downloadMarketCsv: body.downloadMarketCsv ?? false,
      });
      return { success: true, report };
    } catch (err: any) {
      throw new HttpException(
        `Kiểm tra GTT thất bại: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Returns the latest GTT comparison report.
   */
  @Get('gtt-report')
  async getGttReport() {
    const report = this.gttService.getLatestReport();
    if (!report) {
      return { success: false, message: 'Chưa có báo cáo GTT nào. Hãy chạy kiểm tra GTT trước.' };
    }
    return { success: true, report };
  }
}
