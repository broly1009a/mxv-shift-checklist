/**
 * Tiện ích xử lý Ngày Phiên Giao Dịch (Trading Session Date) chuẩn theo Tool C# (operate-transaction-app):
 * - Phiên giao dịch mở lúc sáng sớm (theo cấu hình session_start_time, mặc định '05:00') và kéo dài xuyên đêm tới sáng hôm sau.
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

  let sessionHour = 0;
  let sessionMin = 0;
  if (effectiveStart) {
    const parts = effectiveStart.split(':').map(Number);
    if (parts.length >= 1 && !isNaN(parts[0])) sessionHour = parts[0];
    if (parts.length >= 2 && !isNaN(parts[1])) sessionMin = parts[1];
  }

  const sessionDate = new Date(vnTime);
  // Chuẩn theo Tool C# (BackupService.cs#L106-L114):
  // - Nếu trước giờ bắt đầu phiên (giờ VN), lùi 1 ngày (AddDays(-1))
  // - Nếu rơi vào Thứ 7 hoặc Chủ Nhật, lùi về Thứ 6 gần nhất
  if (effectiveStart && (currentHour < sessionHour || (currentHour === sessionHour && currentMin < sessionMin))) {
    sessionDate.setUTCDate(sessionDate.getUTCDate() - 1);
  }
  while (sessionDate.getUTCDay() === 0 || sessionDate.getUTCDay() === 6) {
    sessionDate.setUTCDate(sessionDate.getUTCDate() - 1);
  }

  return sessionDate.toISOString().split('T')[0];
}
