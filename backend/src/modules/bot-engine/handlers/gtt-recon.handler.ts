import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { CeCcpGttCheckerService } from '../../trading-ops/services/ce-ccp-gtt.service';
import { GttCheckerService } from '../../trading-ops/services/gtt-checker.service';
import { parseJobPayload } from '../helpers/bot-path.helper';

/**
 * Handler quản lý các tác vụ Đối Soát Giá Thanh Toán (GTT) trong BotJobQueue.
 * Hỗ trợ:
 *  - CHECK_GTT_CE_CCP: Đối soát GTT CoreEX (ACM Nano) vs CoreCCP (VNCLEAR)
 *  - CHECK_GTT_LEGACY: Đối chiếu GTT M-System (market.csv) vs CQG QSS
 */
@Injectable()
export class GttReconJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(GttReconJobHandler.name);

  readonly jobTypes = ['CHECK_GTT_CE_CCP', 'CHECK_GTT_LEGACY'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    private readonly ceCcpGttService: CeCcpGttCheckerService,
    private readonly gttService: GttCheckerService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    const payload = parseJobPayload(job);
    const jobType = job.jobType;

    this.logger.log(`[GttReconJobHandler] Tiếp nhận xử lý Job ${jobType} (ID: ${job._id})`);
    job.logs.push(`[${new Date().toISOString()}] [GttRecon] Bắt đầu thực thi ${jobType}...`);
    await job.save();

    if (jobType === 'CHECK_GTT_CE_CCP') {
      const report = await this.ceCcpGttService.runCeCcpGttCheck(payload);
      payload.result = report;
      job.payload = payload;

      const hasDiff = (report.diffCount || 0) > 0;
      const status = hasDiff ? 'NEEDS_ATTENTION' : 'PASSED';
      job.logs.push(
        `[${new Date().toISOString()}] [GttRecon] Hoàn tất đối soát GTT CE-CCP: Khớp ${report.matched}/${report.totalContracts}, Lệch: ${report.diffCount}, Lệch nhỏ: ${report.minorDiffCount}`,
      );
      await job.save();

      if (payload.shiftLogId) {
        await context.syncJobToChecklist(job, status);
      }
      return report;
    }

    if (jobType === 'CHECK_GTT_LEGACY') {
      const report = await this.gttService.runFullGttCheck(payload);
      payload.result = report;
      job.payload = payload;

      const hasDiff = (report.diffCount || 0) > 0;
      const status = hasDiff ? 'NEEDS_ATTENTION' : 'PASSED';
      job.logs.push(
        `[${new Date().toISOString()}] [GttRecon] Hoàn tất đối chiếu GTT MS-CQG: Khớp ${report.matched}/${report.totalContracts}, Lệch: ${report.diffCount}`,
      );
      await job.save();

      if (payload.shiftLogId) {
        await context.syncJobToChecklist(job, status);
      }
      return report;
    }

    throw new Error(`[GttReconJobHandler] Không hỗ trợ loại job: ${jobType}`);
  }
}
