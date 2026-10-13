import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseDSGD,
  parseFR,
  parseStraitsCsv,
  parseTTTTForRecon,
  parsePSForRecon,
  findLatestFile,
} from '../helpers/trading-math.helper';

export interface PreEodReconResult {
  passed: boolean;
  totals: {
    totalACM_MS: number;
    totalACM_Straits: number;
    differACM: number;
    totalCQG_MS: number;
    totalCQG_FR: number;
    differCQG: number;
    totalTTTT_MS?: number;
    totalPS_CQG?: number;
    differPositions?: number;
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
  tradingDate: Date;
  targetDate: Date;
  summaryMessage?: string;
}

@Injectable()
export class PreEodReconService {
  private readonly logger = new Logger(PreEodReconService.name);

  /**
   * Thực hiện đối chiếu 3 bên chốt phiên Pre-EOD: M-System vs CQG vs ACM Straits
   */
  async checkPreEOD(
    files: {
      dsgd: Buffer;
      acmTrades: Buffer;
      cqgFr: Buffer;
      tttt?: Buffer;
      cqgPs?: Buffer;
    },
    acmTradesName: string,
    tradingDate: Date,
    holidays: string[] = [],
  ): Promise<PreEodReconResult> {
    // 1. Tính toán ngày T-1 (lùi ngày làm việc, bỏ qua Thứ Bảy & Chủ Nhật)
    const targetDate = new Date(tradingDate);
    targetDate.setDate(targetDate.getDate() - 1);
    while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
      targetDate.setDate(targetDate.getDate() - 1);
    }

    const dayStr = String(targetDate.getDate()).padStart(2, '0');
    const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
    const yearStr = targetDate.getFullYear().toString();
    const expectedDateStr = `${dayStr}${monthStr}${yearStr}`;

    // Kiểm tra tên file ACM Straits đúng ngày T-1 nếu tên file có chứa ngày
    const hasExplicitDate = /\d{6,8}/.test(acmTradesName || '');
    if (acmTradesName && hasExplicitDate && !acmTradesName.includes(expectedDateStr)) {
      this.logger.warn(
        `File ACM Trades (${acmTradesName}) chứa ngày khác ngày T-1 (${dayStr}/${monthStr}/${yearStr}).`,
      );
    }

    // 2. Parse M-System DSGD
    const dsgdData = parseDSGD(files.dsgd);
    let totalACM_MS = 0;
    let totalCQG_MS = 0;
    dsgdData.forEach((gd) => {
      if (gd.maTKGD.toUpperCase().endsWith('A')) {
        totalACM_MS += gd.klGiaoDich;
      } else {
        totalCQG_MS += gd.klGiaoDich;
      }
    });

    // 3. Parse ACM Straits CSV
    let acmStraitsData = { totalVolume: 0 };
    try {
      acmStraitsData = parseStraitsCsv(files.acmTrades);
    } catch (acmErr: any) {
      this.logger.warn(`Lỗi parse Straits CSV: ${acmErr.message}`);
    }
    const totalACM_Straits = acmStraitsData.totalVolume || 0;
    const differACM = Math.abs(totalACM_MS - totalACM_Straits);

    // 4. Parse CQG FR
    const frData = parseFR(files.cqgFr, tradingDate, holidays);
    let totalCQG_FR = 0;
    frData.forEach((fr) => {
      if (fr.symbol !== 'ZWAZCE') {
        totalCQG_FR += fr.qty;
      }
    });
    const differCQG = Math.abs(totalCQG_MS - totalCQG_FR);

    // 5. Tìm kiếm chênh lệch khớp lệnh 2 chiều (CombinedKey)
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

    // Chiều 1: CQG FR -> M-System DSGD
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

    // Chiều 2: M-System DSGD -> CQG FR
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

    // 6. Đối chiếu vị thế tất toán (TTTT M-System vs PS CQG)
    const mismatchedPositions: Array<{
      account: string;
      symbol: string;
      msPosition: number;
      cqgPosition: number;
      differ: number;
    }> = [];

    let totalTTTT_MS = 0;
    let totalPS_CQG = 0;

    if (files.tttt && files.cqgPs) {
      const msPositions = parseTTTTForRecon(files.tttt);
      const cqgPositions = parsePSForRecon(files.cqgPs, tradingDate, holidays);

      const msPosMap = new Map<string, number>();
      msPositions.forEach((p) => {
        const key = `${p.account}__${p.symbol}`.toUpperCase();
        msPosMap.set(key, (msPosMap.get(key) || 0) + p.position);
        totalTTTT_MS += p.position;
      });

      const cqgPosMap = new Map<string, number>();
      cqgPositions.forEach((p) => {
        const key = `${p.account}__${p.symbol}`.toUpperCase();
        cqgPosMap.set(key, (cqgPosMap.get(key) || 0) + p.position);
        totalPS_CQG += p.position;
      });

      const allKeys = Array.from(new Set([...msPosMap.keys(), ...cqgPosMap.keys()]));
      for (const k of allKeys) {
        const msPos = msPosMap.get(k) || 0;
        const cqgPos = cqgPosMap.get(k) || 0;
        const diff = Math.abs(msPos - cqgPos);
        if (diff > 0.0001) {
          const [acc, sym] = k.split('__');
          mismatchedPositions.push({
            account: acc,
            symbol: sym,
            msPosition: msPos,
            cqgPosition: cqgPos,
            differ: diff,
          });
        }
      }
    }

    const passed =
      differACM === 0 &&
      differCQG === 0 &&
      mismatchedTrades.length === 0 &&
      mismatchedPositions.length === 0;

    return {
      passed,
      totals: {
        totalACM_MS,
        totalACM_Straits,
        differACM,
        totalCQG_MS,
        totalCQG_FR,
        differCQG,
        totalTTTT_MS: files.tttt ? totalTTTT_MS : undefined,
        totalPS_CQG: files.cqgPs ? totalPS_CQG : undefined,
        differPositions:
          files.tttt && files.cqgPs ? Math.abs(totalTTTT_MS - totalPS_CQG) : undefined,
      },
      mismatchedTrades,
      mismatchedPositions,
      tradingDate,
      targetDate,
      summaryMessage: passed
        ? 'Đối chiếu Pre-EOD 3 bên KHỚP 100%'
        : `Phát hiện chênh lệch: Lệch CQG=${differCQG}, Lệch ACM=${differACM}, Lệch khớp lệnh=${mismatchedTrades.length}, Lệch vị thế=${mismatchedPositions.length}`,
    };
  }

  /**
   * Tự động quét file và đối chiếu Pre-EOD theo thư mục
   */
  async runAutoCheckPreEOD(
    tradingDate: Date,
    dataDir?: string,
  ): Promise<PreEodReconResult> {
    const dir = dataDir || path.join(process.cwd(), 'data', 'backup');
    const dsgdFile = findLatestFile(dir, /DSGD.*\.xlsx$/i);
    const acmFile = findLatestFile(dir, /(Straits|ACM).*\.csv$/i);
    const frFile = findLatestFile(dir, /^FR.*\.xlsx$/i);
    const ttttFile = findLatestFile(dir, /TTTT.*\.xlsx$/i);
    const psFile = findLatestFile(dir, /^PS.*\.xlsx$/i);

    if (!dsgdFile || !acmFile || !frFile) {
      throw new Error('Thiếu các file bắt buộc cho Pre-EOD (DSGD, Straits CSV, FR)');
    }

    const files = {
      dsgd: fs.readFileSync(dsgdFile),
      acmTrades: fs.readFileSync(acmFile),
      cqgFr: fs.readFileSync(frFile),
      tttt: ttttFile ? fs.readFileSync(ttttFile) : undefined,
      cqgPs: psFile ? fs.readFileSync(psFile) : undefined,
    };

    return this.checkPreEOD(files, path.basename(acmFile), tradingDate);
  }
}
