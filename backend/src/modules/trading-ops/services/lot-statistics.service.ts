import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseExcelBuffer,
  sumDsgdLot,
  sumFrLot,
  sumTtmLot,
  sumTtttLot,
  sumOpLot,
  sumPsLot,
  aggregateByProduct,
  aggregateByTvkd,
} from '../helpers/clearing-excel.helper';
import type { LotByProduct, LotByTvkd } from '../helpers/clearing-excel.helper';
export type { LotByProduct, LotByTvkd };

export interface LotSummary {
  dsgdTotal: number;
  frTotal: number;
  ttmTotal: number;
  opTotal: number;
  ttttTotal: number;
  psTotal: number;
  acmTotal: number;
  differKlgd: number;
  differTtm: number;
  differTttt: number;
}

export interface LotStatisticsResult {
  summary: LotSummary;
  byProduct: LotByProduct[];
  byTvkd: LotByTvkd[];
  passed: boolean;
  calculatedAt: Date;
}

@Injectable()
export class LotStatisticsService {
  private readonly logger = new Logger(LotStatisticsService.name);

  /**
   * Tính toán thống kê toàn diện số Lot giao dịch theo sản phẩm và TVKD
   */
  calculateLotStatistics(files: {
    dsgd?: Buffer;
    fr?: Buffer;
    ttm?: Buffer;
    tttt?: Buffer;
    op?: Buffer;
    ps?: Buffer;
    acm?: Buffer;
  }): LotStatisticsResult {
    const dsgdRows = files.dsgd ? parseExcelBuffer(files.dsgd) : [];
    const frRows = files.fr ? parseExcelBuffer(files.fr) : [];
    const ttmRows = files.ttm ? parseExcelBuffer(files.ttm) : [];
    const ttttRows = files.tttt ? parseExcelBuffer(files.tttt) : [];
    const opRows = files.op ? parseExcelBuffer(files.op) : [];
    const psRows = files.ps ? parseExcelBuffer(files.ps) : [];
    const acmRows = files.acm ? parseExcelBuffer(files.acm) : [];

    const dsgdTotal = sumDsgdLot(dsgdRows);
    const frTotal = sumFrLot(frRows);
    const ttmTotal = sumTtmLot(ttmRows);
    const opTotal = sumOpLot(opRows);
    const ttttTotal = sumTtttLot(ttttRows);
    const psTotal = sumPsLot(psRows);
    const acmTotal = sumDsgdLot(acmRows);

    const differKlgd = Math.abs(dsgdTotal - frTotal);
    const differTtm = Math.abs(ttmTotal - opTotal);
    const differTttt = Math.abs(ttttTotal - psTotal);

    const byProduct = aggregateByProduct(dsgdRows.length > 0 ? dsgdRows : frRows);
    const byTvkd = aggregateByTvkd(dsgdRows.length > 0 ? dsgdRows : frRows);

    const passed = differKlgd === 0 && differTtm === 0 && differTttt === 0;

    return {
      summary: {
        dsgdTotal,
        frTotal,
        ttmTotal,
        opTotal,
        ttttTotal,
        psTotal,
        acmTotal,
        differKlgd,
        differTtm,
        differTttt,
      },
      byProduct,
      byTvkd,
      passed,
      calculatedAt: new Date(),
    };
  }

  /**
   * Tự động quét file và tính toán thống kê Lot từ thư mục chỉ định
   */
  runAutoLotStatistics(folderPath?: string): LotStatisticsResult {
    const dir = folderPath || path.join(process.cwd(), 'data', 'backup');
    const findFile = (pattern: RegExp) => {
      if (!fs.existsSync(dir)) return null;
      const files = fs.readdirSync(dir);
      const match = files.find((f) => pattern.test(f));
      return match ? path.join(dir, match) : null;
    };

    const dsgdPath = findFile(/DSGD.*\.xlsx$/i);
    const frPath = findFile(/^FR.*\.xlsx$/i);
    const ttmPath = findFile(/TTM.*\.xlsx$/i);
    const opPath = findFile(/^OP.*\.xlsx$/i);
    const ttttPath = findFile(/TTTT.*\.xlsx$/i);
    const psPath = findFile(/^PS.*\.xlsx$/i);
    const acmPath = findFile(/(Straits|Nano).*\.(xlsx|csv)$/i);

    const files = {
      dsgd: dsgdPath ? fs.readFileSync(dsgdPath) : undefined,
      fr: frPath ? fs.readFileSync(frPath) : undefined,
      ttm: ttmPath ? fs.readFileSync(ttmPath) : undefined,
      op: opPath ? fs.readFileSync(opPath) : undefined,
      tttt: ttttPath ? fs.readFileSync(ttttPath) : undefined,
      ps: psPath ? fs.readFileSync(psPath) : undefined,
      acm: acmPath ? fs.readFileSync(acmPath) : undefined,
    };

    return this.calculateLotStatistics(files);
  }
}
