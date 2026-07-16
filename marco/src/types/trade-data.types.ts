/**
 * Types cho dữ liệu giao dịch từ các file nguồn
 * Tương đương với các sheet: DSGD, FR, TTM, OP, PS, TTTT trong VBA macro
 */

// ─── Row từ file DSGD (Danh sách giao dịch - CQG/M-System) ─────────────────
export interface DsgdRow {
  /** Cột A: STT */
  stt?: number;
  /** Cột B: Ngày GD */
  ngayGD?: Date | string;
  /** Cột C: Giờ GD */
  gioGD?: string;
  /** Cột D: Mã TKGD (ví dụ: "MXV001-S", "MXV002-L", "MXV003-A") */
  maTKGD?: string;
  /** Cột E: Mã NĐT */
  maNDT?: string;
  /** Cột F: Loại hợp đồng (C.*, P.*, FUT, SPR...) */
  loaiHD?: string;
  /** Cột G: Thông tin khác (ngày đáo hạn...) */
  col7?: string;
  /** Cột H: Mã sản phẩm/hàng hóa (ví dụ: "TRU2026M", "LCOZ26") */
  maSanPham?: string;
  /** Cột I: Mã kỳ hạn */
  maKyHan?: string;
  /** Cột J */
  col10?: string;
  /** Cột K */
  col11?: string;
  /** Cột L */
  col12?: string;
  /** Cột M: Chiều giao dịch (BUY/SELL) */
  side?: 'BUY' | 'SELL' | string;
  /** Cột N */
  col14?: string | number;
  /** Cột O */
  col15?: string | number;
  /** Cột P: Giá khớp lệnh */
  gia?: number;
  /** Cột Q: Khối lượng (lots) */
  khoiLuong?: number;
  /** Raw row data */
  [key: string]: unknown;
}

// ─── Row từ file FR (Forward Rate / Sổ lệnh MXV) ───────────────────────────
export interface FrRow {
  /** Cột A: Mã TKGD (kết thúc bằng S/L để phân loại) */
  maTKGD?: string;
  /** Cột B: Thời gian (dạng decimal Excel hoặc Date) */
  thoiGian?: number | Date | string;
  /** Cột C: Mã sản phẩm */
  maSanPham?: string;
  /** Cột D */
  col4?: string | number;
  /** Cột E */
  col5?: string | number;
  /** Cột F: Khối lượng (string cần VALUE()) */
  khoiLuong?: string | number;
  /** Cột G */
  col7?: string | number;
  /** Cột H */
  col8?: string | number;
  /** Cột I: Khối lượng đã chuyển sang number (= VALUE(F)) */
  khoiLuongNum?: number;
  /** Cột J (tính toán): Tên SP rút gọn = LEFT(C, LEN-3) */
  maSPNgan?: string;
  /** Cột K (tính toán): Ngày giao dịch chuẩn hóa */
  ngayGD?: Date;
  /** Cột L (tính toán): Thời điểm giao dịch */
  thoiDiem?: Date;
  [key: string]: unknown;
}

// ─── Row từ file TTM (Trading Ticket Master) ────────────────────────────────
export interface TtmRow {
  /** Cột A: STT/ID */
  id?: number | string;
  /** Cột B: Thông tin */
  col2?: string;
  /** ... các cột từ C đến G */
  col3?: string | number;
  col4?: string | number;
  col5?: string | number;
  col6?: string | number;
  col7?: string | number;
  /** Cột H: Mã TKGD (Field 8 trong VBA) */
  maTKGD?: string;
  /** Cột I: Thông tin thêm */
  col9?: string | number;
  /** Cột J: Loại hợp đồng (Field 10 trong VBA cho Options filter) */
  loaiHD?: string;
  /** Cột N+O: KLM/KLB (tính toán) */
  klm?: number;
  klb?: number;
  [key: string]: unknown;
}

// ─── Row từ file OP (Open Position) ─────────────────────────────────────────
export interface OpRow {
  /** Cột A: Mã TKGD (kết thúc S/L) */
  maTKGD?: string;
  /** Cột B */
  col2?: string | number;
  /** Cột C: Loại hợp đồng */
  loaiHD?: string;
  /** Cột D: Long lots */
  longLots?: string | number;
  /** Cột E: Short lots */
  shortLots?: string | number;
  /** Cột I (tính toán): = VALUE(D) + VALUE(E) */
  totalLots?: number;
  [key: string]: unknown;
}

// ─── Row từ file PS (Pending Settlement) ────────────────────────────────────
export interface PsRow {
  /** Cột A: Mã TKGD */
  maTKGD?: string;
  /** Cột B */
  col2?: string | number;
  /** Cột C */
  col3?: string | number;
  /** Cột D: Loại hợp đồng */
  loaiHD?: string;
  /** Cột E: Khối lượng */
  khoiLuong?: string | number;
  /** Cột I (tính toán): = VALUE(E) */
  khoiLuongNum?: number;
  [key: string]: unknown;
}

// ─── Row từ file TTTT (Tổng thể tất toán) ───────────────────────────────────
export interface TtttRow {
  /** Cột A */
  col1?: string | number;
  /** Cột B */
  col2?: string | number;
  /** ... */
  col3?: string | number;
  col4?: string | number;
  col5?: string | number;
  col6?: string | number;
  /** Cột G: Mã kỳ hạn rút gọn (RIGHT(J, 3)) */
  maKyHanNgan?: string;
  col8?: string | number;
  /** Cột H: Mã TKGD (Field 8 trong VBA) */
  maTKGD?: string;
  col9?: string | number;
  /** Cột J: Loại hợp đồng (Field 10 trong VBA) */
  loaiHD?: string;
  /** Cột P: Khối lượng */
  khoiLuong?: number;
  [key: string]: unknown;
}

// ─── Loại phân nhóm giao dịch ───────────────────────────────────────────────
export type TradeCategory = 'Futures' | 'Spread' | 'LME' | 'Options' | 'ACM' | 'TestACM';

export interface ClassifiedTrades {
  dsgd: DsgdRow[];          // Tất cả giao dịch Futures (trừ ACM)
  dsgdSpread: DsgdRow[];    // Giao dịch Spread
  dsgdLme: DsgdRow[];       // Giao dịch LME
  dsgdOptions: DsgdRow[];   // Giao dịch Options
  dsgdAcm: DsgdRow[];       // Giao dịch ACM (thường)
  testAcm: DsgdRow[];       // Giao dịch ACM test (mã 999*)

  fr: FrRow[];
  frSpread: FrRow[];
  frLme: FrRow[];
  frOptions: FrRow[];

  ttm: TtmRow[];
  ttmSpread: TtmRow[];
  ttmLme: TtmRow[];
  ttmOptions: TtmRow[];
  ttmAcm: TtmRow[];

  op: OpRow[];
  opSpread: OpRow[];
  opLme: OpRow[];
  opOptions: OpRow[];

  ps: PsRow[];
  psSpread: PsRow[];
  psLme: PsRow[];
  psOptions: PsRow[];

  tttt: TtttRow[];
  ttttSpread: TtttRow[];
  ttttLme: TtttRow[];
  ttttOptions: TtttRow[];
  ttttAcm: TtttRow[];
  lmeExpired: TtttRow[];    // LME hết hạn
}

// ─── Tỷ giá config ─────────────────────────────────────────────────────────
export interface TyGiaConfig {
  /** Sheet1!D2 - Tỷ giá mặc định (USD/VND) */
  tyGiaDefault: number;
  /** Sheet1!D3 - Tỷ giá cho TRU */
  tyGiaTru: number;
  /** Sheet1!D4 - Tỷ giá cho MPO */
  tyGiaMpo: number;
}

// ─── Bảng tra cứu hàng hóa ──────────────────────────────────────────────────
export interface HangHoaLookup {
  /** Mã hàng hóa (ví dụ: TRU, MPO, LCOZ, ...) */
  maHH: string;
  /** Tên hàng hóa */
  tenHH: string;
  /** Hệ số quy đổi (cột 2 trong Hhoa Vlookup) */
  heSo: number;
  /** Đơn vị (cột 3 trong Hhoa Vlookup) */
  donVi: number;
}

// ─── Config đường dẫn file nguồn ────────────────────────────────────────────
export interface MacroConfig {
  /** Ngày giao dịch (Sheet1!N3) */
  ngayGD: Date;

  // Đường dẫn file nguồn (từ Sheet2 trong VBA)
  /** Sheet2!A5 - file DSGD nguồn */
  pathDsgd: string;
  /** Sheet2!A9 - file GDT (global data table để append) */
  pathGdt: string;
  /** Sheet2!A10 - file TTM */
  pathTtm: string;
  /** Sheet2!A11 - file TTTT */
  pathTttt: string;
  /** Sheet2!A13 - file FR */
  pathFr: string;
  /** Sheet2!A14 - file OP */
  pathOp: string;
  /** Sheet2!A76 - file LK (LME bổ sung) */
  pathLk?: string;
  /** Sheet2!A77 - filter mã kỳ hạn LME */
  filterLmeKyHan?: string;
  /** Sheet2!A158 - file PS */
  pathPs?: string;

  // Đường dẫn file output/lịch sử
  /** Sheet2!A22 - file lịch sử tổng hợp */
  pathOutputHistory: string;
  /** Sheet2!A78 - file lịch sử LME */
  pathOutputLme?: string;
  /** Sheet2!A82 - file lịch sử Options */
  pathOutputOptions?: string;
  /** Sheet2!A200 - file lịch sử ACM */
  pathOutputAcm?: string;

  // Thông số khác
  /** Sheet2!C3 - ngày đáo hạn LME */
  ngayDaoHanLme?: string;
  /** Sheet2!Y1 - deadline cho QO/QP/BM/MPO */
  deadlineSpecial?: number;
  /** Sheet2!X2, X4 - khoảng thời gian đặc biệt */
  specialTimeStart?: number;
  specialTimeEnd?: number;
}
