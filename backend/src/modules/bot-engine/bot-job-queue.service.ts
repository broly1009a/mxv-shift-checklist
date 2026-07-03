import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import { BotJob } from '../../schemas/bot-job.schema';
import { RpaDownloaderService } from './rpa-downloader.service';

@Injectable()
export class BotJobQueueService implements OnModuleInit {
  private readonly logger = new Logger(BotJobQueueService.name);
  private isProcessing = false;

  constructor(
    @InjectModel(BotJob.name) private readonly botJobModel: Model<BotJob>,
    private readonly rpaDownloaderService: RpaDownloaderService,
  ) {}

  onModuleInit() {
    // Start background worker loop every 10 seconds
    setInterval(() => {
      this.processQueue().catch((err) => {
        this.logger.error(`Error in background queue loop: ${err.message}`, err.stack);
      });
    }, 10000);
    this.logger.log('Background BotJob queue worker initialized (polling every 10s).');
  }

  /**
   * Enqueues a new background job.
   */
  async enqueue(jobType: string, payload: Record<string, any> = {}): Promise<BotJob> {
    // If a job of the same type and payload (e.g. same taskId) is already pending or processing, reuse/return it
    if (payload.taskId) {
      const existing = await this.botJobModel.findOne({
        jobType,
        status: { $in: ['PENDING', 'PROCESSING'] },
        'payload.taskId': payload.taskId,
      }).exec();

      if (existing) {
        this.logger.log(`Job of type ${jobType} for task ${payload.taskId} already exists in queue. Status: ${existing.status}`);
        return existing;
      }
    }

    const job = new this.botJobModel({
      jobType,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: payload.maxAttempts || 3,
      logs: [`[${new Date().toISOString()}] Job enqueued.`],
      payload,
    });

    await job.save();
    this.logger.log(`Enqueued job: ${jobType} (ID: ${job._id})`);
    return job;
  }

  /**
   * Gets job status for a given checklist task and shift log.
   */
  async getJobForTask(taskId: string, shiftLogId: string): Promise<BotJob | null> {
    return this.botJobModel.findOne({
      'payload.taskId': taskId,
      'payload.shiftLogId': shiftLogId,
    }).sort({ createdAt: -1 }).exec();
  }

  /**
   * Main worker loop to process PENDING jobs.
   */
  private async processQueue() {
    if (this.isProcessing) {
      return;
    }

    // Fetch next PENDING job
    const job = await this.botJobModel.findOne({ status: 'PENDING' }).sort({ createdAt: 1 }).exec();
    if (!job) {
      return;
    }

    this.isProcessing = true;
    job.status = 'PROCESSING';
    job.attempts += 1;
    const startTime = new Date().toISOString();
    job.logs.push(`[${startTime}] Starting attempt ${job.attempts}/${job.maxAttempts}...`);
    await job.save();

    this.logger.log(`Processing job ${job.jobType} (ID: ${job._id}, Attempt: ${job.attempts})`);

    try {
      if (job.jobType === 'RPA_DOWNLOAD_REPORTS') {
        await this.handleRpaDownloadJob(job);
      } else {
        throw new Error(`Loại job không được hỗ trợ: ${job.jobType}`);
      }

      job.status = 'COMPLETED';
      job.logs.push(`[${new Date().toISOString()}] Job completed successfully.`);
      await job.save();
      this.logger.log(`Job ${job.jobType} (ID: ${job._id}) completed successfully.`);
    } catch (err: any) {
      const errorMsg = err.message || 'Lỗi không xác định';
      this.logger.error(`Job ${job.jobType} (ID: ${job._id}) failed: ${errorMsg}`);
      
      job.logs.push(`[${new Date().toISOString()}] Attempt ${job.attempts} failed: ${errorMsg}`);
      
      if (job.attempts < job.maxAttempts) {
        job.status = 'PENDING'; // Requeue for retry
        job.logs.push(`[${new Date().toISOString()}] Requeued for retry.`);
      } else {
        job.status = 'FAILED';
        job.logs.push(`[${new Date().toISOString()}] Job failed permanently (exhausted attempts).`);
      }
      await job.save();
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle RPA report downloads.
   */
  private async handleRpaDownloadJob(job: BotJob) {
    // 1. Prepare temp directory
    const tempDir = path.join(process.cwd(), 'temp', 'reports');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const targets: string[] = job.payload?.targets || ['NKTTHT', 'NR', 'QLTKGD', 'DSGD'];
    const sessionDay: string = job.payload?.sessionDay;

    job.logs.push(`[${new Date().toISOString()}] Reports to download: ${targets.join(', ')}`);
    await job.save();

    // 2. Perform Login
    const { browser, page } = await this.rpaDownloaderService.loginMSystem(tempDir);

    try {
      // 3. Process each download sequential
      for (const target of targets) {
        const destFile = path.join(tempDir, `${target}.csv`);
        job.logs.push(`[${new Date().toISOString()}] Downloading report: ${target}...`);
        await job.save();

        switch (target) {
          case 'NKTTHT':
            await this.rpaDownloaderService.downloadNKTTHT(page, destFile);
            break;
          case 'DSTKGD-Futures':
            await this.rpaDownloaderService.downloadDSTKGDFutures(page, destFile);
            break;
          case 'DSTKGD-Spread':
            await this.rpaDownloaderService.downloadDSTKGDSpread(page, destFile);
            break;
          case 'DSTKGD-LME':
            await this.rpaDownloaderService.downloadDSTKGDLME(page, destFile);
            break;
          case 'DSTKGD-ACM':
            await this.rpaDownloaderService.downloadDSTKGDACM(page, destFile);
            break;
          case 'QLTKGD':
          case 'QLTTTKGD':
            await this.rpaDownloaderService.downloadQLTTTKGD(page, destFile);
            break;
          case 'QLTKGDAmKQ':
            await this.rpaDownloaderService.downloadQLTTTKGDAmKQ(page, destFile);
            break;
          case 'TLKQHSKQ':
            await this.rpaDownloaderService.downloadTLKQHSKQ(page, destFile);
            break;
          case 'NR':
            await this.rpaDownloaderService.downloadNR(page, destFile);
            break;
          case 'DSTrader':
            await this.rpaDownloaderService.downloadDSTrader(page, destFile);
            break;
          case 'Markettruoc6h':
            await this.rpaDownloaderService.downloadMarkettruoc6h(page, destFile);
            break;
          case 'DSLDK':
            await this.rpaDownloaderService.downloadDSLDK(page, destFile);
            break;
          case 'DSLCK':
            await this.rpaDownloaderService.downloadDSLCK(page, destFile);
            break;
          case 'DSLH':
            await this.rpaDownloaderService.downloadDSLH(page, destFile);
            break;
          case 'DSLK':
            await this.rpaDownloaderService.downloadDSLK(page, destFile);
            break;
          case 'DSGD':
            await this.rpaDownloaderService.downloadDSGD(page, destFile, sessionDay);
            break;
          default:
            this.logger.warn(`Unknown download target skipped: ${target}`);
            job.logs.push(`[${new Date().toISOString()}] Warning: Unknown download target skipped: ${target}`);
        }

        job.logs.push(`[${new Date().toISOString()}] Downloaded report: ${target} successfully.`);
        await job.save();
      }
    } finally {
      this.logger.log('Closing Playwright browser context.');
      await browser.close().catch((err) => {
        this.logger.error(`Error closing browser: ${err.message}`);
      });
    }
  }
}
