/**
 * ccp-classifier.helper.ts
 * Phân loại giao dịch CCP theo Mã TKGD (col[5])
 *
 * Hiện tại CCP chỉ có tài khoản ACM (-A).
 * Thiết kế future-ready để đón nhận Spread (-S), LME (L), Options khi CCP migrate.
 *
 * CCP DSGD Column Mapping (từ file thực tế):
 *   col[0]  = Ngày hệ thống
 *   col[1]  = Ngày phiên
 *   col[5]  = Mã TKGD        ← phân loại ACM/Spread/LME
 *   col[6]  = Mã HĐ          ← mã kỳ hạn (để tách tên HH)
 *   col[7]  = Mua/Bán        ← "Mua" | "Bán"
 *   col[8]  = Loại lệnh      ← MKT | LMT | STP | STL
 *   col[10] = KL khớp        ← số lot
 *   col[13] = Giá khớp TB    ← giá (ngoại tệ)
 *   col[21] = Mã thành viên  ← TVKD 3 ký tự
 */

import * as XLSX from 'xlsx';

export interface CcpDsgdRow {
  raw: any[];
  maTKGD: string;
  maTvkd: string;
  maHD: string;
  muaBan: string;    // 'Mua' | 'Bán'
  loaiLenh: string;  // MKT | LMT | STP | STL
  klKhop: number;
  giaKhop: number;   // đơn vị ngoại tệ
}

export interface CcpTtmRow {
  raw: any[];
  maTvkd: string;    // col[0]
  maTKGD: string;    // col[3]
  maHD: string;      // col[5]
  klMua: number;     // col[8]
  klBan: number;     // col[9]
  laiLoDuKien: number;     // col[13] (ngoại tệ)
  laiLoDuKienVnd: number;  // col[14]
}

export interface CcpTtttRow {
  raw: any[];
  maTvkd: string;    // col[0]
  maTKGD: string;    // col[3]
  maHD: string;      // col[7]
  laiLoThucTe: number;    // col[4] (ngoại tệ)
  laiLoThucTeVnd: number; // col[5]
  klMua: number;     // col[9]
  klBan: number;     // col[10]
}

// ─── Account Type Classifiers (future-ready) ─────────────────────────────────

/** ACM: mã TKGD kết thúc -A (ví dụ: 041P0686868-A) */
export function isCcpAcm(maTKGD: string): boolean {
  return /-A$/i.test(maTKGD.trim());
}

/** Spread: mã TKGD kết thúc -S */
export function isCcpSpread(maTKGD: string): boolean {
  return /-S$/i.test(maTKGD.trim());
}

/** LME: mã TKGD kết thúc L (không phải -L) */
export function isCcpLme(maTKGD: string): boolean {
  if (!maTKGD) return false;
  return maTKGD.trim().toUpperCase().endsWith('L');
}

/**
 * Bạc thỏi niêm yết: mã TKGD kết thúc -M (ví dụ: 003C1234567-M giao dịch SIV0926).
 *
 * NOTE THIẾT KẾ CHỜ (CHƯA GO-LIVE TRÊN CCP PROD):
 * Hiện tại môi trường CCP Production chưa có tài khoản -M (chỉ mới xuất hiện trong môi trường test/UAT).
 * MXV chưa có quyết định chính thức về việc:
 *   - Phương án 1 (Mặc định hiện tại): Gộp chung -M vào sổ Normal (ghi vào 2 file Thống kê thường, cột SIV).
 *   - Phương án 2 (Tương lai khi có chỉ đạo): Tách riêng -M thành 1 cặp file thống kê độc lập (Thong ke so lot/gia tri Bac thoi).
 * Code được thiết kế ở chế độ STANDBY: Phân loại sẵn bucket `bacThoi` trong `CcpDsgdClassified`
 * để khi MXV chính thức chốt phương án, chỉ cần cấu hình tách file mà không phải sửa lại kiến trúc bóc tách.
 */
export function isCcpBacThoi(maTKGD: string): boolean {
  return /-M$/i.test(maTKGD.trim());
}

/** Options: mã HĐ bắt đầu C. hoặc P. */
export function isCcpOptions(maHD: string): boolean {
  return /^[CP]\./i.test(maHD.trim());
}

/** Futures thường: tài khoản không có hậu tố hoặc kết thúc bằng -F (theo chuẩn chuyển đổi mới của CCP) */
export function isCcpFuture(maTKGD: string): boolean {
  if (!maTKGD) return false;
  const clean = maTKGD.trim().toUpperCase();
  if (clean.endsWith('-F')) return true; // Hậu tố mới của CCP
  // Tài khoản cơ sở không có hậu tố (-A, -S, -M, -L)
  return !isCcpAcm(clean) && !isCcpSpread(clean) && !isCcpLme(clean) && !isCcpBacThoi(clean);
}

// ─── Header Map & Dynamic Column Resolution ──────────────────────────────────

export type CcpHeaderMap = Record<string, number>;

export function normalizeHeaderKey(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function buildCcpHeaderMap(headerRow: any[]): CcpHeaderMap {
  const map: CcpHeaderMap = {};
  if (!Array.isArray(headerRow)) return map;
  for (let i = 0; i < headerRow.length; i++) {
    const key = normalizeHeaderKey(headerRow[i]);
    if (key && map[key] === undefined) {
      map[key] = i;
    }
  }
  return map;
}

export function resolveColIdx(
  headerMap: CcpHeaderMap | undefined,
  aliases: string[],
  defaultIdx: number,
): number {
  if (!headerMap) return defaultIdx;
  for (const alias of aliases) {
    const key = normalizeHeaderKey(alias);
    if (headerMap[key] !== undefined) {
      return headerMap[key];
    }
  }
  return defaultIdx;
}

// ─── Row Parsers ─────────────────────────────────────────────────────────────

function parseNum(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseStr(val: any): string {
  return val === null || val === undefined ? '' : String(val).trim();
}

function parseTvkd(val: any): string {
  const s = parseStr(val);
  return /^\d{1,2}$/.test(s) ? s.padStart(3, '0') : s;
}

/** Parse một row từ file DSGD CCP (array format, 25 cols) */
export function parseCcpDsgdRow(raw: any[], headerMap?: CcpHeaderMap): CcpDsgdRow {
  const idxTKGD = resolveColIdx(headerMap, ['matkgd', 'sotkgd', 'account', 'tk'], 5);
  const idxTVKD = resolveColIdx(headerMap, ['mathanhvien', 'matvkd', 'tvkd', 'member'], 21);
  const idxHD = resolveColIdx(headerMap, ['mahd', 'mahopdong', 'symbol', 'contract'], 6);
  const idxMB = resolveColIdx(headerMap, ['muaban', 'side', 'buysell'], 7);
  const idxType = resolveColIdx(headerMap, ['loailenh', 'ordertype', 'type'], 8);
  const idxKL = resolveColIdx(headerMap, ['klkhop', 'khoiluongkhop', 'volume', 'qty', 'matchedvolume'], 10);
  const idxGia = resolveColIdx(headerMap, ['giakhoptrungbinh', 'giakhoptb', 'giakhop', 'price', 'avgprice'], 13);

  return {
    raw,
    maTKGD: parseStr(raw[idxTKGD]),
    maTvkd: parseTvkd(raw[idxTVKD]),
    maHD: parseStr(raw[idxHD]),
    muaBan: parseStr(raw[idxMB]),     // "Mua" | "Bán"
    loaiLenh: parseStr(raw[idxType]),   // MKT | LMT | STP | STL
    klKhop: parseNum(raw[idxKL]),
    giaKhop: parseNum(raw[idxGia]),
  };
}

/** Parse một row từ file TTM CCP (24 cols) */
export function parseCcpTtmRow(raw: any[], headerMap?: CcpHeaderMap): CcpTtmRow {
  const idxTVKD = resolveColIdx(headerMap, ['mathanhvien', 'matvkd', 'tvkd', 'member'], 0);
  const idxTKGD = resolveColIdx(headerMap, ['matkgd', 'sotkgd', 'account', 'tk'], 3);
  const idxHD = resolveColIdx(headerMap, ['mahopdong', 'mahd', 'symbol', 'contract'], 5);
  const idxKLM = resolveColIdx(headerMap, ['khoiluongmua', 'klmua', 'buyvolume', 'buyqty'], 8);
  const idxKLB = resolveColIdx(headerMap, ['khoiluongban', 'klban', 'sellvolume', 'sellqty'], 9);
  const idxLL = resolveColIdx(headerMap, ['lailodukien', 'unrealizedpnl'], 13);
  const idxLLVnd = resolveColIdx(headerMap, ['lailodukienvnd', 'unrealizedpnlvnd'], 14);

  return {
    raw,
    maTvkd: parseTvkd(raw[idxTVKD]),
    maTKGD: parseStr(raw[idxTKGD]),
    maHD: parseStr(raw[idxHD]),
    klMua: parseNum(raw[idxKLM]),
    klBan: parseNum(raw[idxKLB]),
    laiLoDuKien: parseNum(raw[idxLL]),
    laiLoDuKienVnd: parseNum(raw[idxLLVnd]),
  };
}

/** Parse một row từ file TTTT CCP (31 cols) - hỗ trợ cả format TTTT và PNL_EXECUTED */
export function parseCcpTtttRow(raw: any[], headerMap?: CcpHeaderMap): CcpTtttRow {
  const idxTVKD = resolveColIdx(headerMap, ['mathanhvien', 'matvkd', 'tvkd', 'member'], 0);
  const idxTKGD = resolveColIdx(headerMap, ['matkgd', 'sotkgd', 'account', 'tk'], 3);
  const idxHD = resolveColIdx(headerMap, ['mahopdong', 'mahd', 'symbol', 'contract'], 7);
  const idxLL = resolveColIdx(headerMap, ['lailothucte', 'realizedpnl'], 4);
  const idxLLVnd = resolveColIdx(headerMap, ['lailothuctevnd', 'realizedpnlvnd'], 5);
  const idxKLM = resolveColIdx(headerMap, ['khoiluongmua', 'klmua', 'buyvolume', 'buyqty'], 9);
  const idxKLB = resolveColIdx(headerMap, ['khoiluongban', 'klban', 'sellvolume', 'sellqty'], 10);

  return {
    raw,
    maTvkd: parseTvkd(raw[idxTVKD]),
    maTKGD: parseStr(raw[idxTKGD]),
    maHD: parseStr(raw[idxHD]),
    laiLoThucTe: parseNum(raw[idxLL]),
    laiLoThucTeVnd: parseNum(raw[idxLLVnd]),
    klMua: parseNum(raw[idxKLM]),
    klBan: parseNum(raw[idxKLB]),
  };
}

// ─── Classified output ───────────────────────────────────────────────────────

export interface CcpDsgdClassified {
  all: CcpDsgdRow[];       // tất cả
  acm: CcpDsgdRow[];       // -A (ACM)
  spread: CcpDsgdRow[];    // -S (Spread)
  lme: CcpDsgdRow[];       // L / -L (LME)
  options: CcpDsgdRow[];   // mã HĐ bắt đầu C./P. (Options)
  bacThoi?: CcpDsgdRow[];  // -M (Bạc thỏi niêm yết)
  normal: CcpDsgdRow[];    // Sổ thường (Futures không đuôi / đuôi -F và Bạc thỏi niêm yết -M)
}

/**
 * Phân loại DSGD CCP theo Mã TKGD và Mã HĐ (Single-Pass O(N)).
 * Duyệt 1 vòng lặp duy nhất qua danh sách giao dịch, phân loại chính xác, hiệu năng cao.
 */
export function classifyCcpDsgd(rows: CcpDsgdRow[]): CcpDsgdClassified {
  const acm: CcpDsgdRow[] = [];
  const spread: CcpDsgdRow[] = [];
  const lme: CcpDsgdRow[] = [];
  const options: CcpDsgdRow[] = [];
  const bacThoi: CcpDsgdRow[] = [];
  const normal: CcpDsgdRow[] = [];

  for (const r of rows) {
    if (isCcpAcm(r.maTKGD)) {
      acm.push(r);
    } else if (isCcpBacThoi(r.maTKGD)) {
      // Bucket Bạc thỏi (-M) phân lập ở trạng thái Standby, TUYỆT ĐỐI không đưa vào normal
      bacThoi.push(r);
    } else if (isCcpOptions(r.maHD)) {
      options.push(r);
    } else if (isCcpSpread(r.maTKGD)) {
      spread.push(r);
    } else if (isCcpLme(r.maTKGD)) {
      lme.push(r);
    } else if (isCcpFuture(r.maTKGD)) {
      normal.push(r);
    }
  }

  return { all: rows, acm, spread, lme, options, bacThoi, normal };
}

// ─── Known Commodities Dictionary & HH Code Extraction ───────────────────────

/** Danh mục hàng hóa đã biết từ các sàn quốc tế và CoreCCP */
export const ALL_KNOWN_COMMODITIES: string[] = [
  // ACM Nano
  'SI5CO', 'PL1NY', 'CP2CO',
  // Options
  'C.ZCE', 'P.ZCE', 'C.ZSE', 'P.ZSE', 'C.ZWA', 'P.ZWA', 'C.KCE', 'P.KCE',
  'C.SBE', 'P.SBE', 'C.CLE', 'P.CLE', 'C.NGE', 'P.NGE', 'C.QO', 'P.QO',
  // LME
  'CAD', 'AHD', 'PBD', 'SND', 'ZDS', 'NID', 'SSC', 'SSR', 'LHC',
  // Spread & Normal Quốc Tế
  'ZLE', 'ZCE', 'ZSE', 'ZME', 'ZWA', 'KWE', 'ZRE', 'XW', 'XC', 'XB',
  'MZW', 'MZC', 'MZS', 'MZL', 'MZM', 'CCE', 'CTE', 'KCE', 'SBE', 'LRC',
  'QW', 'MPO', 'TRU', 'ZFT', 'ALI', 'CPE', 'MQC', 'MHG', 'SIE', 'MQI',
  'SIL', 'PLE', 'FEF', 'CLE', 'NGE', 'NQM', 'RBE', 'QO', 'QP', 'MCLE',
  'NQG', 'BM',
  // CoreCCP Hàng hóa Việt Nam & Nội địa
  'SVR3L', 'MXV_TEST1', 'TEST1234', 'HANU3', 'HANU2', 'HANU',
  'CXR1', 'CXR2', 'CXA1', 'CXA2', 'SIVE',
  'SIV', 'SRV', 'CHV', 'DTV', 'TDV', 'NEU', 'TLU', 'VNC', 'TSM', 'HDT',
  'BLG', 'DRX', 'APC', 'RB',
].sort((a, b) => b.length - a.length); // Ưu tiên match mã dài trước

/**
 * Tách mã Hàng Hóa (maHH) từ mã hợp đồng CCP.
 *
 * Chiến lược Dynamic 2 Tầng (Zero Hardcoded Length):
 *   Tầng 1 (Dictionary Match): Tra từ điển ALL_KNOWN_COMMODITIES xem mã HĐ có bắt đầu bằng mã HH nào.
 *   Tầng 2 (Regex Fallback):
 *     - Options: ^([CP]\.[A-Z0-9]+?)([FGHJKMNQUVXZ]|\d{2})(\d{2})
 *     - Đuôi tháng số: ^([A-Z0-9_]+?)(\d{2})(\d{2})$ (ví dụ: SIV0926 -> SIV, CXR10627 -> CXR1)
 *     - Đuôi tháng chữ: ^([A-Z0-9_]+?)([FGHJKMNQUVXZ])(\d{2})$ (ví dụ: SI5COZ26 -> SI5CO, ZLEZ26 -> ZLE)
 */
export function getMaHHFromCcpMaHD(maHD: string, _maTKGD?: string): string {
  if (!maHD) return '';
  const cleanHD = maHD.trim().toUpperCase();

  // Tầng 1: Khớp tiền tố với danh mục hàng hóa đã biết
  for (const comm of ALL_KNOWN_COMMODITIES) {
    if (cleanHD.startsWith(comm)) {
      const rest = cleanHD.substring(comm.length);
      if (/^([A-Z]\d{2}|\d{4}|\d{2})$/.test(rest) || rest.length === 0) {
        return comm;
      }
    }
  }

  // Tầng 2: Regex Heuristics
  // A. Options: C.ZCEZ26 hoặc P.ZCE0926
  const optMatch = cleanHD.match(/^([CP]\.[A-Z0-9]+?)([A-Z]|\d{2})\d{2}$/);
  if (optMatch) return optMatch[1];

  // B. Đuôi tháng số: 4 số cuối là MMYY (như SIV0926 -> SIV, CXR10627 -> CXR1)
  const numMonthMatch = cleanHD.match(/^([A-Z0-9_]+?)(?:0[1-9]|1[0-2])\d{2}$/);
  if (numMonthMatch) return numMonthMatch[1];

  // C. Đuôi tháng chữ quốc tế: 1 chữ cái tháng + 2 số năm (như SI5COZ26, ZCEZ26)
  const codeMonthMatch = cleanHD.match(/^([A-Z0-9_]+?)[FGHJKMNQUVXZ]\d{2}$/);
  if (codeMonthMatch) return codeMonthMatch[1];

  // Fallback an toàn
  if (cleanHD.length >= 5) return cleanHD.substring(0, 5);
  return cleanHD;
}

/**
 * Tra bảng thông số HH từ file Mã HĐ CCP.
 * Mỗi entry có: maHH, doCao (độ lớn HĐ), donVi, tienTe
 * Dùng để tính GTGD = KL × Giá × doCao × tyGia
 */
export interface CcpHhSpec {
  maHH: string;      // PL1NY, CP2CO, SI5CO, SIV, CXR1...
  tenHH: string;     // Bạch kim Nano, Đồng Nano, Bạc Nano, Bạc VN...
  doCao: number;     // Độ lớn hợp đồng
  donVi: string;     // Pound, kg, Lô...
  tienTe: string;    // USD, VND...
}

/**
 * Danh sách thông số kỹ thuật hàng hóa CoreCCP & ACM.
 */
export const CCP_HH_DEFAULTS: CcpHhSpec[] = [
  // ACM Nano (USD)
  { maHH: 'PL1NY', tenHH: 'Bạch kim Nano ACM', doCao: 5,    donVi: 'Pound', tienTe: 'USD' },
  { maHH: 'CP2CO', tenHH: 'Đồng Nano ACM',     doCao: 1000, donVi: 'Pound', tienTe: 'USD' },
  { maHH: 'SI5CO', tenHH: 'Bạc Nano ACM',      doCao: 100,  donVi: 'Pound', tienTe: 'USD' },
  // CoreCCP Hàng hóa Nội địa Việt Nam (VND)
  { maHH: 'SIV',   tenHH: 'Bạc Việt Nam',      doCao: 1,    donVi: 'Lô',   tienTe: 'VND' },
  { maHH: 'SIVE',  tenHH: 'Bạc Việt Nam E',    doCao: 1,    donVi: 'Lô',   tienTe: 'VND' },
  { maHH: 'CXR1',  tenHH: 'Cà phê Robusta loại 1', doCao: 1200, donVi: 'kg', tienTe: 'VND' },
  { maHH: 'CXR2',  tenHH: 'Cà phê Robusta loại 2', doCao: 1200, donVi: 'kg', tienTe: 'VND' },
  { maHH: 'CXA1',  tenHH: 'Cà phê Arabica loại 1', doCao: 1200, donVi: 'kg', tienTe: 'VND' },
  { maHH: 'CXA2',  tenHH: 'Cà phê Arabica loại 2', doCao: 1200, donVi: 'kg', tienTe: 'VND' },
  { maHH: 'SRV',   tenHH: 'Sầu riêng tươi',    doCao: 100,  donVi: 'kg',   tienTe: 'VND' },
  { maHH: 'CHV',   tenHH: 'Chuối Cavendish',   doCao: 1300, donVi: 'kg',   tienTe: 'VND' },
  { maHH: 'DTV',   tenHH: 'Hạt Điều thô',      doCao: 5000, donVi: 'kg',   tienTe: 'VND' },
  { maHH: 'TDV',   tenHH: 'Tiêu đen Việt Nam', doCao: 1000, donVi: 'kg',   tienTe: 'VND' },
  { maHH: 'SVR3L', tenHH: 'Cao su SVR 3L',     doCao: 5000, donVi: 'kg',   tienTe: 'VND' },
];

/** Tra nhanh spec HH theo mã (O(1)) */
export function getCcpHhSpec(maHH: string, overrides?: CcpHhSpec[]): CcpHhSpec | undefined {
  const list = overrides ?? CCP_HH_DEFAULTS;
  const upper = maHH.toUpperCase();
  return list.find((h) => h.maHH === upper);
}

/**
 * Trích xuất tỷ giá USD/VND thực tế từ báo cáo TTTT hoặc TTM của CoreCCP.
 * Bằng cách lấy tỷ lệ giữa Lãi lỗ thực tế VND / Ngoại tệ (USD) hoặc Lãi lỗ dự kiến VND / USD.
 */
export function extractExchangeRateFromCcpReports(
  ttttBuffer?: Buffer,
  ttmBuffer?: Buffer,
): { usdRate: number | null; source: string | null } {
  // 1. Ưu tiên kiểm tra TTTT (Lãi lỗ thực tế khớp tất toán)
  if (ttttBuffer) {
    try {
      const wb = XLSX.read(ttttBuffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (rows && rows.length > 1) {
        const headerRow = rows[0].map((h: any) => String(h || '').trim().toLowerCase());
        let colUsd = -1;
        let colVnd = -1;
        for (let j = 0; j < headerRow.length; j++) {
          const h = headerRow[j];
          if (h.includes('lãi lỗ thực tế') && h.includes('vnd')) {
            colVnd = j;
          } else if (h.includes('lãi lỗ thực tế')) {
            colUsd = j;
          }
        }
        if (colUsd !== -1 && colVnd !== -1) {
          for (let i = 1; i < rows.length; i++) {
            const usd = parseFloat(rows[i][colUsd]);
            const vnd = parseFloat(rows[i][colVnd]);
            if (!isNaN(usd) && !isNaN(vnd) && usd !== 0 && vnd !== 0) {
              const rate = Math.round(Math.abs(vnd / usd));
              if (rate >= 20000 && rate <= 35000) {
                return { usdRate: rate, source: 'TTTT (Lãi lỗ thực tế)' };
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Kiểm tra TTM (Lãi lỗ dự kiến vị thế mở) nếu TTTT không có
  if (ttmBuffer) {
    try {
      const wb = XLSX.read(ttmBuffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (rows && rows.length > 1) {
        const headerRow = rows[0].map((h: any) => String(h || '').trim().toLowerCase());
        let colUsd = -1;
        let colVnd = -1;
        for (let j = 0; j < headerRow.length; j++) {
          const h = headerRow[j];
          if (h.includes('lãi lỗ dự kiến') && h.includes('vnd')) {
            colVnd = j;
          } else if (h.includes('lãi lỗ dự kiến')) {
            colUsd = j;
          }
        }
        if (colUsd !== -1 && colVnd !== -1) {
          for (let i = 1; i < rows.length; i++) {
            const usd = parseFloat(rows[i][colUsd]);
            const vnd = parseFloat(rows[i][colVnd]);
            if (!isNaN(usd) && !isNaN(vnd) && usd !== 0 && vnd !== 0) {
              const rate = Math.round(Math.abs(vnd / usd));
              if (rate >= 20000 && rate <= 35000) {
                return { usdRate: rate, source: 'TTM (Lãi lỗ dự kiến)' };
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return { usdRate: null, source: null };
}

