/**
 * Tiện ích xử lý Ngày Phiên Giao Dịch (Trading Session Date) chuẩn theo Tool C# (operate-transaction-app):
 * - Phiên giao dịch mở lúc sáng sớm (05:00 - 06:30) và kéo dài xuyên đêm tới sáng hôm sau.
 * - Nếu thời điểm hiện tại < 06:30 sáng (giờ VN), phiên làm việc thực tế là ca đêm của ngày T - 1 (bỏ qua Thứ 7, Chủ Nhật).
 */
export function getInitialTradingSessionDate(now?: Date): string {
  const baseTime = now || new Date();
  // Giờ Việt Nam GMT+7
  const vnTime = new Date(baseTime.getTime() + 7 * 60 * 60 * 1000);
  const currentHour = vnTime.getUTCHours();
  const currentMin = vnTime.getUTCMinutes();

  const sessionDate = new Date(vnTime);
  // Nếu trước 06:30 sáng giờ VN, tự động lùi về ngày T - 1
  if (currentHour < 6 || (currentHour === 6 && currentMin < 30)) {
    sessionDate.setUTCDate(sessionDate.getUTCDate() - 1);
  }
  // Bỏ qua Thứ 7, Chủ Nhật
  while (sessionDate.getUTCDay() === 0 || sessionDate.getUTCDay() === 6) {
    sessionDate.setUTCDate(sessionDate.getUTCDate() - 1);
  }

  return sessionDate.toISOString().split('T')[0];
}
