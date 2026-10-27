/**
 * agent-heartbeat.service.ts
 *
 * Dịch vụ chuyên trách giám sát Heartbeat và trạng thái kết nối của máy trạm RPA Agent (Windows Agent).
 * Bóc tách khỏi BotJobQueueService để tuân thủ Single Responsibility Principle (SRP).
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { AgentController } from '../controllers/ingress-agent.controller';
import { BotAlertEmailService } from '../../notifications/bot-alert-email.service';

@Injectable()
export class AgentHeartbeatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentHeartbeatService.name);
  private healthInterval?: NodeJS.Timeout;
  private readonly wasAgentOnlineMap = new Map<string, boolean>();

  constructor(
    @Optional()
    private readonly botAlertEmailService?: BotAlertEmailService,
  ) {}

  onModuleInit() {
    // Kiểm tra kết nối của RPA Agent mỗi 60 giây
    this.healthInterval = setInterval(() => {
      this.checkAgentConnectionHealth().catch((err) => {
        this.logger.error(`Lỗi khi kiểm tra kết nối Agent: ${err.message}`);
      });
    }, 60000);

    this.logger.log('AgentHeartbeatService initialized (polling Agent connection every 60s).');
  }

  onModuleDestroy() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }
  }

  /**
   * Quét danh sách agentStatuses để phát hiện sự kiện Online / Offline
   */
  async checkAgentConnectionHealth(): Promise<void> {
    const statuses = AgentController.agentStatuses;
    if (!statuses || statuses.size === 0) return;

    for (const [hostname, status] of statuses.entries()) {
      const diffMs = Date.now() - status.lastSeen.getTime();
      const isOnline = diffMs < 180000; // 3 phút timeout
      const wasOnline = this.wasAgentOnlineMap.get(hostname) || false;

      if (!isOnline && wasOnline) {
        this.wasAgentOnlineMap.set(hostname, false);
        this.logger.warn(`Agent ${hostname} offline alert. Sending notification...`);
        if (this.botAlertEmailService) {
          await this.botAlertEmailService.sendConnectionAlertEmail(status, false);
        }
        statuses.delete(hostname);
      } else if (isOnline && !wasOnline) {
        this.wasAgentOnlineMap.set(hostname, true);
        this.logger.log(`Agent ${hostname} online info. Sending notification...`);
        if (this.botAlertEmailService) {
          await this.botAlertEmailService.sendConnectionAlertEmail(status, true);
        }
      }
    }
  }
}
