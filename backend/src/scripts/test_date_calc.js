function getInitialTradingSessionDate(
  now,
  sessionStartStr,
) {
  const baseTime = now || new Date();
  // Giờ Việt Nam GMT+7
  const vnTime = new Date(baseTime.getTime() + 7 * 60 * 60 * 1000);
  const currentHour = vnTime.getUTCHours();
  const currentMin = vnTime.getUTCMinutes();

  let effectiveStart = sessionStartStr;

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

// Test with 2026-10-07T21:15:56.187Z (which is 04:15:56 AM on 08/10/2026 in Vietnam)
const testDate = new Date('2026-10-07T21:15:56.187Z');
console.log('Test at 04:15 AM VN:', getInitialTradingSessionDate(testDate));
console.log('Test at 04:15 AM VN with sessionStart 05:00:', getInitialTradingSessionDate(testDate, '05:00'));
console.log('Test at 04:15 AM VN with sessionStart 04:00:', getInitialTradingSessionDate(testDate, '04:00'));
