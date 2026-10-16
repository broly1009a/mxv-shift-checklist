/**
 * commodity-catalog.constant.ts
 *
 * Danh mục chuẩn hóa 17 mặt hàng giao dịch chủ lực của Sàn Giao dịch Hàng hóa Việt Nam (MXV).
 * Phục vụ Báo cáo Ban Giám Đốc và Dashboard Quản Lý Giao Dịch (QLGD).
 * Căn cứ thực chứng: Bản mẫu thiết kế Mục 8 Dashboard.
 */

export interface CommodityCatalogItem {
  symbol: string;
  name: string;
  category: 'Nông sản' | 'Nguyên liệu công nghiệp' | 'Kim loại' | 'Năng lượng' | 'Khác';
  sortOrder: number;
}

/**
 * Danh mục 17 mặt hàng chuẩn hóa theo đúng thứ tự báo cáo Ban Giám Đốc
 */
export const COMMODITY_CATALOG: Record<string, CommodityCatalogItem> = {
  // 1. Nhóm Nông sản (STT 1-6)
  ZWA: { symbol: 'ZWA', name: 'Lúa mỳ', category: 'Nông sản', sortOrder: 1 },
  ZLE: { symbol: 'ZLE', name: 'Dầu đậu tương', category: 'Nông sản', sortOrder: 2 },
  ZCE: { symbol: 'ZCE', name: 'Ngô', category: 'Nông sản', sortOrder: 3 },
  ZSE: { symbol: 'ZSE', name: 'Đậu tương', category: 'Nông sản', sortOrder: 4 },
  ZME: { symbol: 'ZME', name: 'Khô đậu tương', category: 'Nông sản', sortOrder: 5 },
  KWE: { symbol: 'KWE', name: 'Lúa mỳ Kansas', category: 'Nông sản', sortOrder: 6 },

  // 2. Nhóm Nguyên liệu công nghiệp (STT 7-10)
  KCE: { symbol: 'KCE', name: 'Cà phê Arabica', category: 'Nguyên liệu công nghiệp', sortOrder: 7 },
  SBE: { symbol: 'SBE', name: 'Đường', category: 'Nguyên liệu công nghiệp', sortOrder: 8 },
  LRC: { symbol: 'LRC', name: 'Cà phê Robusta', category: 'Nguyên liệu công nghiệp', sortOrder: 9 },
  CTE: { symbol: 'CTE', name: 'Bông', category: 'Nguyên liệu công nghiệp', sortOrder: 10 },

  // 3. Nhóm Kim loại (STT 11-17)
  SIE: { symbol: 'SIE', name: 'Bạc', category: 'Kim loại', sortOrder: 11 },
  SIL: { symbol: 'SIL', name: 'Bạc Micro', category: 'Kim loại', sortOrder: 12 },
  CPE: { symbol: 'CPE', name: 'Đồng', category: 'Kim loại', sortOrder: 13 },
  MHG: { symbol: 'MHG', name: 'Đồng Micro', category: 'Kim loại', sortOrder: 14 },
  PLE: { symbol: 'PLE', name: 'Bạch kim', category: 'Kim loại', sortOrder: 15 },
  SI5CO: { symbol: 'SI5CO', name: 'Bạc Nano', category: 'Kim loại', sortOrder: 16 },
  PL1NY: { symbol: 'PL1NY', name: 'Bạch kim Nano', category: 'Kim loại', sortOrder: 17 },
};

/**
 * Lấy thông tin hàng hóa chuẩn từ mã cơ sở.
 * Trả về thông tin mặc định an toàn nếu mã chưa có trong từ điển (Zero-Crash).
 */
export function getCommodityInfo(baseSymbol: string): CommodityCatalogItem {
  const upper = String(baseSymbol || '').trim().toUpperCase();
  if (COMMODITY_CATALOG[upper]) {
    return COMMODITY_CATALOG[upper];
  }
  return {
    symbol: upper || 'UNKNOWN',
    name: upper || 'Chưa định danh',
    category: 'Khác',
    sortOrder: 999,
  };
}
