// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationChannel } from '../../schemas/notification-channel.schema';
import { NotificationLog } from '../../schemas/notification-log.schema';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import * as https from 'https';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

export interface ExpiringContract {
  contractCode: string;
  contractName: string;
  targetDate: string;
  deadline: string;
  side: 'BUY' | 'SELL';
}

export interface GroupedMatch {
  account: string;
  contractCode: string;
  contractName: string;
  openSide: 'BUY' | 'SELL' | 'NONE';
  openVolume: number;
  pendingSide: 'BUY' | 'SELL' | 'BOTH' | 'NONE';
  pendingVolume: number;
  deadline: string;
}

@Injectable()
export class TeamsNotifierService {
  private readonly logger = new Logger(TeamsNotifierService.name);

  constructor(
    @InjectModel(NotificationChannel.name)
    private readonly channelModel: Model<NotificationChannel>,
    @InjectModel(NotificationLog.name)
    private readonly logModel: Model<NotificationLog>,
    private readonly settingsService: SystemSettingsService,
  ) {}

  /**
   * Helper to search header column index in sheet array row
   */
  private findHeaderIndex(
    headerRow: string[],
    mainName: string,
    fallbacks: string[] = [],
  ): number {
    const cleanHeaderRow = headerRow.map((h) =>
      String(h || '')
        .trim()
        .toLowerCase(),
    );
    const lowerMain = mainName.toLowerCase();

    let idx = cleanHeaderRow.indexOf(lowerMain);
    if (idx !== -1) return idx;

    for (const f of fallbacks) {
      idx = cleanHeaderRow.indexOf(f.toLowerCase());
      if (idx !== -1) return idx;
    }

    // Try partial match if exact match not found
    for (let i = 0; i < cleanHeaderRow.length; i++) {
      if (cleanHeaderRow[i].includes(lowerMain)) return i;
      for (const f of fallbacks) {
        if (cleanHeaderRow[i].includes(f.toLowerCase())) return i;
      }
    }

    return -1;
  }

  /**
   * Parse TTTT.xlsx workbook buffer for open positions
   */
  private parseTTTT(
    buffer: Buffer,
  ): { account: string; symbol: string; position: number }[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) return [];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (rows.length < 2) return [];

      const header = rows[0].map((h) => String(h || '').trim());
      const accountIdx = this.findHeaderIndex(header, 'Mã TKGD', [
        'Mã tài khoản',
        'Account',
        'Mã khách hàng',
        'Mã KH',
      ]);
      const symbolIdx = this.findHeaderIndex(header, 'Mã HĐ', [
        'Mã hợp đồng',
        'Symbol',
        'Mã HH',
        'Mã hàng hóa',
      ]);
      const positionIdx = this.findHeaderIndex(header, 'KL ròng', [
        'Khối lượng ròng',
        'Net Position',
        'Position',
        'Vị thế ròng',
        'Trạng thái ròng',
      ]);

      const finalAccIdx = accountIdx !== -1 ? accountIdx : 7;
      const finalSymIdx = symbolIdx !== -1 ? symbolIdx : 9;
      const finalPosIdx = positionIdx !== -1 ? positionIdx : 19;

      const result = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const account = String(row[finalAccIdx] || '').trim();
        const symbol = String(row[finalSymIdx] || '').trim();
        const position = parseFloat(row[finalPosIdx]) || 0;
        if (!account || !symbol) continue;
        result.push({ account, symbol, position });
      }
      return result;
    } catch (err: any) {
      this.logger.error(`Error parsing TTTT sheet: ${err.message}`);
      return [];
    }
  }

  /**
   * Parse QLTKGD.xlsx workbook buffer to find realized P&L awaiting maturity
   */
  private parseQLTKGD(buffer: Buffer): Map<string, number> {
    const dataMap = new Map<string, number>();
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) return dataMap;
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (rows.length < 2) return dataMap;

      const header = rows[0].map((h) => String(h || '').trim());
      const accountIdx = this.findHeaderIndex(header, 'Mã TKGD', [
        'Mã tài khoản',
        'Mã TK',
        'Tai khoan',
        'TKGD',
        'Investor Code',
        'InvestorCode',
        'Account Number',
        'Account',
      ]);
      const waitingMaturityIdx = this.findHeaderIndex(
        header,
        'Lãi lỗ thực tế chờ đáo hạn',
        [
          'Chờ đáo hạn',
          'Cho dao han',
          'Lai lo cho dao han',
          'Lãi lỗ chờ đáo hạn',
        ],
      );

      if (accountIdx === -1 || waitingMaturityIdx === -1) {
        this.logger.warn(
          `Could not find correct columns in QLTKGD.xlsx. accountIdx: ${accountIdx}, waitingMaturityIdx: ${waitingMaturityIdx}`,
        );
        return dataMap;
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const account = String(row[accountIdx] || '').trim();
        const val = parseFloat(row[waitingMaturityIdx]) || 0;
        if (account) {
          dataMap.set(account, val);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error parsing QLTKGD: ${err.message}`);
    }
    return dataMap;
  }

  /**
   * Send Adaptive Card via HTTPS POST
   */
  async sendTeamsNotification(
    webhookUrl: string,
    payload: Record<string, any>,
    recipient: string,
    metadata?: Record<string, any>,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const data = JSON.stringify(payload);
      const url = new URL(webhookUrl);

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      };

      return new Promise((resolve) => {
        const req = https.request(options, (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });

          res.on('end', async () => {
            const statusCode = res.statusCode || 0;
            const success = statusCode >= 200 && statusCode < 300;
            if (success) {
              this.logger.log(
                `Successfully sent Teams notification to ${recipient}`,
              );
              await this.logNotification(recipient, 'SENT', payload, metadata);
              resolve({ success: true, messageId: responseData });
            } else {
              const errMsg = `Teams webhook returned status ${statusCode}: ${responseData}`;
              this.logger.error(errMsg);
              await this.logNotification(
                recipient,
                'FAILED',
                payload,
                metadata,
                errMsg,
              );
              resolve({ success: false, error: errMsg });
            }
          });
        });

        req.on('error', async (error) => {
          const errMsg = `HTTP connection error: ${error.message}`;
          this.logger.error(errMsg);
          await this.logNotification(
            recipient,
            'FAILED',
            payload,
            metadata,
            errMsg,
          );
          resolve({ success: false, error: errMsg });
        });

        req.write(data);
        req.end();
      });
    } catch (err: any) {
      const errMsg = `Exception in sendTeamsNotification: ${err.message}`;
      this.logger.error(errMsg);
      await this.logNotification(
        recipient,
        'FAILED',
        payload,
        metadata,
        errMsg,
      );
      return { success: false, error: errMsg };
    }
  }

  private async logNotification(
    recipient: string,
    status: 'SENT' | 'FAILED',
    payload: any,
    metadata?: any,
    errorMessage?: string,
  ) {
    try {
      const log = new this.logModel({
        eventType: metadata?.eventType || 'MATURITY_ALERT',
        channelType: 'TEAMS',
        recipient,
        status,
        payload,
        errorMessage: errorMessage || null,
        sentAt: status === 'SENT' ? new Date() : null,
      });
      await log.save();
    } catch (err: any) {
      this.logger.error(`Failed to write notification log: ${err.message}`);
    }
  }

  /**
   * Resolve Webhook URL dynamically
   */
  async getWebhookUrlForMember(memberCode: string): Promise<string | null> {
    const channel = await this.channelModel
      .findOne({
        code: `TEAMS_${memberCode}`,
        isActive: true,
      })
      .exec();

    if (channel && channel.config) {
      const url =
        typeof channel.config.get === 'function'
          ? channel.config.get('webhookUrl')
          : (channel.config as any).webhookUrl;
      if (url) return url;
    }

    const settingsStr = await this.settingsService.getSetting(
      'member_teams_webhooks',
      '{}',
    );
    try {
      const settings = JSON.parse(settingsStr);
      if (settings[memberCode]) {
        return settings[memberCode];
      }
    } catch (err: any) {
      this.logger.error(
        `Error parsing member_teams_webhooks setting: ${err.message}`,
      );
    }

    const defaultUrl = await this.settingsService.getSetting(
      'default_teams_webhook',
      '',
    );
    if (defaultUrl) {
      return defaultUrl;
    }

    return null;
  }

  /**
   * Build premium Adaptive Card payload
   */
  buildMaturityCard(
    memberCode: string,
    noticeDate: string,
    positions: {
      account: string;
      contractCode: string;
      contractName: string;
      side: 'BUY' | 'SELL';
      volume: number;
      deadline: string;
    }[],
  ): Record<string, any> {
    const facts: any[] = [];
    positions.forEach((pos, idx) => {
      if (idx > 0) {
        facts.push({
          title: '---',
          value: '----------------------------------------',
        });
      }
      facts.push(
        { title: 'Tài khoản', value: pos.account },
        {
          title: 'Hợp đồng',
          value: `${pos.contractCode} (${pos.contractName})`,
        },
        {
          title: 'Vị thế',
          value: `${pos.side === 'BUY' ? 'MUA' : 'BÁN'} (KL: ${pos.side === 'BUY' ? '+' : '-'}${pos.volume} lot)`,
        },
        { title: 'Hạn tất toán', value: pos.deadline },
      );
    });

    return {
      type: 'AdaptiveCard',
      body: [
        {
          type: 'TextBlock',
          size: 'large',
          weight: 'Bolder',
          text: `CẢNH BÁO ĐÁO HẠN HỢP ĐỒNG - THÀNH VIÊN ${memberCode}`,
          color: 'Attention',
        },
        {
          type: 'TextBlock',
          text:
            `Chào bộ phận QLGD và Thành viên **${memberCode}**,\n` +
            `Theo Thông báo thời hạn tất toán hợp đồng được MXV gửi tới TVKD ngày **${noticeDate}**, ` +
            `vui lòng kiểm tra và thực hiện tất toán vị thế mở, hủy lệnh chờ dẫn tới mở mới vị thế đến hạn để tránh vi phạm quy định.`,
          wrap: true,
        },
        {
          type: 'FactSet',
          facts: facts,
        },
        {
          type: 'TextBlock',
          text: '⚠️ **Lưu ý:** Tất cả các vị thế mở TVKD thực hiện đóng sau thời gian phải tất toán 30 phút sẽ vi phạm quy định về việc “Đóng vị thế mở khi đến ngày đáo hạn của Hợp đồng Kỳ hạn tiêu chuẩn hàng hoá”.',
          wrap: true,
          weight: 'Bolder',
          color: 'Warning',
        },
      ],
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.2',
    };
  }

  /**
   * Parse HTML email body to extract list of expiring contracts and details
   */
  parseMaturityEmail(htmlBody: string): ExpiringContract[] {
    const contracts: ExpiringContract[] = [];
    try {
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;

      trRegex.lastIndex = 0;
      tdRegex.lastIndex = 0;
      thRegex.lastIndex = 0;

      const parts = htmlBody.split(/<table[^>]*>/gi);
      for (let i = 1; i < parts.length; i++) {
        const precedingText = parts[i - 1].toLowerCase();
        const tableContent = parts[i].split(/<\/table>/gi)[0];

        let side: 'BUY' | 'SELL' = 'BUY';
        if (
          precedingText.includes('bán') ||
          precedingText.includes('ngày giao dịch cuối cùng')
        ) {
          side = 'SELL';
        }

        const rows: string[] = [];
        let match;
        while ((match = trRegex.exec(tableContent)) !== null) {
          rows.push(match[1]);
        }

        if (rows.length === 0) continue;
        const headerCols: string[] = [];
        let thMatch;
        const headerRow = rows[0];
        while ((thMatch = thRegex.exec(headerRow)) !== null) {
          headerCols.push(
            thMatch[1]
              .replace(/<[^>]*>/g, '')
              .trim()
              .toLowerCase(),
          );
        }
        if (headerCols.length === 0) {
          let tdMatch;
          while ((tdMatch = tdRegex.exec(headerRow)) !== null) {
            headerCols.push(
              tdMatch[1]
                .replace(/<[^>]*>/g, '')
                .trim()
                .toLowerCase(),
            );
          }
        }

        const contractCodeIdx = headerCols.findIndex(
          (h) =>
            h.includes('mã hợp đồng') ||
            h.includes('mã hđ') ||
            h.includes('contract'),
        );
        const contractNameIdx = headerCols.findIndex(
          (h) => h.includes('tên hợp đồng') || h.includes('name'),
        );
        const targetDateIdx = headerCols.findIndex(
          (h) =>
            h.includes('ngày thông báo') ||
            h.includes('ngày giao dịch') ||
            h.includes('date'),
        );
        const deadlineIdx = headerCols.findIndex(
          (h) =>
            h.includes('thời gian') ||
            h.includes('hạn tất toán') ||
            h.includes('deadline') ||
            h.includes('trước'),
        );

        for (let r = 1; r < rows.length; r++) {
          const cells: string[] = [];
          let tdMatch;
          tdRegex.lastIndex = 0;
          while ((tdMatch = tdRegex.exec(rows[r])) !== null) {
            cells.push(tdMatch[1].replace(/<[^>]*>/g, '').trim());
          }

          if (cells.length > 0) {
            const contractCode =
              cells[contractCodeIdx !== -1 ? contractCodeIdx : 1] || '';
            const contractName =
              cells[contractNameIdx !== -1 ? contractNameIdx : 2] || '';
            const targetDate =
              cells[targetDateIdx !== -1 ? targetDateIdx : 3] || '';
            const deadline = cells[deadlineIdx !== -1 ? deadlineIdx : 4] || '';

            if (contractCode && contractCode !== 'Mã Hợp đồng') {
              contracts.push({
                contractCode: contractCode.trim(),
                contractName: contractName.trim(),
                targetDate: targetDate.trim(),
                deadline: deadline.trim(),
                side,
              });
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Error parsing maturity email HTML: ${err.message}`);
    }
    return contracts;
  }

  /**
   * Orchestrate full contract maturity check and dispatch Teams notification messages
   */
  async checkMaturityAndNotifyFromFiles(
    qltkgdBuffer: Buffer,
    ttttBuffer: Buffer,
    expiringContracts: ExpiringContract[],
    triggerSource: string,
  ): Promise<{ success: boolean; message: string; notificationCount: number }> {
    this.logger.log(
      `Starting maturity checking routine triggered by: ${triggerSource}`,
    );

    if (expiringContracts.length === 0) {
      return {
        success: true,
        message: 'Danh sách hợp đồng đến hạn rỗng. Không có gì để kiểm tra.',
        notificationCount: 0,
      };
    }

    const ttttList = this.parseTTTT(ttttBuffer);
    const qltkgdMap = this.parseQLTKGD(qltkgdBuffer);

    this.logger.log(
      `Parsed TTTT rows: ${ttttList.length}, QLTKGD rows: ${qltkgdMap.size}`,
    );

    // Group expiring positions by member code (first 3 chars of account)
    const memberPositionsMap = new Map<
      string,
      {
        account: string;
        contractCode: string;
        contractName: string;
        side: 'BUY' | 'SELL';
        volume: number;
        deadline: string;
      }[]
    >();

    for (const pos of ttttList) {
      const memberCode = pos.account.substring(0, 3);

      // Determine if account is in expiring contracts
      const expiringMatch = expiringContracts.find((c) => {
        // Match contract code: e.g. TRUN26 or ZCEN26
        const symbolMatches = pos.symbol
          .toUpperCase()
          .includes(c.contractCode.toUpperCase());
        if (!symbolMatches) return false;

        // Match side
        if (c.side === 'BUY' && pos.position > 0) return true;
        if (c.side === 'SELL' && pos.position < 0) return true;
        return false;
      });

      if (expiringMatch) {
        // Also verify if the account has realizations waiting for maturity in QLTKGD
        const waitingValue = qltkgdMap.get(pos.account) || 0;

        // Even if waitingValue is 0, we still alert if they hold positions. But having non-zero makes it critical.
        const currentList = memberPositionsMap.get(memberCode) || [];
        currentList.push({
          account: pos.account,
          contractCode: expiringMatch.contractCode,
          contractName: expiringMatch.contractName,
          side: expiringMatch.side,
          volume: Math.abs(pos.position),
          deadline: expiringMatch.deadline,
        });
        memberPositionsMap.set(memberCode, currentList);
      }
    }

    if (memberPositionsMap.size === 0) {
      this.logger.log('No members hold positions in expiring contracts.');
      return {
        success: true,
        message:
          'Không phát hiện tài khoản nào có vị thế hợp đồng đến hạn cần tất toán.',
        notificationCount: 0,
      };
    }

    let sentCount = 0;
    let failedCount = 0;

    // Use current date as noticeDate
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const noticeDate = `${today.getUTCDate().toString().padStart(2, '0')}/${(today.getUTCMonth() + 1).toString().padStart(2, '0')}/${today.getUTCFullYear()}`;

    for (const [memberCode, positions] of memberPositionsMap.entries()) {
      const webhookUrl = await this.getWebhookUrlForMember(memberCode);
      if (!webhookUrl) {
        this.logger.warn(
          `No Teams Webhook configured for Member ${memberCode}. Skipping.`,
        );
        failedCount++;
        continue;
      }

      const card = this.buildMaturityCard(memberCode, noticeDate, positions);
      const res = await this.sendTeamsNotification(
        webhookUrl,
        card,
        memberCode,
        {
          eventType: 'MATURITY_ALERT',
          triggerSource,
          positionsCount: positions.length,
        },
      );

      if (res.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    }

    const message = `Hoàn thành kiểm tra đáo hạn. Gửi thành công: ${sentCount} kênh, Thất bại/Thiếu config: ${failedCount} kênh.`;
    this.logger.log(message);

    return {
      success: failedCount === 0,
      message,
      notificationCount: sentCount,
    };
  }

  /**
   * Check contract maturity using M-System reports (open_positions.xlsx and pending_orders.xlsx)
   */
  async checkMaturityAndNotifyFromMSystem(
    openPosBuffer: Buffer,
    pendingOrdersBuffer: Buffer,
    expiringContracts: ExpiringContract[],
    triggerSource: string,
  ): Promise<{ success: boolean; message: string; notificationCount: number }> {
    this.logger.log(
      `Starting M-System maturity checking routine triggered by: ${triggerSource}`,
    );

    // Get today's date in GMT+7
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const dd = String(today.getUTCDate()).padStart(2, '0');
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = today.getUTCFullYear();
    const todayStr = `${dd}/${mm}/${yyyy}`;

    this.logger.log(`Filtering contracts for today's deadline: ${todayStr}`);
    const todayContracts = expiringContracts.filter((c) =>
      c.deadline.includes(todayStr),
    );

    if (todayContracts.length === 0) {
      this.logger.log(`No contracts expiring on ${todayStr}.`);
      return {
        success: true,
        message: `Không có hợp đồng nào đến hạn tất toán trong ngày hôm nay (${todayStr}).`,
        notificationCount: 0,
      };
    }

    this.logger.log(
      `Found ${todayContracts.length} expiring contracts today: ${todayContracts.map((c) => `${c.contractCode} (${c.side})`).join(', ')}`,
    );

    // 1. Load and aggregate Open Positions
    const aggregatedPos = new Map<
      string,
      { account: string; symbol: string; buyVol: number; sellVol: number }
    >();
    try {
      const workbook = XLSX.read(openPosBuffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (sheet) {
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length >= 2) {
          const header = rows[0].map((h) => String(h || '').trim());
          const accountIdx = this.findHeaderIndex(header, 'Mã TKGD', [
            'Mã tài khoản',
            'Account',
            'Mã khách hàng',
          ]);
          const symbolIdx = this.findHeaderIndex(header, 'Mã HĐ', [
            'Mã hợp đồng',
            'Symbol',
            'Mã hàng hóa',
          ]);
          const klMuaIdx = this.findHeaderIndex(header, 'KL Mua', [
            'KLMua',
            'Volume Buy',
            'Khối lượng mua',
          ]);
          const klBanIdx = this.findHeaderIndex(header, 'KL Bán', [
            'KLBán',
            'Volume Sell',
            'Khối lượng bán',
          ]);

          const finalAccIdx = accountIdx !== -1 ? accountIdx : 7;
          const finalSymIdx = symbolIdx !== -1 ? symbolIdx : 9;
          const finalMuaIdx = klMuaIdx !== -1 ? klMuaIdx : 11;
          const finalBanIdx = klBanIdx !== -1 ? klBanIdx : 12;

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            const account = String(row[finalAccIdx] || '').trim();
            const symbol = String(row[finalSymIdx] || '').trim();
            const klMua = parseFloat(row[finalMuaIdx]) || 0;
            const klBan = parseFloat(row[finalBanIdx]) || 0;
            if (!account || !symbol) continue;

            const key = `${account}_${symbol}`;
            const existing = aggregatedPos.get(key) || {
              account,
              symbol,
              buyVol: 0,
              sellVol: 0,
            };
            existing.buyVol += klMua;
            existing.sellVol += klBan;
            aggregatedPos.set(key, existing);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Error parsing open positions workbook: ${err.message}`,
      );
      return {
        success: false,
        message: `Lỗi đọc file trạng thái mở: ${err.message}`,
        notificationCount: 0,
      };
    }

    // 2. Load and aggregate Pending Orders
    const aggregatedOrders = new Map<
      string,
      {
        account: string;
        symbol: string;
        buyPending: number;
        sellPending: number;
      }
    >();
    try {
      const workbook = XLSX.read(pendingOrdersBuffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (sheet) {
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length >= 2) {
          const header = rows[0].map((h) => String(h || '').trim());
          const accountIdx = this.findHeaderIndex(header, 'Mã TKGD', [
            'Mã tài khoản',
            'Account',
          ]);
          const symbolIdx = this.findHeaderIndex(header, 'Mã HĐ', [
            'Mã hợp đồng',
            'Symbol',
          ]);
          const sideIdx = this.findHeaderIndex(header, 'Chiều mua bán', [
            'Chiều',
            'Side',
            'Mua/Bán',
          ]);
          const klDatIdx = this.findHeaderIndex(header, 'KL đặt lệnh', [
            'KL đặt',
            'Quantity',
            'Khối lượng',
          ]);
          const klKhopIdx = this.findHeaderIndex(header, 'KL khớp', [
            'KL khớp',
            'Filled',
            'Khớp',
          ]);
          const statusIdx = this.findHeaderIndex(header, 'Trạng thái', [
            'Trạng thái lệnh',
            'Status',
          ]);

          const finalAccIdx = accountIdx !== -1 ? accountIdx : 3;
          const finalSymIdx = symbolIdx !== -1 ? symbolIdx : 5;
          const finalSideIdx = sideIdx !== -1 ? sideIdx : 9;
          const finalDatIdx = klDatIdx !== -1 ? klDatIdx : 10;
          const finalKhopIdx = klKhopIdx !== -1 ? klKhopIdx : 11;
          const finalStatusIdx = statusIdx !== -1 ? statusIdx : 20;

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            const account = String(row[finalAccIdx] || '').trim();
            const symbol = String(row[finalSymIdx] || '').trim();
            const side = String(row[finalSideIdx] || '')
              .trim()
              .toUpperCase();
            const klDat = parseFloat(row[finalDatIdx]) || 0;
            const klKhop = parseFloat(row[finalKhopIdx]) || 0;
            const status = String(row[finalStatusIdx] || '').trim();

            if (!account || !symbol || status !== 'Đang chờ khớp') continue;

            const remaining = klDat - klKhop;
            if (remaining <= 0) continue;

            const key = `${account}_${symbol}`;
            const existing = aggregatedOrders.get(key) || {
              account,
              symbol,
              buyPending: 0,
              sellPending: 0,
            };
            if (side === 'BUY' || side === 'MUA') {
              existing.buyPending += remaining;
            } else if (side === 'SELL' || side === 'BÁN') {
              existing.sellPending += remaining;
            }
            aggregatedOrders.set(key, existing);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Error parsing pending orders workbook: ${err.message}`,
      );
      return {
        success: false,
        message: `Lỗi đọc file lệnh chờ khớp: ${err.message}`,
        notificationCount: 0,
      };
    }

    // 3. Match contracts with aggregated data
    const matchedResults: any[] = [];
    const matchedAccounts = new Set<string>();

    for (const c of todayContracts) {
      // Match positions
      for (const pos of aggregatedPos.values()) {
        if (pos.symbol.toUpperCase() === c.contractCode.toUpperCase()) {
          if (c.side === 'BUY' && pos.buyVol > 0) {
            matchedResults.push({
              account: pos.account,
              contractCode: c.contractCode,
              contractName: c.contractName,
              side: c.side,
              openVolume: pos.buyVol,
              pendingVolume: 0,
              pendingSide: '',
              deadline: c.deadline,
            });
            matchedAccounts.add(pos.account);
          } else if (c.side === 'SELL' && pos.sellVol > 0) {
            matchedResults.push({
              account: pos.account,
              contractCode: c.contractCode,
              contractName: c.contractName,
              side: c.side,
              openVolume: pos.sellVol,
              pendingVolume: 0,
              pendingSide: '',
              deadline: c.deadline,
            });
            matchedAccounts.add(pos.account);
          }
        }
      }

      // Match pending orders
      for (const ord of aggregatedOrders.values()) {
        if (ord.symbol.toUpperCase() === c.contractCode.toUpperCase()) {
          let pendingVol = 0;
          let pendingSide = '';

          if (c.side === 'BUY' && ord.buyPending > 0) {
            pendingVol = ord.buyPending;
            pendingSide = 'BUY';
          } else if (c.side === 'SELL' && ord.sellPending > 0) {
            pendingVol = ord.sellPending;
            pendingSide = 'SELL';
          }

          if (pendingVol > 0) {
            const existing = matchedResults.find(
              (r) =>
                r.account === ord.account &&
                r.contractCode === c.contractCode &&
                r.side === c.side,
            );
            if (existing) {
              existing.pendingVolume = pendingVol;
              existing.pendingSide = pendingSide;
            } else {
              matchedResults.push({
                account: ord.account,
                contractCode: c.contractCode,
                contractName: c.contractName,
                side: c.side,
                openVolume: 0,
                pendingVolume: pendingVol,
                pendingSide: pendingSide,
                deadline: c.deadline,
              });
              matchedAccounts.add(ord.account);
            }
          }
        }
      }
    }

    // 4. Group by (account, contractCode)
    const groupedMap = new Map<string, GroupedMatch>();
    for (const r of matchedResults) {
      const key = `${r.account}_${r.contractCode}`;
      const existing = groupedMap.get(key);
      if (existing) {
        if (r.openVolume > 0) {
          existing.openVolume = r.openVolume;
          existing.openSide = r.side;
        }
        if (r.pendingVolume > 0) {
          if (existing.pendingVolume > 0) {
            existing.pendingVolume += r.pendingVolume;
            existing.pendingSide = 'BOTH';
          } else {
            existing.pendingVolume = r.pendingVolume;
            existing.pendingSide = r.pendingSide;
          }
        }
      } else {
        groupedMap.set(key, {
          account: r.account,
          contractCode: r.contractCode,
          contractName: r.contractName,
          openSide: r.openVolume > 0 ? r.side : 'NONE',
          openVolume: r.openVolume,
          pendingSide: r.pendingVolume > 0 ? r.pendingSide : 'NONE',
          pendingVolume: r.pendingVolume,
          deadline: r.deadline,
        });
      }
    }

    if (groupedMap.size === 0) {
      this.logger.log(
        'No members hold positions or pending orders in expiring contracts today.',
      );
      return {
        success: true,
        message: `Không phát hiện tài khoản nào có vị thế/lệnh chờ hợp đồng đến hạn ngày hôm nay (${todayStr}).`,
        notificationCount: 0,
      };
    }

    // Group grouped results by Member Code (first 3 chars of account)
    const memberGroup = new Map<string, GroupedMatch[]>();
    for (const g of groupedMap.values()) {
      const memberCode = g.account.substring(0, 3);
      const list = memberGroup.get(memberCode) || [];
      list.push(g);
      memberGroup.set(memberCode, list);
    }

    // Send notifications to each member
    let sentCount = 0;
    let failedCount = 0;
    const noticeDate = `${dd}/${mm}/${yyyy}`;

    for (const [memberCode, items] of memberGroup.entries()) {
      const webhookUrl = await this.getWebhookUrlForMember(memberCode);
      if (!webhookUrl) {
        this.logger.warn(
          `No Teams Webhook configured for Member ${memberCode}. Skipping.`,
        );
        failedCount++;
        continue;
      }

      // Build facts list for card
      const facts: any[] = [];
      items.forEach((item, idx) => {
        if (idx > 0) {
          facts.push({
            title: '---',
            value: '----------------------------------------',
          });
        }
        const posDesc =
          item.openVolume > 0
            ? `${item.openSide === 'BUY' ? 'MUA' : 'BÁN'} (KL: ${item.openVolume} lot)`
            : 'Không';

        let pendingDesc = 'Không';
        if (item.pendingVolume > 0) {
          if (item.pendingSide === 'BOTH') {
            pendingDesc = `MUA/BÁN (KL: ${item.pendingVolume} lot)`;
          } else {
            pendingDesc = `${item.pendingSide === 'BUY' ? 'MUA' : 'BÁN'} (KL: ${item.pendingVolume} lot)`;
          }
        }

        facts.push(
          { title: 'Tài khoản', value: item.account },
          {
            title: 'Hợp đồng',
            value: `${item.contractCode} (${item.contractName})`,
          },
          { title: 'Vị thế mở', value: posDesc },
          { title: 'Lệnh chờ', value: pendingDesc },
          { title: 'Hạn tất toán', value: item.deadline },
        );
      });

      const card = {
        type: 'AdaptiveCard',
        body: [
          {
            type: 'TextBlock',
            size: 'large',
            weight: 'Bolder',
            text: `CẢNH BÁO ĐÁO HẠN HỢP ĐỒNG - THÀNH VIÊN ${memberCode}`,
            color: 'Attention',
          },
          {
            type: 'TextBlock',
            text:
              `Chào bộ phận QLGD và Thành viên **${memberCode}**,\n` +
              `Theo Thông báo thời hạn tất toán hợp đồng được MXV gửi tới TVKD ngày **06/07/2026**, ` +
              `vui lòng kiểm tra và thực hiện tất toán vị thế mở, hủy lệnh chờ dẫn tới mở mới vị thế đến hạn để tránh vi phạm quy định.`,
            wrap: true,
          },
          {
            type: 'FactSet',
            facts: facts,
          },
          {
            type: 'TextBlock',
            text: '⚠️ **Lưu ý:** Tất cả các vị thế mở TVKD thực hiện đóng sau thời gian phải tất toán 30 phút sẽ vi phạm quy định về việc “Đóng vị thế mở khi đến ngày đáo hạn của Hợp đồng Kỳ hạn tiêu chuẩn hàng hoá”.',
            wrap: true,
            weight: 'Bolder',
            color: 'Warning',
          },
        ],
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.2',
      };

      const res = await this.sendTeamsNotification(
        webhookUrl,
        card,
        memberCode,
        {
          eventType: 'MATURITY_ALERT',
          triggerSource,
          positionsCount: items.length,
        },
      );

      if (res.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    }

    // Generate the manual text messages for copy-pasting
    const manualMessagesPath = path.join(
      process.cwd(),
      'temp',
      'downloads',
      'teams_manual_messages.txt',
    );
    const manualJsonPath = path.join(
      process.cwd(),
      'temp',
      'downloads',
      'teams_manual_messages.json',
    );
    let manualText = `====================================================\n`;
    manualText += `DANH SÁCH TEMPLATE TIN NHẮN THỦ CÔNG GỬI THÀNH VIÊN (QLGD)\n`;
    manualText += `Target Date: ${todayStr}\n`;
    manualText += `Generated At: ${new Date().toLocaleString()}\n`;
    manualText += `====================================================\n\n`;

    const manualJson: any[] = [];

    for (const [memberCode, items] of memberGroup.entries()) {
      manualText += `====================================================\n`;
      manualText += `THÀNH VIÊN: ${memberCode}\n`;
      manualText += `====================================================\n\n`;

      items.forEach((item) => {
        let targetDetail = '';
        if (item.openVolume > 0 && item.pendingVolume > 0) {
          const oSide = item.openSide === 'BUY' ? 'MUA' : 'BÁN';
          const pSide =
            item.pendingSide === 'BOTH'
              ? 'MUA/BÁN'
              : item.pendingSide === 'BUY'
                ? 'MUA'
                : 'BÁN';
          targetDetail = `vị thế mở ${oSide} (KL: ${item.openVolume} lot) và lệnh chờ ${pSide} (KL: ${item.pendingVolume} lot)`;
        } else if (item.openVolume > 0) {
          const oSide = item.openSide === 'BUY' ? 'MUA' : 'BÁN';
          targetDetail = `vị thế mở ${oSide} (KL: ${item.openVolume} lot)`;
        } else if (item.pendingVolume > 0) {
          const pSide =
            item.pendingSide === 'BOTH'
              ? 'MUA/BÁN'
              : item.pendingSide === 'BUY'
                ? 'MUA'
                : 'BÁN';
          targetDetail = `lệnh chờ ${pSide} (KL: ${item.pendingVolume} lot)`;
        }

        const msg =
          `Theo Thông báo thời hạn tất toán hợp đồng được MXV gửi tới TVKD ngày 06/07/2026, thời hạn tất toán ${targetDetail} hợp đồng ${item.contractCode} là ${item.deadline}.\n` +
          `TVKD lưu ý kiểm tra lại thông báo, thực hiện tất toán vị thế mở, huỷ lệnh chờ dẫn tới mở mới vị thế đến hạn, tránh vi phạm quy định của MXV về việc Đóng vị thế mở khi đến ngày đáo hạn của hợp đồng.`;

        manualText += `Tài khoản: ${item.account}\n`;
        manualText += `${msg}\n`;
        manualText += `----------------------------------------------------\n\n`;

        manualJson.push({
          memberCode,
          account: item.account,
          contractCode: item.contractCode,
          contractName: item.contractName,
          openSide: item.openSide,
          openVolume: item.openVolume,
          pendingSide: item.pendingSide,
          pendingVolume: item.pendingVolume,
          deadline: item.deadline,
          messageText: msg,
        });
      });
    }

    try {
      const dir = path.dirname(manualMessagesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(manualMessagesPath, manualText, 'utf8');
      fs.writeFileSync(
        manualJsonPath,
        JSON.stringify(manualJson, null, 2),
        'utf8',
      );

      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dailyManualMessagesPath = path.join(
        process.cwd(),
        'temp',
        'reconciliation',
        dateStr,
        'teams_manual_messages.txt',
      );
      const dailyManualJsonPath = path.join(
        process.cwd(),
        'temp',
        'reconciliation',
        dateStr,
        'teams_manual_messages.json',
      );
      const dailyDir = path.dirname(dailyManualMessagesPath);
      if (!fs.existsSync(dailyDir)) {
        fs.mkdirSync(dailyDir, { recursive: true });
      }
      fs.writeFileSync(dailyManualMessagesPath, manualText, 'utf8');
      fs.writeFileSync(
        dailyManualJsonPath,
        JSON.stringify(manualJson, null, 2),
        'utf8',
      );
    } catch (e: any) {
      this.logger.error(
        `Could not write manual message templates: ${e.message}`,
      );
    }

    const message = `Hoàn thành kiểm tra đáo hạn M-System. Gửi thành công: ${sentCount} kênh, Thất bại/Thiếu config: ${failedCount} kênh.`;
    this.logger.log(message);

    return {
      success: failedCount === 0,
      message,
      notificationCount: sentCount,
    };
  }
}
