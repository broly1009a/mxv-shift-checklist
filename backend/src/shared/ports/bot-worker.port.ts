/**
 * Bot Worker Port Interface
 * Cổng giao tiếp chuẩn hóa cho mọi Worker thực thi tác vụ Bot nghiệp vụ (Trading Ops, CCP Clearing, IT Ops,...).
 *
 * Mọi Worker chuyên ngành (KlgdReconWorker, PreEodReconWorker, CcpLotWorker,...) bắt buộc implement interface này.
 */

import {
  TaskExecutionContext,
  TaskExecutionResult,
} from '../contracts/bot-execution.contract';

export const BOT_WORKER_PORT = 'BOT_WORKER_PORT';

export interface IBotWorker {
  /**
   * Định danh loại nghiệp vụ mà Worker này có năng lực xử lý (khớp với botCheckType cấu hình trên template)
   * Ví dụ: 'CHECK_KLGD', 'CHECK_PRE_EOD', 'CHECK_MARGIN', 'CCP_LOT_STATS'
   */
  readonly capabilityType: string;

  /**
   * Tên hiển thị người dùng (Display name)
   */
  readonly displayName: string;

  /**
   * Thực thi tác vụ nghiệp vụ chuyên ngành
   */
  execute(context: TaskExecutionContext): Promise<TaskExecutionResult>;
}
