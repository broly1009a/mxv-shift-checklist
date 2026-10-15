import * as XLSX from 'xlsx';

export interface ParsedRow {
  [key: string]: any;
}

export interface LotByProduct {
  maSP: string;
  klm: number;
  klb: number;
  total: number;
}

export interface LotByTvkd {
  tvkd: string;
  klm: number;
  klb: number;
  total: number;
}

export function toNum(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val).replace(/,/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function toStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

export function isAcm(maTKGD: string): boolean {
  if (!maTKGD) return false;
  return /-A[^-]*$/i.test(maTKGD) || /-A$/i.test(maTKGD);
}

export function isSpread(maTKGD: string): boolean {
  if (!maTKGD) return false;
  return /-S$/i.test(maTKGD);
}

export function isLme(maTKGD: string): boolean {
  if (!maTKGD) return false;
  const s = maTKGD.toString().trim().toUpperCase();
  return s.endsWith('L') || s.endsWith('-L');
}

export function isOptions(loaiHD: string): boolean {
  if (!loaiHD) return false;
  return /^[CP]\./i.test(loaiHD);
}

export function parseExcelBuffer(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(ws) as ParsedRow[];
}

export function sumDsgdLot(rows: ParsedRow[]): number {
  return rows.reduce((s, r) => {
    const lot = toNum(
      r['KL giao dịch'] ??
        r['KL'] ??
        r['Khối lượng'] ??
        r['col13'] ??
        r['col17'],
    );
    return s + lot;
  }, 0);
}

export function sumFrLot(rows: ParsedRow[]): number {
  return rows.reduce((s, r) => {
    return s + toNum(r['Qty'] ?? r['KL'] ?? r['col6'] ?? r['col9']);
  }, 0);
}

export function sumTtmLot(rows: ParsedRow[]): number {
  return rows.reduce((s, r) => {
    const klm = toNum(r['KLM'] ?? r['col14']);
    const klb = toNum(r['KLB'] ?? r['col15']);
    return s + klm + klb;
  }, 0);
}

export function sumTtttLot(rows: ParsedRow[]): number {
  return rows.reduce((s, r) => {
    return s + toNum(r['KL Mua'] ?? r['KL'] ?? r['Số lô'] ?? r['col16']);
  }, 0);
}

export function sumOpLot(rows: ParsedRow[]): number {
  return rows.reduce((s, r) => {
    const l = toNum(r['L'] ?? r['col7']);
    const sv = toNum(r['S'] ?? r['col8']);
    return s + l + sv;
  }, 0);
}

export function sumPsLot(rows: ParsedRow[]): number {
  return rows.reduce((s, r) => {
    const sv = toNum(r['S'] ?? r['col7'] ?? r['col8']);
    return s + sv;
  }, 0);
}

export function extractCcpBaseProduct(rawSymbol: string): string {
  const s = toStr(rawSymbol).trim().toUpperCase();
  if (!s || s === 'UNKNOWN') return 'UNKNOWN';

  // Nhóm ACM và CoreCCP đặc thù đã biết
  const known = ['SI5CO', 'CP2CO', 'PL1NY', 'GLD1', 'SIV', 'SIVE', 'SVR3L'];
  for (const k of known) {
    if (s.startsWith(k)) return k;
  }

  // Nhóm Quyền chọn (Options)
  if (/^[CP]\./.test(s)) {
    const m = s.match(/^([CP]\.[A-Z0-9]+?)([FGHJKMNQUVXZ]|\d{2})/);
    return m ? m[1] : s.split(/\s+/)[0];
  }

  // Fallback: cắt bỏ ký tự tháng chữ/số + 2 số năm cuối (ví dụ ZCEZ26 -> ZCE, CADU26 -> CAD, CXR10627 -> CXR1)
  const m = s.match(/^([A-Z0-9]+?)([FGHJKMNQUVXZ]\d{2}|\d{4})$/);
  return m ? m[1] : s;
}

export function aggregateByProduct(rows: ParsedRow[]): LotByProduct[] {
  const map = new Map<string, { klm: number; klb: number }>();

  for (const r of rows) {
    const rawSymbol = toStr(r['Mã SP'] ?? r['Mã HĐ'] ?? r['Mã Hợp Đồng'] ?? r['Mã hàng hóa'] ?? r['Symbol'] ?? 'UNKNOWN');
    const maSP = extractCcpBaseProduct(rawSymbol);
    const side = toStr(r['Mua/Bán'] ?? r['B/S'] ?? r['Side'] ?? '').toUpperCase();
    const qty = toNum(r['KL'] ?? r['Qty'] ?? r['KL giao dịch'] ?? r['KL khớp'] ?? 0);

    const cur = map.get(maSP) || { klm: 0, klb: 0 };
    if (side === 'B' || side === 'BUY' || side === 'MUA') {
      cur.klm += qty;
    } else {
      cur.klb += qty;
    }
    map.set(maSP, cur);
  }

  const result: LotByProduct[] = [];
  for (const [maSP, val] of map.entries()) {
    result.push({
      maSP,
      klm: val.klm,
      klb: val.klb,
      total: val.klm + val.klb,
    });
  }
  return result.sort((a, b) => b.total - a.total);
}

export function aggregateByTvkd(rows: ParsedRow[]): LotByTvkd[] {
  const map = new Map<string, { klm: number; klb: number }>();

  for (const r of rows) {
    const memberCode = toStr(r['Mã thành viên'] ?? r['TVKD'] ?? r['Mã TVKD'] ?? '');
    let tvkd = memberCode;
    if (!tvkd) {
      const maTKGD = toStr(r['Mã TKGD'] ?? r['Account'] ?? '');
      tvkd = maTKGD.length >= 3 ? maTKGD.substring(0, 3).toUpperCase() : 'OTHER';
    }
    if (/^\d{1,2}$/.test(tvkd)) {
      tvkd = tvkd.padStart(3, '0');
    }

    const side = toStr(r['Mua/Bán'] ?? r['B/S'] ?? r['Side'] ?? '').toUpperCase();
    const qty = toNum(r['KL'] ?? r['Qty'] ?? r['KL giao dịch'] ?? r['KL khớp'] ?? 0);

    const cur = map.get(tvkd) || { klm: 0, klb: 0 };
    if (side === 'B' || side === 'BUY' || side === 'MUA') {
      cur.klm += qty;
    } else {
      cur.klb += qty;
    }
    map.set(tvkd, cur);
  }

  const result: LotByTvkd[] = [];
  for (const [tvkd, val] of map.entries()) {
    result.push({
      tvkd,
      klm: val.klm,
      klb: val.klb,
      total: val.klm + val.klb,
    });
  }
  return result.sort((a, b) => b.total - a.total);
}
