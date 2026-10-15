/**
 * Tiện ích xử lý Ngày Phiên Giao Dịch (Trading Session Date) chuẩn theo Tool C# (operate-transaction-app):
 * - Phiên giao dịch mở lúc sáng sớm (mặc định cấu hình session_start_time, thường là 05:00 hoặc 06:30) và kéo dài xuyên đêm tới sáng hôm sau.
 * - Nếu thời điểm hiện tại < giờ bắt đầu phiên (giờ VN), phiên làm việc thực tế là ca đêm của ngày T - 1 (bỏ qua Thứ 7, Chủ Nhật).
 */
export function getInitialTradingSessionDate(
  now?: Date,
  sessionStartStr?: string,
): string {
  const baseTime = now || new Date();
  // Giờ Việt Nam GMT+7
  const vnTime = new Date(baseTime.getTime() + 7 * 60 * 60 * 1000);
  const currentHour = vnTime.getUTCHours();
  const currentMin = vnTime.getUTCMinutes();

  let effectiveStart = sessionStartStr;
  if (!effectiveStart && typeof window !== 'undefined') {
    effectiveStart = localStorage.getItem('tm_session_start_time') || undefined;
  }

  let sessionHour = 5;
  let sessionMin = 0;
  if (effectiveStart) {
    const parts = effectiveStart.split(':').map(Number);
    if (parts.length >= 1 && !isNaN(parts[0])) sessionHour = parts[0];
    if (parts.length >= 2 && !isNaN(parts[1])) sessionMin = parts[1];
  }

  const sessionDate = new Date(vnTime);
  // Nếu trước giờ bắt đầu phiên (giờ VN), tự động lùi về ngày T - 1 (trừ rạng sáng thứ Hai)
  if (currentHour < sessionHour || (currentHour === sessionHour && currentMin < sessionMin)) {
    if (vnTime.getUTCDay() !== 1) {
      sessionDate.setUTCDate(sessionDate.getUTCDate() - 1);
      while (sessionDate.getUTCDay() === 0 || sessionDate.getUTCDay() === 6) {
        sessionDate.setUTCDate(sessionDate.getUTCDate() - 1);
      }
    }
  }

  return sessionDate.toISOString().split('T')[0];
}
