import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { TelegramService } from '../../telegram/telegram.service';
import { MarginCheckerService } from '../../margin-checker/margin-checker.service';
import { resolveStoragePathCrossPlatform } from '../../bot-engine/helpers/bot-path.helper';
import {
  findHeaderIndex,
  findLatestFile,
  resolveCqgFile,
  getCcpBackupBasePath,
  resolveCcpDailyPath,
  parseDSGD,
  parseFR,
  parseTradeDateTime,
  parseCqgDateTime,
  parseStraitsCsv,
  parseTTTTForRecon,
  parsePSForRecon,
} from '../helpers/recon-number-parser.helper';
import { EODMismatchedItem } from './ccp-recon.service';

@Injectable()
export class PreEodReconService {
  private readonly logger = new Logger(PreEodReconService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly telegramService: TelegramService,
    private readonly marginCheckerService: MarginCheckerService,
  ) {}

  private buildPreEodEmailHtml(
    passed: boolean,
    totals: any,
    mismatchedTrades: any[],
    mismatchedPositions: any[],
  ): string {
    const statusColor = passed ? '#2e7d32' : '#c62828';
    const statusText = passed ? 'KHỚP HOÀN TOÀN' : 'CÓ CHÊNH LỆCH';

    let tradesRows = '';
    if (mismatchedTrades.length > 0) {
      tradesRows = mismatchedTrades
        .map(
          (t, idx) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${t.source}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${t.maLenh || '-'}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${t.maTKGD}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${t.maHD}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${t.giaKhop.toLocaleString()}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${t.klGiaoDich.toLocaleString()}</td>
          <td style="border: 1px solid #ddd; padding: 8px; color: #c62828;">${t.reason}</td>
        </tr>
      `,
        )
        .join('');
    } else {
      tradesRows = `<tr><td colspan="8" style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #2e7d32;">Không phát hiện chênh lệch khớp lệnh.</td></tr>`;
    }

    let positionsRows = '';
    if (mismatchedPositions.length > 0) {
      positionsRows = mismatchedPositions
        .map(
          (p, idx) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${p.account}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${p.symbol}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${p.msPosition.toLocaleString()}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${p.cqgPosition.toLocaleString()}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold; color: #c62828;">${p.differ.toLocaleString()}</td>
        </tr>
      `,
        )
        .join('');
    } else {
      positionsRows = `<tr><td colspan="6" style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #2e7d32;">Không phát hiện chênh lệch vị thế.</td></tr>`;
    }

    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f6f9; padding: 20px;">
          <div style="max-width: 800px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 8px solid ${statusColor};">
            <div style="padding: 20px;">
              <h2 style="color: ${statusColor}; margin-top: 0;">Báo Cáo Đối Chiếu Pre-EOD (Khớp Lệnh & Vị Thế)</h2>
              <p>Hệ thống vừa thực hiện kiểm tra đối chiếu cuối ngày (Pre-EOD) tự động.</p>
              
              <div style="background-color: ${passed ? '#e8f5e9' : '#ffebee'}; border-left: 4px solid ${statusColor}; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <span style="font-weight: bold; color: ${statusColor};">Kết quả: ${statusText}</span>
              </div>

              <h3>1. Tổng Hợp Khối Lượng Giao Dịch</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Hạng mục đối chiếu</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">M-System (Vô số)</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Đối tác (Straits/CQG)</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Chênh lệch</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">Khối lượng ACM (Straits)</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.totalACM_MS.toLocaleString()}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.totalACM_Straits.toLocaleString()}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold; color: ${totals.differACM > 0 ? '#c62828' : '#2e7d32'};">${totals.differACM.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">Khối lượng CQG (FR)</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.totalCQG_MS.toLocaleString()}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.totalCQG_FR.toLocaleString()}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold; color: ${totals.differCQG > 0 ? '#c62828' : '#2e7d32'};">${totals.differCQG.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              <h3>2. Chi Tiết Lệnh Lệch (Nếu Có)</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">STT</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Nguồn</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mã Lệnh</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mã TKGD</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mã HĐ</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Giá</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">KL</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Lý do</th>
                  </tr>
                </thead>
                <tbody>
                  ${tradesRows}
                </tbody>
              </table>

              <h3>3. Chi Tiết Lệch Vị Thế Net (Nếu Có)</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">STT</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mã TKGD</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mã HĐ</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Vị thế M-System</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Vị thế CQG</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Chênh lệch</th>
                  </tr>
                </thead>
                <tbody>
                  ${positionsRows}
                </tbody>
              </table>
            </div>
            <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ddd;">
              Đây là email tự động từ hệ thống MXV Shift Checklist.
            </div>
          </div>
        </body>
      </html>
    `;
  }

  async checkPreEOD(
    files: {
      dsgd: Buffer;
      acmTrades: Buffer;
      cqgFr: Buffer;
      tttt: Buffer;
      cqgPs: Buffer;
    },
    acmTradesName: string,
    tradingDate: Date,
    holidays: string[] = [],
    sessionStartStr: string = '05:00',
  ): Promise<{
    passed: boolean;
    totals: {
      totalACM_MS: number;
      totalACM_Straits: number;
      differACM: number;
      totalCQG_MS: number;
      totalCQG_FR: number;
      differCQG: number;
    };
    mismatchedTrades: Array<{
      source: 'MSystem' | 'CQG';
      maLenh?: string;
      maTKGD: string;
      maHD: string;
      giaKhop: number;
      klGiaoDich: number;
      ngayGio: string;
      reason: string;
    }>;
    mismatchedPositions: Array<{
      account: string;
      symbol: string;
      msPosition: number;
      cqgPosition: number;
      differ: number;
    }>;
    sessionStart?: Date;
    checkTime?: Date;
  }> {
    if (sessionStartStr) {
      await this.settingsService.setSetting(
        'session_start_time',
        sessionStartStr,
      );
    }
    const [sHour, sMin] = sessionStartStr.split(':').map(Number);

    const isPastDateOrDateOnly =
      (tradingDate.getHours() === 0 &&
        tradingDate.getMinutes() === 0 &&
        tradingDate.getSeconds() === 0) ||
      (tradingDate.getUTCHours() === 0 &&
        tradingDate.getUTCMinutes() === 0 &&
        tradingDate.getUTCSeconds() === 0);

    const sessionStart = new Date(tradingDate);
    let checkTime: Date;

    if (isPastDateOrDateOnly) {
      sessionStart.setHours(sHour, sMin, 0, 0);
      while (sessionStart.getDay() === 0 || sessionStart.getDay() === 6) {
        sessionStart.setDate(sessionStart.getDate() - 1);
      }
      checkTime = new Date(sessionStart);
      checkTime.setDate(checkTime.getDate() + 1);
    } else {
      checkTime = new Date(tradingDate);
      sessionStart.setHours(sHour, sMin, 0, 0);
      if (checkTime < sessionStart) {
        sessionStart.setDate(sessionStart.getDate() - 1);
      }
      while (sessionStart.getDay() === 0 || sessionStart.getDay() === 6) {
        sessionStart.setDate(sessionStart.getDate() - 1);
      }
    }

    const rawDsgdData = parseDSGD(files.dsgd);
    const dsgdUpperBound = checkTime;
    const dsgdData = rawDsgdData.filter((gd) => {
      if (!gd.ngayGio) return true;
      const tradeTime = parseTradeDateTime(gd.ngayGio, tradingDate);
      if (!tradeTime) return true;
      return tradeTime >= sessionStart && tradeTime <= dsgdUpperBound;
    });

    let totalACM_MS = 0;
    let totalCQG_MS = 0;
    dsgdData.forEach((gd) => {
      if (gd.maTKGD.toUpperCase().endsWith('A')) {
        totalACM_MS += gd.klGiaoDich;
      } else {
        totalCQG_MS += gd.klGiaoDich;
      }
    });

    let acmStraitsData: any = { totalVolume: 0 };
    try {
      acmStraitsData = parseStraitsCsv(files.acmTrades);
    } catch (acmErr: any) {
      this.logger.warn(
        `Lỗi parse file ACM Trades: ${acmErr.message}. Tiếp tục đối chiếu MS vs CQG.`,
      );
    }
    const totalACM_Straits = acmStraitsData.totalVolume || 0;
    const differACM = Math.abs(totalACM_MS - totalACM_Straits);

    const rawFrData = parseFR(files.cqgFr, tradingDate, holidays);
    const frData = rawFrData.filter((fr) => {
      if (!fr.time) return true;
      const tradeTime = parseCqgDateTime(fr.time, tradingDate);
      if (!tradeTime) return true;
      return tradeTime >= sessionStart && tradeTime <= checkTime;
    });

    let totalCQG_FR = 0;
    frData.forEach((fr) => {
      if (fr.symbol !== 'ZWAZCE') {
        totalCQG_FR += fr.qty;
      }
    });
    const differCQG = Math.abs(totalCQG_MS - totalCQG_FR);

    const mismatchedTrades: Array<{
      source: 'MSystem' | 'CQG';
      maLenh?: string;
      maTKGD: string;
      maHD: string;
      giaKhop: number;
      klGiaoDich: number;
      ngayGio: string;
      reason: string;
    }> = [];

    frData.forEach((fr) => {
      if (fr.symbol === 'ZWAZCE') return;
      const existsInDSGD = dsgdData.some(
        (gd) => gd.combinedKey === fr.combinedKey,
      );
      if (!existsInDSGD) {
        mismatchedTrades.push({
          source: 'CQG',
          maLenh: fr.ord,
          maTKGD: fr.accountRaw,
          maHD: fr.symbol,
          giaKhop: fr.fillP,
          klGiaoDich: fr.qty,
          ngayGio: fr.time,
          reason: 'Lệnh CQG không tìm thấy bên M-System',
        });
      }
    });

    dsgdData.forEach((gd) => {
      if (gd.maTKGD.toUpperCase().endsWith('A')) return;
      const existsInFR = frData.some((fr) => fr.combinedKey === gd.combinedKey);
      if (!existsInFR) {
        mismatchedTrades.push({
          source: 'MSystem',
          maLenh: gd.maLenh,
          maTKGD: gd.maTKGD,
          maHD: gd.maHD,
          giaKhop: gd.giaKhop,
          klGiaoDich: gd.klGiaoDich,
          ngayGio: gd.ngayGio,
          reason: 'Giao dịch M-System không tìm thấy bên CQG',
        });
      }
    });

    const ttttList = parseTTTTForRecon(files.tttt);
    const psList = parsePSForRecon(files.cqgPs, tradingDate, holidays);

    const msSummary = new Map<
      string,
      { account: string; symbol: string; position: number }
    >();
    ttttList.forEach((item) => {
      if (item.account.toUpperCase().endsWith('A')) return;
      const key = `${item.account}_${item.symbol}`;
      const existing = msSummary.get(key) || {
        account: item.account,
        symbol: item.symbol,
        position: 0,
      };
      existing.position += item.position;
      msSummary.set(key, existing);
    });

    const cqgSummary = new Map<
      string,
      { account: string; symbol: string; position: number }
    >();
    psList.forEach((item) => {
      const key = `${item.account}_${item.symbol}`;
      const existing = cqgSummary.get(key) || {
        account: item.account,
        symbol: item.symbol,
        position: 0,
      };
      existing.position += item.position;
      cqgSummary.set(key, existing);
    });

    const mismatchedPositions: Array<{
      account: string;
      symbol: string;
      msPosition: number;
      cqgPosition: number;
      differ: number;
    }> = [];

    const allKeys = new Set([...msSummary.keys(), ...cqgSummary.keys()]);
    for (const key of allKeys) {
      const ms = msSummary.get(key);
      const cqg = cqgSummary.get(key);
      const account = ms?.account || cqg?.account || '';
      const symbol = ms?.symbol || cqg?.symbol || '';
      const msVal = ms?.position || 0;
      const cqgVal = cqg?.position || 0;
      const diff = msVal - cqgVal;

      if (Math.abs(diff) > 0.001) {
        mismatchedPositions.push({
          account,
          symbol,
          msPosition: msVal,
          cqgPosition: cqgVal,
          differ: diff,
        });
      }
    }

    const passed =
      differACM === 0 &&
      differCQG === 0 &&
      mismatchedTrades.length === 0 &&
      mismatchedPositions.length === 0;

    try {
      const emailConfig = await this.marginCheckerService.loadConfig();
      const mailSettings = emailConfig.preEodCheck || {
        isSendWarning: true,
        email: ['it.support@mxv.vn'],
      };
      if (mailSettings.isSendWarning) {
        const subject = `[MXV PRE-EOD CHECK] Báo cáo đối chiếu Khối lượng & Vị thế cuối ngày - ${passed ? 'KHỚP' : 'LỆCH'}`;
        const htmlBody = this.buildPreEodEmailHtml(
          passed,
          {
            totalACM_MS,
            totalACM_Straits,
            differACM,
            totalCQG_MS,
            totalCQG_FR,
            differCQG,
          },
          mismatchedTrades,
          mismatchedPositions,
        );
        await this.marginCheckerService.sendEmailNotification(
          emailConfig,
          mailSettings.email,
          subject,
          htmlBody,
          [],
          'preEodCheck',
        );
      }
    } catch (err: any) {
      this.logger.error(`Lỗi gửi email Pre-EOD: ${err.message}`);
    }

    return {
      passed,
      totals: {
        totalACM_MS,
        totalACM_Straits,
        differACM,
        totalCQG_MS,
        totalCQG_FR,
        differCQG,
      },
      mismatchedTrades,
      mismatchedPositions,
      sessionStart,
      checkTime,
    };
  }

  async runAutoCheckPreEOD(tradingDate: Date): Promise<any> {
    const targetDate = new Date(tradingDate);
    targetDate.setDate(targetDate.getDate() - 1);
    targetDate.setHours(0, 0, 0, 0);

    const msBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting(
        'bot_backup_path_ms',
        'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
      ),
    );
    const cqgBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting(
        'bot_backup_path_cqg',
        'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
      ),
    );
    const acmBackupBase = resolveStoragePathCrossPlatform(
      (await this.settingsService.getSetting('bot_backup_path_acm', '')) ||
        msBackupBase.replace(
          /Backup MS[\\/]Futures/i,
          (match) => (match.includes('/') ? 'Backup MS/ACM' : 'Backup MS\\ACM'),
        ),
    );

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = path.join(msBackupBase, subFolder);
    const cqgDailyPath = path.join(cqgBackupBase, subFolder);
    const acmDailyPath = path.join(acmBackupBase, subFolder);

    const dsgdPath = path.join(msDailyPath, 'DSGD.xlsx');
    const ttttPath = path.join(msDailyPath, 'TTTT.xlsx');

    const acmTradesPath =
      findLatestFile(acmDailyPath, /Straits/i) ||
      findLatestFile(acmDailyPath, /Nano|Fill/i);

    const cqgFrPath = resolveCqgFile(cqgDailyPath, 'FR', this.logger);
    const cqgPsPath = resolveCqgFile(cqgDailyPath, 'PS', this.logger);

    const sessionStartStr = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );

    const [sHour, sMin] = sessionStartStr.split(':').map(Number);
    const sessionStart = new Date(targetDate);
    sessionStart.setHours(sHour, sMin, 0, 0);
    while (sessionStart.getDay() === 0 || sessionStart.getDay() === 6) {
      sessionStart.setDate(sessionStart.getDate() - 1);
    }
    const checkTime = new Date(sessionStart);
    checkTime.setDate(checkTime.getDate() + 1);

    const missingFiles: string[] = [];
    if (!fs.existsSync(dsgdPath)) missingFiles.push(`DSGD.xlsx`);
    if (!fs.existsSync(ttttPath)) missingFiles.push(`TTTT.xlsx`);
    if (!acmTradesPath) missingFiles.push(`ACM Trades (Fill.xlsx / Straits.csv)`);
    if (!cqgFrPath) missingFiles.push(`CQG FR`);
    if (!cqgPsPath) missingFiles.push(`CQG Positions/PS`);

    if (missingFiles.length > 0) {
      return {
        passed: true,
        isWaitingFiles: true,
        sessionStart,
        checkTime,
        message: `[Đang chờ dữ liệu] Thư mục backup ngày ${day}.${month}.${year} đang chờ cập nhật đầy đủ file đối chiếu (Đang thiếu: ${missingFiles.join(', ')}). Bot sẽ tự động kiểm tra lại ở chu kỳ tiếp theo.`,
        totals: {
          totalDSGD: 0,
          totalFR: 0,
          totalACM: 0,
          totalNano: 0,
          differ: 0,
          differACM: 0,
          totalTTTT: 0,
          totalPS: 0,
          differTTTT: 0,
        },
        mismatchedTrades: [],
        mismatchedPositions: [],
        mismatchedTTM: [],
        mismatchedTTTT: [],
      };
    }

    const result = await this.checkPreEOD(
      {
        dsgd: fs.readFileSync(dsgdPath),
        acmTrades: fs.readFileSync(acmTradesPath!),
        cqgFr: fs.readFileSync(cqgFrPath!),
        tttt: fs.readFileSync(ttttPath),
        cqgPs: fs.readFileSync(cqgPsPath!),
      },
      path.basename(acmTradesPath!),
      targetDate,
      [],
      sessionStartStr,
    );

    let telegramMsg = ` <b>[ĐỐI CHIẾU PRE-EOD TỰ ĐỘNG - ${day}/${month}/${year}]</b>\n`;
    if (result.sessionStart && result.checkTime) {
      const startStr = result.sessionStart.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      });
      const endStr = result.checkTime.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      });
      telegramMsg += `• Khoảng thời gian lọc: <code>${startStr}</code> đến <code>${endStr}</code>\n`;
    }
    telegramMsg += `• Trạng thái: ${result.passed ? '✓ Khớp hoàn toàn' : '<b>PHÁT HIỆN LỆCH KHỚP LỆNH/VỊ THẾ</b>'}\n`;
    telegramMsg += `• ACM (M-System vs Straits): MS <code>${result.totals.totalACM_MS}</code> vs Partner <code>${result.totals.totalACM_Straits}</code> (Lệch: <b>${result.totals.differACM}</b>)\n`;
    telegramMsg += `• CQG (M-System vs CQG): MS <code>${result.totals.totalCQG_MS}</code> vs Partner <code>${result.totals.totalCQG_FR}</code> (Lệch: <b>${result.totals.differCQG}</b>)\n`;
    telegramMsg += `• Số lượng lệnh lệch: <b>${result.mismatchedTrades.length}</b>\n`;
    telegramMsg += `• Số vị thế net lệch: <b>${result.mismatchedPositions.length}</b>\n`;

    await this.telegramService.sendMessage(telegramMsg);

    return result;
  }

  async runAutoCheckSOD(tradingDate: Date): Promise<any> {
    const msBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting(
        'bot_backup_path_ms',
        'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
      ),
    );

    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = path.join(msBackupBase, subFolder);
    const qltkgdPath = path.join(msDailyPath, 'QLTKGD.xlsx');

    if (!fs.existsSync(qltkgdPath)) {
      throw new Error(`Không tìm thấy file QLTKGD.xlsx tại: ${qltkgdPath}`);
    }

    return {
      success: true,
      tradingDate,
      qltkgdPath,
    };
  }

  async runAutoCheckEodMm(tradingDate: Date): Promise<any> {
    const msBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting(
        'bot_backup_path_ms',
        'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
      ),
    );

    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = path.join(msBackupBase, subFolder);
    const qltkgdPath = path.join(msDailyPath, 'QLTKGD.xlsx');
    const eodPath = findLatestFile(msDailyPath, /eod/i);
    const ttttPath = path.join(msDailyPath, 'TTTT.xlsx');

    if (!fs.existsSync(qltkgdPath))
      throw new Error(`Thiếu file QLTKGD.xlsx tại ${qltkgdPath}`);
    if (!eodPath) throw new Error('Không tìm thấy file eod.csv / eod.xlsx từ email M-System');

    const rawCcpBase = await getCcpBackupBasePath(this.settingsService);
    const ccpDailyPath = resolveCcpDailyPath(subFolder, rawCcpBase);
    let qltkgdCcpBuffer: Buffer | undefined;
    let eodCcpBuffer: Buffer | undefined;
    let ttttCcpBuffer: Buffer | undefined;

    if (fs.existsSync(ccpDailyPath)) {
      const qltkgdCcpFile = findLatestFile(ccpDailyPath, /qltkgd|qltttkgd/i);
      const eodCcpFile = findLatestFile(ccpDailyPath, /eod/i);
      const ttttCcpFile = findLatestFile(ccpDailyPath, /tttt/i);

      if (qltkgdCcpFile && fs.existsSync(qltkgdCcpFile)) {
        qltkgdCcpBuffer = fs.readFileSync(qltkgdCcpFile);
      }
      if (eodCcpFile && fs.existsSync(eodCcpFile)) {
        eodCcpBuffer = fs.readFileSync(eodCcpFile);
      }
      if (ttttCcpFile && fs.existsSync(ttttCcpFile)) {
        ttttCcpBuffer = fs.readFileSync(ttttCcpFile);
      }
    }

    return {
      success: true,
      tradingDate,
      msDailyPath,
      eodPath,
    };
  }
}
