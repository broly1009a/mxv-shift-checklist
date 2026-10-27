import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  Res,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import type { Response } from 'express';
import JSZip from 'jszip';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { BotJobQueueService } from '../queue/bot-job-queue.service';
import { BotJob } from '../../../schemas/bot-job.schema';
import { ShiftLog } from '../../../schemas/shift-log.schema';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  getMsBackupBase,
  resolveDailySubfolder,
  resolveStoragePathCrossPlatform,
  parseJobPayload,
} from '../../../shared/helpers/file-path.helper';

@Controller(['api/v1/checklist-hub', 'api/v1/bot-engine'])
@UseGuards(JwtAuthGuard)
export class ChecklistBotJobsController {
  private readonly logger = new Logger(ChecklistBotJobsController.name);

  constructor(
    private readonly jobQueueService: BotJobQueueService,
    private readonly settingsService: SystemSettingsService,
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    @InjectModel(BotJob.name) private readonly botJobModel: Model<BotJob>,
  ) {}
  /**
   * Lấy danh sách background jobs (hỗ trợ lọc theo jobTypes, status, phân trang limit)
   * GET /api/v1/checklist-hub/jobs & GET /api/v1/bot-engine/jobs
   */
  @Get('jobs')
  async getJobs(
    @Query('jobTypes') jobTypes?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const filter: Record<string, any> = {};
    if (jobTypes) {
      const types = jobTypes.split(',').map((t) => t.trim()).filter(Boolean);
      if (types.length > 0) {
        filter.jobType = { $in: types };
      }
    }
    if (status) {
      filter.status = status;
    }
    const maxLimit = Math.min(parseInt(limit || '20', 10) || 20, 100);
    return this.botJobModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(maxLimit)
      .lean()
      .exec();
  }

  /**
   * Truy vấn trạng thái chi tiết của một Job cụ thể
   * GET /api/v1/checklist-hub/jobs/:id & GET /api/v1/bot-engine/jobs/:id
   */
  @Get('jobs/:id')
  async getJobById(@Param('id') jobId: string) {
    const job = await this.botJobModel.findById(jobId).lean().exec();
    if (!job) {
      throw new HttpException('Không tìm thấy job tương ứng.', HttpStatus.NOT_FOUND);
    }
    return job;
  }

  /**
   * Hủy / Dừng khẩn cấp một Job đang thực thi
   * POST /api/v1/checklist-hub/jobs/:id/cancel & POST /api/v1/bot-engine/jobs/:id/cancel
   */
  @Post('jobs/:id/cancel')
  async cancelJob(
    @Param('id') jobId: string,
    @Body('reason') reason?: string,
  ) {
    const result = await this.jobQueueService.cancelJob(jobId, reason);
    return {
      success: true,
      message: 'Đã hủy job thành công.',
      data: result,
    };
  }

  @Get('jobs/:id/download-zip')
  async downloadJobZip(@Param('id') jobId: string, @Res() res: Response) {
    const job = await this.botJobModel.findById(jobId).exec();
    if (!job) {
      throw new HttpException(
        'Không tìm thấy background job tương ứng.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (job.status !== 'COMPLETED') {
      throw new HttpException(
        `Job chưa hoàn thành. Trạng thái hiện tại: ${job.status}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const payload = parseJobPayload(job);
    const candidateDirs: string[] = [];
    const candidateFiles: string[] = [];

    // Nguồn 1: Thư mục tạm theo JobId
    candidateDirs.push(path.join(process.cwd(), 'temp', 'reports', jobId));

    // Nguồn 2: Thư mục đích / file trong payload & result
    if (payload.destFolder) candidateDirs.push(resolveStoragePathCrossPlatform(payload.destFolder));
    if (payload.outputDir) candidateDirs.push(resolveStoragePathCrossPlatform(payload.outputDir));
    if (payload.backupFolder) candidateDirs.push(resolveStoragePathCrossPlatform(payload.backupFolder));
    if (payload.targetFolder) candidateDirs.push(resolveStoragePathCrossPlatform(payload.targetFolder));

    const result = payload.result || {};
    if (result.destFolder) candidateDirs.push(resolveStoragePathCrossPlatform(result.destFolder));
    if (result.outputDir) candidateDirs.push(resolveStoragePathCrossPlatform(result.outputDir));
    if (result.tempDir) candidateDirs.push(resolveStoragePathCrossPlatform(result.tempDir));

    // File đơn lẻ
    if (result.outputPath) candidateFiles.push(resolveStoragePathCrossPlatform(result.outputPath));
    if (result.filePath) candidateFiles.push(resolveStoragePathCrossPlatform(result.filePath));
    if (payload.outputPath) candidateFiles.push(resolveStoragePathCrossPlatform(payload.outputPath));

    // Mảng file
    if (Array.isArray(result.downloadedFiles)) {
      for (const f of result.downloadedFiles) {
        if (typeof f === 'string') candidateFiles.push(resolveStoragePathCrossPlatform(f));
        else if (f?.path) candidateFiles.push(resolveStoragePathCrossPlatform(f.path));
      }
    }
    if (Array.isArray(payload.files)) {
      for (const f of payload.files) {
        if (typeof f === 'string') candidateFiles.push(resolveStoragePathCrossPlatform(f));
        else if (f?.path) candidateFiles.push(resolveStoragePathCrossPlatform(f.path));
      }
    }

    // Nguồn 3: Thư mục Backup ngày tương ứng
    const dateInput = payload.sessionDay || payload.targetDate || payload.startDate || (job.createdAt ? new Date(job.createdAt) : null);
    if (dateInput) {
      try {
        const jobType = (job.jobType || '').toUpperCase();
        if (jobType.includes('RPA') || jobType.includes('MS')) {
          const rawMs = await getMsBackupBase(this.settingsService);
          if (rawMs) candidateDirs.push(resolveDailySubfolder(rawMs, dateInput).fullPath);
        } else if (jobType.includes('CCP') || jobType.includes('LOT') || jobType.includes('VALUE')) {
          const rawCcp = await this.settingsService.getSetting('bot_backup_path_ccp', '');
          if (rawCcp) candidateDirs.push(resolveDailySubfolder(rawCcp, dateInput).fullPath);
        } else if (jobType.includes('CE')) {
          const rawCe = await this.settingsService.getSetting('bot_backup_path_ce', '');
          if (rawCe) candidateDirs.push(resolveDailySubfolder(rawCe, dateInput).fullPath);
        } else if (jobType.includes('CAST')) {
          const rawCast = await this.settingsService.getSetting('bot_backup_path_cast', '');
          if (rawCast) candidateDirs.push(resolveDailySubfolder(rawCast, dateInput).fullPath);
        }
      } catch (err: any) {
        this.logger.warn(`[DownloadZip] Không thể suy diễn thư mục ngày từ dateInput: ${err.message}`);
      }
    }

    // Thu thập các file thực tế tồn tại trên đĩa
    const fileMap = new Map<string, string>(); // baseFileName -> absolutePath

    // 1. Quét file đơn lẻ
    for (const filePath of candidateFiles) {
      if (filePath && fs.existsSync(filePath)) {
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile() && stat.size > 0) {
            fileMap.set(path.basename(filePath), filePath);
          }
        } catch {}
      }
    }

    // 2. Quét các thư mục ứng viên
    const targets = Array.isArray(payload.targets)
      ? payload.targets.map((t: string) => t.toLowerCase())
      : [];

    for (const dir of candidateDirs) {
      if (!dir || !fs.existsSync(dir)) continue;
      try {
        const stat = fs.statSync(dir);
        if (!stat.isDirectory()) continue;

        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          if (entry.startsWith('.') || entry.endsWith('.tmp')) continue;
          const fullFilePath = path.join(dir, entry);
          try {
            const fStat = fs.statSync(fullFilePath);
            if (fStat.isFile() && fStat.size > 0) {
              if (!fileMap.has(entry)) {
                // Nếu targets rỗng hoặc là thư mục tạm của job hoặc entry khớp target
                if (targets.length === 0 || dir.includes(jobId) || targets.some(t => entry.toLowerCase().includes(t))) {
                  fileMap.set(entry, fullFilePath);
                }
              }
            }
          } catch {}
        }
      } catch {}
    }

    if (fileMap.size === 0) {
      throw new HttpException(
        `Không tìm thấy file báo cáo nào của tác vụ (${job.jobType}) để nén tải về. Thư mục lưu trữ cục bộ hoặc thư mục sao lưu theo ngày chưa có tệp hoặc đã bị xóa.`,
        HttpStatus.NOT_FOUND,
      );
    }

    const zip = new JSZip();
    for (const [filename, filePath] of fileMap.entries()) {
      try {
        const fileContent = fs.readFileSync(filePath);
        zip.file(filename, fileContent);
      } catch (err: any) {
        this.logger.warn(`[DownloadZip] Không thể đọc file ${filePath}: ${err.message}`);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=BaoCao_${job.jobType}_${jobId}.zip`,
    );
    return res.send(zipBuffer);
  }

  /**
   * Cung cấp Captcha gõ tay từ UI cho Job đang chờ.
   */
  @Post('jobs/:id/submit-captcha')
  async submitCaptcha(
    @Param('id') jobId: string,
    @Body('captchaText') captchaText: string,
  ) {
    if (!captchaText || typeof captchaText !== 'string') {
      throw new HttpException(
        'Mã captcha không hợp lệ.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Captcha hiện tại đã được giải tự động qua AI Gemini Key
      return {
        success: true,
        message: 'Đã gửi captcha thành công. Job đang tiếp tục chạy.',
      };
    } catch (err: any) {
      throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
    }
  }
}
