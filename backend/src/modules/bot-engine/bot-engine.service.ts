import { Injectable, Logger } from '@nestjs/common';
import { ExpiringContract } from '../notifications/teams-notifier.service';

/**
 * BotEngineService - Tinh gọn theo chuẩn Modular Monolith V2
 *
 * Nhiệm vụ chính: Bóc tách email thông báo tất toán đáo hạn hợp đồng (ops_during_05).
 * Lưu ý: Toàn bộ vòng lặp quét ca trực @Cron('* * * * *') cũ đã được bàn giao chính thức cho
 * ShiftScannerService (backend/src/modules/checklist-hub/scheduler/shift-scanner.service.ts).
 */
@Injectable()
export class BotEngineService {
  private readonly logger = new Logger(BotEngineService.name);

  constructor() {}

  /**
   * Phương thức tương thích ngược cho các test scripts.
   * Runner chính thức trong production là ShiftScannerService (checklist-hub).
   */
  async handleBotChecks() {
    this.logger.debug(
      '[BotEngineService] handleBotChecks() đã được chuyển giao cho ShiftScannerService (checklist-hub). Bỏ qua thực thi legacy.',
    );
    return;
  }

  /**
   * Parse HTML email body to extract list of expiring contracts and details
   */
  public parseMaturityEmail(htmlBody: string): ExpiringContract[] {
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
   * Parse plain text email body to extract list of expiring contracts and details
   */
  public parseEmailText(content: string): ExpiringContract[] {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const contracts: ExpiringContract[] = [];
    let currentSide: 'BUY' | 'SELL' = 'BUY';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (
        line.includes('Đối với Vị thế mở mua') ||
        line.includes('Ngày thông báo đầu tiên')
      ) {
        currentSide = 'BUY';
        continue;
      }
      if (
        line.includes('Đối với Vị thế mở bán') ||
        line.includes('Ngày giao dịch cuối cùng')
      ) {
        currentSide = 'SELL';
        continue;
      }

      // A contract row starts with STT (digit) followed by contract code
      if (/^\d+$/.test(line) && i + 4 < lines.length) {
        const contractCode = lines[i + 1];
        const contractName = lines[i + 2];
        const targetDate = lines[i + 3];
        const deadline = lines[i + 4];

        if (/^[A-Z0-9]{4,10}$/.test(contractCode) && targetDate.includes('/')) {
          contracts.push({
            contractCode,
            contractName,
            targetDate,
            deadline,
            side: currentSide,
          });
          i += 4;
        }
      }
    }

    return contracts;
  }
}
