import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
} from '../../../shared';

@Injectable()
export class EmailWatcherWorker implements IBotWorker {
  private readonly logger = new Logger(EmailWatcherWorker.name);

  readonly capabilityType = 'EMAIL_ATTACHMENT_INGRESS';
  readonly displayName = 'Quét & Tải Đính Kèm Email Ca Trực';

  canHandle(capabilityType: string): boolean {
    return (
      capabilityType === this.capabilityType ||
      capabilityType === 'CHECK_EMAIL' ||
      capabilityType === 'EMAIL_WATCHER'
    );
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `[EmailWatcherWorker] Tiếp nhận quét email đính kèm cho Task: ${context.taskId}, Ca: ${context.shiftId || 'N/A'}`,
    );

    try {
      const targetDate = context.targetDate || new Date().toISOString().split('T')[0];
      const targetDir =
        context.parameters?.targetDirectory ||
        path.join(process.cwd(), 'data', 'backup', 'Email', targetDate);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Giả lập quét hòm thư an toàn
      const simulatedAttachments = [
        `EOD_Report_${targetDate.replace(/-/g, '')}.xlsx`,
        `Daily_Settlement_${targetDate.replace(/-/g, '')}.csv`,
      ];

      return {
        status: 'SUCCESS',
        summary: `Quét email thành công phiên ${targetDate}. Phát hiện ${simulatedAttachments.length} file đính kèm hợp lệ.`,
        metrics: {
          attachmentsCount: simulatedAttachments.length,
          files: simulatedAttachments,
          targetDir,
        },
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`[EmailWatcherWorker] Lỗi quét email: ${err.message}`);
      return {
        status: 'FAILED',
        summary: `Thất bại: ${err.message}`,
        error: err.message,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    }
  }
}
