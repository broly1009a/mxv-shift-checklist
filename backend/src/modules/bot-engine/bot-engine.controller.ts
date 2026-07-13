import { Controller, Get, Post, Body, Param, UseGuards, HttpException, HttpStatus, UploadedFile, UseInterceptors, Logger, Res, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import type { Response } from 'express';
import JSZip from 'jszip';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { BotJobQueueService } from './bot-job-queue.service';
import { RpaDownloaderService } from './rpa-downloader.service';
import { GttCheckerService } from './gtt-checker.service';
import { BotJob } from '../../schemas/bot-job.schema';
import { ShiftLog } from '../../schemas/shift-log.schema';
import { encrypt, decrypt } from './utils/crypto';
import { CqgSyncService } from './cqg-sync.service';

@Controller('api/v1/bot-engine')
@UseGuards(JwtAuthGuard)
export class BotEngineController {
  private readonly logger = new Logger(BotEngineController.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly jobQueueService: BotJobQueueService,
    private readonly rpaService: RpaDownloaderService,
    private readonly gttService: GttCheckerService,
    private readonly cqgSyncService: CqgSyncService,
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
    const acmRaw = await this.settingsService.getSetting('bot_credentials_acm', '');
    const castRaw = await this.settingsService.getSetting('bot_credentials_cast', '');

    let msystem = { url: 'https://msystem.mxv.vn/', username: '', password: '', pin: '' };
    let cqg = { url: 'https://m.cqg.com/cqg/desktop/logon?ref=forced', username: '', password: '' };
    let acm = {
      url: 'https://acm.member-url.vn/login',
      username: '',
      password: '',
      geminiApiKey: '',
      downloadUrl: '',
      downloadBtnSelector: '',
      sftpHost: '',
      sftpPort: '2231',
      sftpUsername: '',
      sftpPassword: '',
      sftpRemoteDir: '',
      sftpFileExtensions: '',
    };
    let cast = { url: 'https://www.cqgtrader.com/CAST/Logon/Logon.asp', username: '', password: '' };

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

    if (acmRaw) {
      try {
        const decrypted = JSON.parse(decrypt(acmRaw));
        acm = {
          url: decrypted.url || 'https://acm.member-url.vn/login',
          username: decrypted.username || '',
          password: decrypted.password ? '********' : '',
          geminiApiKey: decrypted.geminiApiKey ? '********' : '',
          downloadUrl: decrypted.downloadUrl || '',
          downloadBtnSelector: decrypted.downloadBtnSelector || '',
          sftpHost: decrypted.sftpHost || '',
          sftpPort: decrypted.sftpPort || '2231',
          sftpUsername: decrypted.sftpUsername || '',
          sftpPassword: decrypted.sftpPassword ? '********' : '',
          sftpRemoteDir: decrypted.sftpRemoteDir || '/data/',
          sftpFileExtensions: decrypted.sftpFileExtensions || 'dump,log',
        };
      } catch (err) {}
    }

    if (castRaw) {
      try {
        const decrypted = JSON.parse(decrypt(castRaw));
        cast = {
          url: decrypted.url || 'https://www.cqgtrader.com/CAST/Logon/Logon.asp',
          username: decrypted.username || '',
          password: decrypted.password ? '********' : '',
        };
      } catch (err) {}
    }

    const schedulerConfigRaw = await this.settingsService.getSetting('bot_scheduler_config', '[]');
    let schedulerConfig = [];
    try {
      schedulerConfig = JSON.parse(schedulerConfigRaw);
    } catch (e) {}

    return { msystem, cqg, acm, cast, schedulerConfig };
  }

  /**
   * Updates M-System and CQG credentials (encrypted in DB).
   */
  @Post('config')
  async saveConfig(@Body() body: any) {
    const { msystem, cqg, acm, cast, schedulerConfig } = body;

    if (schedulerConfig) {
      await this.settingsService.setSetting('bot_scheduler_config', JSON.stringify(schedulerConfig, null, 2));
    }

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

    if (acm) {
      const acmRaw = await this.settingsService.getSetting('bot_credentials_acm', '');
      let currentAcm: any = {};
      if (acmRaw) {
        try {
          currentAcm = JSON.parse(decrypt(acmRaw));
        } catch (err) {}
      }

      const mergedAcm = {
        url: acm.url || currentAcm.url || 'https://acm.member-url.vn/login',
        username: acm.username !== undefined ? acm.username : currentAcm.username,
        password: acm.password && acm.password !== '********' ? acm.password : currentAcm.password,
        geminiApiKey: acm.geminiApiKey && acm.geminiApiKey !== '********' ? acm.geminiApiKey : currentAcm.geminiApiKey,
        downloadUrl: acm.downloadUrl !== undefined ? acm.downloadUrl : currentAcm.downloadUrl,
        downloadBtnSelector: acm.downloadBtnSelector !== undefined ? acm.downloadBtnSelector : currentAcm.downloadBtnSelector,
        sftpHost: acm.sftpHost !== undefined ? acm.sftpHost : currentAcm.sftpHost,
        sftpPort: acm.sftpPort !== undefined ? acm.sftpPort : currentAcm.sftpPort,
        sftpUsername: acm.sftpUsername !== undefined ? acm.sftpUsername : currentAcm.sftpUsername,
        sftpPassword: acm.sftpPassword && acm.sftpPassword !== '********' ? acm.sftpPassword : currentAcm.sftpPassword,
        sftpRemoteDir: acm.sftpRemoteDir !== undefined ? acm.sftpRemoteDir : currentAcm.sftpRemoteDir,
        sftpFileExtensions: acm.sftpFileExtensions !== undefined ? acm.sftpFileExtensions : currentAcm.sftpFileExtensions,
      };

      await this.settingsService.setSetting('bot_credentials_acm', encrypt(JSON.stringify(mergedAcm)));
    }

    if (cast) {
      const castRaw = await this.settingsService.getSetting('bot_credentials_cast', '');
      let currentCast: any = {};
      if (castRaw) {
        try {
          currentCast = JSON.parse(decrypt(castRaw));
        } catch (err) {}
      }

      const mergedCast = {
        url: cast.url || currentCast.url || 'https://www.cqgtrader.com/CAST/Logon/Logon.asp',
        username: cast.username !== undefined ? cast.username : currentCast.username,
        password: cast.password && cast.password !== '********' ? cast.password : currentCast.password,
      };

      await this.settingsService.setSetting('bot_credentials_cast', encrypt(JSON.stringify(mergedCast)));
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

    const checkType = task.botCheckTypeSnapshot || 'RPA_DOWNLOAD';
    let jobType = 'RPA_DOWNLOAD_REPORTS';
    const payload: any = {
      taskId: task.taskId,
      shiftLogId: log._id.toString(),
      sessionDay: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0],
      maxAttempts: 1, // Only 1 attempt for manual trigger
    };

    if (checkType === 'RPA_DOWNLOAD_CAST') {
      jobType = 'DOWNLOAD_CAST';
    } else if (checkType === 'AUTO_CHECK_SOD') {
      jobType = 'AUTO_CHECK_SOD';
    } else {
      payload.targets = targets;
    }

    // Force enqueue a fresh RPA job
    const job = await this.jobQueueService.enqueue(jobType, payload);

    return { success: true, message: `Đã đưa yêu cầu chạy tác vụ ${jobType} vào hàng đợi.`, jobId: job._id };
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

  /**
   * Performs an instant headless trial login to ACM to verify configurations.
   */
  @Post('test-connection-acm')
  async testConnectionACM() {
    const tempDir = path.join(process.cwd(), 'temp', 'test-connection-acm');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      const { browser } = await this.rpaService.loginACM(tempDir);
      await browser.close();
      return { success: true, message: 'Kết nối thử nghiệm ACM thành công! Robot đăng nhập ACM và vượt mã captcha hoàn tất.' };
    } catch (err: any) {
      throw new HttpException(
        `Kết nối thử nghiệm ACM thất bại: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('trigger-cast-download')
  async triggerCastDownload(@Body('backupPath') backupPath?: string) {
    const job = await this.jobQueueService.enqueue('DOWNLOAD_CAST', {
      maxAttempts: 1,
      backupPath: backupPath || '',
    });
    return { success: true, message: 'Đã đưa yêu cầu tải báo cáo CQG CAST vào hàng đợi.', jobId: job._id };
  }

  /**
   * Performs an instant trial login and download to verify CQG CAST configuration.
   */
  @Post('test-connection-cast')
  async testConnectionCast() {
    const tempDir = path.join(process.cwd(), 'temp', 'test-connection-cast');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const testFile = path.join(tempDir, `test_cast_${Date.now()}.xlsx`);

    try {
      await this.rpaService.downloadCastBalances(testFile);
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
      return { success: true, message: 'Kết nối thử nghiệm CQG CAST thành công! Robot đăng nhập và tải file thử nghiệm hoàn tất.' };
    } catch (err: any) {
      throw new HttpException(
        `Kết nối thử nghiệm CQG CAST thất bại: ${err.message || 'Lỗi không xác định'}`,
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
   * Upload hang_hoa.xlsx file manually containing commodity specifications.
   */
  @Post('commodity-upload')
  async uploadCommodityFile(@Body() body: { base64: string; filename?: string }) {
    try {
      const targetPath = this.gttService.getHangHoaXlsxPath();

      if (!body.base64) {
        throw new Error('Không có dữ liệu file được gửi lên.');
      }

      const buffer = Buffer.from(body.base64, 'base64');
      fs.writeFileSync(targetPath, buffer);

      this.logger.log(`hang_hoa.xlsx uploaded successfully to: ${targetPath}`);
      return { success: true, message: 'Upload file hàng hóa thành công!', path: targetPath };
    } catch (err: any) {
      throw new HttpException(
        `Upload file hàng hóa thất bại: ${err.message}`,
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

  /**
   * Generates and downloads the correction Excel file for mismatched GTT prices.
   */
  @Get('gtt-report/export-correction')
  async exportGttCorrection(
    @Query('type') type: 'settlement' | 'first_match' = 'settlement',
    @Res() res: Response,
  ) {
    try {
      if (type !== 'settlement' && type !== 'first_match') {
        throw new HttpException('Loại giá không hợp lệ. Chỉ chấp nhận settlement hoặc first_match.', HttpStatus.BAD_REQUEST);
      }

      const filePath = await this.gttService.generateCorrectionFile(type);
      const filename = path.basename(filePath);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      return res.download(filePath);
    } catch (err: any) {
      throw new HttpException(
        `Không thể xuất file sửa giá: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Pushes the GTT correction prices directly to M-System.
   */
  @Post('gtt-report/push-to-ms')
  async pushGttCorrectionToMs() {
    try {
      const result = await this.gttService.pushCorrectionToMSystem();
      if (!result.success) {
        throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
      }
      return result;
    } catch (err: any) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new HttpException(
        `Lỗi khi đẩy giá lên M-System: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Triggers an on-demand RPA report download job.
   */
  @Post('trigger-download')
  async triggerDownload(@Body('targets') targets?: string[]) {
    const defaultTargets = [
      'NKTTHT',
      'DSTKGD-Futures',
      'DSTKGD-Spread',
      'DSTKGD-LME',
      'DSTKGD-ACM',
      'QLTKGD',
      'TTTT',
      'NR',
      'Markettruoc6h',
    ];

    const actualTargets = targets && targets.length > 0 ? targets : defaultTargets;

    const job = await this.jobQueueService.enqueue('RPA_DOWNLOAD_REPORTS', {
      targets: actualTargets,
      sessionDay: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0],
      maxAttempts: 1, // Only 1 attempt for manual triggers
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu chạy RPA tải báo cáo vào hàng đợi.',
      jobId: job._id,
    };
  }

  /**
   * Zips and downloads files for a completed RPA download job.
   */
  @Get('jobs/:id/download-zip')
  async downloadJobZip(@Param('id') jobId: string, @Res() res: Response) {
    const job = await this.botJobModel.findById(jobId).exec();
    if (!job) {
      throw new HttpException('Không tìm thấy background job tương ứng.', HttpStatus.NOT_FOUND);
    }

    if (job.status !== 'COMPLETED') {
      throw new HttpException(`Job chưa hoàn thành. Trạng thái hiện tại: ${job.status}`, HttpStatus.BAD_REQUEST);
    }

    const jobDir = path.join(process.cwd(), 'temp', 'reports', jobId);
    if (!fs.existsSync(jobDir)) {
      throw new HttpException('Thư mục lưu trữ báo cáo của Job này không tồn tại hoặc đã bị xóa.', HttpStatus.NOT_FOUND);
    }

    const files = fs.readdirSync(jobDir);
    if (files.length === 0) {
      throw new HttpException('Không có báo cáo nào được tải về trong Job này.', HttpStatus.NOT_FOUND);
    }

    const zip = new JSZip();
    for (const filename of files) {
      const filePath = path.join(jobDir, filename);
      const fileStat = fs.statSync(filePath);
      if (fileStat.isFile()) {
        const fileContent = fs.readFileSync(filePath);
        zip.file(filename, fileContent);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=BaoCao_MXV_${jobId}.zip`);
    return res.send(zipBuffer);
  }

  // =========================================================================
  // BACKUP MS AUDIT ENDPOINTS
  // =========================================================================

  /**
   * Returns the configured MS backup folder path.
   */
  @Get('backup-ms/config')
  async getBackupMsConfig() {
    const backupPath = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    );
    return { backupPath };
  }

  /**
   * Saves the MS backup folder path to system settings.
   */
  @Post('backup-ms/config')
  async saveBackupMsConfig(@Body('backupPath') backupPath: string) {
    if (!backupPath || typeof backupPath !== 'string') {
      throw new HttpException('backupPath không hợp lệ.', HttpStatus.BAD_REQUEST);
    }
    await this.settingsService.setSetting('bot_backup_path_ms', backupPath.trim());
    return { success: true, message: 'Đã lưu đường dẫn thư mục backup MS.' };
  }

  /**
   * Synchronously scans the MS backup folder and returns status of each required file.
   * Does NOT trigger any Playwright download — just a quick file system scan.
   */
  @Post('audit-ms-backup')
  async auditMsBackup(@Body('targetDate') targetDateStr?: string) {
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
    const backupPath = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    );

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    const dailyPath = path.join(backupPath, subFolder);

    const scanPath = fs.existsSync(dailyPath) ? dailyPath : backupPath;

    if (!fs.existsSync(scanPath)) {
      throw new HttpException(
        `Thư mục backup không tồn tại: ${scanPath}. Vui lòng kiểm tra lại đường dẫn.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const results = await this.jobQueueService.scanMsBackupFiles(scanPath, targetDate);
    const okCount = results.filter(r => r.status === 'OK').length;
    const missingCount = results.filter(r => r.status === 'MISSING').length;
    const outdatedCount = results.filter(r => r.status === 'OUTDATED').length;

    return {
      success: true,
      backupPath: scanPath,
      summary: { total: results.length, ok: okCount, missing: missingCount, outdated: outdatedCount },
      files: results,
    };
  }

  /**
   * Triggers an async FILE_AUDIT_MS job:
   * Scans backup folder → downloads only missing/outdated files via Playwright.
   */
  @Post('trigger-audit-ms')
  async triggerAuditMs(@Body('targetDate') targetDateStr?: string) {
    const backupPath = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    );

    const job = await this.jobQueueService.enqueue('FILE_AUDIT_MS', {
      backupPath,
      targetDate: targetDateStr || new Date().toISOString(),
      maxAttempts: 1,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu kiểm tra và tải bổ sung file backup MS vào hàng đợi.',
      jobId: job._id,
    };
  }

  // =========================================================================
  // BACKUP CQG AUDIT ENDPOINTS
  // =========================================================================

  /**
   * Returns the configured CQG backup base directory path and resolved full path for today.
   */
  @Get('backup-cqg/config')
  async getBackupCqgConfig() {
    const { baseDir, fullPath } = await this.cqgSyncService.getDailyBackupPath(new Date());
    return { backupPath: baseDir, fullPath };
  }

  /**
   * Saves the CQG backup folder path to system settings.
   */
  @Post('backup-cqg/config')
  async saveBackupCqgConfig(@Body('backupPath') backupPath: string) {
    if (!backupPath || typeof backupPath !== 'string') {
      throw new HttpException('backupPath không hợp lệ.', HttpStatus.BAD_REQUEST);
    }
    await this.settingsService.setSetting('bot_backup_path_cqg', backupPath.trim());
    return { success: true, message: 'Đã lưu đường dẫn thư mục backup CQG.' };
  }

  /**
   * Synchronously scans the daily CQG backup folder and returns status of required files.
   */
  @Post('audit-cqg-backup')
  async auditCqgBackup(@Body('targetDate') targetDateStr?: string) {
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
    const { fullPath } = await this.cqgSyncService.getDailyBackupPath(targetDate);

    const results = await this.cqgSyncService.scanCqgBackupFiles(targetDate);
    const okCount = results.filter(r => r.status === 'OK').length;
    const missingCount = results.filter(r => r.status === 'MISSING').length;
    const outdatedCount = results.filter(r => r.status === 'OUTDATED').length;

    return {
      success: true,
      backupPath: fullPath,
      summary: { total: results.length, ok: okCount, missing: missingCount, outdated: outdatedCount },
      files: results,
    };
  }

  /**
   * Triggers an async FILE_AUDIT_CQG job:
   * Scans backup folder -> merges missing/outdated files.
   */
  @Post('trigger-audit-cqg')
  async triggerAuditCqg(@Body('targetDate') targetDateStr?: string) {
    const job = await this.jobQueueService.enqueue('FILE_AUDIT_CQG', {
      targetDate: targetDateStr || new Date().toISOString(),
      maxAttempts: 1,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu kiểm tra và ghép file backup CQG vào hàng đợi.',
      jobId: job._id,
    };
  }

  // =========================================================================
  // BACKUP ACM AUDIT ENDPOINTS
  // =========================================================================

  /**
   * Returns the configured ACM backup folder path.
   */
  @Get('backup-acm/config')
  async getBackupAcmConfig() {
    const backupPath = await this.jobQueueService.getAcmBackupBase();
    return { backupPath };
  }

  /**
   * Saves the ACM backup folder path to system settings.
   */
  @Post('backup-acm/config')
  async saveBackupAcmConfig(@Body('backupPath') backupPath: string) {
    return { success: true, message: 'Đường dẫn ACM được tự động đồng bộ theo Backup MS.' };
  }

  /**
   * Synchronously scans the ACM backup folder and returns status.
   */
  @Post('audit-acm-backup')
  async auditAcmBackup(@Body('targetDate') targetDateStr?: string) {
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
    const backupPath = await this.jobQueueService.getAcmBackupBase();

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    const dailyPath = path.join(backupPath, subFolder);

    const scanPath = fs.existsSync(dailyPath) ? dailyPath : backupPath;

    if (!fs.existsSync(scanPath)) {
      fs.mkdirSync(scanPath, { recursive: true });
    }

    const results = await this.jobQueueService.scanAcmBackupFiles(scanPath, targetDate);
    const okCount = results.filter(r => r.status === 'OK').length;
    const missingCount = results.filter(r => r.status === 'MISSING').length;
    const outdatedCount = results.filter(r => r.status === 'OUTDATED').length;

    return {
      success: true,
      backupPath: scanPath,
      summary: { total: results.length, ok: okCount, missing: missingCount, outdated: outdatedCount },
      files: results,
    };
  }

  /**
   * Triggers an async FILE_AUDIT_ACM job.
   */
  @Post('trigger-audit-acm')
  async triggerAuditAcm(@Body('targetDate') targetDateStr?: string) {
    const backupPath = await this.jobQueueService.getAcmBackupBase();

    const job = await this.jobQueueService.enqueue('FILE_AUDIT_ACM', {
      backupPath,
      targetDate: targetDateStr || new Date().toISOString(),
      maxAttempts: 1,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu kiểm tra và tải bổ sung file backup ACM vào hàng đợi.',
      jobId: job._id,
    };
  }

  /**
   * Cung cấp Captcha gõ tay từ UI cho Job đang chờ.
   */
  @Post('jobs/:id/submit-captcha')
  async submitCaptcha(@Param('id') jobId: string, @Body('captchaText') captchaText: string) {
    if (!captchaText || typeof captchaText !== 'string') {
      throw new HttpException('Mã captcha không hợp lệ.', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.jobQueueService.submitCaptcha(jobId, captchaText.trim());
      return { success: true, message: 'Đã gửi captcha thành công. Job đang tiếp tục chạy.' };
    } catch (err: any) {
      throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
    }
  }

  // =========================================================================
  // MACRO LOT CONSOLIDATION ENDPOINTS
  // =========================================================================

  /**
   * Lấy cấu hình chạy Excel Macro thống kê số lot.
   */
  @Get('macro-lot/config')
  async getMacroLotConfig() {
    const defaultMacroPath = fs.existsSync(path.join(process.cwd(), 'marco'))
      ? path.join(process.cwd(), 'marco', 'Thong ke so lot giao dich có ACM', 'Macro thong ke so lot giao dich có ACM.xlsm')
      : path.join(process.cwd(), '..', 'marco', 'Thong ke so lot giao dich có ACM', 'Macro thong ke so lot giao dich có ACM.xlsm');

    const macroPath = await this.settingsService.getSetting(
      'bot_macro_lot_path',
      defaultMacroPath
    );
    const backupMs = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures'
    );
    const backupCqg = await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures'
    );
    const defaultScriptPath = (() => {
      const relPath = path.join(process.cwd(), '..', 'POC', 'scripts', 'run_lot_macro.py');
      const relPath2 = path.join(process.cwd(), 'scripts', 'run_lot_macro.py');
      if (fs.existsSync(relPath)) return relPath;
      if (fs.existsSync(relPath2)) return relPath2;
      return path.join('C:', 'POC', 'scripts', 'run_lot_macro.py');
    })();

    const pythonExe = await this.settingsService.getSetting('bot_python_path', 'python');
    const scriptPath = await this.settingsService.getSetting('bot_lot_script_path', defaultScriptPath);
    const targetRoot = await this.settingsService.getSetting(
      'bot_lot_macro_target_root',
      'M:\\Quanlygiaodich\\Tai lieu hoat dong'
    );
    return { macroPath, backupMs, backupCqg, pythonExe, scriptPath, targetRoot };
  }

  /**
   * Lưu cấu hình Excel Macro thống kê số lot.
   */
  @Post('macro-lot/config')
  async saveMacroLotConfig(
    @Body('macroPath') macroPath?: string,
    @Body('scriptPath') scriptPath?: string,
    @Body('pythonExe') pythonExe?: string,
    @Body('targetRoot') targetRoot?: string,
  ) {
    if (macroPath !== undefined) {
      await this.settingsService.setSetting('bot_macro_lot_path', macroPath.trim());
    }
    if (scriptPath !== undefined) {
      await this.settingsService.setSetting('bot_lot_script_path', scriptPath.trim());
    }
    if (pythonExe !== undefined) {
      await this.settingsService.setSetting('bot_python_path', pythonExe.trim());
    }
    if (targetRoot !== undefined) {
      await this.settingsService.setSetting('bot_lot_macro_target_root', targetRoot.trim());
    }
    return { success: true, message: 'Đã cập nhật cấu hình chạy Excel Macro thống kê số lot.' };
  }

  /**
   * Kích hoạt job chạy Excel Macro thống kê số lot.
   */
  @Post('trigger-lot-macro')
  async triggerLotMacro(@Body('targetDate') targetDateStr?: string) {
    const defaultMacroPath = fs.existsSync(path.join(process.cwd(), 'marco'))
      ? path.join(process.cwd(), 'marco', 'Thong ke so lot giao dich có ACM', 'Macro thong ke so lot giao dich có ACM.xlsm')
      : path.join(process.cwd(), '..', 'marco', 'Thong ke so lot giao dich có ACM', 'Macro thong ke so lot giao dich có ACM.xlsm');

    const macroPath = await this.settingsService.getSetting('bot_macro_lot_path', defaultMacroPath);
    const backupPathMs = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures'
    );
    const backupPathCqg = await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures'
    );
    const pythonExe = await this.settingsService.getSetting('bot_python_path', 'python');
    const targetRoot = await this.settingsService.getSetting(
      'bot_lot_macro_target_root',
      'M:\\Quanlygiaodich\\Tai lieu hoat dong'
    );

    const defaultScriptPath = (() => {
      const relPath = path.join(process.cwd(), '..', 'POC', 'scripts', 'run_lot_macro.py');
      const relPath2 = path.join(process.cwd(), 'scripts', 'run_lot_macro.py');
      if (fs.existsSync(relPath)) return relPath;
      if (fs.existsSync(relPath2)) return relPath2;
      return path.join('C:', 'POC', 'scripts', 'run_lot_macro.py');
    })();
    const scriptPath = await this.settingsService.getSetting('bot_lot_script_path', defaultScriptPath);

    let targetDate = new Date();
    if (targetDateStr) {
      targetDate = new Date(targetDateStr);
    }
    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    const job = await this.jobQueueService.enqueue('RUN_LOT_MACRO', {
      targetDate: formattedDate,
      macroPath,
      scriptPath,
      backupPathMs,
      backupPathCqg,
      targetRoot,
      pythonExe,
      maxAttempts: 1,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu chạy Excel Macro thống kê số lot vào hàng đợi.',
      jobId: job._id,
    };
  }

  // =========================================================================
  // MACRO VALUE CONSOLIDATION ENDPOINTS
  // =========================================================================

  /**
   * Lấy cấu hình chạy Excel Macro thống kê giá trị.
   */
  @Get('macro-value/config')
  async getMacroValueConfig() {
    const defaultMacroPath = fs.existsSync(path.join(process.cwd(), 'marco'))
      ? path.join(process.cwd(), 'marco', 'Thong ke gia tri giao dich có ACM', 'Macro thong ke gia tri giao dich có ACM.xlsm')
      : path.join(process.cwd(), '..', 'marco', 'Thong ke gia tri giao dich có ACM', 'Macro thong ke gia tri giao dich có ACM.xlsm');

    const defaultScriptPath = (() => {
      const relPath = path.join(process.cwd(), '..', 'POC', 'scripts', 'run_value_macro.py');
      const relPath2 = path.join(process.cwd(), 'scripts', 'run_value_macro.py');
      if (fs.existsSync(relPath)) return relPath;
      if (fs.existsSync(relPath2)) return relPath2;
      return path.join('C:', 'POC', 'scripts', 'run_value_macro.py');
    })();

    const macroPath = await this.settingsService.getSetting('bot_macro_value_path', defaultMacroPath);
    const scriptPath = await this.settingsService.getSetting('bot_value_script_path', defaultScriptPath);
    const pythonExe = await this.settingsService.getSetting('bot_python_path', 'python');
    return { macroPath, scriptPath, pythonExe };
  }

  /**
   * Lưu cấu hình Excel Macro thống kê giá trị.
   */
  @Post('macro-value/config')
  async saveMacroValueConfig(
    @Body('macroPath') macroPath?: string,
    @Body('scriptPath') scriptPath?: string,
    @Body('pythonExe') pythonExe?: string,
  ) {
    if (macroPath !== undefined) {
      await this.settingsService.setSetting('bot_macro_value_path', macroPath.trim());
    }
    if (scriptPath !== undefined) {
      await this.settingsService.setSetting('bot_value_script_path', scriptPath.trim());
    }
    if (pythonExe !== undefined) {
      await this.settingsService.setSetting('bot_python_path', pythonExe.trim());
    }
    return { success: true, message: 'Đã cập nhật cấu hình chạy Excel Macro thống kê giá trị.' };
  }

  /**
   * Kích hoạt job chạy Excel Macro thống kê giá trị.
   */
  @Post('trigger-value-macro')
  async triggerValueMacro(@Body('targetDate') targetDateStr?: string) {
    const defaultMacroPath = fs.existsSync(path.join(process.cwd(), 'marco'))
      ? path.join(process.cwd(), 'marco', 'Thong ke gia tri giao dich có ACM', 'Macro thong ke gia tri giao dich có ACM.xlsm')
      : path.join(process.cwd(), '..', 'marco', 'Thong ke gia tri giao dich có ACM', 'Macro thong ke gia tri giao dich có ACM.xlsm');

    const macroPath = await this.settingsService.getSetting('bot_macro_value_path', defaultMacroPath);

    const defaultScriptPath = (() => {
      const relPath = path.join(process.cwd(), '..', 'POC', 'scripts', 'run_value_macro.py');
      const relPath2 = path.join(process.cwd(), 'scripts', 'run_value_macro.py');
      if (fs.existsSync(relPath)) return relPath;
      if (fs.existsSync(relPath2)) return relPath2;
      return path.join('C:', 'POC', 'scripts', 'run_value_macro.py');
    })();

    const scriptPath = await this.settingsService.getSetting('bot_value_script_path', defaultScriptPath);
    const pythonExe = await this.settingsService.getSetting('bot_python_path', 'python');

    let targetDate = new Date();
    if (targetDateStr) {
      targetDate = new Date(targetDateStr);
    }
    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    const job = await this.jobQueueService.enqueue('RUN_VALUE_MACRO', {
      targetDate: formattedDate,
      macroPath,
      scriptPath,
      pythonExe,
      maxAttempts: 1,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu chạy Excel Macro thống kê giá trị vào hàng đợi.',
      jobId: job._id,
    };
  }
}
