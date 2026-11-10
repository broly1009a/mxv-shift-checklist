/**
 * partner-auth-monitor.service.ts
 *
 * Dịch vụ chuyên trách giám sát tần suất đăng nhập và gọi API của 5 phân hệ đối tác.
 * Thiết kế Non-blocking, In-Memory Ring Buffer, Async Batch Flush vào MongoDB,
 * Tự động phát hiện bão đăng nhập (Storm / Rate-limit Exceed) và kích hoạt
 * cơ chế dập bão email với Cooldown 15 phút.
 * Tuân thủ quy chuẩn Zero-Hardcoding (cấu hình động từ SystemSettings).
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PartnerSubsystem,
  IPartnerTelemetryEvent,
  IPartnerMonitorConfig,
  IPartnerHealthSummary,
  HealthStatus,
} from './partner-auth-monitor.interface';
import {
  PartnerAuthTelemetry,
  PartnerAuthTelemetryDocument,
} from './partner-auth-telemetry.schema';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { BotAlertEmailService } from '../../notifications/bot-alert-email.service';

const CONFIG_KEY = 'partner_auth_monitor_config';
const MAX_BUFFER_SIZE = 2000;
const FLUSH_INTERVAL_MS = 5000;

interface IAlertState {
  lastAlertSentAt: number;
  suppressedCount: number;
}

const DEFAULT_CONFIG: IPartnerMonitorConfig = {
  enabled: true,
  recipients: ['it.support@mxv.vn'],
  cooldownMinutes: 15,
  thresholds: {
    CORECCP: { maxLoginsPerMinute: 3, consecutiveFailures: 3, maxRpm: 60 },
    COREEX: { maxLoginsPerMinute: 3, consecutiveFailures: 3, maxRpm: 60 },
    MS: { maxLoginsPerMinute: 3, consecutiveFailures: 3, maxRpm: 40 },
    CQG: { maxLoginsPerMinute: 2, consecutiveFailures: 2, maxRpm: 20 },
    ACM: { maxLoginsPerMinute: 4, consecutiveFailures: 3, maxRpm: 30 },
  },
};

@Injectable()
export class PartnerAuthMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PartnerAuthMonitorService.name);

  // In-Memory Ring Buffer & State Tracking
  private readonly buffer: IPartnerTelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  // Trạng thái theo dõi thời gian thực cho từng đối tác
  private readonly consecutiveFailures = new Map<PartnerSubsystem, number>([
    ['CORECCP', 0],
    ['COREEX', 0],
    ['MS', 0],
    ['CQG', 0],
    ['ACM', 0],
  ]);

  private readonly lastErrors = new Map<PartnerSubsystem, string>();
  private readonly lastSeen = new Map<PartnerSubsystem, Date>();

  // Rolling window timestamps (chỉ giữ timestamp của 1 giờ qua trong RAM)
  private readonly recentEvents = new Map<PartnerSubsystem, IPartnerTelemetryEvent[]>([
    ['CORECCP', []],
    ['COREEX', []],
    ['MS', []],
    ['CQG', []],
    ['ACM', []],
  ]);

  // Bộ dập bão Email (Email Storm Suppression)
  private readonly alertStates = new Map<string, IAlertState>();

  constructor(
    @InjectModel(PartnerAuthTelemetry.name)
    private readonly telemetryModel: Model<PartnerAuthTelemetryDocument>,
    @Optional()
    private readonly settingsService?: SystemSettingsService,
    @Optional()
    private readonly emailAlertService?: BotAlertEmailService,
  ) {}

  onModuleInit() {
    this.startBatchFlushTimer();
    this.logger.log('PartnerAuthMonitorService đã sẵn sàng (Non-blocking Buffer & Storm Monitor).');
  }

  onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    // Flush nốt những bản ghi còn sót trước khi shutdown
    this.flushBufferToDatabase();
  }

  /**
   * Khởi động timer định kỳ trút buffer xuống MongoDB
   */
  private startBatchFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flushBufferToDatabase();
      this.pruneOldRollingEvents();
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * Ghi nhận một sự kiện Telemetry (Non-blocking, O(1) synchronous)
   */
  recordEvent(event: IPartnerTelemetryEvent): void {
    const timestamp = event.timestamp || new Date();
    const enrichedEvent: IPartnerTelemetryEvent = {
      ...event,
      timestamp,
    };

    // 1. Đưa vào In-Memory Buffer
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.buffer.shift(); // Drop oldest event if buffer is full
    }
    this.buffer.push(enrichedEvent);

    // 2. Cập nhật state thời gian thực
    this.lastSeen.set(enrichedEvent.partner, timestamp);

    const partnerEvents = this.recentEvents.get(enrichedEvent.partner) || [];
    partnerEvents.push(enrichedEvent);
    this.recentEvents.set(enrichedEvent.partner, partnerEvents);

    if (enrichedEvent.success) {
      this.consecutiveFailures.set(enrichedEvent.partner, 0);
    } else {
      const currentFailures = (this.consecutiveFailures.get(enrichedEvent.partner) || 0) + 1;
      this.consecutiveFailures.set(enrichedEvent.partner, currentFailures);
      if (enrichedEvent.errorMessage) {
        this.lastErrors.set(enrichedEvent.partner, enrichedEvent.errorMessage);
      }
    }

    // 3. Kiểm tra ngưỡng bất thường bất đồng bộ (Fire-and-Forget, không chặn)
    setImmediate(() => {
      this.evaluateThresholds(enrichedEvent.partner, enrichedEvent).catch((err) => {
        this.logger.error(`Lỗi khi đánh giá ngưỡng cảnh báo ${enrichedEvent.partner}: ${err.message}`);
      });
    });

    // Nếu buffer đạt 50 items thì chủ động flush sớm
    if (this.buffer.length >= 50) {
      this.flushBufferToDatabase();
    }
  }

  /**
   * Trút buffer xuống MongoDB
   */
  private async flushBufferToDatabase(): Promise<void> {
    if (this.buffer.length === 0) return;

    const toFlush = this.buffer.splice(0, this.buffer.length);
    try {
      await this.telemetryModel.insertMany(toFlush, { ordered: false });
    } catch (err: any) {
      this.logger.warn(`Lỗi ghi batch telemetry vào MongoDB: ${err.message}`);
    }
  }

  /**
   * Dọn dẹp rolling window RAM (chỉ giữ lại dữ liệu 60 phút gần nhất trong bộ nhớ)
   */
  private pruneOldRollingEvents(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [partner, events] of this.recentEvents.entries()) {
      const filtered = events.filter((e) => (e.timestamp?.getTime() || 0) >= oneHourAgo);
      this.recentEvents.set(partner, filtered);
    }
  }

  /**
   * Đọc cấu hình động từ CSDL
   */
  async getConfig(): Promise<IPartnerMonitorConfig> {
    if (!this.settingsService) return DEFAULT_CONFIG;

    try {
      const configStr = await this.settingsService.getSetting(CONFIG_KEY, '');
      if (!configStr) return DEFAULT_CONFIG;
      const parsed = JSON.parse(configStr);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        thresholds: {
          ...DEFAULT_CONFIG.thresholds,
          ...(parsed.thresholds || {}),
        },
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Cập nhật cấu hình động vào CSDL
   */
  async updateConfig(newConfig: Partial<IPartnerMonitorConfig>): Promise<IPartnerMonitorConfig> {
    const current = await this.getConfig();
    const updated: IPartnerMonitorConfig = {
      ...current,
      ...newConfig,
      thresholds: {
        ...current.thresholds,
        ...(newConfig.thresholds || {}),
      },
    };

    if (this.settingsService) {
      await this.settingsService.setSetting(
        CONFIG_KEY,
        JSON.stringify(updated),
      );
    }
    return updated;
  }

  /**
   * Đánh giá ngưỡng vi phạm và gửi cảnh báo kèm cơ chế dập bão email
   */
  private async evaluateThresholds(
    partner: PartnerSubsystem,
    lastEvent: IPartnerTelemetryEvent,
  ): Promise<void> {
    const config = await this.getConfig();
    if (!config.enabled) return;

    const threshold = config.thresholds[partner] || DEFAULT_CONFIG.thresholds[partner];
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    const partnerEvents = this.recentEvents.get(partner) || [];
    const eventsLastMinute = partnerEvents.filter(
      (e) => (e.timestamp?.getTime() || 0) >= oneMinuteAgo,
    );

    const rpm = eventsLastMinute.length;
    const loginsLastMinute = eventsLastMinute.filter(
      (e) => e.eventType === 'LOGIN' || e.eventType === 'REFRESH_TOKEN',
    ).length;
    const consecutiveFails = this.consecutiveFailures.get(partner) || 0;

    // 1. Kiểm tra Lỗi liên tiếp
    if (consecutiveFails >= threshold.consecutiveFailures) {
      await this.dispatchAlert({
        partner,
        violationType: 'CONSECUTIVE_FAILURES',
        details: `Phân hệ ${partner} gặp ${consecutiveFails} lỗi liên tiếp. Lỗi gần nhất: ${lastEvent.errorMessage || 'Không rõ'}`,
        consecutiveFailures: consecutiveFails,
        cooldownMinutes: config.cooldownMinutes,
        recipients: config.recipients,
      });
    }

    // 2. Kiểm tra Bão Login / Request RPM quá cao
    if (loginsLastMinute > threshold.maxLoginsPerMinute) {
      await this.dispatchAlert({
        partner,
        violationType: 'RATE_LIMIT_EXCEEDED',
        details: `Phát hiện Login Storm trên ${partner}: ${loginsLastMinute} lượt login trong 60s (vượt ngưỡng ${threshold.maxLoginsPerMinute})`,
        rpm,
        cooldownMinutes: config.cooldownMinutes,
        recipients: config.recipients,
      });
    } else if (rpm > threshold.maxRpm) {
      await this.dispatchAlert({
        partner,
        violationType: 'RATE_LIMIT_EXCEEDED',
        details: `Tần suất gọi API của ${partner} tăng đột biến: ${rpm} requests/phút (vượt ngưỡng ${threshold.maxRpm})`,
        rpm,
        cooldownMinutes: config.cooldownMinutes,
        recipients: config.recipients,
      });
    }

    // 3. Kiểm tra Circuit Breaker Tripped
    if (lastEvent.eventType === 'CIRCUIT_BREAKER') {
      await this.dispatchAlert({
        partner,
        violationType: 'CIRCUIT_BREAKER',
        details: `Ngắt mạch khẩn cấp (Circuit Breaker) được kích hoạt cho ${partner}: ${lastEvent.errorMessage || 'Bị chặn bởi Safety Gate'}`,
        cooldownMinutes: config.cooldownMinutes,
        recipients: config.recipients,
      });
    }
  }

  /**
   * Điều phối gửi Email kèm cơ chế Cooldown dập bão
   */
  private async dispatchAlert(params: {
    partner: PartnerSubsystem;
    violationType: 'CONSECUTIVE_FAILURES' | 'RATE_LIMIT_EXCEEDED' | 'CIRCUIT_BREAKER';
    details: string;
    consecutiveFailures?: number;
    rpm?: number;
    cooldownMinutes: number;
    recipients: string[];
  }): Promise<void> {
    const alertKey = params.partner;
    const now = Date.now();
    const cooldownMs = (params.cooldownMinutes || 15) * 60 * 1000;

    const alertState = this.alertStates.get(alertKey) || {
      lastAlertSentAt: 0,
      suppressedCount: 0,
    };

    if (now - alertState.lastAlertSentAt < cooldownMs) {
      // Đang trong thời gian Cooldown: Tăng biến dập tắt và bỏ qua gửi mail
      alertState.suppressedCount += 1;
      this.alertStates.set(alertKey, alertState);
      this.logger.debug(
        `[Email Storm Suppressed] ${alertKey} đang trong Cooldown. Bỏ qua lần thông báo thứ ${alertState.suppressedCount}.`,
      );
      return;
    }

    // Đã hết Cooldown: Gửi email cảnh báo và ghi nhận số lần đã dập tắt trước đó
    const suppressedBefore = alertState.suppressedCount;
    alertState.lastAlertSentAt = now;
    alertState.suppressedCount = 0;
    this.alertStates.set(alertKey, alertState);

    if (this.emailAlertService) {
      await this.emailAlertService.sendPartnerAuthAlert({
        partner: params.partner,
        violationType: params.violationType,
        details: params.details,
        consecutiveFailures: params.consecutiveFailures,
        rpm: params.rpm,
        suppressedCount: suppressedBefore,
        cooldownMinutes: params.cooldownMinutes,
        customRecipients: params.recipients,
      });
    }
  }

  /**
   * Tính toán Health Summary cho 5 phân hệ đối tác
   */
  async getHealthSummaries(): Promise<IPartnerHealthSummary[]> {
    const partners: PartnerSubsystem[] = ['CORECCP', 'COREEX', 'MS', 'CQG', 'ACM'];
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    const summaries: IPartnerHealthSummary[] = [];

    for (const partner of partners) {
      const partnerEvents = this.recentEvents.get(partner) || [];
      const eventsLastMinute = partnerEvents.filter(
        (e) => (e.timestamp?.getTime() || 0) >= oneMinuteAgo,
      );
      const eventsLastHour = partnerEvents.filter(
        (e) => (e.timestamp?.getTime() || 0) >= oneHourAgo,
      );

      const rpm = eventsLastMinute.length;
      const loginsLastMinute = eventsLastMinute.filter(
        (e) => e.eventType === 'LOGIN' || e.eventType === 'REFRESH_TOKEN',
      ).length;

      const consecutiveFails = this.consecutiveFailures.get(partner) || 0;
      const totalLastHour = eventsLastHour.length;
      const successfulLastHour = eventsLastHour.filter((e) => e.success).length;
      const successRate = totalLastHour > 0
        ? Math.round((successfulLastHour / totalLastHour) * 100)
        : 100;

      let health: HealthStatus = 'HEALTHY';
      if (consecutiveFails >= 3 || (totalLastHour >= 3 && successRate < 50)) {
        health = 'CRITICAL';
      } else if (consecutiveFails > 0 || (totalLastHour >= 3 && successRate < 90) || rpm > 30) {
        health = 'WARNING';
      }

      summaries.push({
        partner,
        health,
        activeToken: consecutiveFails === 0 && (partnerEvents.length > 0 ? partnerEvents[partnerEvents.length - 1].success : true),
        rpm,
        loginsLastMinute,
        consecutiveFailures: consecutiveFails,
        successRate,
        totalRequestsLastHour: totalLastHour,
        lastSeenAt: this.lastSeen.get(partner) || null,
        lastError: this.lastErrors.get(partner),
      });
    }

    return summaries;
  }

  /**
   * Lấy danh sách sự kiện gần nhất (phục vụ Audit Log Table)
   */
  async getRecentEvents(
    partner?: PartnerSubsystem,
    limit: number = 50,
  ): Promise<PartnerAuthTelemetry[]> {
    const query: any = {};
    if (partner) {
      query.partner = partner;
    }

    try {
      const docs = await this.telemetryModel
        .find(query)
        .sort({ timestamp: -1 })
        .limit(Math.min(limit, 200))
        .lean()
        .exec();

      if (docs && docs.length > 0) {
        return docs as PartnerAuthTelemetry[];
      }
    } catch (err: any) {
      this.logger.warn(`Lỗi truy vấn MongoDB Telemetry: ${err.message}`);
    }

    // Fallback sang RAM events nếu MongoDB chưa có hoặc đang khởi động
    let ramEvents = Array.from(this.recentEvents.values()).flat();
    if (partner) {
      ramEvents = ramEvents.filter((e) => e.partner === partner);
    }
    ramEvents.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));

    return ramEvents.slice(0, limit) as unknown as PartnerAuthTelemetry[];
  }
}
