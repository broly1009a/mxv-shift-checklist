import { Injectable, Logger } from '@nestjs/common';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
  TaskExecutionStatus,
} from '../../../shared';
import { GttCheckerService } from '../services/recon/gtt-checker.service';

/**
 * Worker chuyên trách Đối Chiếu Giá Thanh Toán (GTT) giữa M-System và CQG.
 * Tích hợp vào hệ thống Modular Monolith V2 theo chuẩn IBotWorker.
 */
@Injectable()
export class MsCqgGttWorker implements IBotWorker {
  private readonly logger = new Logger(MsCqgGttWorker.name);

  readonly capabilityType = 'CHECK_GTT_LEGACY';
  readonly displayName = 'Đối Chiếu Giá Thanh Toán M-System vs CQG';

  constructor(
    private readonly gttService: GttCheckerService,
  ) {}

  canHandle(capabilityType: string): boolean {
    const norm = (capabilityType || '').toUpperCase().trim();
    return (
      norm === this.capabilityType ||
      norm === 'CHECK_GTT_MS_CQG' ||
      norm === 'GTT_LEGACY' ||
      norm === 'CHECK_GTT_CQG'
    );
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `[MsCqgGttWorker] Bắt đầu thực thi GTT MS vs CQG cho Task: ${context.taskId || 'N/A'}, Ca: ${context.shiftId || 'N/A'}`,
    );

    try {
      const options = {
        targetDate: context.targetDate,
        ...(context.parameters || {}),
      };

      const report = await this.gttService.runFullGttCheck(options);

      const hasDiff = (report.diffCount || 0) > 0;
      const status: TaskExecutionStatus = hasDiff ? 'WARNING' : 'SUCCESS';
      const summary = `Đối chiếu GTT MS-CQG hoàn tất: Khớp ${report.matched}/${report.totalContracts} mã, Lệch: ${report.diffCount}`;

      return {
        status,
        passed: !hasDiff,
        summary,
        metrics: {
          totalContracts: report.totalContracts,
          matched: report.matched,
          diffCount: report.diffCount,
        },
        details: report,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
        logs: report.logs || [],
      };
    } catch (err: any) {
      this.logger.error(`[MsCqgGttWorker] Thất bại: ${err.message}`, err.stack);
      return {
        status: 'FAILED',
        summary: `Đối chiếu GTT MS-CQG thất bại: ${err.message}`,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
        error: err.message,
      };
    }
  }
}
