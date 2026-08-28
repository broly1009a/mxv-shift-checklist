import { Logger } from '@nestjs/common';
import { BotJob } from '../../../schemas/bot-job.schema';

export interface IJobExecutionContext {
  syncJobToChecklist: (
    job: any,
    status: string,
    error?: string,
  ) => Promise<void>;
  logger: Logger;
}

export interface IBotJobHandler {
  /**
   * Danh sách các mã jobType mà Handler này phụ trách xử lý.
   * Ví dụ: ['RUN_LOT_MACRO'] hoặc ['CHECK_KLGD', 'CHECK_PRE_EOD', 'AUTO_CHECK_SOD', 'CHECK_EOD_MM']
   */
  readonly jobTypes: string[];

  /**
   * Thực thi logic nghiệp vụ của Job.
   * Nếu thực thi thành công: hàm trả về dữ liệu kết quả (nếu có) hoặc void.
   * Nếu có lỗi: throw Error để Queue quản lý việc retry hoặc đánh dấu FAILED.
   */
  execute(job: BotJob, context: IJobExecutionContext): Promise<any>;
}
