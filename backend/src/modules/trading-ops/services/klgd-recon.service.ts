import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
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
} from '../helpers/trading-math.helper';

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

    const dsgdData = rawDsgdData.filter((gd) => {
      if (!gd.ngayGio) return true;
      const tradeTime = parseTradeDateTime(gd.ngayGio, tradingDate);
      if (!tradeTime) return true;
      return tradeTime <= dsgdUpperBound;
    });

    const effectiveCutoffTime = options?.cutoffTime;
    const pendingSyncTrades: Array<{
      source: 'CQG' | 'ACM';
      maLenh?: string;
      maTKGD: string;
      maHD: string;
      giaKhop: number;
      klGiaoDich: number;
      ngayGio: string;
      cutoffTime: string;
      note: string;
    }> = [];

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

    nanoData.forEach((gd) => {
      const existsInDSGD = dsgdData.some(
        (row) =>
          row.maTKGD.toUpperCase().endsWith('A') &&
          row.maGD === gd.maGD &&
          row.klGiaoDich === gd.klGiaoDich,
      );
      if (!existsInDSGD) {
        mismatchedTrades.push({
          source: 'ACM',
          maLenh: gd.maLenh,
          maTKGD: gd.maTKGD,
          maHD: gd.maHD,
          giaKhop: gd.giaKhop,
          klGiaoDich: gd.klGiaoDich,
          ngayGio: gd.ngayGio,
          reason: 'Giao dịch ACM không đồng bộ bên M-System',
        });
      }
    });

    dsgdData.forEach((gd) => {
      if (!gd.maTKGD.toUpperCase().endsWith('A')) return;
      const existsInNano = nanoData.some(
        (row) => row.maGD === gd.maGD && row.klGiaoDich === gd.klGiaoDich,
      );
      if (!existsInNano) {
        mismatchedTrades.push({
          source: 'Nano',
          maLenh: gd.maLenh,
          maTKGD: gd.maTKGD,
          maHD: gd.maHD,
          giaKhop: gd.giaKhop,
          klGiaoDich: gd.klGiaoDich,
          ngayGio: gd.ngayGio,
          reason: 'Giao dịch M-System (tự doanh) không có bên cổng ACM',
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

    const hasDiscrepancy =
      (checkKlgdFlag && (finalDiffer > 0 || finalDifferACM > 0 || mismatchedTrades.length > 0)) ||
      (checkTtmFlag && finalMismatchedTTM.length > 0) ||
      (checkTtttFlag && files.tttt && (files.ps || files.ps1 || files.ps2) && ((finalDifferTTTT || 0) > 0 || (finalMismatchedTTTT || []).length > 0));

    return {
      totals: {
        totalDSGD,
        totalFR,
        totalACM,
        totalNano,
        differ: finalDiffer,
        differACM: finalDifferACM,
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
      differACM: finalDifferACM,
      totalTTTT: files.tttt ? totalTTTT : 0,
      totalPS: files.ps || files.ps1 || files.ps2 ? totalPS : 0,
      totalTtttAcm: files.tttt ? totalACM_TTTT : 0,
      differTTTT: finalDifferTTTT,
      mismatchedTrades,
      mismatchedTTM: finalMismatchedTTM,
      mismatchedTTTT: finalMismatchedTTTT,
      pendingSyncTrades: pendingSyncTrades.length > 0 ? pendingSyncTrades : undefined,
      cutoffTime: effectiveCutoffTime,
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
      customDataDir?: string;
    },
  ): Promise<CheckKLGDResult> {
    const dataDir = options?.customDataDir || path.join(process.cwd(), 'data', 'backup');
    const dsgdFile = findLatestFile(dataDir, /DSGD.*\.xlsx$/i);
    const frFile = findLatestFile(dataDir, /^FR.*\.xlsx$/i);
    const nanoFile = findLatestFile(dataDir, /(Nano|Straits).*\.(xlsx|csv)$/i);
    const ttmFile = findLatestFile(dataDir, /TTM.*\.xlsx$/i);
    const opFile = findLatestFile(dataDir, /^OP.*\.xlsx$/i);
    const ttttFile = findLatestFile(dataDir, /TTTT.*\.xlsx$/i);
    const psFile = findLatestFile(dataDir, /^PS.*\.xlsx$/i);

    const files: any = {
      dsgd: dsgdFile ? fs.readFileSync(dsgdFile) : undefined,
      fr: frFile ? fs.readFileSync(frFile) : undefined,
      nano: nanoFile ? fs.readFileSync(nanoFile) : undefined,
      ttm: ttmFile ? fs.readFileSync(ttmFile) : undefined,
      op: opFile ? fs.readFileSync(opFile) : undefined,
      tttt: ttttFile ? fs.readFileSync(ttttFile) : undefined,
      ps: psFile ? fs.readFileSync(psFile) : undefined,
    };

    return this.checkKLGD(files, tradingDate, [], '05:00', options);
  }
}
