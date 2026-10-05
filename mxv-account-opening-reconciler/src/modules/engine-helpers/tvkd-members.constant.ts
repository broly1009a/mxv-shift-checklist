/**
 * TVKD_DEFAULT_NAME_MAP — Bảng tra cứu tên hiển thị cho các Thành viên kinh doanh (TVKD).
 *
 * ⚠️ QUY TẮC BẢO TRÌ:
 * - Đây là nguồn sự thật duy nhất (Single Source of Truth) cho tên TVKD trong toàn hệ thống.
 * - Khi MXV cấp phép cho TVKD mới hoặc thay đổi tên, chỉ cần cập nhật tại đây.
 * - Không được hardcode map này trực tiếp vào bất kỳ hàm nghiệp vụ nào khác.
 *
 * 🔮 HƯỚNG PHÁT TRIỂN (Roadmap):
 * - Bước tiếp theo: Chuyển sang load từ MongoDB collection `tvkd_members`
 *   để Admin cập nhật qua UI mà không cần deploy lại code.
 * - Khi DB đã có dữ liệu: file này giữ vai trò FALLBACK DEFAULT.
 */
export const TVKD_DEFAULT_NAME_MAP: Record<string, string> = {
  '003': 'Gia Cát Lợi',
  '012': 'Sài Gòn Futures',
  '036': 'HCT',
  '007': 'An Lộc',
  '021': 'VnCommodities',
  '682': 'Đông Nam Á',
  '028': 'Hưng Thịnh',
};

/**
 * Lấy tên hiển thị cho TVKD theo mã.
 * Tra cứu trong map động trước (nếu có), sau đó fallback về DEFAULT.
 *
 * @param maTVKD Mã 3 chữ số của TVKD (ví dụ: '003')
 * @param dynamicMap Bản đồ tên load từ DB/config (tuỳ chọn, ghi đè DEFAULT)
 */
export function resolveTvkdName(
  maTVKD: string,
  dynamicMap?: Record<string, string>,
): string {
  if (dynamicMap && dynamicMap[maTVKD]) return dynamicMap[maTVKD];
  return TVKD_DEFAULT_NAME_MAP[maTVKD] || `TVKD ${maTVKD}`;
}
