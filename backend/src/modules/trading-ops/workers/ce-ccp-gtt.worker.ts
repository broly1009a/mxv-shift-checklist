import { Injectable, Logger } from '@nestjs/common';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
  TaskExecutionStatus,
} from '../../../shared';
import { CeCcpGttCheckerService } from '../services/ce-ccp-gtt.service';

/**
 * Worker chuyên trách Đối Soát Giá Thanh Toán (GTT) giữa CoreEX (CE) và CoreCCP (VNCLEAR).
 * Tích hợp vào hệ thống Modular Monolith V2 theo chuẩn IBotWorker.
 */
@Injectable()
export class CeCcpGttWorker implements IBotWorker {
  private readonly logger = new Logger(CeCcpGttWorker.name);

  readonly capabilityType = 'CHECK_GTT_CE_CCP';
  readonly displayName = 'Đối Soát Giá Thanh Toán CoreEX vs CoreCCP';

  constructor(
    private readonly ceCcpGttService: CeCcpGttCheckerService,
  ) {}

  canHandle(capabilityType: string): boolean {
    const norm = (capabilityType || '').toUpperCase().trim();
    return (
      norm === this.capabilityType ||
      norm === 'CE_CCP_GTT' ||
      norm === 'CHECK_GTT' ||
      norm === 'TASK_CCP_06_GTT'
    );
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `[CeCcpGttWorker] Bắt đầu thực thi GTT CE vs CCP cho Task: ${context.taskId || 'N/A'}, Ca: ${context.shiftId || 'N/A'}`,
    );

    try {
      const options = {
        targetDate: context.targetDate,
        ...(context.parameters || {}),
      };

      const report = await this.ceCcpGttService.runCeCcpGttCheck(options);

      const hasDiff = (report.diffCount || 0) > 0;
      const status: TaskExecutionStatus = hasDiff ? 'WARNING' : 'SUCCESS';
      const summary = `Đối soát GTT CE-CCP hoàn tất: Khớp ${report.matched}/${report.totalContracts} mã, Lệch: ${report.diffCount}, Lệch nhỏ: ${report.minorDiffCount}`;

      return {
        status,
        passed: !hasDiff,
        summary,
        metrics: {
          totalContracts: report.totalContracts,
          matched: report.matched,
          diffCount: report.diffCount,
          minorDiffCount: report.minorDiffCount,
        },
        details: report,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
        logs: report.logs || [],
      };
    } catch (err: any) {
      this.logger.error(`[CeCcpGttWorker] Thất bại: ${err.message}`, err.stack);
      return {
        status: 'FAILED',
        summary: `Đối soát GTT CE-CCP thất bại: ${err.message}`,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
        error: err.message,
      };
    }
  }
}
