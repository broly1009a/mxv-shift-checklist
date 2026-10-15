/**
 * [V1 FACADE] DsgdBeforeEodService — Thin Delegation Facade (Strangler Fig Pattern)
 *
 * Task 3.6 — 14/10/2026: Service này đã được chuyển đổi thành Facade mỏng
 * ủy quyền 100% sang V2 tại trading-ops/services/dsgd-before-eod.service.ts
 *
 * Tất cả signature public được giữ nguyên để đảm bảo backward compatibility.
 * Bên trong chỉ gọi this.v2Service.method() — KHÔNG chứa logic nghiệp vụ.
 *
 * Lịch sử: File gốc 314 dòng chứa toàn bộ logic — Đã di chuyển sang V2.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { DsgdBeforeEodService as DsgdBeforeEodServiceV2 } from '../../trading-ops/services/dsgd-before-eod.service';

export type CheckDSGDBeforeEODResult = Awaited<
  ReturnType<DsgdBeforeEodServiceV2['checkDSGDBeforeEODFromBuffers']>
>;

@Injectable()
export class DsgdBeforeEodService {
  private readonly logger = new Logger('DsgdBeforeEodService-V1-Facade');

  constructor(
    @Optional()
    private readonly v2Service?: DsgdBeforeEodServiceV2,
  ) {
    if (!this.v2Service) {
      this.logger.warn(
        '[Facade] V2 DsgdBeforeEodService không được inject. ' +
        'Đảm bảo TradingOpsModule được import vào ReconciliationModule.',
      );
    }
  }

  /**
   * @deprecated Dùng qua V2: trading-ops/services/dsgd-before-eod.service.ts
   */
  public calculatePreviousSessionDate(inputDate?: Date | string) {
    if (!this.v2Service) throw new Error('[Facade] V2 DsgdBeforeEodService chưa được inject');
    return this.v2Service.calculatePreviousSessionDate(inputDate);
  }

  /**
   * @deprecated Dùng qua V2: trading-ops/services/dsgd-before-eod.service.ts
   */
  public checkDSGDBeforeEODFromBuffers(
    files: {
      dsgdOriginal: Buffer;
      dsgdTemp?: Buffer;
      acmTrades?: Buffer;
    },
    options?: {
      timeSuffix?: string;
      sessionDate?: string;
    },
  ): CheckDSGDBeforeEODResult {
    if (!this.v2Service) throw new Error('[Facade] V2 DsgdBeforeEodService chưa được inject');
    return this.v2Service.checkDSGDBeforeEODFromBuffers(files, options);
  }

  /**
   * @deprecated Dùng qua V2: trading-ops/services/dsgd-before-eod.service.ts
   */
  public async runAutoCheckDSGDBeforeEOD(options?: {
    tradingDate?: Date | string;
    timeSuffix?: string;
    triggerDownload?: boolean;
  }): Promise<CheckDSGDBeforeEODResult> {
    if (!this.v2Service) throw new Error('[Facade] V2 DsgdBeforeEodService chưa được inject');
    return this.v2Service.runAutoCheckDSGDBeforeEOD(options);
  }
}
