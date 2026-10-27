import { Injectable, Logger } from '@nestjs/common';
import { IBotJobHandler } from './job-handler.interface';

@Injectable()
export class BotJobHandlerRegistry {
  private readonly logger = new Logger(BotJobHandlerRegistry.name);
  private readonly handlers = new Map<string, IBotJobHandler>();

  /**
   * Đăng ký một handler xử lý cho danh sách các jobTypes tương ứng.
   */
  public register(handler: IBotJobHandler): void {
    for (const jobType of handler.jobTypes) {
      if (this.handlers.has(jobType)) {
        this.logger.warn(
          `Ghi đè Handler cho Job Type: ${jobType} (Handler cũ: ${this.handlers.get(jobType)?.constructor.name} -> mới: ${handler.constructor.name})`,
        );
      }
      this.handlers.set(jobType, handler);
      this.logger.log(
        `Đã đăng ký Handler [${handler.constructor.name}] cho Job Type: ${jobType}`,
      );
    }
  }

  /**
   * Lấy Handler tương ứng với jobType.
   */
  public getHandler(jobType: string): IBotJobHandler | undefined {
    return this.handlers.get(jobType);
  }

  /**
   * Kiểm tra xem một jobType đã có Handler xử lý chưa.
   */
  public hasHandler(jobType: string): boolean {
    return this.handlers.has(jobType);
  }

  /**
   * Lấy danh sách tất cả các jobTypes đã được đăng ký.
   */
  public getRegisteredJobTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
