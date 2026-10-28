import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  Res,
  Req,
  Inject,
  forwardRef,
  Optional,
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
import { SystemLogsService } from '../../system-logs/system-logs.service';
import { OmsWatcherService } from '../../trading-ops/services/oms/oms-watcher.service';
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
    private readonly systemLogsService: SystemLogsService,
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    @InjectModel(BotJob.name) private readonly botJobModel: Model<BotJob>,
    @Optional()
    @Inject(forwardRef(() => OmsWatcherService))
    private readonly omsWatcherService?: OmsWatcherService,
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
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    const filter: Record<string, any> = {};
    if (includeDeleted !== 'true') {
      filter.isDeleted = { $ne: true };
    }
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
    @Body('cancelledBy') bodyCancelledBy?: string,
    @Req() req?: any,
  ) {
    const userFromToken = req?.user?.fullName
      ? `${req.user.fullName} (${req.user.username})`
      : req?.user?.username || req?.user?.email;
    const actor = userFromToken || bodyCancelledBy || 'Admin';
    const result = await this.jobQueueService.cancelJob(jobId, reason, actor);
    return {
      success: true,
      message: 'Đã hủy job thành công.',
      data: result,
    };
  }

  /**
   * Xóa mềm (Soft Delete / Archive) một Job đã kết thúc (CANCELLED hoặc FAILED) khỏi hàng đợi hiển thị
   * Bảo toàn 100% dữ liệu gốc trong CSDL và ghi nhận vết kiểm toán vào SystemLog.
   * DELETE /api/v1/checklist-hub/jobs/:id & DELETE /api/v1/bot-engine/jobs/:id
   */
  @Delete('jobs/:id')
  async deleteJob(@Param('id') jobId: string, @Req() req: any) {
    if (req.user?.role !== 'ADMIN') {
      throw new HttpException(
        'Chỉ Quản trị viên (Admin) mới có quyền xóa bản ghi tác vụ.',
        HttpStatus.FORBIDDEN,
      );
    }

    const job = await this.botJobModel.findById(jobId).exec();
    if (!job) {
      throw new HttpException('Không tìm thấy job cần xóa.', HttpStatus.NOT_FOUND);
    }
    if (['PROCESSING', 'PENDING', 'AWAITING_CAPTCHA'].includes(job.status)) {
      throw new HttpException(
        'Không thể xóa tác vụ đang trong hàng đợi hoặc đang chạy. Vui lòng bấm Dừng tác vụ trước.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const actor = req.user?.fullName || req.user?.username || 'Admin';
    const deletedAt = new Date();

    // 1. Soft Delete: Đánh dấu cờ isDeleted = true, lưu giữ toàn bộ dữ liệu & log trong MongoDB
    await this.botJobModel.updateOne(
      { _id: jobId },
      {
        $set: {
          isDeleted: true,
          deletedAt,
          deletedBy: actor,
          deleteReason: 'Đã xóa bởi Quản trị viên',
        },
      },
    );

    // 2. Ghi vết Audit Trail vào SystemLog (Màn hình Activity Logs)
    await this.systemLogsService
      .logEvent({
        eventType: 'BOT_JOB_DELETED',
        source: 'USER',
        actorUserId: req.user?.id || req.user?._id,
        jobId: job._id as any,
        status: 'SUCCESS',
        message: `Quản trị viên ${actor} đã xóa (lưu trữ) tác vụ ${job.jobType} [${jobId.substring(0, 8)}] khỏi hàng đợi.`,
        metadata: {
          jobId: job._id?.toString(),
          jobType: job.jobType,
          originalStatus: job.status,
          deletedBy: actor,
          deletedAt: deletedAt.toISOString(),
        },
      })
      .catch((err) => {
        this.logger.warn(`Lỗi ghi SystemLog khi xóa job: ${err.message}`);
      });

    return {
      success: true,
      message: 'Đã xóa (lưu trữ an toàn) bản ghi tác vụ thành công.',
    };
  }

  /**
   * Dọn dẹp hàng loạt các tác vụ Đã Hủy hoặc Thất Bại (Soft Delete / Archive hàng đợi)
   * Bảo toàn 100% dữ liệu gốc trong CSDL và ghi nhận vết kiểm toán vào SystemLog.
   * POST /api/v1/checklist-hub/jobs/cleanup-cancelled & POST /api/v1/bot-engine/jobs/cleanup-cancelled
   */
  @Post('jobs/cleanup-cancelled')
  async cleanupCancelledJobs(
    @Body('date') targetDate?: string,
    @Body('statuses') statuses?: string[],
    @Req() req?: any,
  ) {
    if (req?.user?.role !== 'ADMIN') {
      throw new HttpException(
        'Chỉ Quản trị viên (Admin) mới có quyền dọn dẹp hàng đợi tác vụ.',
        HttpStatus.FORBIDDEN,
      );
    }

    const actor = req?.user?.fullName || req?.user?.username || 'Admin';
    const deletedAt = new Date();

    const filter: Record<string, any> = {
      status: { $in: statuses && statuses.length > 0 ? statuses : ['CANCELLED', 'FAILED'] },
      isDeleted: { $ne: true },
    };

    if (targetDate) {
      const start = new Date(`${targetDate}T00:00:00.000Z`);
      const end = new Date(`${targetDate}T23:59:59.999Z`);
      filter.createdAt = { $gte: start, $lte: end };
    }

    // 1. Soft Delete hàng loạt: Đánh dấu isDeleted = true, tuyệt đối không xóa cứng CSDL
    const res = await this.botJobModel.updateMany(filter, {
      $set: {
        isDeleted: true,
        deletedAt,
        deletedBy: actor,
        deleteReason: 'Dọn dẹp hàng loạt bởi Quản trị viên',
      },
    });

    const affectedCount = res.modifiedCount || 0;

    // 2. Ghi vết Audit Trail vào SystemLog (Màn hình Activity Logs)
    await this.systemLogsService
      .logEvent({
        eventType: 'BOT_JOB_CLEANUP',
        source: 'USER',
        actorUserId: req?.user?.id || req?.user?._id,
        status: 'SUCCESS',
        message: `Quản trị viên ${actor} đã dọn dẹp ${affectedCount} tác vụ đã hủy/thất bại khỏi hàng đợi (được lưu trữ an toàn).`,
        metadata: {
          deletedCount: affectedCount,
          deletedBy: actor,
          targetDate: targetDate || 'all',
          statuses: filter.status.$in,
          deletedAt: deletedAt.toISOString(),
        },
      })
      .catch((err) => {
        this.logger.warn(`Lỗi ghi SystemLog khi dọn hàng đợi: ${err.message}`);
      });

    return {
      success: true,
      deletedCount: affectedCount,
      message: `Đã dọn dẹp ${affectedCount} tác vụ khỏi hàng đợi (dữ liệu được lưu trữ an toàn trong CSDL).`,
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

  /**
   * Kích hoạt xác minh gửi email sao kê cho tác vụ ca trực.
   * POST /api/v1/checklist-hub/trigger-email-check/:shiftLogId/:taskId & POST /api/v1/bot-engine/trigger-email-check/:shiftLogId/:taskId
   */
  @Post('trigger-email-check/:shiftLogId/:taskId')
  async triggerEmailCheck(
    @Param('shiftLogId') shiftLogId: string,
    @Param('taskId') taskId: string,
  ) {
    const log = await this.shiftLogModel.findById(shiftLogId).exec();
    if (!log) {
      throw new HttpException(
        'Không tìm thấy ca trực tương ứng.',
        HttpStatus.NOT_FOUND,
      );
    }

    const task = log.details.find((t) => t.taskId === taskId);
    if (!task) {
      throw new HttpException(
        'Không tìm thấy tác vụ tương ứng trong ca trực.',
        HttpStatus.NOT_FOUND,
      );
    }

    const existingJob = await this.botJobModel
      .findOne({
        shiftLogId,
        taskId,
        jobType: 'VERIFY_EMAIL_STATUS',
        status: { $in: ['PENDING', 'PROCESSING'] },
      })
      .exec();

    if (existingJob) {
      throw new HttpException(
        'Hệ thống đang chạy xác minh email cho tác vụ này. Vui lòng đợi.',
        HttpStatus.CONFLICT,
      );
    }

    await this.shiftLogModel.updateOne(
      { _id: shiftLogId, 'details.taskId': taskId },
      {
        $set: {
          'details.$.status': 'WAITING',
          'details.$.resultNote':
            'Đang bắt đầu kích hoạt xác minh gửi email sao kê tự động...',
          'details.$.isBotCheckSnapshot': true,
          'details.$.botCheckTypeSnapshot': 'EMAIL_STATUS_CHECK',
          'details.$.botTriggerTimeSnapshot': '07:30',
          'details.$.slaDeadlineSnapshot': '08:00',
        },
      },
    );

    await this.jobQueueService.enqueue('VERIFY_EMAIL_STATUS', {
      taskId,
      shiftLogId,
      sessionDay: log.shiftDate,
      maxAttempts: 1,
    });

    return {
      success: true,
      message: 'Đã kích hoạt xác minh email sao kê tự động.',
    };
  }

  /**
   * Kích hoạt kiểm tra OMS tự động cho tác vụ ca trực.
   * POST /api/v1/checklist-hub/trigger-oms-check/:shiftLogId/:taskId & POST /api/v1/bot-engine/trigger-oms-check/:shiftLogId/:taskId
   */
  @Post('trigger-oms-check/:shiftLogId/:taskId')
  async triggerOmsCheck(
    @Param('shiftLogId') shiftLogId: string,
    @Param('taskId') taskId: string,
  ) {
    if (this.omsWatcherService?.isRunning()) {
      throw new HttpException(
        'Hệ thống đang chạy một phiên kiểm tra OMS khác. Vui lòng đợi.',
        HttpStatus.CONFLICT,
      );
    }

    const log = await this.shiftLogModel.findById(shiftLogId).exec();
    if (!log) {
      throw new HttpException(
        'Không tìm thấy ca trực tương ứng.',
        HttpStatus.NOT_FOUND,
      );
    }

    const task = log.details.find((t) => t.taskId === taskId);
    if (!task) {
      throw new HttpException(
        'Không tìm thấy tác vụ tương ứng trong ca trực.',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.shiftLogModel.updateOne(
      { _id: shiftLogId, 'details.taskId': taskId },
      {
        $set: {
          'details.$.status': 'WAITING',
          'details.$.resultNote':
            'Đang bắt đầu kích hoạt kiểm tra OMS tự động...',
        },
      },
    );

    if (this.omsWatcherService) {
      this.omsWatcherService
        .checkOmsStatus()
        .then(async (result) => {
          const status = result?.success ? 'PASSED' : 'FAILED';
          const resultNoteStr = JSON.stringify({
            message: result?.message || 'Không có phản hồi.',
            timestamp: new Date().toISOString(),
            data: result?.data || null,
          });

          await this.shiftLogModel.updateOne(
            { _id: shiftLogId, 'details.taskId': taskId },
            {
              $set: {
                'details.$.status': status,
                'details.$.resultNote': resultNoteStr,
                'details.$.isChecked': result?.success || false,
                'details.$.checkedAt': new Date(),
              },
            },
          );
        })
        .catch(async (err: any) => {
          await this.shiftLogModel.updateOne(
            { _id: shiftLogId, 'details.taskId': taskId },
            {
              $set: {
                'details.$.status': 'FAILED',
                'details.$.resultNote': JSON.stringify({
                  message: `Lỗi kích hoạt bot: ${err.message}`,
                  timestamp: new Date().toISOString(),
                }),
              },
            },
          );
        });
    }

    return {
      success: true,
      message: 'Đã kích hoạt kiểm tra OMS.',
    };
  }

  /**
   * Kích hoạt chạy bot tải báo cáo cho tác vụ ca trực.
   * POST /api/v1/checklist-hub/trigger/:shiftLogId/:taskId & POST /api/v1/bot-engine/trigger/:shiftLogId/:taskId
   */
  @Post('trigger/:shiftLogId/:taskId')
  async triggerTaskRpa(
    @Param('shiftLogId') shiftLogId: string,
    @Param('taskId') taskId: string,
  ) {
    const log = await this.shiftLogModel.findById(shiftLogId).exec();
    if (!log) {
      throw new HttpException(
        'Không tìm thấy ca trực tương ứng.',
        HttpStatus.NOT_FOUND,
      );
    }

    const task = log.details.find((t) => t.taskId === taskId);
    if (!task) {
      throw new HttpException(
        'Không tìm thấy tác vụ tương ứng trong ca trực.',
        HttpStatus.NOT_FOUND,
      );
    }

    const targetStr = task.botCheckTargetSnapshot || '';
    let targets: string[] = ['NKTTHT'];
    try {
      if (targetStr.trim().startsWith('[')) {
        targets = JSON.parse(targetStr);
      } else if (targetStr) {
        targets = targetStr.split(',').map((t) => t.trim());
      }
    } catch {
      targets = [targetStr];
    }

    const checkType = task.botCheckTypeSnapshot;
    let jobType: any = 'RPA_DOWNLOAD_REPORTS';
    const payload: any = {
      taskId: task.taskId,
      shiftLogId,
      sessionDay: log.shiftDate,
      maxAttempts: 1,
    };

    if (checkType === 'AUTO_DOWNLOAD_MS') {
      jobType = 'RPA_DOWNLOAD_REPORTS';
      payload.targets = targets;
    } else if (
      checkType === 'AUTO_DOWNLOAD_CQG' ||
      checkType === 'DOWNLOAD_CQG_BACKUP'
    ) {
      jobType = 'DOWNLOAD_CQG_BACKUP';
    } else if (
      checkType === 'AUTO_DOWNLOAD_CCP' ||
      checkType === 'DOWNLOAD_CCP_REPORT'
    ) {
      jobType = 'DOWNLOAD_CCP_REPORT';
    } else if (
      checkType === 'AUTO_DOWNLOAD_CE' ||
      checkType === 'DOWNLOAD_CE_REPORT'
    ) {
      jobType = 'DOWNLOAD_CE_REPORT';
    } else if (
      checkType === 'AUTO_DOWNLOAD_CAST' ||
      checkType === 'DOWNLOAD_CAST'
    ) {
      jobType = 'DOWNLOAD_CAST';
    } else {
      payload.targets = targets;
    }

    const job = await this.jobQueueService.enqueue(jobType, payload);

    return {
      success: true,
      message: `Đã đưa yêu cầu chạy tác vụ ${jobType} vào hàng đợi.`,
      jobId: job._id,
    };
  }
}

