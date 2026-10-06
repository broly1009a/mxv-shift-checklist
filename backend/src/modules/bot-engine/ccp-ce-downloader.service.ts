/**
 * ccp-ce-downloader.service.ts
 *
 * NestJS service port của Python ReportEngine (cpp-ce-downloader/services/report_engine.py).
 * Tải các báo cáo từ hệ thống VNCLEAR CoreCCP & CoreEX thông qua Playwright.
 *
 * Tuân thủ AGENTS.md Mục 8: Zero Hardcoding — mọi URL, credentials đều đọc từ DB.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser, BrowserContext, Page, Download } from 'playwright-core';
import { CcpExcelParser } from '../reconciliation/parsers';

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces & Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CcpReportConfig {
  /** Mã báo cáo ngắn: NR, DSL, DSGD, TTTT, LSGTT */
  code: string;
  /** Tên đầy đủ hiển thị trong log */
  name: string;
  /** Tên menu cha trên sidebar */
  parentMenu: string;
  /** Tên menu con cần click */
  childMenu: string;
  /** Nhóm con cấp 2 (ví dụ: Tra cứu tổng hợp) */
  subGroup?: string;
  /** Tab cần chuyển sang (ví dụ TTTT: "Lịch sử tất toán", DSL: "Lệnh đã khớp") */
  tabName?: string;
  /** URL trực tiếp đã học — dùng để điều hướng nhanh; rỗng = phải click menu */
  cachedUrl?: string;
  /** Bật/tắt báo cáo này trong lần chạy */
  enabled: boolean;
  /** Giai đoạn chạy: PRE_1620 (trước 16h20) | EOD (cuối ngày) | BOTH */
  phase?: 'PRE_1620' | 'EOD' | 'BOTH';
  /** Tên file xuất ra khớp chuẩn 100% với tên Maker lưu trữ */
  outputFileName?: string;
  /** Mã hàng hóa (dành riêng cho các file Hợp đồng) */
  commodityCode?: string;
}

export interface DateInterval {
  /** dd/mm/yyyy */
  startStr: string;
  /** dd/mm/yyyy */
  endStr: string;
  /** Nhãn tháng dạng mmyy, ví dụ: "0726" */
  mmyy: string;
}

export interface CcpFilterOptions {
  exchange?: string;
  memberCode?: string;
  acctNo?: string;
}

export interface CcpDownloadOptions extends CcpFilterOptions {
  headless?: boolean;
  overwriteExisting?: boolean;
  downloadTimeoutMs?: number;
  autoSplitOnTimeout?: boolean;
}

export interface CcpRunOptions {
  systemUrl: string;
  username: string;
  password: string;
  startDate: string;
  endDate: string;
  outputDir: string;
  reports?: CcpReportConfig[];
  options?: CcpDownloadOptions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Báo cáo mặc định — 25 BÁO CÁO THỰC TẾ HÀNG NGÀY CỦA MAKER (VNCLEAR CORECCP)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CCP_REPORTS: CcpReportConfig[] = [
  // ── 1. NHÓM LỆNH THƯỜNG (/ORDERS/ORDERBOOK) ────────────────────────────────
  {
    code: 'DSL',
    name: 'Danh sách lệnh (Tất cả)',
    parentMenu: 'Lệnh và vị thế',
    subGroup: 'Tra cứu tổng hợp',
    childMenu: 'Danh sách lệnh',
    tabName: 'Tất cả',
    cachedUrl: '/ORDERS/ORDERBOOK',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSL CCP.xlsx',
  },
  {
    code: 'DSLDK',
    name: 'Danh sách lệnh đã khớp',
    parentMenu: 'Lệnh và vị thế',
    subGroup: 'Tra cứu tổng hợp',
    childMenu: 'Danh sách lệnh',
    tabName: 'Lệnh đã khớp',
    cachedUrl: '/ORDERS/ORDERBOOK',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSLDK CCP.xlsx',
  },
  {
    code: 'DSLCK',
    name: 'Danh sách lệnh chờ khớp',
    parentMenu: 'Lệnh và vị thế',
    subGroup: 'Tra cứu tổng hợp',
    childMenu: 'Danh sách lệnh',
    tabName: 'Lệnh chờ khớp',
    cachedUrl: '/ORDERS/ORDERBOOK',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSLCK CCP.xlsx',
  },
  {
    code: 'DSLDH',
    name: 'Danh sách lệnh đã hủy',
    parentMenu: 'Lệnh và vị thế',
    subGroup: 'Tra cứu tổng hợp',
    childMenu: 'Danh sách lệnh',
    tabName: 'Lệnh đã hủy',
    cachedUrl: '/ORDERS/ORDERBOOK',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSLDH CCP.xlsx',
  },
  {
    code: 'DSGD',
    name: 'Danh sách giao dịch',
    parentMenu: 'Lệnh và vị thế',
    subGroup: 'Tra cứu tổng hợp',
    childMenu: 'Danh sách giao dịch',
    cachedUrl: '/ORDERS/ORDERMATCH_DETAIL',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSGD CCP.xlsx',
  },

  // ── 2. NHÓM LỆNH MARKET MAKER (/ORDERS/ORDERBOOK_MM) ───────────────────────
  {
    code: 'DSL_MM',
    name: 'Danh sách lệnh MM (Tất cả)',
    parentMenu: 'Lệnh và vị thế',
    subGroup: 'Tra cứu tổng hợp',
    childMenu: 'Danh sách lệnh MM',
    tabName: 'Tất cả',
    cachedUrl: '/ORDERS/ORDERBOOK_MM',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSL MM CCP.xlsx',
  },
  {
    code: 'DSLDK_MM',
    name: 'Danh sách lệnh MM đã khớp',
    parentMenu: 'Lệnh và vị thế',
    subGroup: 'Tra cứu tổng hợp',
    childMenu: 'Danh sách lệnh MM',
    tabName: 'Lệnh đã khớp',
    cachedUrl: '/ORDERS/ORDERBOOK_MM',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSLDK MM CCP.xlsx',
  },
  {
    code: 'DSLCK_MM',
    name: 'Danh sách lệnh MM chờ khớp',
    parentMenu: 'Lệnh và vị thế',
    subGroup: 'Tra cứu tổng hợp',
    childMenu: 'Danh sách lệnh MM',
    tabName: 'Lệnh chờ khớp',
    cachedUrl: '/ORDERS/ORDERBOOK_MM',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSLCK MM CCP.xlsx',
  },
  {
    code: 'DSLDH_MM',
    name: 'Danh sách lệnh MM đã hủy',
    parentMenu: 'Lệnh và vị thế',
    subGroup: 'Tra cứu tổng hợp',
    childMenu: 'Danh sách lệnh MM',
    tabName: 'Lệnh đã hủy',
    cachedUrl: '/ORDERS/ORDERBOOK_MM',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSLDH MM CCP.xlsx',
  },
  {
    code: 'DSGD_MM',
    name: 'Danh sách giao dịch MM',
    parentMenu: 'Lệnh và vị thế',
    subGroup: 'Tra cứu tổng hợp',
    childMenu: 'Danh sách giao dịch MM',
    cachedUrl: '/ORDERS/ORDERMATCH_DETAIL_MM',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSGD MM CCP.xlsx',
  },

  // ── 3. NHÓM VỊ THẾ & LÃI LỖ ───────────────────────────────────────────────
  {
    code: 'TTM_PRE1620',
    name: 'Trạng thái mở trước 16h20',
    parentMenu: 'Lệnh và vị thế',
    subGroup: 'Tra cứu tổng hợp',
    childMenu: 'Trạng thái mở',
    cachedUrl: '/ORDERS/OPEN_POSITION',
    enabled: true,
    phase: 'PRE_1620',
    outputFileName: 'TTM truoc 4h20.xlsx',
  },
  {
    code: 'TTM',
    name: 'Trạng thái mở cuối ngày',
    parentMenu: 'Lệnh và vị thế',
    subGroup: 'Tra cứu tổng hợp',
    childMenu: 'Trạng thái mở',
    cachedUrl: '/ORDERS/OPEN_POSITION',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'TTM CCP.xlsx',
  },
  {
    code: 'TTTT',
    name: 'Trạng thái tất toán vị thế',
    parentMenu: 'Lệnh và vị thế',
    subGroup: 'Tra cứu tổng hợp',
    childMenu: 'Trạng thái tất toán',
    tabName: 'Lịch sử tất toán',
    cachedUrl: '/ORDERS/PNL_EXECUTED',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'TTTT.xlsx',
  },

  // ── 4. NHÓM RỦI RO & KÝ QUỸ ───────────────────────────────────────────────
  {
    code: 'QLTTTKGD_PRE1620',
    name: 'Quản lý trạng thái TKGD trước 16h20',
    parentMenu: 'Quản lý rủi ro',
    childMenu: 'Quản lý trạng thái TKGD',
    tabName: 'Danh sách trạng thái TKGD',
    cachedUrl: '/RISKMNG/ACCTMARGIN_ALL',
    enabled: true,
    phase: 'PRE_1620',
    outputFileName: 'QL TT TKGD truoc 4h20.xlsx',
  },
  {
    code: 'QLTTTKGD',
    name: 'Quản lý trạng thái TKGD cuối ngày',
    parentMenu: 'Quản lý rủi ro',
    childMenu: 'Quản lý trạng thái TKGD',
    tabName: 'Danh sách trạng thái TKGD',
    cachedUrl: '/RISKMNG/ACCTMARGIN_ALL',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'QL TT TKGD.xlsx',
  },
  {
    code: 'QLTTTVKD',
    name: 'Quản lý trạng thái TKTVKD',
    parentMenu: 'Quản lý rủi ro',
    childMenu: 'Quản lý trạng thái TKGD',
    tabName: 'Danh sách trạng thái TKTVKD',
    cachedUrl: '/RISKMNG/ACCTMARGIN_ALL',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'QL TT TVKD.xlsx',
  },
  {
    code: 'DSQLKQ_TKGD',
    name: 'Quản lý ký quỹ TKGD',
    parentMenu: 'Quản lý rủi ro',
    childMenu: 'Quản lý trạng thái TKGD',
    tabName: 'Danh sách trạng thái TKGD',
    cachedUrl: '/RISKMNG/ACCTMARGIN_ALL',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSQLKQ TKGD.xlsx',
  },
  {
    code: 'DSQLKQ_TVKD',
    name: 'Quản lý ký quỹ TVKD',
    parentMenu: 'Quản lý rủi ro',
    childMenu: 'Quản lý trạng thái TKGD',
    tabName: 'Danh sách trạng thái TKTVKD',
    cachedUrl: '/RISKMNG/ACCTMARGIN_ALL',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSQLKQ TVKD.xlsx',
  },

  // ── 5. NHÓM TIỀN & TÀI KHOẢN ──────────────────────────────────────────────
  {
    code: 'NR',
    name: 'Lịch sử nộp rút tiền',
    parentMenu: 'Nộp rút tiền',
    childMenu: 'Lịch sử Nộp/ Rút tiền',
    cachedUrl: '/CASHTRANFER/CASHTRANFER_HIST',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'NR.xlsx',
  },
  {
    code: 'DSTKGD',
    name: 'Danh sách tài khoản giao dịch',
    parentMenu: 'Quản lý tài khoản',
    childMenu: 'Danh sách tài khoản giao dịch',
    cachedUrl: '/ACCOUNTMNG/ACCOUNTS_INFO',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSTKGD ACM.xlsx',
  },

  // ── 6. NHÓM HÀNG HÓA, HỢP ĐỒNG & GIÁ ──────────────────────────────────────
  {
    code: 'GTT',
    name: 'Quản lý giá thanh toán',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý giá thanh toán',
    cachedUrl: '/PRODUCT/SETTLEMENT',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'GTT CCP.xlsx',
  },
  {
    code: 'HH',
    name: 'Danh mục hàng hóa',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý hàng hóa, hợp đồng',
    cachedUrl: '/PRODUCT/COMMODITY',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'HH.xlsx',
  },
  {
    code: 'HD',
    name: 'Hợp đồng hàng hóa',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý hàng hóa, hợp đồng',
    cachedUrl: '/PRODUCT/COMMODITY',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'HĐ *.xlsx',
  },
  // ── 7. NHÓM THAM SỐ HỆ THỐNG (/SYSCONFIGMNG/CURRENCYEXCHANGERATE) ─────────
  {
    code: 'TYGIA',
    name: 'Tỷ giá nguyên tệ',
    parentMenu: 'Tham số hệ thống',
    childMenu: 'Tỷ giá nguyên tệ',
    cachedUrl: '/SYSCONFIGMNG/CURRENCYEXCHANGERATE',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'Tỷ giá CCP.xlsx',
  },

  // ── Legacy Contract Aliases ───────────────────────────────────────────────
  {
    code: 'HD_CP2CO',
    name: 'Hợp đồng Đồng Nano ACM (CP2CO)',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý hàng hóa, hợp đồng',
    commodityCode: 'CP2CO',
    cachedUrl: '/PRODUCT/COMMODITY',
    enabled: false,
    phase: 'EOD',
    outputFileName: 'HĐ CP2CO.xlsx',
  },
  {
    code: 'HD_PL1NY',
    name: 'Hợp đồng Bạch kim Nano ACM (PL1NY)',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý hàng hóa, hợp đồng',
    commodityCode: 'PL1NY',
    cachedUrl: '/PRODUCT/COMMODITY',
    enabled: false,
    phase: 'EOD',
    outputFileName: 'HĐ PL1NY.xlsx',
  },
  {
    code: 'HD_SI5CO',
    name: 'Hợp đồng Bạc Nano ACM (SI5CO)',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý hàng hóa, hợp đồng',
    commodityCode: 'SI5CO',
    cachedUrl: '/PRODUCT/COMMODITY',
    enabled: false,
    phase: 'EOD',
    outputFileName: 'HĐ SI5CO.xlsx',
  },

  // ── Legacy Aliases ────────────────────────────────────────────────────────
  {
    code: 'LSGTT',
    name: 'Lịch sử giá thanh toán',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý lịch sử giá thanh toán',
    cachedUrl: '/PRODUCT/SETTLEMENT_HIST',
    enabled: false,
    phase: 'EOD',
    outputFileName: 'LSGTT.xlsx',
  },
  {
    code: 'EOD',
    name: 'Kết quả EOD (Vận hành)',
    parentMenu: 'Vận hành',
    childMenu: 'Kết quả EOD',
    cachedUrl: '/EOD/ACCTMARGIN_HIST',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'EOD.xlsx',
  },
];

export const DEFAULT_CE_REPORTS: CcpReportConfig[] = [
  {
    code: 'DSGD',
    name: 'Danh sách giao dịch (CE)',
    parentMenu: 'Quản lý sổ lệnh',
    childMenu: 'Lịch sử khớp lệnh liên thông chi tiết',
    cachedUrl: '/ORDERS/ORDERMATCH_DETAIL_ACM',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSGD ACM CE.xlsx',
  },
  {
    code: 'DSL',
    name: 'Sổ lệnh (CE)',
    parentMenu: 'Quản lý sổ lệnh',
    childMenu: 'Lịch sử sổ lệnh liên thông',
    cachedUrl: '/ORDERS/ORDERBOOK_ALL_ACM',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSL ACM CE.xlsx',
  },
  {
    code: 'DSLCK',
    name: 'Lệnh chờ khớp (CE)',
    parentMenu: 'Quản lý sổ lệnh',
    childMenu: 'Danh sách lệnh liên thông ACM',
    tabName: 'Lệnh chờ khớp',
    cachedUrl: '/ORDERS/ORDERBOOK_ACM',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSLCK ACM CE.xlsx',
  },
  {
    code: 'DSLDK',
    name: 'Lệnh điều kiện (CE)',
    parentMenu: 'Quản lý sổ lệnh',
    childMenu: 'Danh sách lệnh liên thông ACM',
    tabName: 'Lệnh đã khớp',
    cachedUrl: '/ORDERS/ORDERBOOK_ACM',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSLDK ACM CE.xlsx',
  },
  {
    code: 'DSLH',
    name: 'Lệnh hủy (CE)',
    parentMenu: 'Quản lý sổ lệnh',
    childMenu: 'Danh sách lệnh liên thông ACM',
    tabName: 'Lệnh đã hủy',
    cachedUrl: '/ORDERS/ORDERBOOK_ACM',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'DSLH ACM CE.xlsx',
  },
  {
    code: 'GTT',
    name: 'Giá thanh toán (CE)',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý giá thanh toán',
    cachedUrl: '/PRODUCT/SETTLEMENT',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'GTT ACM.xlsx',
  },
  {
    code: 'HH',
    name: 'Hàng hóa (CE)',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý hàng hóa, hợp đồng',
    cachedUrl: '/PRODUCT/COMMODITY',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'HH ACM.xlsx',
  },
  {
    code: 'HD',
    name: 'Hợp đồng chi tiết (CE)',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý hàng hóa, hợp đồng',
    cachedUrl: '/PRODUCT/COMMODITY',
    enabled: true,
    phase: 'EOD',
    outputFileName: 'HĐ *.xlsx',
  },

  // ── Legacy Contract Aliases (Tương thích ngược, tắt mặc định giống CCP) ────
  {
    code: 'HD_CP2CO',
    name: 'Hợp đồng CP2CO (Đồng Nano)',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý hàng hóa, hợp đồng',
    commodityCode: 'CP2CO',
    cachedUrl: '/PRODUCT/COMMODITY',
    enabled: false,
    phase: 'EOD',
    outputFileName: 'HĐ CP2CO.xlsx',
  },
  {
    code: 'HD_PL1NY',
    name: 'Hợp đồng PL1NY (Bạch kim Nano)',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý hàng hóa, hợp đồng',
    commodityCode: 'PL1NY',
    cachedUrl: '/PRODUCT/COMMODITY',
    enabled: false,
    phase: 'EOD',
    outputFileName: 'HĐ PL1NY.xlsx',
  },
  {
    code: 'HD_SI5CO',
    name: 'Hợp đồng SI5CO (Bạc Nano)',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý hàng hóa, hợp đồng',
    commodityCode: 'SI5CO',
    cachedUrl: '/PRODUCT/COMMODITY',
    enabled: false,
    phase: 'EOD',
    outputFileName: 'HĐ SI5CO.xlsx',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Date Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Chuyển dd/mm/yyyy hoặc yyyy-mm-dd → Date object */
function parseDmY(s: string): Date {
  if (!s) return new Date();
  if (s.includes('-')) {
    const parts = s.split('-').map(Number);
    if (parts[0] > 1000) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  if (s.includes('/')) {
    const parts = s.split('/').map(Number);
    if (parts[0] > 1000) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return new Date(s);
}

/** Format Date → dd/mm/yyyy */
function formatDmY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Lấy ngày hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh) */
export function getTodayVnDate(): { y: number; m: number; d: number; ymd: string; dmy: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const ymd = formatter.format(now);
  const [y, m, d] = ymd.split('-').map(Number);
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return {
    y,
    m,
    d,
    ymd: `${y}-${mm}-${dd}`,
    dmy: `${dd}/${mm}/${y}`,
  };
}

/** Chuẩn hóa chuỗi ngày (YYYY-MM-DD, DD/MM/YYYY, DD.MM.YYYY, DD.MM) sang YYYY-MM-DD */
export function normalizeDateToYmd(s?: string): string | null {
  if (!s || !s.trim()) return null;
  const clean = s.trim().split('T')[0];
  const sep = clean.includes('-') ? '-' : clean.includes('/') ? '/' : clean.includes('.') ? '.' : null;
  if (!sep) return null;
  const parts = clean.split(sep).map(Number);
  if (parts.length === 3) {
    if (parts[0] > 1000) {
      return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    }
    return `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
  }
  if (parts.length === 2) {
    const curYear = getTodayVnDate().y;
    return `${curYear}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
  }
  return null;
}

/** Kiểm tra 1 chuỗi ngày có phải là ngày hôm nay hay không */
export function isTodayDate(dateStr?: string): boolean {
  if (!dateStr || !dateStr.trim()) return true;
  const ymd = normalizeDateToYmd(dateStr);
  if (!ymd) return false;
  return ymd === getTodayVnDate().ymd;
}

/** Kiểm tra khoảng ngày [startDate, endDate] có phải là tải cho duy nhất ngày hôm nay hay không */
export function isTodayDateRange(startDate?: string, endDate?: string): boolean {
  return isTodayDate(startDate) && isTodayDate(endDate);
}

/** Kiểm tra 1 chuỗi ngày có phải là phiên hôm nay hoặc phiên giao dịch đêm đang chạy hay không */
export function isTodayOrCurrentSession(dateStr?: string): boolean {
  if (!dateStr || !dateStr.trim()) return true;
  const ymd = normalizeDateToYmd(dateStr);
  if (!ymd) return false;
  const today = getTodayVnDate();
  if (ymd === today.ymd) return true;

  // Nếu đang trong khung giờ đêm / rạng sáng (00:00 - 07:00 VN),
  // phiên T-1 vẫn đang là phiên giao dịch realtime hoạt động trên sàn và CoreCCP
  const now = new Date();
  const vnHour = (now.getUTCHours() + 7) % 24;
  if (vnHour < 7) {
    const yesterdayVn = new Date(now.getTime() + 7 * 3600 * 1000 - 24 * 3600 * 1000);
    const yYmd = `${yesterdayVn.getUTCFullYear()}-${String(yesterdayVn.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterdayVn.getUTCDate()).padStart(2, '0')}`;
    if (ymd === yYmd) return true;
  }
  return false;
}

/** Sinh danh sách các khoảng ngày theo tháng trong khoảng startDate → endDate */
export function generateMonthlyIntervals(startDate: string, endDate: string): DateInterval[] {
  const intervals: DateInterval[] = [];
  const start = parseDmY(startDate);
  const end = parseDmY(endDate);

  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const monthStart = new Date(Math.max(cur.getTime(), start.getTime()));
    const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const monthEnd = new Date(Math.min(lastDay.getTime(), end.getTime()));

    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const yy = String(cur.getFullYear()).slice(-2);

    intervals.push({
      startStr: formatDmY(monthStart),
      endStr: formatDmY(monthEnd),
      mmyy: `${mm}${yy}`,
    });

    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return intervals;
}

/**
 * Chia đôi khoảng ngày. Trả về null nếu là 1 ngày đơn.
 */
export function splitInterval(
  startStr: string,
  endStr: string,
): [DateInterval, DateInterval] | null {
  const start = parseDmY(startStr);
  const end = parseDmY(endStr);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (diffDays < 1) return null;

  const midMs = start.getTime() + Math.floor(diffDays / 2) * 86_400_000;
  const mid = new Date(midMs);
  const midPlus1 = new Date(midMs + 86_400_000);

  const buildInterval = (s: Date, e: Date): DateInterval => {
    const mm = String(s.getMonth() + 1).padStart(2, '0');
    const yy = String(s.getFullYear()).slice(-2);
    return { startStr: formatDmY(s), endStr: formatDmY(e), mmyy: `${mm}${yy}` };
  };

  return [buildInterval(start, mid), buildInterval(midPlus1, end)];
}

/** Merge nhiều file CSV: giữ header dòng 1 của file đầu, bỏ header các file tiếp theo */
export function mergeCsvFiles(srcPaths: string[], destPath: string): boolean {
  try {
    let headerWritten = false;
    const out = fs.createWriteStream(destPath, { encoding: 'utf8' });
    for (const src of srcPaths) {
      if (!fs.existsSync(src) || fs.statSync(src).size === 0) continue;
      const content = fs.readFileSync(src, 'utf8');
      const lines = content.split('\n');
      if (!headerWritten) {
        out.write(content);
        headerWritten = true;
      } else {
        // Bỏ dòng header (dòng 0) của các file sau
        out.write('\n' + lines.slice(1).join('\n'));
      }
    }
    out.end();
    return fs.existsSync(destPath) && fs.statSync(destPath).size > 0;
  } catch (e) {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class CcpCeDownloaderService {
  private readonly logger = new Logger(CcpCeDownloaderService.name);

  /**
   * Retrieves the Chrome/Chromium executable path. Searches local bundled Chrome first, then Edge/Chrome installed on system.
   */
  private getChromeExecutablePath(): string | null {
    if (process.platform === 'win32') {
      const candidates = [
        path.join(process.cwd(), '..', 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
        path.join(process.cwd(), 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          this.logger.log(`Using Chrome/Edge binary at: ${p}`);
          return p;
        }
      }
    }
    return null;
  }

  // ── Private log helper (ghi vào Logger + callback ngoài nếu có) ──────────
  private log(msg: string, logCallback?: (m: string) => void): void {
    this.logger.log(msg);
    if (logCallback) logCallback(msg);
  }

  /**
   * Ghép cachedUrl tương đối với domain của hệ thống đang kết nối
   */
  resolveReportUrl(cachedUrl: string, systemUrl: string): string {
    if (!cachedUrl) return '';
    if (cachedUrl.startsWith('http://') || cachedUrl.startsWith('https://')) {
      return cachedUrl;
    }
    try {
      let base = systemUrl;
      if (!base.startsWith('http://') && !base.startsWith('https://')) {
        base = 'https://' + base;
      }
      const origin = new URL(base).origin;
      return `${origin}${cachedUrl.startsWith('/') ? '' : '/'}${cachedUrl}`;
    } catch {
      return '';
    }
  }

  /** Nhận diện hệ thống CoreEX dựa trên URL */
  isCoreExSystem(systemUrl: string): boolean {
    return systemUrl.toLowerCase().includes('coreexchange');
  }

  // ── AUTHENTICATION ────────────────────────────────────────────────────────

  /**
   * Đăng nhập vào CoreCCP / CoreEX.
   * Sau khi thành công, page.url() sẽ không còn chứa "/login".
   */
  async loginVnclear(
    page: Page,
    systemUrl: string,
    username: string,
    password: string,
    logCb?: (m: string) => void,
  ): Promise<void> {
    this.log(`Dang nhap '${username}' vao ${systemUrl} ...`, logCb);
    await page.goto(systemUrl, { waitUntil: 'networkidle', timeout: 30_000 });

    await page.fill(
      "input[name='username'], input[placeholder*='ten dang nhap'], input[placeholder*='đăng nhập'], input[type='text']",
      username,
    );
    await page.fill(
      "input[name='password'], input[placeholder*='mat khau'], input[placeholder*='mật khẩu'], input[type='password']",
      password,
    );
    await page.click("button[type='submit'], button:has-text('Đăng nhập')");
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1_000);

    // Chờ trình duyệt hoàn tất trao đổi Token SSO: thoát khỏi cả /login và /validate_code?code=...
    try {
      await page.waitForURL(
        (url) => !url.href.includes('validate_code') && !url.pathname.toLowerCase().includes('/login'),
        { timeout: 25_000 },
      );
    } catch { }

    const curUrl = page.url().toLowerCase();
    if (curUrl.includes('/login') || curUrl.includes('validate_code')) {
      const errLoc = page.locator(
        "//*[contains(@class,'MuiAlert-message') or contains(text(),'không chính xác') or contains(text(),'khóa')]",
      );
      let errText = 'Tên đăng nhập hoặc mật khẩu không đúng hoặc máy chủ SSO VNCLEAR phản hồi chậm.';
      try {
        if (await errLoc.first().isVisible({ timeout: 1_500 })) {
          errText = (await errLoc.first().textContent()) ?? errText;
        }
      } catch { }
      throw new Error(`Đăng nhập thất bại: ${errText.trim()} (URL hiện tại: ${page.url()})`);
    }
    this.log(`Dang nhap thanh cong. URL sau dang nhap: ${page.url()}`, logCb);
  }

  // ── BACKDROP & SIDEBAR ────────────────────────────────────────────────────

  /**
   * Đóng các popup backdrop MUI che phủ giao diện nếu có.
   * Port 1:1 từ BasePage.dismiss_modal_backdrop (base_page.py:L13-21).
   */
  private async dismissModalBackdrop(page: Page): Promise<void> {
    try {
      const backdrop = page
        .locator(
          "xpath=//div[contains(@class, 'MuiBackdrop-root') and not(contains(@class, 'MuiBackdrop-invisible'))]",
        )
        .first();
      if (await backdrop.isVisible({ timeout: 500 })) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    } catch { }
  }

  /**
   * Đảm bảo sidebar đã được mở rộng.
   * Port 1:1 từ BasePage.ensure_sidebar_expanded (base_page.py:L23-43).
   */
  private async ensureSidebarExpanded(page: Page): Promise<void> {
    await this.dismissModalBackdrop(page);
    try {
      const sidebarText = page
        .locator("xpath=//span[text()='Trang chủ'] | //input[contains(@placeholder, 'Tìm kiếm')]")
        .first();
      if (await sidebarText.isVisible({ timeout: 1_000 })) return;

      const toggleBtn = page
        .locator(
          "xpath=//div[contains(@class, 'mui-1rihtzt')] | //div[contains(@class, 'mui-12t1bub')] | //svg[@data-testid='ChevronRightIcon'] | //button[contains(@aria-label, 'open drawer') or contains(@aria-label, 'Mở rộng')]",
        )
        .first();
      if (await toggleBtn.isVisible({ timeout: 1_500 })) {
        await toggleBtn.click({ force: true });
        await page.waitForTimeout(1_000);
      }
    } catch { }
  }

  // ── TABLE LOADING ─────────────────────────────────────────────────────────

  /**
   * Chờ bảng dữ liệu load xong (không còn spinner/skeleton).
   * Ổn định 2 tick 300ms liên tiếp mới return.
   * Port 1:1 từ BaseReportPage.wait_for_table_loading_complete (base_report_page.py:L10-58).
   */
  private async waitForTableLoadingComplete(
    page: Page,
    maxTimeoutMs = 60_000,
  ): Promise<boolean> {
    const spinnerSel =
      "xpath=//*[contains(@class, 'MuiCircularProgress-root') " +
      "or contains(@class, 'MuiLinearProgress-root') " +
      "or contains(@class, 'MuiBackdrop-root') " +
      "or @role='progressbar' " +
      "or contains(@id, 'mrt-progress') " +
      "or contains(@class, 'MuiSkeleton-root')]";

    await page.waitForTimeout(800);

    const startTime = Date.now();
    const maxSec = maxTimeoutMs / 1000.0;
    let stableCount = 0;

    while ((Date.now() - startTime) / 1000.0 < maxSec) {
      // Kiểm tra sớm nếu bảng đã hiện chữ "Không có dữ liệu" -> dừng chờ ngay lập tức
      try {
        const noData = page.locator(
          "xpath=//tbody//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data') or contains(text(), 'No records')] | //*[text()='Không có dữ liệu']",
        ).first();
        if (await noData.isVisible({ timeout: 150 })) {
          return true;
        }
      } catch { }

      // Đếm spinner THỰC SỰ HIỂN THỊ (is_visible)
      const spinners = await page.locator(spinnerSel).all();
      let visibleCount = 0;
      for (const s of spinners) {
        try {
          if (await s.isVisible()) visibleCount++;
        } catch { }
      }

      if (visibleCount === 0) {
        stableCount++;
        if (stableCount >= 2) return true;
      } else {
        stableCount = 0;
      }
      await page.waitForTimeout(300);
    }
    return false;
  }

  // ── NAVIGATION ────────────────────────────────────────────────────────────

  /**
   * Điều hướng đến trang báo cáo.
   * Port 1:1 từ CoreCCPPage.navigate_to_report (core_ccp_page.py:L35-128).
   * Ưu tiên 1: cachedUrl (direct navigation).
   * Ưu tiên 2: Click menu sidebar có danh sách ứng viên (candidates).
   */
  async navigateToReport(
    page: Page,
    report: CcpReportConfig,
    systemUrl: string,
    logCb?: (m: string) => void,
  ): Promise<string> {
    // 0. Phòng vệ: Nếu trình duyệt vẫn đang kẹt ở validate_code, chờ cho SSO hoàn tất
    if (page.url().includes('validate_code')) {
      this.log(`[Nav] Trình duyệt đang ở chặng SSO validate_code, chờ chuyển hướng...`, logCb);
      try {
        await page.waitForURL((url) => !url.href.includes('validate_code'), { timeout: 15_000 });
      } catch {
        throw new Error(`[Fail-Fast] Không thể điều hướng đến ${report.name}: SSO VNCLEAR vẫn đang kẹt tại ${page.url()}`);
      }
    }

    // Thử direct URL
    const targetUrl = this.resolveReportUrl(report.cachedUrl || '', systemUrl);
    if (targetUrl) {
      try {
        this.log(`[Nav] Direct URL den trang bao cao: ${targetUrl}`, logCb);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        await page.waitForTimeout(1000);
        await this.dismissModalBackdrop(page);

        // Chờ nếu direct URL bị redirect tạm sang validate_code
        if (page.url().includes('validate_code')) {
          await page.waitForURL((url) => !url.href.includes('validate_code'), { timeout: 10_000 }).catch(() => {});
        }

        const checkElem = page.locator(
          "xpath=//button[contains(., 'Tìm kiếm')] | //button[contains(., 'Kết xuất')] | //input[contains(@class, 'MuiPickersInputBase-input')]",
        ).first();
        if (await checkElem.isVisible({ timeout: 3_000 })) {
          const directLearnedUrl = page.url();
          if (
            !directLearnedUrl.includes('validate_code') &&
            !directLearnedUrl.includes('/login') &&
            !directLearnedUrl.includes('/DASHBOARD')
          ) {
            this.log(`[Nav] Direct URL thành công -> URL: ${directLearnedUrl}`, logCb);
            return directLearnedUrl;
          }
        } else {
          this.log(`[Nav] Direct URL chua hien bang, fallback sang click Menu...`, logCb);
        }
      } catch {
        this.log(`[Nav] Direct URL that bai, chuyen sang click menu...`, logCb);
      }
    }

    // Click menu sidebar (Chuẩn Candidates từ core_ccp_page.py:L60-125)
    try {
      await this.ensureSidebarExpanded(page);

      const parentCandidates = [report.parentMenu];
      if (report.parentMenu === 'Quản lý tiền' || report.parentMenu === 'Nộp rút tiền') {
        parentCandidates.push('Quản lý tiền', 'Nộp rút tiền');
      } else if (report.parentMenu === 'Tham số hệ thống' || report.parentMenu === 'Quản lý tham số') {
        parentCandidates.push('Tham số hệ thống', 'Quản lý tham số');
      }

      let parentElem: ReturnType<Page['locator']> | null = null;
      for (const pCand of parentCandidates) {
        if (!pCand) continue;
        const elem = page.locator(`xpath=//span[text()='${pCand}'] | //span[contains(text(), '${pCand}')]`).first();
        if (await elem.isVisible({ timeout: 1_500 })) {
          parentElem = elem;
          break;
        }
      }

      if (parentElem) {
        await parentElem.click({ force: true });
        await page.waitForTimeout(800);
      }

      const childCandidates = [report.childMenu];
      if (report.childMenu === 'Lịch sử nộp rút tiền' || report.childMenu === 'Lịch sử Nộp/ Rút tiền') {
        childCandidates.push('Lịch sử nộp rút tiền', 'Lịch sử Nộp/ Rút tiền');
      } else if (report.childMenu === 'Lịch sử lệnh' || report.childMenu === 'Danh sách lệnh') {
        childCandidates.push('Lịch sử lệnh', 'Danh sách lệnh');
      } else if (report.childMenu === 'Danh sách giao dịch' || report.childMenu === 'Lịch sử giao dịch') {
        childCandidates.push('Danh sách giao dịch', 'Danh sách giao dịch MM', 'Lịch sử giao dịch');
      } else if (report.childMenu === 'Trạng thái mở' || report.childMenu === 'Vị thế mở') {
        childCandidates.push('Trạng thái mở', 'Vị thế mở', 'Danh sách trạng thái mở');
      } else if (report.childMenu === 'Tỷ giá nguyên tệ' || report.childMenu === 'Tỷ giá tiền tệ') {
        childCandidates.push('Tỷ giá nguyên tệ', 'Tỷ giá tiền tệ');
      }

      let childElem: ReturnType<Page['locator']> | null = null;
      for (const cand of childCandidates) {
        if (!cand) continue;
        const elem = page.locator(`xpath=//span[text()='${cand}'] | //span[contains(text(), '${cand}')]`).first();
        if (await elem.isVisible({ timeout: 1_500 })) {
          childElem = elem;
          break;
        }
      }

      if (childElem) {
        await childElem.click({ force: true });
        await page.waitForTimeout(2000);
      } else if (parentElem) {
        await parentElem.click({ force: true });
        await page.waitForTimeout(800);
        for (const cand of childCandidates) {
          if (!cand) continue;
          const elem = page.locator(`xpath=//span[text()='${cand}'] | //span[contains(text(), '${cand}')]`).first();
          if (await elem.isVisible({ timeout: 1_500 })) {
            await elem.click({ force: true });
            await page.waitForTimeout(2000);
            break;
          }
        }
      }

      // Đợi bảng hoặc nút Tìm kiếm/Kết xuất của trang báo cáo xuất hiện để đảm bảo trang đã load
      const reportReady = page.locator(
        "xpath=//button[contains(., 'Tìm kiếm')] | //button[contains(., 'Kết xuất')] | //input[contains(@class, 'MuiPickersInputBase-input')]",
      ).first();
      try {
        await reportReady.waitFor({ state: 'visible', timeout: 5_000 });
      } catch { }

      const learnedUrl = page.url();
      if (
        learnedUrl.includes('/DASHBOARD') ||
        learnedUrl.endsWith('.vn/') ||
        learnedUrl.endsWith('.vn') ||
        learnedUrl.includes('validate_code') ||
        learnedUrl.includes('/login')
      ) {
        throw new Error(`[Fail-Fast] Không thể điều hướng đến báo cáo ${report.name} (${report.code}). Trình duyệt vẫn đang ở URL không hợp lệ (${learnedUrl})!`);
      }
      this.log(`[Nav] Điều hướng thành công -> URL: ${learnedUrl}`, logCb);
      return learnedUrl;
    } catch (e: any) {
      this.log(`[Nav] Lỗi điều hướng đến ${report.childMenu}: ${e?.message}`, logCb);
      throw e;
    }
  }

  // ── FILTERING ─────────────────────────────────────────────────────────────

  /**
   * Đặt bộ lọc ngày và các filter nghiệp vụ, rồi nhấn Tìm kiếm.
   * Port 1:1 từ BaseReportPage.set_date_range_and_search (base_report_page.py:L59-231).
   * Xử lý đặc biệt: TTTT (click tab), DSGD (xóa "Ngày hệ thống").
   * Trả về 'NO_DATA' nếu bảng hiển thị "Không có dữ liệu" ngay sau khi tìm kiếm.
   */
  async setDateRangeAndSearch(
    page: Page,
    report: CcpReportConfig,
    startDate: string,
    endDate: string,
    filters: CcpFilterOptions = {},
    logCb?: (m: string) => void,
  ): Promise<'OK' | 'EMPTY_TABLE'> {
    await this.dismissModalBackdrop(page);

    // ── Nếu báo cáo có tabName hoặc là TTTT: click tab trước ────────────────
    const url = page.url();
    const targetTabName = report.tabName || (report.code === 'TTTT' || url.includes('PNL_EXECUTED') ? 'Lịch sử tất toán' : '');
    if (targetTabName) {
      try {
        const tabElem = page.locator(`xpath=//*[self::button or self::div or self::span or @role='tab'][normalize-space(text())='${targetTabName}' or contains(text(), '${targetTabName}')]`).first();
        await tabElem.waitFor({ state: 'visible', timeout: 8000 });
        await tabElem.click({ force: true });
        this.log(`[Filter] Đã click chuyển sang tab: "${targetTabName}"`, logCb);
        await page.waitForTimeout(1500);
        await this.waitForTableLoadingComplete(page, 10000);
      } catch (err: any) {
        this.log(`[Filter] Cảnh báo click tab "${targetTabName}": ${err?.message}`, logCb);
      }
    }

    // ── Kiểm tra nếu là ngày HÔM NAY: Không cần filter ngày, tải trực tiếp ──
    const isToday = isTodayDateRange(startDate, endDate);
    if (isToday) {
      this.log(`[Filter] Ngày tải là HÔM NAY (${startDate || 'mặc định'}) -> Bỏ qua lọc ngày vì CoreCCP đã mặc định hôm nay. Cứ thế tải trực tiếp.`, logCb);

      const hasCustomFilters = Boolean(filters.memberCode || filters.acctNo || filters.exchange);
      if (!hasCustomFilters) {
        // Kiểm tra xem bảng có dữ liệu hay "Không có dữ liệu"
        try {
          const noDataInTable = page.locator(
            "xpath=//tbody//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data') or contains(text(), 'No records')]",
          ).first();
          if (await noDataInTable.isVisible({ timeout: 600 })) {
            this.log('[Filter] Bảng báo cáo hiển thị "Không có dữ liệu" -> Tiếp tục kết xuất tải file mẫu.', logCb);
            return 'EMPTY_TABLE';
          }
        } catch { }
        return 'OK';
      }
    }

    // ── NẾU KHÁC HÔM NAY: MỚI FILTER THEO NGÀY ──────────────────────────────
    if (!isToday) {
      // ── DSGD: Xóa ô "Ngày hệ thống" nếu có ──────────────────────────────
      if (report.code === 'DSGD') {
        try {
          const sysDateInput = page.locator(
            "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Ngày hệ thống')]]//input" +
            " | //label[contains(text(), 'Ngày hệ thống')]/following-sibling::div//input",
          ).first();
          if (await sysDateInput.isVisible({ timeout: 1_000 })) {
            await sysDateInput.click({ force: true });
            await page.waitForTimeout(150);
            await page.keyboard.press('Control+A');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(150);
            await page.keyboard.press('Tab');
            this.log('[Filter] Da xoa o Ngay he thong (DSGD)', logCb);
          }
        } catch { }
      }

      // ── Điền DatePicker: "Từ ngày" và "Đến ngày" (Chuẩn count >= 3 từ Python) ─
      if (report.code !== 'QLTTTKGD' && report.code !== 'TYGIA') {
        await this.fillDatePicker(page, startDate, endDate, logCb);
      }
    }

    // ── Bật bộ lọc nếu chưa hiển thị ────────────────────────────────────
    if (filters.memberCode || filters.acctNo || filters.exchange) {
      const headerInputCount = await page
        .locator('thead input, thead .MuiInputBase-input')
        .count();
      if (headerInputCount === 0) {
        try {
          const filterToggle = page.locator(
            "//button[contains(@aria-label,'bộ lọc') or contains(@aria-label,'filter') or contains(@title,'bộ lọc')]",
          );
          if (await filterToggle.first().isVisible({ timeout: 2_000 })) {
            await filterToggle.first().click();
            await page.waitForTimeout(500);
          }
        } catch { }
      }
    }

    // ── Filter Mã thành viên ──────────────────────────────────────────────
    if (filters.memberCode) {
      await this.fillFilter(
        page,
        ['Mã thành viên', 'Ma thanh vien'],
        filters.memberCode,
        logCb,
      );
    }

    // ── Filter Số tiểu khoản / Mã TKGD ───────────────────────────────────
    if (filters.acctNo) {
      await this.fillFilter(
        page,
        ['Số tiểu khoản', 'So tieu khoan', 'Mã TKGD', 'Ma TKGD'],
        filters.acctNo,
        logCb,
      );
    }

    // ── Click Tìm kiếm ────────────────────────────────────────────────────
    try {
      const searchBtn = page.locator(
        "xpath=//button[contains(., 'Tìm kiếm') or contains(., 'Search')]",
      ).first();
      if (await searchBtn.isVisible({ timeout: 2_000 })) {
        await searchBtn.click({ force: true });
        this.log(`[Filter] Da click Tim kiem: ${startDate} -> ${endDate}`, logCb);
        await this.waitForTableLoadingComplete(page, 60_000);
        await this.dismissModalBackdrop(page);
      }
    } catch {
      this.log('[Filter] Khong tim thay nut Tim kiem, bo qua...', logCb);
    }

    // ── Kiểm tra bảng rỗng sau Tìm kiếm: bỏ qua lọc cột con nhưng vẫn tiếp tục kết xuất tải file
    try {
      const noDataInTable = page.locator(
        "xpath=//tbody//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data') or contains(text(), 'No records')]",
      ).first();
      if (await noDataInTable.isVisible({ timeout: 600 })) {
        this.log('[Filter] Bang bao cao tra ve "Khong co du lieu" -> Bo qua loc cot va chuyen sang ket xuat tai file.', logCb);
        return 'EMPTY_TABLE';
      }
    } catch { }

    return 'OK';
  }

  /**
   * Điền ngày vào DatePicker MUI.
   * Port 1:1 từ BaseReportPage.set_date_range_and_search (base_report_page.py:L88-142).
   */
  private async fillDatePicker(
    page: Page,
    startDate: string,
    endDate: string,
    logCb?: (m: string) => void,
  ): Promise<void> {
    try {
      const pickerInputs = page.locator(
        "xpath=//div[contains(@class, 'MuiPickersInputBase-root') or contains(@class, 'MuiPickersOutlinedInput-root') or @role='group']//input | //input[contains(@class, 'MuiPickersInputBase-input')]",
      );
      const count = await pickerInputs.count();

      let fromInp: ReturnType<Page['locator']> | null = null;
      let toInp: ReturnType<Page['locator']> | null = null;

      const fromByLabel = page.locator(
        "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Từ') or contains(text(), '(Từ)')]]//input | //label[contains(text(), 'Từ') or contains(text(), '(Từ)')]/following-sibling::div//input",
      ).first();
      const toByLabel = page.locator(
        "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Đến') or contains(text(), '(Đến)')]]//input | //label[contains(text(), 'Đến') or contains(text(), '(Đến)')]/following-sibling::div//input",
      ).first();

      if (await fromByLabel.isVisible({ timeout: 800 }).catch(() => false)) fromInp = fromByLabel;
      if (await toByLabel.isVisible({ timeout: 800 }).catch(() => false)) toInp = toByLabel;

      if (count >= 3) {
        if (!fromInp) fromInp = pickerInputs.nth(1);
        if (!toInp) toInp = pickerInputs.nth(2);
      } else if (count === 2) {
        if (!fromInp) fromInp = pickerInputs.nth(0);
        if (!toInp) toInp = pickerInputs.nth(1);
      }

      if (fromInp && toInp) {
        this.log(`[Filter] Dien DatePicker: ${startDate} -> ${endDate}`, logCb);
        await fromInp.click({ force: true });
        await page.waitForTimeout(200);
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(150);
        await page.keyboard.type(startDate, { delay: 40 });
        await page.waitForTimeout(200);
        await page.keyboard.press('Tab');

        await toInp.click({ force: true });
        await page.waitForTimeout(200);
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(150);
        await page.keyboard.type(endDate, { delay: 40 });
        await page.waitForTimeout(200);
        await page.keyboard.press('Tab');
      }
    } catch (e: any) {
      this.log(`[Filter] Loi dien DatePicker: ${e?.message}`, logCb);
    }
  }

  /** Điền filter vào ô Top Form hoặc Column Header MRT */
  private async fillFilter(
    page: Page,
    labels: string[],
    value: string,
    logCb?: (m: string) => void,
  ): Promise<void> {
    // Thử Top Form trước
    for (const lbl of labels) {
      try {
        const inp = page.locator(`//label[contains(text(),'${lbl}')]/..//input`);
        if (await inp.first().isVisible({ timeout: 1_500 })) {
          await inp.first().fill(value);
          this.log(`[Filter] Top Form "${lbl}" = "${value}"`, logCb);
          return;
        }
      } catch { }
    }
    // Fallback: Column Header filter (MRT)
    for (const lbl of labels) {
      try {
        const inp = page.locator(
          `//th[contains(.,'${lbl}')]//input | //th[contains(.,'${lbl}')]//.MuiInputBase-input`,
        );
        if (await inp.first().isVisible({ timeout: 1_500 })) {
          await inp.first().fill(value);
          this.log(`[Filter] Column Header "${lbl}" = "${value}"`, logCb);
          return;
        }
      } catch { }
    }
  }

  // ── EXPORT ────────────────────────────────────────────────────────────────

  /**
   * Kích hoạt nút xuất file và bắt sự kiện download.
   * Port 1:1 từ BaseReportPage.trigger_export_download (base_report_page.py:L324-429).
   * Trả về: Download object | 'NO_DATA' | null
   */
  async triggerExportDownload(
    page: Page,
    timeoutMs = 120_000,
    isTableEmpty = false,
    logCb?: (m: string) => void,
  ): Promise<Download | 'NO_DATA' | null> {
    await this.dismissModalBackdrop(page);
    await this.waitForTableLoadingComplete(page, 30_000);

    // Nếu bảng 0 bản ghi: Nếu sàn cho xuất thì file mẫu (4KB) chỉ mất 2-3s; nếu sàn chặn, chỉ chờ tối đa 6s thay vì 60s/120s!
    const effectiveTimeoutMs = isTableEmpty ? 6_000 : timeoutMs;

    // Tìm nút 'Kết xuất' (Vẫn thực hiện kết xuất ngay cả khi bảng 0 dòng để lưu file mẫu/tiêu đề)
    let exportBtn = page.locator(
      "xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất CSV') or contains(., 'Xuất Excel') or contains(., 'Export')]" +
      " | //button[contains(@aria-label, 'Export') or contains(@aria-label, 'Kết xuất')]",
    ).first();

    if (!(await exportBtn.isVisible({ timeout: 2_000 }).catch(() => false))) {
      exportBtn = page.locator("xpath=//button[.//svg[@data-testid='FileDownloadIcon' or @data-testid='DownloadIcon']]").first();
    }

    if (!(await exportBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      this.log("   [Export] Khong tim thay nut 'Ket xuat'", logCb);
      return null;
    }

    let downloadObj: Download | null = null;
    const downloadPromise = page.waitForEvent('download', { timeout: effectiveTimeoutMs })
      .then((d) => { downloadObj = d; return d; })
      .catch(() => null);

    // 1. Click nút Kết xuất
    await exportBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);

    // 2. Kiểm tra nếu có menu dropdown "Xuất tất cả"
    const exportAllOption = page.locator(
      "xpath=//li[contains(text(), 'Xuất tất cả')] | //*[self::li or self::div or self::span][text()='Xuất tất cả']" +
      " | //*[self::li or self::div or self::span or self::p][contains(text(), 'Export all')]",
    ).first();

    if (await exportAllOption.isVisible({ timeout: 1500 }).catch(() => false)) {
      this.log('   [Export] Phát hiện menu dropdown -> Bấm "Xuất tất cả"...', logCb);
      await exportAllOption.click({ force: true }).catch(() => {});
    }

    // 3. Chờ file tải về song song kiểm tra Toast thông báo "Không có dữ liệu"
    const startTime = Date.now();
    while (Date.now() - startTime < effectiveTimeoutMs) {
      if (downloadObj) {
        await this.dismissModalBackdrop(page);
        return downloadObj;
      }

      try {
        const toastLocator = page.locator(
          "xpath=//*[contains(@class, 'notistack-Snackbar') or contains(@class, 'MuiAlert-message') or contains(@class, 'Toastify') or contains(@role, 'alert') or contains(@class, 'MuiSnackbar-root')]" +
          "[contains(., 'Không có dữ liệu') or contains(., 'không có dữ liệu') or contains(., 'No data') or contains(., 'No records')]",
        ).first();

        if (await toastLocator.isVisible({ timeout: 150 })) {
          const text = (await toastLocator.textContent()) || '';
          this.log(`  [Toast Notification] "${text.trim()}" -> Hệ thống xác nhận không có dữ liệu để xuất!`, logCb);
          await this.dismissModalBackdrop(page);
          return 'NO_DATA';
        }
      } catch { }

      await page.waitForTimeout(200);
    }

    const res = await downloadPromise;
    await this.dismissModalBackdrop(page);
    if (res) return res;
    if (isTableEmpty) {
      this.log('  [Export] Không có file tải về sau timeout trên bảng rỗng -> Coi như Không có dữ liệu.', logCb);
      return 'NO_DATA';
    }
    return null;
  }

  // ── CORE DOWNLOAD SINGLE INTERVAL ────────────────────────────────────────

  /** Tải 1 khoảng ngày cụ thể, lưu vào destPath. Trả về true nếu thành công. */
  private async downloadSingleInterval(
    page: Page,
    report: CcpReportConfig,
    systemUrl: string,
    interval: DateInterval,
    destPath: string,
    opts: Required<CcpDownloadOptions>,
    logCb?: (m: string) => void,
  ): Promise<boolean> {
    await this.navigateToReport(page, report, systemUrl, logCb);
    const searchRes = await this.setDateRangeAndSearch(
      page,
      report,
      interval.startStr,
      interval.endStr,
      { exchange: opts.exchange, memberCode: opts.memberCode, acctNo: opts.acctNo },
      logCb,
    );
    const isTableEmpty = searchRes === 'EMPTY_TABLE';

    try {
      const result = await this.triggerExportDownload(page, opts.downloadTimeoutMs, isTableEmpty, logCb);
      if (result === 'NO_DATA') {
        this.log(
          `  [Info] Khoang ${interval.startStr} -> ${interval.endStr} khong co du lieu.`,
          logCb,
        );
        return true;
      }
      if (result) {
        await result.saveAs(destPath);
        return fs.existsSync(destPath) && fs.statSync(destPath).size > 0;
      }
    } catch (e: any) {
      this.log(`  [Warn] Loi tai khoang ${interval.startStr} -> ${interval.endStr}: ${e?.message}`, logCb);
    }
    return false;
  }

  // ── SAFETY NET: ADAPTIVE SPLIT ────────────────────────────────────────────

  /**
   * Đệ quy chia đôi khoảng ngày khi timeout, merge lại.
   * depth tối đa = 4. Single day → retry 5 lần với backoff.
   */
  async downloadWithAdaptiveSplit(
    page: Page,
    report: CcpReportConfig,
    systemUrl: string,
    interval: DateInterval,
    targetFolder: string,
    extraSuffix: string,
    opts: Required<CcpDownloadOptions>,
    depth = 1,
    finalDestPath?: string,
    logCb?: (m: string) => void,
  ): Promise<boolean> {
    const { startStr, endStr } = interval;
    const code = report.code;

    const parts = splitInterval(startStr, endStr);

    // Single day — persistent retry với backoff
    if (!parts) {
      const subFile = path.join(
        targetFolder,
        `temp_${code}_${startStr.replace(/\//g, '')}_${endStr.replace(/\//g, '')}${extraSuffix}.csv`,
      );
      this.log(`\n  [Single Day Retry] ${startStr} — kich hoat 5 lan thu lai...`, logCb);
      const backoffs = [0, 15, 30, 45, 45];
      for (let attempt = 1; attempt <= 5; attempt++) {
        if (attempt > 1) {
          this.log(
            `  [Thu lai ${attempt}/5] Nghi ${backoffs[attempt - 1]}s...`,
            logCb,
          );
          await new Promise((r) => setTimeout(r, backoffs[attempt - 1] * 1_000));
        }
        const ok = await this.downloadSingleInterval(
          page,
          report,
          systemUrl,
          interval,
          subFile,
          opts,
          logCb,
        );
        if (ok) return true;
      }
      // Ghi vào MISSING_DATES.txt
      const missingLog = path.join(targetFolder, 'MISSING_DATES.txt');
      try {
        fs.appendFileSync(
          missingLog,
          `[${new Date().toISOString()}] Bao cao ${code} | Ngay ${startStr}: Thu 5 lan that bai.\n`,
          'utf8',
        );
      } catch { }
      return false;
    }

    const [part1, part2] = parts;
    this.log(
      `\n  [Safety Net Lv${depth}] Tach: ${startStr} -> ${endStr} thanh 2 nua: ${part1.startStr}-${part1.endStr} | ${part2.startStr}-${part2.endStr}`,
      logCb,
    );

    if (!finalDestPath) {
      const sTag = startStr.replace(/\//g, '');
      const eTag = endStr.replace(/\//g, '');
      finalDestPath =
        depth === 1
          ? path.join(targetFolder, `${code}${interval.mmyy}${extraSuffix}.csv`)
          : path.join(targetFolder, `temp_merged_${code}_${sTag}_${eTag}${extraSuffix}.csv`);
    }

    const subFiles: string[] = [];
    for (const [idx, sub] of [part1, part2].entries()) {
      const sTag = sub.startStr.replace(/\//g, '');
      const eTag = sub.endStr.replace(/\//g, '');
      const subFile = path.join(
        targetFolder,
        `temp_${code}_${sTag}_${eTag}${extraSuffix}.csv`,
      );
      this.log(`\n  [Safety Net Lv${depth}.${idx + 1}] Tai khoang nho: ${sub.startStr} -> ${sub.endStr}...`, logCb);

      let ok = await this.downloadSingleInterval(page, report, systemUrl, sub, subFile, opts, logCb);
      if (!ok && depth < 4) {
        const mergedSub = path.join(
          targetFolder,
          `temp_merged_${code}_${sTag}_${eTag}${extraSuffix}.csv`,
        );
        ok = await this.downloadWithAdaptiveSplit(
          page,
          report,
          systemUrl,
          sub,
          targetFolder,
          extraSuffix,
          opts,
          depth + 1,
          mergedSub,
          logCb,
        );
        if (ok && fs.existsSync(mergedSub) && fs.statSync(mergedSub).size > 0) {
          subFiles.push(mergedSub);
          continue;
        }
      }
      if (fs.existsSync(subFile) && fs.statSync(subFile).size > 0) {
        subFiles.push(subFile);
      }
    }

    if (subFiles.length > 0) {
      this.log(`\n  [Merge Lv${depth}] Hop nhat ${subFiles.length} file nho...`, logCb);
      const ok = mergeCsvFiles(subFiles, finalDestPath);
      if (ok) {
        const sz = fs.statSync(finalDestPath).size;
        this.log(`  [Thanh cong Merge Lv${depth}] ${finalDestPath} (${sz.toLocaleString()} bytes)`, logCb);
        return true;
      }
    } else {
      this.log(`  [Info] Khoang ${startStr} -> ${endStr} khong co du lieu.`, logCb);
      return true;
    }
    return false;
  }

  // ── DOWNLOAD SINGLE REPORT (monthly) ─────────────────────────────────────

  async downloadReport(
    page: Page,
    report: CcpReportConfig,
    systemUrl: string,
    interval: DateInterval,
    outputDir: string,
    opts: Required<CcpDownloadOptions>,
    logCb?: (m: string) => void,
  ): Promise<boolean> {
    const code = report.code;
    const { startStr, endStr, mmyy } = interval;

    // Suffix cho tên file
    let extraSuffix = '';
    if (opts.exchange && !['tất cả', 'all', ''].includes(opts.exchange.trim().toLowerCase())) {
      extraSuffix += `_${opts.exchange.trim().toUpperCase()}`;
    }
    if (opts.memberCode) extraSuffix += `_TV${opts.memberCode.trim()}`;
    if (opts.acctNo) extraSuffix += `_TK${opts.acctNo.trim()}`;

    // Nếu là thư mục ca trực hàng ngày (kết thúc bằng ngày tháng DD.MM hoặc trong thư mục Backup CCP/CE):
    // Lưu phẳng trực tiếp thành CODE.csv trong outputDir, KHÔNG tạo thư mục con lồng nhau tránh trùng lặp dữ liệu
    const isDailyShiftFolder = /\d{2}\.\d{2}$/.test(outputDir.trim()) || outputDir.includes('Backup CCP') || outputDir.includes('Backup CE');
    const targetFolder = isDailyShiftFolder ? outputDir : path.join(outputDir, code);
    fs.mkdirSync(targetFolder, { recursive: true });

    const fileName = (report.outputFileName && isDailyShiftFolder)
      ? report.outputFileName
      : (isDailyShiftFolder ? `${code}.csv` : `${code}${mmyy}${extraSuffix}.csv`);
    const destPath = path.join(targetFolder, fileName);

    // Kiểm tra file đã tồn tại
    if (!opts.overwriteExisting && fs.existsSync(destPath)) {
      const sz = fs.statSync(destPath).size;
      if (sz > 100) {
        this.log(`  [Bo qua] ${fileName} da ton tai & hop le (${sz.toLocaleString()} bytes).`, logCb);
        return true;
      }
      this.log(`  [Warn] ${fileName} bi hong/rong (${sz} bytes). Tai lai...`, logCb);
      fs.unlinkSync(destPath);
    } else if (opts.overwriteExisting && fs.existsSync(destPath)) {
      this.log(`  [Ghi de] Tien hanh tai moi file ${fileName}...`, logCb);
      fs.unlinkSync(destPath);
    }

    this.log(`\n  [Dang tai] ${report.name} (${code}) | Thang ${mmyy} (${startStr} -> ${endStr})...`, logCb);

    // Điều hướng + cập nhật cachedUrl
    const learnedUrl = await this.navigateToReport(page, report, systemUrl, logCb);
    report.cachedUrl = learnedUrl;

    // Xử lý riêng cho các file Hợp đồng chi tiết theo mã hàng hóa (Modal Contract)
    if (report.commodityCode) {
      const ok = await this.exportSingleCommodityContract(page, report.commodityCode, destPath, logCb);
      return ok;
    }

    const searchRes = await this.setDateRangeAndSearch(
      page,
      report,
      startStr,
      endStr,
      { exchange: opts.exchange, memberCode: opts.memberCode, acctNo: opts.acctNo },
      logCb,
    );
    const isTableEmpty = searchRes === 'EMPTY_TABLE';

    // Retry 2 lần với Progressive Timeout (Vẫn xuất file để lấy file mẫu ngay cả khi 0 dòng)
    for (let attempt = 1; attempt <= 2; attempt++) {
      const currentTimeout = opts.downloadTimeoutMs * attempt;
      if (attempt > 1) {
        this.log(
          `  [Thu lai ${attempt}/2] Kich hoat lai xuat file ${fileName} (timeout ${currentTimeout / 1000}s)...`,
          logCb,
        );
        await new Promise((r) => setTimeout(r, 2_000));
      }

      try {
        const result = await this.triggerExportDownload(page, currentTimeout, isTableEmpty, logCb);
        if (result === 'NO_DATA') {
          this.log(`  [Info] ${fileName} khong co du lieu.`, logCb);
          return true;
        }
        if (result) {
          await result.saveAs(destPath);
          if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
            const sz = fs.statSync(destPath).size;
            this.log(`  [Thanh cong] Da luu: ${destPath} (${sz.toLocaleString()} bytes)`, logCb);

            // Dọn dẹp thư mục con thừa nếu trước đó từng tạo ra
            if (isDailyShiftFolder) {
              const legacySubFolder = path.join(outputDir, code);
              if (fs.existsSync(legacySubFolder) && legacySubFolder !== outputDir) {
                try {
                  fs.rmSync(legacySubFolder, { recursive: true, force: true });
                } catch { }
              }
            }
            return true;
          }
          this.log(`  [Warn] File ${fileName} sau khi luu bi rong.`, logCb);
        }
      } catch (e: any) {
        this.log(`  [Warn] Loi xuat file ${fileName} (lan ${attempt}): ${e?.message}`, logCb);
      }
    }

    // Safety Net: chia nhỏ khoảng ngày
    if (opts.autoSplitOnTimeout) {
      this.log(`\n  [Safety Net] Khoang ${startStr} -> ${endStr} het gio — Kich hoat chia nho...`, logCb);
      return this.downloadWithAdaptiveSplit(
        page,
        report,
        systemUrl,
        interval,
        targetFolder,
        extraSuffix,
        opts,
        1,
        undefined,
        logCb,
      );
    }

    return false;
  }

  // ── ORCHESTRATOR ──────────────────────────────────────────────────────────

  /**
   * Chạy toàn bộ tiến trình tải báo cáo CCP hoặc CE.
   * Đây là entry point dùng từ controller hoặc bot job.
   */
  async run(runOpts: CcpRunOptions, logCb?: (m: string) => void): Promise<boolean> {
    const {
      systemUrl,
      username,
      password,
      startDate,
      endDate,
      outputDir,
    } = runOpts;

    const opts: Required<CcpDownloadOptions> = {
      headless: runOpts.options?.headless ?? true,
      overwriteExisting: runOpts.options?.overwriteExisting ?? false,
      downloadTimeoutMs: runOpts.options?.downloadTimeoutMs ?? 120_000,
      autoSplitOnTimeout: runOpts.options?.autoSplitOnTimeout ?? true,
      exchange: runOpts.options?.exchange ?? '',
      memberCode: runOpts.options?.memberCode ?? '',
      acctNo: runOpts.options?.acctNo ?? '',
    };

    const reportsToRun = (runOpts.reports ?? (this.isCoreExSystem(systemUrl) ? DEFAULT_CE_REPORTS : DEFAULT_CCP_REPORTS))
      .filter((r) => r.enabled);

    const todayDmy = formatDmY(new Date());
    const effStartDate = startDate || todayDmy;
    const effEndDate = endDate || todayDmy;
    const isTodayJob = isTodayDateRange(effStartDate, effEndDate);

    const intervals = isTodayJob
      ? [{
          startStr: todayDmy,
          endStr: todayDmy,
          mmyy: `${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getFullYear()).slice(-2)}`,
        }]
      : generateMonthlyIntervals(effStartDate, effEndDate);

    this.log('='.repeat(60), logCb);
    this.log(`BAT DAU TAI BAO CAO VNCLEAR (${this.isCoreExSystem(systemUrl) ? 'CoreEX' : 'CoreCCP'})`, logCb);
    this.log(`He thong: ${systemUrl}`, logCb);
    this.log(
      isTodayJob
        ? `Khoang: HOM NAY (${effStartDate}) - Mac dinh CoreCCP, bo qua filter ngay`
        : `Khoang: ${effStartDate} -> ${effEndDate} (${intervals.length} thang)`,
      logCb,
    );
    this.log(`Thu muc luu: ${outputDir}`, logCb);
    this.log('='.repeat(60), logCb);

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      const chromePath = this.getChromeExecutablePath();
      const launchOptions: any = {
        headless: opts.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-infobars'],
      };
      if (chromePath) {
        launchOptions.executablePath = chromePath;
      }
      browser = await chromium.launch(launchOptions);
      context = await browser.newContext({
        acceptDownloads: true,
        viewport: { width: 1366, height: 768 },
      });
      const page = await context.newPage();

      // Đăng nhập
      await this.loginVnclear(page, systemUrl, username, password, logCb);

      // Mở sidebar
      await this.ensureSidebarExpanded(page);

      // Vòng lặp tải từng loại báo cáo
      let contractsProcessed = false;
      const targetCommodityCodes = reportsToRun
        .map((r) => r.commodityCode || (r.code.startsWith('HD_') ? r.code.replace(/^HD_/, '') : null))
        .filter(Boolean) as string[];

      for (const report of reportsToRun) {
        if (report.code === 'HD' || report.code.startsWith('HD_')) {
          if (contractsProcessed) {
            this.log(`  [Commodity & Contracts] Nhóm Hợp đồng đã được xử lý ở bước trước -> Bỏ qua`, logCb);
            continue;
          }
          contractsProcessed = true;
          this.log(`\n>>> BAO CAO: HỢP ĐỒNG CHI TIẾT (CE) (${report.code}) <<<`, logCb);
          this.log(`  [Commodity & Contracts] Kích hoạt tải động toàn bộ hợp đồng từ bảng HH...`, logCb);
          await this.downloadCommodityAndContracts(
            page,
            systemUrl,
            outputDir,
            targetCommodityCodes.length > 0 ? targetCommodityCodes : undefined,
            logCb,
          );
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        this.log(`\n>>> BAO CAO: ${report.name.toUpperCase()} (${report.code}) <<<`, logCb);

        for (const interval of intervals) {
          await this.downloadReport(page, report, systemUrl, interval, outputDir, opts, logCb);
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      this.log('\nHOAN THANH TOAN BO TIEN TRINH TAI BAO CAO!', logCb);
      return true;
    } catch (e: any) {
      this.log(`[Error] Loi nghiem trong trong qua trinh chay: ${e?.message}`, logCb);
      this.logger.error(e);
      return false;
    } finally {
      await context?.close();
      await browser?.close();
    }
  }

  /**
   * Tải riêng file Kết quả EOD từ CoreCCP (/EOD/ACCTMARGIN_HIST).
   * Lưu trực tiếp thành eod_ccp.csv (hoặc theo ngày) trong thư mục chỉ định.
   */
  async downloadEodCcp(params: {
    systemUrl: string;
    username: string;
    password: string;
    tradingDate: string; // DD/MM/YYYY
    outputDir: string;
    options?: CcpDownloadOptions;
    logCallback?: (m: string) => void;
  }): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const {
      systemUrl,
      username,
      password,
      tradingDate,
      outputDir,
      options: runOpts = {},
      logCallback: logCb,
    } = params;

    const opts: Required<CcpDownloadOptions> = {
      headless: runOpts.headless ?? false,
      overwriteExisting: runOpts.overwriteExisting ?? true,
      exchange: runOpts.exchange ?? '',
      memberCode: runOpts.memberCode ?? '',
      acctNo: runOpts.acctNo ?? '',
      downloadTimeoutMs: runOpts.downloadTimeoutMs ?? 60_000,
      autoSplitOnTimeout: false,
    };

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const cleanDate = tradingDate.replace(/\//g, '');
    const destPath = path.join(outputDir, `eod_ccp_${cleanDate}.csv`);
    const defaultDestPath = path.join(outputDir, 'eod_ccp.csv');

    this.log(`[EOD] Bat dau tai Ket qua EOD CCP ngay ${tradingDate}...`, logCb);

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      const chromePath = this.getChromeExecutablePath();
      const launchOptions: any = {
        headless: opts.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-infobars'],
      };
      if (chromePath) launchOptions.executablePath = chromePath;

      browser = await chromium.launch(launchOptions);
      context = await browser.newContext({
        acceptDownloads: true,
        viewport: { width: 1366, height: 768 },
      });
      const page = await context.newPage();

      await this.loginVnclear(page, systemUrl, username, password, logCb);

      const eodReport: CcpReportConfig = {
        code: 'EOD',
        name: 'Kết quả EOD',
        parentMenu: 'Vận hành',
        childMenu: 'Kết quả EOD',
        cachedUrl: '/EOD/ACCTMARGIN_HIST',
        enabled: true,
      };

      await this.navigateToReport(page, eodReport, systemUrl, logCb);
      const searchRes = await this.setDateRangeAndSearch(page, eodReport, tradingDate, tradingDate, {}, logCb);
      const isTableEmpty = searchRes === 'EMPTY_TABLE';

      const downloadResult = await this.triggerExportDownload(page, opts.downloadTimeoutMs, isTableEmpty, logCb);
      if (downloadResult === 'NO_DATA') {
        this.log(`[EOD] Ngay ${tradingDate} khong co du lieu EOD.`, logCb);
        return { success: false, error: 'NO_DATA' };
      }
      if (downloadResult) {
        await downloadResult.saveAs(destPath);
        try {
          fs.copyFileSync(destPath, defaultDestPath);
        } catch { }
        const sz = fs.statSync(destPath).size;
        this.log(`[EOD] Da tai thanh cong Ket qua EOD: ${destPath} (${sz.toLocaleString()} bytes)`, logCb);
        return { success: true, filePath: destPath };
      }
      return { success: false, error: 'Download failed' };
    } catch (err: any) {
      this.log(`[EOD] Loi khi tai Ket qua EOD: ${err?.message}`, logCb);
      return { success: false, error: err?.message };
    } finally {
      await context?.close();
      await browser?.close();
    }
  }

  /**
   * Tải riêng file QLTTTKGD từ CoreCCP (/RISKMNG/ACCTMARGIN_ALL).
   * Báo cáo này là trạng thái snapshot tài khoản thời gian thực (trước 05:00), không cần chọn ngày.
   * Tự động lưu thành QLTTTKGD_CCP.xlsx trong thư mục chỉ định.
   */
  async downloadQltkgdCcp(params: {
    systemUrl: string;
    username: string;
    password: string;
    outputDir: string;
    options?: CcpDownloadOptions;
    logCallback?: (m: string) => void;
  }): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const {
      systemUrl,
      username,
      password,
      outputDir,
      options: runOpts = {},
      logCallback: logCb,
    } = params;

    const opts: Required<CcpDownloadOptions> = {
      headless: runOpts.headless ?? false,
      overwriteExisting: runOpts.overwriteExisting ?? true,
      exchange: runOpts.exchange ?? '',
      memberCode: runOpts.memberCode ?? '',
      acctNo: runOpts.acctNo ?? '',
      downloadTimeoutMs: runOpts.downloadTimeoutMs ?? 60_000,
      autoSplitOnTimeout: false,
    };

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const defaultDestPath = path.join(outputDir, 'QLTTTKGD_CCP.xlsx');
    const csvDestPath = path.join(outputDir, 'QLTTTKGD_CCP.csv');

    this.log(`[QLTTTKGD] Bat dau tai Trang thai TKGD CCP (QLTTTKGD)...`, logCb);

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      const chromePath = this.getChromeExecutablePath();
      const launchOptions: any = {
        headless: opts.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-infobars'],
      };
      if (chromePath) launchOptions.executablePath = chromePath;

      browser = await chromium.launch(launchOptions);
      context = await browser.newContext({
        acceptDownloads: true,
        viewport: { width: 1366, height: 768 },
      });
      const page = await context.newPage();

      await this.loginVnclear(page, systemUrl, username, password, logCb);

      const qlReport: CcpReportConfig = {
        code: 'QLTTTKGD',
        name: 'Quản lý trạng thái TKGD',
        parentMenu: 'Quản lý rủi ro',
        childMenu: 'Quản lý trạng thái TKGD',
        tabName: 'Danh sách trạng thái TKGD',
        cachedUrl: '/RISKMNG/ACCTMARGIN_ALL',
        enabled: true,
      };

      await this.navigateToReport(page, qlReport, systemUrl, logCb);
      const searchRes = await this.setDateRangeAndSearch(page, qlReport, '', '', {}, logCb);
      const isTableEmpty = searchRes === 'EMPTY_TABLE';

      const downloadResult = await this.triggerExportDownload(page, opts.downloadTimeoutMs, isTableEmpty, logCb);
      if (downloadResult === 'NO_DATA') {
        this.log(`[QLTTTKGD] Khong co du lieu trang thai TKGD.`, logCb);
        return { success: false, error: 'NO_DATA' };
      }
      if (downloadResult) {
        await downloadResult.saveAs(defaultDestPath);
        try {
          fs.copyFileSync(defaultDestPath, csvDestPath);
        } catch { }
        const sz = fs.statSync(defaultDestPath).size;
        this.log(`[QLTTTKGD] Da tai thanh cong QLTTTKGD CCP: ${defaultDestPath} (${sz.toLocaleString()} bytes)`, logCb);
        return { success: true, filePath: defaultDestPath };
      }
      return { success: false, error: 'Download failed' };
    } catch (err: any) {
      this.log(`[QLTTTKGD] Loi khi tai QLTTTKGD: ${err?.message}`, logCb);
      return { success: false, error: err?.message };
    } finally {
      await context?.close();
      await browser?.close();
    }
  }

  /**
   * Tải riêng 3 báo cáo CoreCCP phục vụ CheckKLGD (DSGD, TTM, TTTT) trong 1 phiên duy nhất,
   * lưu file vào outputDir và bóc tách trực tiếp số liệu:
   * - klgd: Tổng số lot khớp (DSGD)
   * - ttm: Tổng số vị thế mở Mua + Bán (TTM - /ORDERS/OPEN_POSITION)
   * - tttt: Tổng số lot tất toán Bán (TTTT)
   */
  async downloadAndExtractKlgdMetrics(params: {
    systemUrl: string;
    username: string;
    password: string;
    tradingDate: string; // dd/mm/yyyy
    outputDir: string;
    options?: CcpDownloadOptions;
    logCallback?: (m: string) => void;
  }): Promise<{
    success: boolean;
    tradingDate: string;
    metrics: {
      klgd: number;
      ttm: number;
      tttt: number;
    };
    files: {
      dsgd?: string;
      ttm?: string;
      tttt?: string;
    };
    error?: string;
  }> {
    const {
      systemUrl,
      username,
      password,
      tradingDate,
      outputDir,
      options: runOpts = {},
      logCallback: logCb,
    } = params;

    const opts: Required<CcpDownloadOptions> = {
      headless: runOpts.headless ?? false,
      overwriteExisting: runOpts.overwriteExisting ?? true,
      exchange: runOpts.exchange ?? '',
      memberCode: runOpts.memberCode ?? '',
      acctNo: runOpts.acctNo ?? '',
      downloadTimeoutMs: runOpts.downloadTimeoutMs ?? 60_000,
      autoSplitOnTimeout: false,
    };

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const cleanDate = tradingDate.replace(/\//g, '.');
    const dsgdDestPath = path.join(outputDir, `DSGD_${cleanDate}.xlsx`);
    const ttmDestPath = path.join(outputDir, `TTM_${cleanDate}.xlsx`);
    const ttttDestPath = path.join(outputDir, `TTTT_${cleanDate}.xlsx`);

    const resultFiles: { dsgd?: string; ttm?: string; tttt?: string } = {};
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      const chromePath = this.getChromeExecutablePath();
      const launchOptions: any = {
        headless: opts.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-infobars'],
      };
      if (chromePath) launchOptions.executablePath = chromePath;

      browser = await chromium.launch(launchOptions);
      context = await browser.newContext({
        acceptDownloads: true,
        viewport: { width: 1366, height: 768 },
      });
      const page = await context.newPage();

      this.log(`[CCP KLGD] Đăng nhập CoreCCP: ${systemUrl}...`, logCb);
      await this.loginVnclear(page, systemUrl, username, password, logCb);

      const targetReports: CcpReportConfig[] = [
        {
          code: 'DSGD',
          name: 'Danh sách giao dịch',
          parentMenu: 'Lệnh và vị thế',
          childMenu: 'Danh sách giao dịch',
          cachedUrl: '/ORDERS/ORDERMATCH_DETAIL',
          enabled: true,
        },
        {
          code: 'TTM',
          name: 'Trạng thái mở',
          parentMenu: 'Lệnh và vị thế',
          childMenu: 'Trạng thái mở',
          cachedUrl: '/ORDERS/OPEN_POSITION',
          enabled: true,
        },
        {
          code: 'TTTT',
          name: 'Trạng thái tất toán',
          parentMenu: 'Lệnh và vị thế',
          childMenu: 'Trạng thái tất toán',
          tabName: 'Lịch sử tất toán',
          cachedUrl: '',
          enabled: true,
        },
      ];

      for (const rep of targetReports) {
        this.log(`[CCP KLGD] Đang tải báo cáo ${rep.name} (${rep.code})...`, logCb);
        try {
          await this.navigateToReport(page, rep, systemUrl, logCb);
          let isTableEmpty = false;
          if (rep.code === 'DSGD' && isTodayOrCurrentSession(tradingDate)) {
            this.log(`[CCP KLGD] DSGD phiên hiện tại (${tradingDate}) -> Giữ nguyên bảng giao dịch mặc định realtime.`, logCb);
            await this.waitForTableLoadingComplete(page, 15_000);
            try {
              const noData = page.locator(
                "xpath=//tbody//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data') or contains(text(), 'No records')]"
              ).first();
              isTableEmpty = await noData.isVisible({ timeout: 600 }).catch(() => false);
            } catch { }
          } else {
            const searchRes = await this.setDateRangeAndSearch(page, rep, tradingDate, tradingDate, {}, logCb);
            isTableEmpty = searchRes === 'EMPTY_TABLE';
          }

          const dl = await this.triggerExportDownload(page, opts.downloadTimeoutMs, isTableEmpty, logCb);
          if (dl && dl !== 'NO_DATA') {
            let targetDest = dsgdDestPath;
            if (rep.code === 'TTM') targetDest = ttmDestPath;
            if (rep.code === 'TTTT') targetDest = ttttDestPath;

            await dl.saveAs(targetDest);
            if (rep.code === 'DSGD') resultFiles.dsgd = targetDest;
            if (rep.code === 'TTM') resultFiles.ttm = targetDest;
            if (rep.code === 'TTTT') resultFiles.tttt = targetDest;
            this.log(`[CCP KLGD] Tải thành công ${rep.code}: ${targetDest}`, logCb);
          } else {
            this.log(`[CCP KLGD] Báo cáo ${rep.code} không có dữ liệu để xuất hoặc bảng rỗng.`, logCb);
          }
        } catch (err: any) {
          this.log(`[CCP KLGD] Cảnh báo khi tải ${rep.code}: ${err.message}`, logCb);
        }
      }
    } catch (err: any) {
      this.log(`[CCP KLGD] Lỗi phiên duyệt web CoreCCP: ${err.message}`, logCb);
      return {
        success: false,
        tradingDate,
        metrics: { klgd: 0, ttm: 0, tttt: 0 },
        files: resultFiles,
        error: err.message,
      };
    } finally {
      await context?.close();
      await browser?.close();
    }

    // Parse các file đã tải để lấy ra 3 chỉ số KLGD, TTM, TTTT
    let klgd = 0;
    let ttm = 0;
    let tttt = 0;

    if (resultFiles.dsgd && fs.existsSync(resultFiles.dsgd)) {
      try {
        const parsed = CcpExcelParser.parseDSGD(fs.readFileSync(resultFiles.dsgd), tradingDate);
        klgd = parsed.totalKhop || 0;
      } catch (e: any) {
        this.log(`[CCP KLGD] Lỗi bóc tách DSGD: ${e.message}`, logCb);
      }
    }
    if (resultFiles.ttm && fs.existsSync(resultFiles.ttm)) {
      try {
        const parsed = CcpExcelParser.parseTTM(fs.readFileSync(resultFiles.ttm), tradingDate);
        ttm = parsed.totalTTM || 0;
      } catch (e: any) {
        this.log(`[CCP KLGD] Lỗi bóc tách TTM: ${e.message}`, logCb);
      }
    }
    if (resultFiles.tttt && fs.existsSync(resultFiles.tttt)) {
      try {
        const parsed = CcpExcelParser.parseTTTT(fs.readFileSync(resultFiles.tttt), tradingDate);
        tttt = parsed.totalTTTT || 0;
      } catch (e: any) {
        this.log(`[CCP KLGD] Lỗi bóc tách TTTT: ${e.message}`, logCb);
      }
    }

    this.log(`[CCP KLGD]  Hoàn tất bóc tách CoreCCP: KLGD=${klgd}, TTM=${ttm}, TTTT=${tttt}`, logCb);
    return {
      success: true,
      tradingDate,
      metrics: { klgd, ttm, tttt },
      files: resultFiles,
    };
  }

  /**
   * Khởi tạo phiên trình duyệt CoreCCP phục vụ quy trình Đồng bộ 2 Pha:
   * Pha 1: Mở browser, login Vnclear, điều hướng sẵn vào màn hình DSGD và lọc ngày giao dịch.
   * Cung cấp triggerExportDsgd() để kích hoạt click xuất file cùng lúc với các nguồn khác tại Pha 2.
   */
  async prepareKlgdSession(params: {
    systemUrl: string;
    username: string;
    password: string;
    tradingDate: string; // dd/mm/yyyy
    outputDir: string;
    options?: CcpDownloadOptions;
    logCallback?: (m: string) => void;
  }): Promise<{
    triggerExportDsgd: () => Promise<string | null>;
    downloadRemainingAndExtract: (downloadedDsgdPath?: string) => Promise<{
      success: boolean;
      tradingDate: string;
      metrics: { klgd: number; ttm: number; tttt: number };
      files: { dsgd?: string; ttm?: string; tttt?: string };
      error?: string;
    }>;
    close: () => Promise<void>;
  }> {
    const {
      systemUrl,
      username,
      password,
      tradingDate,
      outputDir,
      options: runOpts = {},
      logCallback: logCb,
    } = params;

    const opts: Required<CcpDownloadOptions> = {
      headless: runOpts.headless ?? false,
      overwriteExisting: runOpts.overwriteExisting ?? true,
      exchange: runOpts.exchange ?? '',
      memberCode: runOpts.memberCode ?? '',
      acctNo: runOpts.acctNo ?? '',
      downloadTimeoutMs: runOpts.downloadTimeoutMs ?? 60_000,
      autoSplitOnTimeout: false,
    };

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const cleanDate = tradingDate.replace(/\//g, '.');
    const dsgdDestPath = path.join(outputDir, `DSGD_${cleanDate}.xlsx`);
    const ttmDestPath = path.join(outputDir, `TTM_${cleanDate}.xlsx`);
    const ttttDestPath = path.join(outputDir, `TTTT_${cleanDate}.xlsx`);

    const resultFiles: { dsgd?: string; ttm?: string; tttt?: string } = {};
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let isTableEmpty = false;

    const chromePath = this.getChromeExecutablePath();
    const launchOptions: any = {
      headless: opts.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-infobars'],
    };
    if (chromePath) launchOptions.executablePath = chromePath;

    browser = await chromium.launch(launchOptions);
    context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1366, height: 768 },
    });
    page = await context.newPage();

    this.log(`[CCP KLGD] Đăng nhập CoreCCP: ${systemUrl}...`, logCb);
    await this.loginVnclear(page, systemUrl, username, password, logCb);

    const repDSGD: CcpReportConfig = {
      code: 'DSGD',
      name: 'Danh sách giao dịch',
      parentMenu: 'Lệnh và vị thế',
      childMenu: 'Danh sách giao dịch',
      cachedUrl: '/ORDERS/ORDERMATCH_DETAIL',
      enabled: true,
    };

    this.log(`[CCP KLGD] Điều hướng đến màn hình DSGD và cấu hình ngày ${tradingDate}...`, logCb);
    await this.navigateToReport(page, repDSGD, systemUrl, logCb);

    const currentUrl = page.url();
    if (currentUrl.includes('validate_code') || currentUrl.includes('/login')) {
      throw new Error(`[Fail-Fast] Màn hình DSGD chưa sẵn sàng, trình duyệt đang ở URL: ${currentUrl}`);
    }

    const isToday = isTodayOrCurrentSession(tradingDate);
    if (isToday) {
      this.log(`[CCP KLGD] Phiên hiện tại/hôm nay (${tradingDate}) -> Giữ nguyên bảng giao dịch mặc định (bỏ qua filter để bảo toàn 100% dữ liệu realtime).`, logCb);
      await this.waitForTableLoadingComplete(page, 15_000);
      try {
        const noData = page.locator(
          "xpath=//tbody//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data') or contains(text(), 'No records')]"
        ).first();
        isTableEmpty = await noData.isVisible({ timeout: 600 }).catch(() => false);
      } catch { }
    } else {
      const searchRes = await this.setDateRangeAndSearch(page, repDSGD, tradingDate, tradingDate, {}, logCb);
      isTableEmpty = searchRes === 'EMPTY_TABLE';
    }
    this.log(`[CCP KLGD] Sẵn sàng tại màn hình xuất DSGD (${isTableEmpty ? 'chưa có dữ liệu' : 'có dữ liệu'}). Đang chờ rào cản đồng bộ...`, logCb);

    const triggerExportDsgd = async (): Promise<string | null> => {
      if (!page || page.isClosed()) return null;
      try {
        this.log(`[CCP KLGD] Kích hoạt xuất báo cáo DSGD...`, logCb);
        const dl = await this.triggerExportDownload(page, opts.downloadTimeoutMs, isTableEmpty, logCb);
        if (dl && dl !== 'NO_DATA') {
          await dl.saveAs(dsgdDestPath);
          resultFiles.dsgd = dsgdDestPath;
          this.log(`[CCP KLGD] Tải thành công DSGD: ${dsgdDestPath}`, logCb);
          return dsgdDestPath;
        }
        return null;
      } catch (err: any) {
        this.log(`[CCP KLGD] Cảnh báo khi xuất DSGD: ${err.message}`, logCb);
        return null;
      }
    };

    const downloadRemainingAndExtract = async (downloadedDsgdPath?: string) => {
      if (downloadedDsgdPath) resultFiles.dsgd = downloadedDsgdPath;
      if (page && !page.isClosed()) {
        const remainingReports: CcpReportConfig[] = [
          {
            code: 'TTM',
            name: 'Trạng thái mở',
            parentMenu: 'Lệnh và vị thế',
            childMenu: 'Trạng thái mở',
            cachedUrl: '/ORDERS/OPEN_POSITION',
            enabled: true,
          },
          {
            code: 'TTTT',
            name: 'Trạng thái tất toán',
            parentMenu: 'Lệnh và vị thế',
            childMenu: 'Trạng thái tất toán',
            tabName: 'Lịch sử tất toán',
            cachedUrl: '',
            enabled: true,
          },
        ];

        for (const rep of remainingReports) {
          try {
            this.log(`[CCP KLGD] Đang tải báo cáo bổ sung ${rep.name} (${rep.code})...`, logCb);
            await this.navigateToReport(page, rep, systemUrl, logCb);

            let emptyTbl = false;

            if (rep.code === 'TTM') {
              // TTM: Snapshot vị thế mở của ngày hôm nay, không có datepicker
              await this.waitForTableLoadingComplete(page, 15_000);
              try {
                const noData = page.locator("xpath=//tbody//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data')]").first();
                emptyTbl = await noData.isVisible({ timeout: 600 }).catch(() => false);
              } catch { }
            } else if (rep.code === 'TTTT') {
              // TTTT: Chuyển tab 'Lịch sử tất toán'
              const tabSettled = page.locator("xpath=//*[self::button or self::div or self::span][contains(text(), 'Lịch sử tất toán')]").first();
              if (await tabSettled.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await tabSettled.click({ force: true });
                await page.waitForTimeout(1_000);
              }
              if (isToday) {
                await this.waitForTableLoadingComplete(page, 15_000);
                try {
                  const noData = page.locator("xpath=//tbody//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data')]").first();
                  emptyTbl = await noData.isVisible({ timeout: 600 }).catch(() => false);
                } catch { }
              } else {
                const sRes = await this.setDateRangeAndSearch(page, rep, tradingDate, tradingDate, {}, logCb);
                emptyTbl = sRes === 'EMPTY_TABLE';
              }
            } else {
              if (isToday) {
                await this.waitForTableLoadingComplete(page, 15_000);
              } else {
                const sRes = await this.setDateRangeAndSearch(page, rep, tradingDate, tradingDate, {}, logCb);
                emptyTbl = sRes === 'EMPTY_TABLE';
              }
            }

            const dl = await this.triggerExportDownload(page, opts.downloadTimeoutMs, emptyTbl, logCb);
            if (dl && dl !== 'NO_DATA') {
              const targetDest = rep.code === 'TTM' ? ttmDestPath : ttttDestPath;
              await dl.saveAs(targetDest);
              if (rep.code === 'TTM') resultFiles.ttm = targetDest;
              if (rep.code === 'TTTT') resultFiles.tttt = targetDest;
              this.log(`[CCP KLGD] Tải thành công ${rep.code}: ${targetDest}`, logCb);
            }
          } catch (err: any) {
            this.log(`[CCP KLGD] Cảnh báo khi tải ${rep.code}: ${err.message}`, logCb);
          }
        }
      }

      await context?.close().catch(() => { });
      await browser?.close().catch(() => { });

      let klgd = 0;
      let ttm = 0;
      let tttt = 0;

      if (resultFiles.dsgd && fs.existsSync(resultFiles.dsgd)) {
        try {
          const parsed = CcpExcelParser.parseDSGD(fs.readFileSync(resultFiles.dsgd), tradingDate);
          klgd = parsed.totalKhop || 0;
        } catch (e: any) {
          this.log(`[CCP KLGD] Lỗi bóc tách DSGD: ${e.message}`, logCb);
        }
      }
      if (resultFiles.ttm && fs.existsSync(resultFiles.ttm)) {
        try {
          const parsed = CcpExcelParser.parseTTM(fs.readFileSync(resultFiles.ttm), tradingDate);
          ttm = parsed.totalTTM || 0;
        } catch (e: any) {
          this.log(`[CCP KLGD] Lỗi bóc tách TTM: ${e.message}`, logCb);
        }
      }
      if (resultFiles.tttt && fs.existsSync(resultFiles.tttt)) {
        try {
          const parsed = CcpExcelParser.parseTTTT(fs.readFileSync(resultFiles.tttt), tradingDate);
          tttt = parsed.totalTTTT || 0;
        } catch (e: any) {
          this.log(`[CCP KLGD] Lỗi bóc tách TTTT: ${e.message}`, logCb);
        }
      }

      this.log(`[CCP KLGD]  Hoàn tất bóc tách CoreCCP: KLGD=${klgd}, TTM=${ttm}, TTTT=${tttt}`, logCb);
      return {
        success: true,
        tradingDate,
        metrics: { klgd, ttm, tttt },
        files: resultFiles,
      };
    };

    const close = async () => {
      await context?.close().catch(() => { });
      await browser?.close().catch(() => { });
    };

    return {
      triggerExportDsgd,
      downloadRemainingAndExtract,
      close,
    };
  }

  // ── COMMODITY & CONTRACTS BATCH DOWNLOAD ─────────────────────────────────

  /**
   * Tải hợp đồng chi tiết của 1 mã hàng hóa cụ thể (ví dụ: CP2CO, PL1NY, SI5CO).
   */
  async exportSingleCommodityContract(
    page: Page,
    commodityCode: string,
    destPath: string,
    logCb?: (m: string) => void,
  ): Promise<boolean> {
    this.log(`  [Contract] Tìm kiếm dòng hàng hóa mã: "${commodityCode}"...`, logCb);
    if (!page.url().includes('/PRODUCT/COMMODITY')) {
      const commUrl = this.resolveReportUrl('/PRODUCT/COMMODITY', page.url());
      await page.goto(commUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
    }
    await this.dismissModalBackdrop(page);
    await this.waitForTableLoadingComplete(page, 15000);

    const rowLocator = page.locator(
      `xpath=//tr[.//td[@data-column-id='UACODE' and normalize-space(.)='${commodityCode}'] or .//td[normalize-space(.)='${commodityCode}']]`
    ).first();

    const isRowVis = await rowLocator.isVisible({ timeout: 8000 }).catch(() => false);
    if (!isRowVis) {
      this.log(`  [Info] Không tìm thấy hàng hóa mã "${commodityCode}" trên sàn (có thể là mã của môi trường khác). Bỏ qua an toàn.`, logCb);
      return true;
    }

    const viewBtn = rowLocator.locator("xpath=.//button[contains(@class, 'MuiIconButton-root') or .//svg]").first();
    await viewBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const modalTitle = page.locator("#modal-modal-title, h2:has-text('Xem Thông tin hàng hóa')").first();
    await modalTitle.waitFor({ state: 'visible', timeout: 8000 });

    const contractTab = page.locator("xpath=//button[@id='tab-1' or contains(., 'Thông tin hợp đồng')]").first();
    await contractTab.waitFor({ state: 'visible', timeout: 5000 });
    await contractTab.click({ force: true });
    await page.waitForTimeout(1500);

    const tabpanel = page.locator("#tabpanel-1");
    const noDataText = tabpanel.locator("xpath=.//*[contains(text(), 'Không có dữ liệu') or contains(text(), '0-0 trên 0')]").first();
    if (await noDataText.isVisible({ timeout: 1500 }).catch(() => false)) {
      this.log(`  [Info] Hàng hóa [${commodityCode}] không có hợp đồng (0 bản ghi) -> Bỏ qua`, logCb);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      return true;
    }

    const modalExportBtn = tabpanel.locator("button.button-element:has-text('Kết xuất'), button:has-text('Kết xuất')").first();
    if (!(await modalExportBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      await page.keyboard.press('Escape');
      this.log(`  [Error] Không tìm thấy nút Kết xuất trong tab Hợp đồng của mã "${commodityCode}"!`, logCb);
      return false;
    }

    const dlPromise = page.waitForEvent('download', { timeout: 25000 }).catch(() => null);

    await modalExportBtn.click({ force: true });
    await page.waitForTimeout(500);

    const exportAll = page.locator("li:visible:has-text('Xuất tất cả'), [role='menuitem']:visible:has-text('Xuất tất cả')").last();
    if (await exportAll.isVisible({ timeout: 2000 }).catch(() => false)) {
      await exportAll.click({ force: true });
    }

    const dl = await dlPromise;
    let ok = false;
    if (dl) {
      await dl.saveAs(destPath);
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
        const sz = fs.statSync(destPath).size;
        this.log(`  [Thành công] Đã lưu: ${destPath} (${sz.toLocaleString()} bytes)`, logCb);
        ok = true;
      }
    }

    // Đóng modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const closeBtn = page.locator("button:has-text('Đóng')").last();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click({ force: true });
    }
    return ok;
  }

  /**
   * Quét danh sách mã hàng hóa thực tế trên sàn CoreEX / CoreCCP (Data-Driven 100%).
   */
  async scanActualCommoditiesFromTable(page: Page, maxCount = 20): Promise<string[]> {
    await this.waitForTableLoadingComplete(page, 15_000);
    let rows = page.locator("xpath=//tbody[contains(@class, 'MuiTableBody-root') and not(ancestor::div[@id='tabpanel-1'])]//tr[@data-index]");
    let count = await rows.count();
    if (count === 0) {
      rows = page.locator("xpath=//tbody[contains(@class, 'MuiTableBody-root') and not(ancestor::div[@id='tabpanel-1'])]//tr");
      count = await rows.count();
    }
    const list: string[] = [];

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const codeCell = row.locator("xpath=.//td[@data-column-id='UACODE']").first();
      let code = '';
      if (await codeCell.isVisible().catch(() => false)) {
        code = (await codeCell.textContent())?.trim() || '';
      }
      if (!code) {
        const tdList = row.locator("xpath=.//td");
        const numTd = await tdList.count();
        for (let j = 0; j < numTd; j++) {
          const text = (await tdList.nth(j).textContent())?.trim() || '';
          if (/^[A-Z0-9]{2,8}$/.test(text) && !['VND', 'USD', 'MXV', 'KG'].includes(text)) {
            code = text;
            break;
          }
        }
      }

      if (code && !list.includes(code)) {
        list.push(code);
        if (list.length >= maxCount) break;
      }
    }
    return list;
  }

  /**
   * Tải hợp đồng chi tiết theo dữ liệu hàng hóa thật của sàn (Data-Driven 100%).
   * Hỗ trợ chỉ định danh sách targetCodes hoặc tự động quét mã hàng hóa thực tế trên sàn.
   * Đồng thời xuất bảng Hàng hóa chính (HH ACM.xlsx / HH.xlsx) nếu chưa có.
   */
  async downloadCommodityAndContracts(
    page: Page,
    systemUrl: string,
    outputDir: string,
    targetCodesOrLogCb?: string[] | ((m: string) => void),
    logCbArg?: (m: string) => void,
  ): Promise<{ hhPath?: string; contractFiles: string[] }> {
    const targetCodes = Array.isArray(targetCodesOrLogCb) ? targetCodesOrLogCb : undefined;
    const logCb = typeof targetCodesOrLogCb === 'function' ? targetCodesOrLogCb : logCbArg;

    this.log('\n[Commodity & Contracts] Bắt đầu tải Hàng hóa & Hợp đồng chi tiết (Data-Driven)...', logCb);
    const commUrl = this.resolveReportUrl('/PRODUCT/COMMODITY', systemUrl);
    if (!page.url().includes('/PRODUCT/COMMODITY')) {
      await page.goto(commUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(1500);
    }
    await this.dismissModalBackdrop(page);
    await this.waitForTableLoadingComplete(page, 20_000);

    // 1. Xuất file Hàng hóa chính nếu chưa tồn tại
    let hhPath: string | undefined;
    const isCoreEx = this.isCoreExSystem(systemUrl);
    const hhFileName = isCoreEx ? 'HH ACM.xlsx' : 'HH.xlsx';
    const hhDest = path.join(outputDir, hhFileName);
    if (!fs.existsSync(hhDest)) {
      this.log(`  [Commodity] Xuất bảng danh mục hàng hóa chính: ${hhFileName}...`, logCb);
      try {
        const dl = await this.triggerExportDownload(page, 20_000, false, logCb);
        if (dl && dl !== 'NO_DATA') {
          await dl.saveAs(hhDest);
          if (fs.existsSync(hhDest) && fs.statSync(hhDest).size > 0) {
            hhPath = hhDest;
            this.log(`  [Commodity] Đã lưu bảng hàng hóa: ${hhDest} (${fs.statSync(hhDest).size.toLocaleString()} bytes)`, logCb);
          }
        }
      } catch (err: any) {
        this.log(`  [Commodity Warn] Không thể xuất bảng hàng hóa chính: ${err?.message}`, logCb);
      }
    } else {
      hhPath = hhDest;
    }

    const contractFiles: string[] = [];
    let commoditiesToProcess: string[] = [];

    if (targetCodes && targetCodes.length > 0) {
      commoditiesToProcess = targetCodes;
      this.log(`  [Commodity] Danh sách hàng hóa chỉ định: [${commoditiesToProcess.join(', ')}]`, logCb);
    } else {
      this.log(`  [Commodity] Đang quét bảng hàng hóa thực tế trên sàn...`, logCb);
      commoditiesToProcess = await this.scanActualCommoditiesFromTable(page, 20);
      this.log(`  [Commodity] Phát hiện ${commoditiesToProcess.length} mã hàng hóa thực tế: [${commoditiesToProcess.join(', ')}]`, logCb);
    }

    let successfulDownloads = 0;
    for (const code of commoditiesToProcess) {
      const fileName = `HĐ ${code}.xlsx`;
      const destPath = path.join(outputDir, fileName);

      if (!page.url().includes('/PRODUCT/COMMODITY')) {
        await page.goto(commUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        await page.waitForTimeout(1500);
      }

      const ok = await this.exportSingleCommodityContract(page, code, destPath, logCb);
      if (ok && fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
        contractFiles.push(destPath);
        successfulDownloads++;
      }
    }

    // Fallback: nếu các mã chỉ định không có trên sàn hiện tại (ví dụ mã Prod chạy trên UAT), tự động quét hàng hóa thực tế
    if (successfulDownloads === 0 && targetCodes && targetCodes.length > 0) {
      this.log(`  [Info] Không tìm thấy hợp đồng nào cho các mã [${targetCodes.join(', ')}] trên sàn hiện tại. Tự động quét hàng hóa thực tế trên sàn...`, logCb);
      const actualCodes = await this.scanActualCommoditiesFromTable(page, 10);
      for (const code of actualCodes) {
        const fileName = `HĐ ${code}.xlsx`;
        const destPath = path.join(outputDir, fileName);
        if (!page.url().includes('/PRODUCT/COMMODITY')) {
          await page.goto(commUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
          await page.waitForTimeout(1500);
        }
        const ok = await this.exportSingleCommodityContract(page, code, destPath, logCb);
        if (ok && fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
          contractFiles.push(destPath);
        }
      }
    }

    return { hhPath, contractFiles };
  }

  // ── TRỌN BỘ 25 FILE MAKER (CORECCP BATCH DOWNLOADER) ──────────────────────

  /**
   * Tải trọn vẹn hoặc theo đợt bộ 25 file báo cáo thực tế hàng ngày của Maker.
   * Áp dụng kỹ thuật In-page tab switching và gom cụm để tối ưu tốc độ (~35-45s).
   */
  async downloadBatch25CcpReports(params: {
    systemUrl: string;
    username: string;
    password: string;
    outputDir: string;
    phase?: 'PRE_1620' | 'EOD' | 'ALL';
    tradingDate?: string;
    headless?: boolean;
    reports?: string[];
  }, logCb?: (m: string) => void): Promise<{
    success: boolean;
    downloadedFiles: string[];
    failedFiles: string[];
  }> {
    const { systemUrl, username, password, outputDir } = params;
    const phase = params.phase || 'ALL';
    const isHeaded = params.headless === false;

    fs.mkdirSync(outputDir, { recursive: true });

    this.log('='.repeat(60), logCb);
    this.log(`[CORECCP BATCH 25] Bắt đầu tiến trình tải báo cáo Maker (Phase: ${phase})`, logCb);
    this.log(`Thư mục lưu: ${outputDir}`, logCb);
    this.log('='.repeat(60), logCb);

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    const downloadedFiles: string[] = [];
    const failedFiles: string[] = [];

    const helperDownloadTab = async (page: Page, tabSelector: string, destFileName: string) => {
      try {
        const tabElem = page.locator(tabSelector).first();
        if (await tabElem.isVisible({ timeout: 2_000 })) {
          await tabElem.click({ force: true });
          await page.waitForTimeout(600);
        }
        const dest = path.join(outputDir, destFileName);
        const dl = await this.triggerExportDownload(page, 25_000, false, logCb);
        if (dl && dl !== 'NO_DATA') {
          await dl.saveAs(dest);
          if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
            downloadedFiles.push(dest);
            this.log(`  ✓ Đã tải: ${destFileName} (${fs.statSync(dest).size} bytes)`, logCb);
            return true;
          }
        }
      } catch (err: any) {
        this.log(`  [Warn] Lỗi tải ${destFileName}: ${err.message}`, logCb);
      }
      failedFiles.push(destFileName);
      return false;
    };

    const helperDownloadDirect = async (page: Page, relativeUrl: string, destFileName: string, tabName?: string) => {
      try {
        const fullUrl = this.resolveReportUrl(relativeUrl, systemUrl);
        await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30_000 });
        await this.dismissModalBackdrop(page);
        await this.waitForTableLoadingComplete(page, 20_000);

        if (tabName) {
          const tab = page.locator(`xpath=//*[self::button or self::div][contains(text(), '${tabName}')]`).first();
          if (await tab.isVisible({ timeout: 2_000 })) {
            await tab.click({ force: true });
            await page.waitForTimeout(600);
          }
        }

        const dest = path.join(outputDir, destFileName);
        const dl = await this.triggerExportDownload(page, 25_000, false, logCb);
        if (dl && dl !== 'NO_DATA') {
          await dl.saveAs(dest);
          if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
            downloadedFiles.push(dest);
            this.log(`  ✓ Đã tải: ${destFileName} (${fs.statSync(dest).size} bytes)`, logCb);
            return true;
          }
        }
      } catch (err: any) {
        this.log(`  [Warn] Lỗi tải ${destFileName}: ${err.message}`, logCb);
      }
      failedFiles.push(destFileName);
      return false;
    };

    try {
      const chromePath = this.getChromeExecutablePath();
      const launchOptions: any = {
        headless: !isHeaded,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      };
      if (chromePath) launchOptions.executablePath = chromePath;

      browser = await chromium.launch(launchOptions);
      context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();

      // Đăng nhập
      await this.loginVnclear(page, systemUrl, username, password, logCb);

      if (phase === 'PRE_1620') {
        // ── ĐỢT 1: TRƯỚC 16H20 (2 FILE) ──
        this.log('\n>>> ĐỢT 1: GIÁM SÁT TRƯỚC 16H20 (2 FILE) <<<', logCb);
        await helperDownloadDirect(page, '/RISKMNG/ACCTMARGIN_ALL', 'QL TT TKGD truoc 4h20.xlsx', 'trạng thái TKGD');
        await helperDownloadDirect(page, '/ORDERS/OPEN_POSITION', 'TTM truoc 4h20.xlsx');

      } else {
        // ── ĐỢT 2: CUỐI NGÀY EOD HOẶC TẤT CẢ (23 - 25 FILE) ──
        this.log('\n>>> BẮT ĐẦU TẢI TRỌN BỘ CÁC FILE CHÍNH CỦA MAKER <<<', logCb);

        // 1. Cụm Lệnh thường (/ORDERS/ORDERBOOK -> 4 file)
        const orderUrl = this.resolveReportUrl('/ORDERS/ORDERBOOK', systemUrl);
        await page.goto(orderUrl, { waitUntil: 'networkidle', timeout: 30_000 });
        await this.dismissModalBackdrop(page);
        await helperDownloadTab(page, "xpath=//button[@role='tab' and contains(., 'Tất cả')]", 'DSL CCP.xlsx');
        await helperDownloadTab(page, "xpath=//button[@role='tab' and contains(., 'Lệnh đã khớp')]", 'DSLDK CCP.xlsx');
        await helperDownloadTab(page, "xpath=//button[@role='tab' and contains(., 'Lệnh chờ khớp')]", 'DSLCK CCP.xlsx');
        await helperDownloadTab(page, "xpath=//button[@role='tab' and contains(., 'Lệnh đã hủy')]", 'DSLDH CCP.xlsx');

        // 2. Cụm Lệnh MM (/ORDERS/ORDERBOOK_MM -> 4 file)
        const mmUrl = this.resolveReportUrl('/ORDERS/ORDERBOOK_MM', systemUrl);
        await page.goto(mmUrl, { waitUntil: 'networkidle', timeout: 30_000 });
        await this.dismissModalBackdrop(page);
        await helperDownloadTab(page, "xpath=//button[@role='tab' and contains(., 'Tất cả')]", 'DSL MM CCP.xlsx');
        await helperDownloadTab(page, "xpath=//button[@role='tab' and contains(., 'Lệnh đã khớp')]", 'DSLDK MM CCP.xlsx');
        await helperDownloadTab(page, "xpath=//button[@role='tab' and contains(., 'Lệnh chờ khớp')]", 'DSLCK MM CCP.xlsx');
        await helperDownloadTab(page, "xpath=//button[@role='tab' and contains(., 'Lệnh đã hủy')]", 'DSLDH MM CCP.xlsx');

        // 3. Khớp lệnh thường & MM
        await helperDownloadDirect(page, '/ORDERS/ORDERMATCH_DETAIL', 'DSGD CCP.xlsx');
        await helperDownloadDirect(page, '/ORDERS/ORDERBOOK_ALL_MM', 'DSGD MM CCP.xlsx');

        // 4. Vị thế mở cuối ngày & Tất toán
        await helperDownloadDirect(page, '/ORDERS/OPEN_POSITION', 'TTM CCP.xlsx');
        await helperDownloadDirect(page, '/ORDERS/PNL_EXECUTED', 'TTTT.xlsx', 'Lịch sử tất toán');

        // 5. Cụm Trạng thái rủi ro (2 file)
        const riskUrl = this.resolveReportUrl('/RISKMNG/ACCTMARGIN_ALL', systemUrl);
        await page.goto(riskUrl, { waitUntil: 'networkidle', timeout: 30_000 });
        await this.dismissModalBackdrop(page);
        await helperDownloadTab(page, "xpath=//button[@role='tab' and contains(., 'trạng thái TKGD')]", 'QL TT TKGD.xlsx');
        await helperDownloadTab(page, "xpath=//button[@role='tab' and contains(., 'trạng thái TKTVKD')]", 'QL TT TVKD.xlsx');

        // 6. Cụm Quản lý ký quỹ (2 file)
        await helperDownloadTab(page, "xpath=//button[@role='tab' and contains(., 'trạng thái TKGD')]", 'DSQLKQ TKGD.xlsx');
        await helperDownloadTab(page, "xpath=//button[@role='tab' and contains(., 'trạng thái TKTVKD')]", 'DSQLKQ TVKD.xlsx');

        // 7. Nộp rút tiền & Danh sách TKGD & Giá thanh toán
        await helperDownloadDirect(page, '/CASHTRANFER/CASHTRANFER_HIST', 'NR.xlsx');
        await helperDownloadDirect(page, '/ACCOUNTMNG/ACCOUNTS_INFO', 'DSTKGD ACM.xlsx');
        await helperDownloadDirect(page, '/PRODUCT/SETTLEMENT', 'GTT CCP.xlsx');

        // 8. Cụm Hàng hóa & Modal Hợp đồng
        const commResult = await this.downloadCommodityAndContracts(page, systemUrl, outputDir, logCb);
        if (commResult.hhPath) downloadedFiles.push(commResult.hhPath);
        downloadedFiles.push(...commResult.contractFiles);
      }

      this.log(`\n[CORECCP BATCH 25] HOÀN TẤT: Thành công ${downloadedFiles.length} file, Thất bại ${failedFiles.length} file.`, logCb);
      return {
        success: failedFiles.length === 0,
        downloadedFiles,
        failedFiles,
      };
    } catch (err: any) {
      this.log(`[CORECCP BATCH 25] Lỗi tiến trình: ${err.message}`, logCb);
      return {
        success: false,
        downloadedFiles,
        failedFiles,
      };
    } finally {
      await context?.close().catch(() => {});
      await browser?.close().catch(() => {});
    }
  }
}

