/**
 * domain-lock-manager.service.ts
 *
 * DỊCH VỤ QUẢN LÝ KHÓA TÀI NGUYÊN PHÂN HỆ (DOMAIN RESOURCE LOCK MANAGER)
 * Kiến trúc Clean Architecture - Modular Monolith V2.
 * Đơn trách nhiệm (SRP): Quản lý vòng đời và trạng thái khóa của từng Phân Hệ trong RAM.
 *
 * Nguyên tắc:
 * 1. Mỗi phân hệ (MS, CQG, CCP, CE, ACM, EMAIL, RECON) chỉ có tối đa 1 Job chạy cùng lúc (maxPerDomain = 1).
 * 2. Tổng số Job chạy song song toàn hệ thống được kiểm soát qua maxGlobalConcurrency (6).
 * 3. Fail-Safe: Khóa được giải phóng an toàn 100% trong khối finally.
 */

import { Injectable, Logger } from '@nestjs/common';
import { JobResourceDomain } from '../../../shared/constants/job-domains.constant';

export interface IActiveJobContext {
  jobId: string;
  domain: JobResourceDomain;
  domains: JobResourceDomain[]; // Danh sách các phân hệ mà Job đang giữ khóa
  abortController: AbortController;
  cleanups: (() => Promise<void> | void)[];
  startedAt?: Date;
}

@Injectable()
export class DomainLockManagerService {
  private readonly logger = new Logger(DomainLockManagerService.name);
  private readonly maxGlobalConcurrency = 6;
  private readonly maxPerDomain = 1;

  private activeJobs = new Map<string, IActiveJobContext>();

  /**
   * Kiểm tra xem toàn hệ thống đã đạt trần song song chưa
   */
  public isGlobalLimitReached(): boolean {
    return this.activeJobs.size >= this.maxGlobalConcurrency;
  }

  /**
   * Lấy số lượng job hiện đang thực thi
   */
  public getActiveJobsCount(): number {
    return this.activeJobs.size;
  }

  /**
   * Lấy danh sách tất cả các Phân Hệ (Resource Domains) hiện đang bận
   */
  public getActiveDomains(): Set<JobResourceDomain> {
    const domains = new Set<JobResourceDomain>();
    for (const ctx of this.activeJobs.values()) {
      for (const d of ctx.domains) {
        domains.add(d);
      }
    }
    return domains;
  }

  /**
   * Kiểm tra xem một phân hệ cụ thể có đang có job chạy không
   */
  public isDomainBusy(domain: JobResourceDomain): boolean {
    for (const ctx of this.activeJobs.values()) {
      if (ctx.domains.includes(domain)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Kiểm tra xem trong danh sách các phân hệ yêu cầu, có bất kỳ phân hệ nào đang bận không
   */
  public isAnyDomainBusy(requiredDomains: JobResourceDomain[]): boolean {
    for (const d of requiredDomains) {
      if (this.isDomainBusy(d)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Tìm context của Job đang chạy trong một phân hệ
   */
  public getRunningJobByDomain(domain: JobResourceDomain): IActiveJobContext | undefined {
    for (const ctx of this.activeJobs.values()) {
      if (ctx.domains.includes(domain)) {
        return ctx;
      }
    }
    return undefined;
  }

  /**
   * Đăng ký khóa tài nguyên cho Job mới (Acquire Lock)
   * Hỗ trợ cả 1 phân hệ đơn lẻ hoặc mảng các phân hệ (như CHECK_KLGD cần cả MS và CQG)
   */
  public tryAcquire(
    jobId: string,
    domainOrDomains: JobResourceDomain | JobResourceDomain[],
    abortController: AbortController,
    cleanups: (() => Promise<void> | void)[] = [],
  ): boolean {
    if (this.isGlobalLimitReached()) {
      this.logger.warn(`[LOCK_MANAGER] Từ chối cấp khóa cho Job ${jobId}: Đạt trần song song toàn hệ thống (${this.maxGlobalConcurrency}).`);
      return false;
    }

    const domainList = Array.isArray(domainOrDomains) ? domainOrDomains : [domainOrDomains];
    const primaryDomain = domainList[0] || JobResourceDomain.DEFAULT;

    // Kiểm tra xem có phân hệ nào đang bận không
    for (const d of domainList) {
      if (this.isDomainBusy(d)) {
        this.logger.warn(`[LOCK_MANAGER] Từ chối cấp khóa cho Job ${jobId}: Phân hệ "${d}" đang có job khác đang chạy.`);
        return false;
      }
    }

    this.activeJobs.set(jobId, {
      jobId,
      domain: primaryDomain,
      domains: domainList,
      abortController,
      cleanups,
      startedAt: new Date(),
    });

    this.logger.log(`[LOCK_MANAGER] Đã cấp khóa phân hệ [${domainList.join(', ')}] cho Job ${jobId}. (Đang chạy: ${this.activeJobs.size}/${this.maxGlobalConcurrency})`);
    return true;
  }

  /**
   * Lấy context của một Job cụ thể
   */
  public getContext(jobId: string): IActiveJobContext | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Giải phóng tất cả khóa phân hệ của Job (Release Lock)
   * Trả về danh sách domains vừa được giải phóng để kích hoạt bốc job tiếp theo
   */
  public release(jobId: string): JobResourceDomain[] {
    const ctx = this.activeJobs.get(jobId);
    if (!ctx) {
      return [];
    }

    const releasedDomains = ctx.domains;
    this.activeJobs.delete(jobId);
    this.logger.log(`[LOCK_MANAGER] Đã giải phóng khóa phân hệ [${releasedDomains.join(', ')}] của Job ${jobId}. (Còn lại: ${this.activeJobs.size}/${this.maxGlobalConcurrency})`);
    return releasedDomains;
  }

  /**
   * Dừng khẩn cấp và kích hoạt cleanup cho Job đang chạy
   */
  public async abortJob(jobId: string): Promise<boolean> {
    const ctx = this.activeJobs.get(jobId);
    if (!ctx) {
      return false;
    }

    this.logger.log(`[LOCK_MANAGER] Đang kích hoạt AbortController và Cleanups cho Job ${jobId} (${ctx.domain})...`);
    try {
      ctx.abortController.abort();
    } catch (abortErr: any) {
      this.logger.warn(`[LOCK_MANAGER] Lỗi khi gọi abort() cho Job ${jobId}: ${abortErr.message}`);
    }

    for (const cleanup of ctx.cleanups) {
      try {
        await cleanup();
      } catch (cleanupErr: any) {
        this.logger.warn(`[LOCK_MANAGER] Lỗi trong cleanup handler của Job ${jobId}: ${cleanupErr.message}`);
      }
    }

    this.activeJobs.delete(jobId);
    return true;
  }
}
