/**
 * DTOs cho lot-statistics API
 */

export class ProcessLotDto {
  /** Ngày giao dịch, format: YYYY-MM-DD */
  ngayGD: string;

  /**
   * 4 ngày TRU cần trừ khi tính FR Product
   * Tương đương Sheet2!A15, A28, A32, A34 trong VBA
   * Format: ["2026-07-16", "2026-07-15", ...]
   */
  truDates?: string[];

  /**
   * 2 ngày FEF cần trừ (Sheet2!A15, A28)
   */
  fefDates?: string[];

  /**
   * 2 ngày ZFT cần trừ
   */
  zftDates?: string[];

  /**
   * Mã kỳ hạn LME đã hết hạn để lọc LME Expired
   * Tương đương Sheet2!A77 trong VBA
   * Ví dụ: "M26"
   */
  filterLmeKyHan?: string;

  /**
   * Deadline cho QO/QP/BM/MPO (Excel serial number)
   * Tương đương Sheet2!Y1 trong VBA
   */
  deadline?: number;
}

export class LotConfigDto {
  /** Đường dẫn thư mục DSGD mặc định trên server */
  defaultPathDsgd?: string;

  /** Đường dẫn thư mục FR mặc định trên server */
  defaultPathFr?: string;

  /** Đường dẫn thư mục TTM mặc định */
  defaultPathTtm?: string;

  /** Đường dẫn thư mục TTTT mặc định */
  defaultPathTttt?: string;

  /** Đường dẫn thư mục OP mặc định */
  defaultPathOp?: string;

  /** Đường dẫn thư mục PS mặc định */
  defaultPathPs?: string;

  /** Mã kỳ hạn LME hết hạn mặc định */
  defaultLmeKyHan?: string;
}
