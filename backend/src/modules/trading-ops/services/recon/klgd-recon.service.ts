import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SystemSettingsService } from '../../../system-settings/system-settings.service';
import {
  resolveStoragePathCrossPlatform,
  resolveCqgFile,
  getCcpBackupBasePath,
  resolveCcpDailyPath,
} from '../../../../shared';
import { CcpExcelParser } from '../../parsers';
import {
  parseDSGD,
  parseFR,
  parseNano,
  parseOP,
  parseTTM,
  parseTTTTForVolume,
  parsePSForVolume,
  parseTradeDateTime,
  parseCqgDateTime,
  findLatestFile,
  extractCqgSnapshotTime,
} from '../../helpers/trading-math.helper';

export interface CheckKLGDResult {
  totals: {
    totalDSGD: number;
    totalFR: number;
    totalACM: number;
    totalNano: number;
    differ: number;
    differACM: number;
    totalTTM?: number;
    totalTTM_MS?: number;
    totalOP?: number;
    totalTTM_CQG?: number;
    totalACM_TTM?: number;
    totalTTM_ACM?: number;
    differTTM?: number;
    totalTTTT?: number;
    totalTTTT_MS?: number;
    totalPS?: number;
    totalPS_CQG?: number;
    totalACM_TTTT?: number;
    totalTTTT_ACM?: number;
    differTTTT?: number;
    totalCCP_DSGD?: number;
    totalCCP_TTM?: number;
    totalCCP_TTTT?: number;
    differCCP_KLGD?: number;
    differCCP_TTM?: number;
    differCCP_TTTT?: number;
    ccpStatus?: 'IDLE' | 'LOADING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
    ccpErrorMessage?: string;
    acmSessionAnomaly?: boolean;
    acmAnomalyNote?: string;
  };
  totalTTM?: number;
  totalOP?: number;
  totalTtmAcm?: number;
  totalDSGD?: number;
  totalFR?: number;
  totalACM?: number;
  totalNano?: number;
  differ?: number;
  differACM?: number;
  totalTTTT?: number;
  totalPS?: number;
  totalTtttAcm?: number;
  differTTTT?: number;
  mismatchedTrades: Array<{
    source: 'MSystem' | 'CQG' | 'ACM' | 'Nano' | 'CoreCCP';
    maLenh?: string;
    maTKGD: string;
    maHD: string;
    giaKhop: number;
    klGiaoDich: number;
    ngayGio: string;
    reason: string;
  }>;
  mismatchedTTM: Array<{
    maTKGD: string;
    ttmValue: number;
    opValue: number;
    differ: number;
  }>;
  mismatchedTTTT?: Array<{
    maTKGD: string;
    ttttValue: number;
    psValue: number;
    differ: number;
  }>;
  pendingSyncTrades?: Array<{
    source: 'MSystem' | 'CQG' | 'ACM' | 'Nano' | 'CoreCCP';
    maLenh?: string;
    maTKGD: string;
    maHD: string;
    giaKhop: number;
    klGiaoDich: number;
    ngayGio: string;
    cutoffTime?: string;
    note?: string;
    reason?: string;
  }>;
  cutoffTime?: Date;
  cqgCutoffTime?: Date;
  sessionStart?: Date;
  checkTime?: Date;
  passed?: boolean;
  isWaitingFiles?: boolean;
  message?: string;
  acmSessionAnomaly?: boolean;
  acmAnomalyNote?: string;
}

@Injectable()
export class KlgdReconService {
  private readonly logger = new Logger(KlgdReconService.name);

  constructor(private readonly settingsService: SystemSettingsService) {}

  /**
   * Tính toán và đối chiếu KLGD trong phiên (M-System vs CQG vs ACM)
   */
  async checkKLGD(
    files: {
      dsgd?: Buffer;
      fr?: Buffer;
      fr1?: Buffer;
      fr2?: Buffer;
      nano?: Buffer;
      ttm?: Buffer;
      op?: Buffer;
      op1?: Buffer;
      op2?: Buffer;
      tttt?: Buffer;
      ps?: Buffer;
      ps1?: Buffer;
      ps2?: Buffer;
      dsgdCcp?: Buffer;
      ttmCcp?: Buffer;
      ttttCcp?: Buffer;
      ccpStatus?: 'IDLE' | 'LOADING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
    },
    tradingDate: Date,
    holidays: string[] = [],
    sessionStartStr: string = '05:00',
    options?: {
      checkKlgd?: boolean;
      checkTtm?: boolean;
      checkTttt?: boolean;
      cutoffTime?: Date;
      cqgCutoffTime?: Date;
    },
  ): Promise<CheckKLGDResult> {
    if (sessionStartStr) {
      await this.settingsService.setSetting('session_start_time', sessionStartStr);
    }
    const rawDsgdData = files.dsgd ? parseDSGD(files.dsgd) : [];
    const rawNanoData = files.nano ? parseNano(files.nano) : [];

    const rawFrData: any[] = [];
    if (files.fr) rawFrData.push(...parseFR(files.fr, tradingDate, holidays));
    if (files.fr1) rawFrData.push(...parseFR(files.fr1, tradingDate, holidays));
    if (files.fr2) rawFrData.push(...parseFR(files.fr2, tradingDate, holidays));

    // Bảo toàn toàn bộ các lần khớp (partial fills) của CQG từ rawFrData theo chuẩn C# IT Tool (FIleUtils.cs & TransactionCheckingService.cs)

    const sessionStart = new Date(tradingDate);
    const [sHour, sMin] = sessionStartStr.split(':').map(Number);

    const isPastDateOrDateOnly =
      (tradingDate.getHours() === 0 &&
        tradingDate.getMinutes() === 0 &&
        tradingDate.getSeconds() === 0) ||
      (tradingDate.getUTCHours() === 0 &&
        tradingDate.getUTCMinutes() === 0 &&
        tradingDate.getUTCSeconds() === 0);

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

    const dsgdUpperBound = checkTime;
    const effectiveCutoffTime = options?.cutoffTime;
    const effectiveCqgCutoffTime = options?.cqgCutoffTime;
    const pendingSyncTrades: Array<{
      source: 'MSystem' | 'CQG' | 'ACM';
      maLenh?: string;
      maTKGD: string;
      maHD: string;
      giaKhop: number;
      klGiaoDich: number;
      ngayGio: string;
      cutoffTime: string;
      note: string;
    }> = [];

    const rawFrKeySet = new Set(rawFrData.map((f) => f.combinedKey));
    const cqgCutoffBufferMs = 2000; // Buffer 2,000ms triệt tiêu độ trễ mạng / clock skew tương tự Chiều 1 dsgdCutoffTime
    const cqgBoundaryThreshold = effectiveCqgCutoffTime
      ? new Date(effectiveCqgCutoffTime.getTime() - cqgCutoffBufferMs)
      : undefined;

    const dsgdData = rawDsgdData.filter((gd) => {
      if (!gd.ngayGio) return true;
      const tradeTime = parseTradeDateTime(gd.ngayGio, tradingDate);
      if (!tradeTime) return true;
      // Chiều 2: Lệnh M-System khớp sau hoặc sát mốc chốt dữ liệu CQG -> Tự động bảo lưu pendingSyncTrades
      if (
        effectiveCqgCutoffTime &&
        !gd.maTKGD.toUpperCase().endsWith('A')
      ) {
        const isLateTrade = tradeTime > effectiveCqgCutoffTime;
        const isBoundaryTrade =
          cqgBoundaryThreshold &&
          tradeTime >= cqgBoundaryThreshold &&
          !rawFrKeySet.has(gd.combinedKey);

        if (isLateTrade || isBoundaryTrade) {
          pendingSyncTrades.push({
            source: 'MSystem',
            maLenh: gd.maLenh,
            maTKGD: gd.maTKGD,
            maHD: gd.maHD,
            giaKhop: gd.giaKhop,
            klGiaoDich: gd.klGiaoDich,
            ngayGio: gd.ngayGio,
            cutoffTime: effectiveCqgCutoffTime.toISOString(),
            note: isLateTrade
              ? `Giao dịch M-System khớp lúc ${gd.ngayGio}, sau mốc chốt dữ liệu CQG (${effectiveCqgCutoffTime.toLocaleTimeString('vi-VN')})`
              : `Giao dịch M-System khớp lúc ${gd.ngayGio}, sát mốc chốt dữ liệu CQG (${effectiveCqgCutoffTime.toLocaleTimeString('vi-VN')}) do độ trễ đồng bộ mạng`,
          });
          return false;
        }
      }
      return tradeTime <= dsgdUpperBound;
    });

    const nanoUpperBound = dsgdUpperBound;
    const nanoData = rawNanoData.filter((gd) => {
      if (!gd.ngayGio) return true;
      const tradeTime = parseTradeDateTime(gd.ngayGio, tradingDate);
      if (!tradeTime) return true;
      if (effectiveCutoffTime && tradeTime > effectiveCutoffTime) {
        pendingSyncTrades.push({
          source: 'ACM',
          maLenh: gd.maLenh,
          maTKGD: gd.maTKGD,
          maHD: gd.maHD,
          giaKhop: gd.giaKhop,
          klGiaoDich: gd.klGiaoDich,
          ngayGio: gd.ngayGio,
          cutoffTime: effectiveCutoffTime.toISOString(),
          note: `Giao dịch ACM khớp lúc ${gd.ngayGio}, sau mốc chốt dữ liệu M-System (${effectiveCutoffTime.toLocaleTimeString('vi-VN')})`,
        });
        return false;
      }
      return tradeTime <= nanoUpperBound;
    });

    const frData = rawFrData.filter((fr) => {
      if (!fr.time) return true;
      const tradeTime = parseCqgDateTime(fr.time, tradingDate);
      if (!tradeTime) return true;
      if (tradeTime < sessionStart) return false;
      if (effectiveCutoffTime && tradeTime > effectiveCutoffTime) {
        pendingSyncTrades.push({
          source: 'CQG',
          maLenh: fr.ord,
          maTKGD: fr.accountRaw,
          maHD: fr.symbol,
          giaKhop: fr.fillP,
          klGiaoDich: fr.qty,
          ngayGio: fr.time,
          cutoffTime: effectiveCutoffTime.toISOString(),
          note: `Lệnh CQG khớp lúc ${fr.time}, sau mốc chốt dữ liệu M-System (${effectiveCutoffTime.toLocaleTimeString('vi-VN')})`,
        });
        return false;
      }
      return tradeTime <= checkTime;
    });

    let totalDSGD = 0;
    let totalACM = 0;
    let totalFR = 0;
    let totalNano = 0;

    dsgdData.forEach((gd) => {
      if (gd.maTKGD.toUpperCase().endsWith('A')) {
        totalACM += gd.klGiaoDich;
      } else {
        totalDSGD += gd.klGiaoDich;
      }
    });

    frData.forEach((fr) => {
      if (fr.symbol !== 'ZWAZCE') {
        totalFR += fr.qty;
      }
    });

    nanoData.forEach((gd) => {
      totalNano += gd.klGiaoDich;
    });

    let acmSessionAnomaly = false;
    let acmAnomalyNote = '';

    if (totalNano === 0 && totalACM > 0 && rawNanoData.length > 0) {
      const candidates = rawNanoData.filter((gd) => {
        if (!gd.tradeDateStr) return false;
        const tradeTime = parseTradeDateTime(gd.tradeDateStr, tradingDate);
        if (!tradeTime) return false;
        if (tradeTime < sessionStart) return false;
        if (effectiveCutoffTime && tradeTime > effectiveCutoffTime) {
          pendingSyncTrades.push({
            source: 'ACM',
            maLenh: gd.maLenh,
            maTKGD: gd.maTKGD,
            maHD: gd.maHD,
            giaKhop: gd.giaKhop,
            klGiaoDich: gd.klGiaoDich,
            ngayGio: gd.tradeDateStr,
            cutoffTime: effectiveCutoffTime.toISOString(),
            note: `Giao dịch ACM khớp lúc ${gd.tradeDateStr}, sau mốc chốt dữ liệu M-System (${effectiveCutoffTime.toLocaleTimeString('vi-VN')})`,
          });
          return false;
        }
        return tradeTime <= nanoUpperBound;
      });

      if (candidates.length > 0) {
        acmSessionAnomaly = true;
        let recheckLots = 0;
        candidates.forEach((c) => {
          recheckLots += c.klGiaoDich;
        });

        acmAnomalyNote = `[ACM CHƯA CẮT PHIÊN] Phát hiện sàn ACM chưa cắt phiên kế toán. Đã tự động đối soát theo Trade Date: ghi nhận ${recheckLots} lots Nano.`;
        this.logger.warn(`[Recon KLGD] ${acmAnomalyNote}`);

        nanoData.length = 0;
        nanoData.push(...candidates);
        totalNano = recheckLots;
      }
    }

    const differ = Math.abs(totalFR - totalDSGD);
    const differACM = Math.abs(totalNano - totalACM);

    const mismatchedTrades: Array<{
      source: 'MSystem' | 'CQG' | 'ACM' | 'Nano';
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
      const existsInDSGD = dsgdData.some((gd) => gd.combinedKey === fr.combinedKey);
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

    // II. TTM

    let totalTTM = 0;
    let totalACM_TTM = 0;
    let totalOP = 0;
    const ttmSummary: Record<string, number> = {};
    const opSummary: Record<string, number> = {};
    const mismatchedTTM: Array<{
      maTKGD: string;
      ttmValue: number;
      opValue: number;
      differ: number;
    }> = [];

    if (files.ttm) {
      const ttmData = parseTTM(files.ttm);
      ttmData.forEach((t) => {
        const qty = t.tongMua + t.tongBan;
        const cleanAcc = String(t.maTKGD || '').trim().toUpperCase();
        if (cleanAcc.endsWith('A')) {
          totalACM_TTM += qty;
        } else {
          totalTTM += qty;
        }
        ttmSummary[cleanAcc] = (ttmSummary[cleanAcc] || 0) + qty;
      });
    }

    if (files.op || files.op1 || files.op2) {
      const opData: any[] = [];
      if (files.op) opData.push(...parseOP(files.op));
      if (files.op1) opData.push(...parseOP(files.op1));
      if (files.op2) opData.push(...parseOP(files.op2));

      opData.forEach((o) => {
        const cleanAcc = String(o.account || '').trim().toUpperCase();
        const qty = o.lValue + o.sValue;
        if (!cleanAcc.endsWith('A')) {
          totalOP += qty;
        }
        opSummary[cleanAcc] = (opSummary[cleanAcc] || 0) + qty;
      });
    }

    if (files.ttm && (files.op || files.op1 || files.op2)) {
      const allAccounts = Array.from(new Set([...Object.keys(ttmSummary), ...Object.keys(opSummary)]));
      allAccounts.forEach((acc) => {
        if (acc.endsWith('A')) return;
        const ttmVal = ttmSummary[acc] || 0;
        const opVal = opSummary[acc] || 0;
        if (Math.abs(ttmVal - opVal) > 0) {
          mismatchedTTM.push({
            maTKGD: acc,
            ttmValue: ttmVal,
            opValue: opVal,
            differ: Math.abs(ttmVal - opVal),
          });
        }
      });
    }

    // III. TTTT vs PS
    let totalTTTT = 0;
    let totalACM_TTTT = 0;
    let totalPS = 0;
    const ttttSummary: Record<string, number> = {};
    const psSummary: Record<string, number> = {};
    const mismatchedTTTT: Array<{
      maTKGD: string;
      ttttValue: number;
      psValue: number;
      differ: number;
    }> = [];

    if (files.tttt) {
      const ttttData = parseTTTTForVolume(files.tttt);
      ttttData.forEach((t) => {
        const cleanAcc = String(t.maTKGD || '').trim().toUpperCase();
        if (cleanAcc.endsWith('A')) {
          totalACM_TTTT += t.tongBan;
        } else {
          totalTTTT += t.tongBan;
        }
        ttttSummary[cleanAcc] = (ttttSummary[cleanAcc] || 0) + t.tongBan;
      });
    }

    if (files.ps || files.ps1 || files.ps2) {
      const psData: any[] = [];
      if (files.ps) psData.push(...parsePSForVolume(files.ps));
      if (files.ps1) psData.push(...parsePSForVolume(files.ps1));
      if (files.ps2) psData.push(...parsePSForVolume(files.ps2));

      psData.forEach((p) => {
        const cleanAcc = String(p.account || '').trim().toUpperCase();
        if (!cleanAcc.endsWith('A')) {
          totalPS += p.sValue;
        }
        psSummary[cleanAcc] = (psSummary[cleanAcc] || 0) + p.sValue;
      });
    }

    if (files.tttt && (files.ps || files.ps1 || files.ps2)) {
      const allTtttAccounts = Array.from(new Set([...Object.keys(ttttSummary), ...Object.keys(psSummary)]));
      allTtttAccounts.forEach((acc) => {
        if (acc.endsWith('A')) return;
        const ttttVal = ttttSummary[acc] || 0;
        const psVal = psSummary[acc] || 0;
        if (Math.abs(ttttVal - psVal) > 0) {
          mismatchedTTTT.push({
            maTKGD: acc,
            ttttValue: ttttVal,
            psValue: psVal,
            differ: Math.abs(ttttVal - psVal),
          });
        }
      });
    }

    const checkKlgdFlag = options?.checkKlgd !== false;
    const checkTtmFlag = options?.checkTtm !== false;
    const checkTtttFlag = options?.checkTttt !== false;

    const finalDiffer = checkKlgdFlag ? differ : 0;
    const finalDifferACM = checkKlgdFlag ? differACM : 0;
    const finalMismatchedTTM = checkTtmFlag ? mismatchedTTM : [];
    const finalMismatchedTTTT = checkTtttFlag && files.tttt ? mismatchedTTTT : undefined;
    const finalDifferTTTT =
      checkTtttFlag && files.tttt && (files.ps || files.ps1 || files.ps2)
        ? Math.abs(totalTTTT - totalPS)
        : undefined;

    let totalCCP_DSGD: number | undefined;
    let totalCCP_TTM: number | undefined;
    let totalCCP_TTTT: number | undefined;
    let ccpStatus: 'IDLE' | 'LOADING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' =
      files.ccpStatus || 'IDLE';
    let ccpDsgdRecords: any[] = [];

    if (files.dsgdCcp) {
      try {
        const parsed = CcpExcelParser.parseDSGD(
          files.dsgdCcp,
          tradingDate,
          sessionStart,
          checkTime,
        );
        totalCCP_DSGD = parsed.totalKhop;
        ccpDsgdRecords = parsed.records || [];
        ccpStatus = 'COMPLETED';
      } catch (err: any) {
        this.logger.warn(`[Recon] Lỗi parse DSGD CoreCCP: ${err.message}`);
      }
    }
    if (files.ttmCcp) {
      try {
        const parsed = CcpExcelParser.parseTTM(files.ttmCcp, tradingDate);
        totalCCP_TTM = parsed.totalTTM;
        ccpStatus = 'COMPLETED';
      } catch (err: any) {
        this.logger.warn(`[Recon] Lỗi parse TTM CoreCCP: ${err.message}`);
      }
    }
    if (files.ttttCcp) {
      try {
        const parsed = CcpExcelParser.parseTTTT(files.ttttCcp, tradingDate);
        totalCCP_TTTT = parsed.totalTTTT;
        ccpStatus = 'COMPLETED';
      } catch (err: any) {
        this.logger.warn(`[Recon] Lỗi parse TTTT CoreCCP: ${err.message}`);
      }
    }

    let finalMismatchedTrades = checkKlgdFlag ? [...mismatchedTrades] : [];


    let evaluatedDifferACM = finalDifferACM;
    const ccpDsgdLots = totalCCP_DSGD || 0;
    if (checkKlgdFlag && ccpDsgdLots > 0) {
      const diff1 = Math.abs(totalNano - (totalACM + ccpDsgdLots));
      const diff2 = Math.abs((totalNano + ccpDsgdLots) - totalACM);
      evaluatedDifferACM = Math.min(finalDifferACM, diff1, diff2);
    }

    const differCCP_KLGD =
      evaluatedDifferACM === 0
        ? 0
        : totalCCP_DSGD !== undefined
          ? Math.abs(totalNano - (totalACM + ccpDsgdLots))
          : undefined;
    const differCCP_TTM =
      totalCCP_TTM !== undefined && files.ttm ? Math.abs(totalTTM - totalCCP_TTM) : undefined;
    const differCCP_TTTT =
      totalCCP_TTTT !== undefined && files.tttt ? Math.abs(totalTTTT - totalCCP_TTTT) : undefined;

    // Theo chuẩn C# CheckKLGD (TransactionCheckingService.cs#L368-L383):
    // Kết luận Khớp/Lệch của ca Khớp Lệnh chỉ căn cứ vào Khối lượng khớp lệnh thường (differ),
    // tự doanh ACM (differACM) và chi tiết các lệnh không khớp (mismatchedTrades).
    // TTM (Vị thế mở) và TTTT (Tất toán) chỉ mang tính chất ghi chú bổ trợ (notiData), không làm fail ca Khớp Lệnh trong phiên.
    const hasDiscrepancy =
      checkKlgdFlag &&
      (finalDiffer > 0 || evaluatedDifferACM > 0 || finalMismatchedTrades.length > 0);

    return {
      totals: {
        totalDSGD,
        totalFR,
        totalACM,
        totalNano,
        differ: finalDiffer,
        differACM: evaluatedDifferACM,
        totalTTM: files.ttm ? totalTTM : 0,
        totalTTM_MS: files.ttm ? totalTTM : 0,
        totalOP: files.op || files.op1 || files.op2 ? totalOP : 0,
        totalTTM_CQG: files.op || files.op1 || files.op2 ? totalOP : 0,
        totalACM_TTM: files.ttm ? totalACM_TTM : 0,
        totalTTM_ACM: files.ttm ? totalACM_TTM : 0,
        differTTM: files.ttm && (files.op || files.op1 || files.op2) ? Math.abs(totalTTM - totalOP) : 0,
        totalTTTT: files.tttt ? totalTTTT : 0,
        totalTTTT_MS: files.tttt ? totalTTTT : 0,
        totalPS: files.ps || files.ps1 || files.ps2 ? totalPS : 0,
        totalPS_CQG: files.ps || files.ps1 || files.ps2 ? totalPS : 0,
        totalACM_TTTT: files.tttt ? totalACM_TTTT : 0,
        totalTTTT_ACM: files.tttt ? totalACM_TTTT : 0,
        differTTTT: finalDifferTTTT,
        totalCCP_DSGD,
        totalCCP_TTM,
        totalCCP_TTTT,
        differCCP_KLGD,
        differCCP_TTM,
        differCCP_TTTT,
        ccpStatus,
        acmSessionAnomaly,
        acmAnomalyNote: acmSessionAnomaly ? acmAnomalyNote : undefined,
      },
      totalTTM: files.ttm ? totalTTM : 0,
      totalOP: files.op || files.op1 || files.op2 ? totalOP : 0,
      totalTtmAcm: files.ttm ? totalACM_TTM : 0,
      totalDSGD,
      totalFR,
      totalACM,
      totalNano,
      differ: finalDiffer,
      differACM: evaluatedDifferACM,
      totalTTTT: files.tttt ? totalTTTT : 0,
      totalPS: files.ps || files.ps1 || files.ps2 ? totalPS : 0,
      totalTtttAcm: files.tttt ? totalACM_TTTT : 0,
      differTTTT: finalDifferTTTT,
      mismatchedTrades: finalMismatchedTrades,
      mismatchedTTM: finalMismatchedTTM,
      mismatchedTTTT: finalMismatchedTTTT,
      pendingSyncTrades: pendingSyncTrades.length > 0 ? pendingSyncTrades : undefined,
      cutoffTime: effectiveCutoffTime,
      cqgCutoffTime: effectiveCqgCutoffTime,
      sessionStart,
      checkTime,
      passed: !hasDiscrepancy,
      acmSessionAnomaly,
      acmAnomalyNote: acmSessionAnomaly ? acmAnomalyNote : undefined,
    };
  }

  /**
   * Tự động quét file và đối chiếu theo ngày phiên
   */
  async runAutoCheckKLGD(
    tradingDate: Date,
    options?: {
      checkKlgd?: boolean;
      checkTtm?: boolean;
      checkTttt?: boolean;
      cutoffTime?: Date;
      cqgCutoffTime?: Date;
      customDataDir?: string;
    },
  ): Promise<CheckKLGDResult> {
    const msBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting(
        'bot_backup_path_ms',
        '',
      ),
    );
    const cqgBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting(
        'bot_backup_path_cqg',
        '',
      ),
    );
    const acmBackupBase = resolveStoragePathCrossPlatform(
      (await this.settingsService.getSetting('bot_backup_path_acm', '')) ||
        msBackupBase.replace(
          /Backup MS[\\/]Futures/i,
          (match) => (match.includes('/') ? 'Backup MS/ACM' : 'Backup MS\\ACM'),
        ),
    );

    const year = tradingDate.getFullYear().toString();
    const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
    const day = String(tradingDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    // Thư mục dữ liệu kiểm tra giao dịch trong phiên (TradingCheckPath)
    const tradingCheckBase = resolveStoragePathCrossPlatform(
      (await this.settingsService.getSetting('bot_trading_check_path', '')) ||
        msBackupBase.replace(/Backup MS[\\/]Futures/i, 'TradingCheck/Futures').replace(/Backup MS/i, 'TradingCheck'),
    );
    const msTradingDailyPath = options?.customDataDir || path.join(tradingCheckBase, subFolder);
    const cqgTradingDailyPath = options?.customDataDir || path.join(
      cqgBackupBase.replace(/Backup CQG[\\/]Futures/i, 'TradingCheck/Futures/CQG').replace(/Backup CQG/i, 'TradingCheck/CQG'),
      subFolder,
    );
    const acmTradingDailyPath = options?.customDataDir || path.join(
      acmBackupBase.replace(/Backup MS[\\/]ACM/i, 'TradingCheck/ACM').replace(/Backup ACM/i, 'TradingCheck/ACM'),
      subFolder,
    );
    const rawCcpBase = await getCcpBackupBasePath(this.settingsService);
    const ccpTradingDailyPath = options?.customDataDir || path.join(
      resolveStoragePathCrossPlatform(rawCcpBase).replace(/Backup CCP/i, 'TradingCheck/CCP'),
      subFolder,
    );

    const msDailyPath = path.join(msBackupBase, subFolder);
    const cqgDailyPath = path.join(cqgBackupBase, subFolder);
    const acmDailyPath = path.join(acmBackupBase, subFolder);
    const ccpDailyPath = resolveCcpDailyPath(subFolder, rawCcpBase);

    // Ưu tiên đọc từ thư mục kiểm tra trong phiên (TradingCheck), nếu chưa có thì fallback đọc từ thư mục Backup
    const resolvePriorityPath = (primaryDir: string, fallbackDir: string, filename: string): string => {
      const p1 = path.join(primaryDir, filename);
      if (fs.existsSync(p1)) return p1;
      return path.join(fallbackDir, filename);
    };

    const dsgdPath = resolvePriorityPath(msTradingDailyPath, msDailyPath, 'DSGD.xlsx');
    const ttttPath = resolvePriorityPath(msTradingDailyPath, msDailyPath, 'TTTT.xlsx');
    const ttmPath = resolvePriorityPath(msTradingDailyPath, msDailyPath, 'TTM.xlsx');

    // Lọc file Straits CSV theo ngày phiên giao dịch
    const findSessionStraitsPath = (dirs: string[]): string | null => {
      for (const d of dirs) {
        if (!fs.existsSync(d)) continue;
        const acmFiles = fs.readdirSync(d);
        const expectedName = `EOD FO trades_PT Straits Financial Indonesia - 10017890000_${day}${month}${year}.csv`;
        const directPath = path.join(d, expectedName);
        if (fs.existsSync(directPath)) return directPath;

        const dateSpecific = acmFiles.find(
          (f) => /straits.*\.csv$/i.test(f) && f.includes(`${day}${month}${year}`),
        );
        if (dateSpecific) return path.join(d, dateSpecific);

        if (acmFiles.includes(`Straits_${day}${month}${year}.csv`)) {
          return path.join(d, `Straits_${day}${month}${year}.csv`);
        }

        if (acmFiles.includes('Straits.csv')) {
          return path.join(d, 'Straits.csv');
        }
      }
      return null;
    };

    const acmTradesPath = findSessionStraitsPath([acmTradingDailyPath, acmDailyPath]);

    const cqgFrPath =
      resolveCqgFile(cqgTradingDailyPath, 'FR', this.logger) ||
      resolveCqgFile(cqgDailyPath, 'FR', this.logger);
    const cqgPsPath =
      resolveCqgFile(cqgTradingDailyPath, 'PS', this.logger) ||
      resolveCqgFile(cqgDailyPath, 'PS', this.logger);
    const cqgOpPath =
      resolveCqgFile(cqgTradingDailyPath, 'OP', this.logger) ||
      resolveCqgFile(cqgDailyPath, 'OP', this.logger);

    const dsgdCcpPath =
      findLatestFile(ccpTradingDailyPath, /dsgd/i) ||
      findLatestFile(ccpDailyPath, /dsgd/i);
    const ttmCcpPath =
      findLatestFile(ccpTradingDailyPath, /ttm/i) ||
      findLatestFile(ccpDailyPath, /ttm/i);
    const ttttCcpPath =
      findLatestFile(ccpTradingDailyPath, /tttt/i) ||
      findLatestFile(ccpDailyPath, /tttt/i);

    const sessionStartStr = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );

    const [sHour, sMin] = sessionStartStr.split(':').map(Number);
    const sessionStart = new Date(tradingDate);
    sessionStart.setHours(sHour, sMin, 0, 0);
    const checkTime = new Date();
    if (checkTime < sessionStart) {
      if (checkTime.getDay() !== 1) {
        sessionStart.setDate(sessionStart.getDate() - 1);
        while (sessionStart.getDay() === 0 || sessionStart.getDay() === 6) {
          sessionStart.setDate(sessionStart.getDate() - 1);
        }
      }
    }

    const checkKlgdFlag = options?.checkKlgd !== false;
    const checkTtmFlag = options?.checkTtm !== false;

    const missingFiles: string[] = [];
    if (checkKlgdFlag) {
      if (!fs.existsSync(dsgdPath)) missingFiles.push(`DSGD.xlsx`);
      if (!acmTradesPath) missingFiles.push(`ACM Trades (Straits CSV)`);
      if (!cqgFrPath) missingFiles.push(`CQG FR`);
    }
    if (checkTtmFlag) {
      if (!fs.existsSync(ttmPath)) missingFiles.push(`TTM.xlsx`);
    }

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
        },
        mismatchedTrades: [],
        mismatchedTTM: [],
      };
    }

    const files: any = {};
    let dsgdCutoffTime: Date | undefined = undefined;
    if (fs.existsSync(dsgdPath)) {
      files.dsgd = fs.readFileSync(dsgdPath);
      try {
        const stat = fs.statSync(dsgdPath);
        dsgdCutoffTime = new Date(stat.mtime.getTime() - 2000);
        this.logger.log(
          `[Recon] Xác định mốc cắt dữ liệu (Cutoff Time) từ file DSGD.xlsx: ${dsgdCutoffTime.toLocaleTimeString('vi-VN')} (${dsgdCutoffTime.toISOString()}, buffer -2s so với mtime ghi đĩa)`,
        );
      } catch (err: any) {
        this.logger.warn(`[Recon] Không lấy được mtime của DSGD.xlsx: ${err.message}`);
      }
    }
    if (cqgFrPath && fs.existsSync(cqgFrPath)) files.fr = fs.readFileSync(cqgFrPath);
    if (acmTradesPath && fs.existsSync(acmTradesPath)) files.nano = fs.readFileSync(acmTradesPath);
    if (fs.existsSync(ttmPath)) files.ttm = fs.readFileSync(ttmPath);
    if (fs.existsSync(ttttPath)) files.tttt = fs.readFileSync(ttttPath);
    if (cqgPsPath && fs.existsSync(cqgPsPath)) files.ps = fs.readFileSync(cqgPsPath);
    if (cqgOpPath && fs.existsSync(cqgOpPath)) files.op = fs.readFileSync(cqgOpPath);

    if (dsgdCcpPath && fs.existsSync(dsgdCcpPath)) files.dsgdCcp = fs.readFileSync(dsgdCcpPath);
    if (ttmCcpPath && fs.existsSync(ttmCcpPath)) files.ttmCcp = fs.readFileSync(ttmCcpPath);
    if (ttttCcpPath && fs.existsSync(ttttCcpPath)) files.ttttCcp = fs.readFileSync(ttttCcpPath);

    // Trích xuất mốc chốt dữ liệu thực tế của CQG từ Header file thô (FR1/FR2) hoặc FR.xlsx
    let cqgCutoffTime: Date | undefined = options?.cqgCutoffTime;
    if (!cqgCutoffTime && cqgFrPath) {
      const frDir = path.dirname(cqgFrPath);
      const snap1 = extractCqgSnapshotTime(path.join(frDir, 'FR1.xlsx'));
      const snap2 = extractCqgSnapshotTime(path.join(frDir, 'FR2.xlsx'));
      if (snap1 && snap2) {
        cqgCutoffTime = new Date(Math.max(snap1.getTime(), snap2.getTime()));
      } else {
        cqgCutoffTime = (snap1 || snap2 || extractCqgSnapshotTime(cqgFrPath)) || undefined;
      }
      if (cqgCutoffTime) {
        this.logger.log(
          `[Recon] Xác định mốc cắt dữ liệu CQG (CQG Cutoff Time) từ Header file: ${cqgCutoffTime.toLocaleTimeString('vi-VN')} (${cqgCutoffTime.toISOString()})`,
        );
      }
    }

    const reconOptions = {
      ...options,
      cutoffTime: options?.cutoffTime || dsgdCutoffTime,
      cqgCutoffTime,
    };

    const lmeHolidaysStr = await this.settingsService.getSetting(
      'lme_holiday_replacements',
      '[]',
    );
    let lmeHolidays: any[] = [];
    try {
      lmeHolidays = JSON.parse(lmeHolidaysStr) || [];
    } catch {}

    return this.checkKLGD(files, tradingDate, lmeHolidays, sessionStartStr, reconOptions);
  }
}
