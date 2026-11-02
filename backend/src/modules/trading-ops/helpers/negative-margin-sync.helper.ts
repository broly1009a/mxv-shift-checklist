/**
 * negative-margin-sync.helper.ts
 *
 * Tiện ích đồng bộ và đối soát danh sách tài khoản âm ký quỹ (M-System & CoreCCP).
 * Hiện thực hóa quy chuẩn "3 Thôi" theo chỉ đạo nghiệp vụ:
 * 1. Máy tự thêm sau mỗi phiên có TK âm mới.
 * 2. Nếu đã có sẵn trong danh sách -> Thôi không báo động lặp lại.
 * 3. Nếu đã nạp tiền (hết âm) -> Thôi theo dõi, tự động dọn dẹp khỏi CSDL.
 */

export interface MonitoredNegativeAccount {
  account: string;                                     // Mã TKGD (e.g. '088C123456')
  negativeType: 'IMR' | 'BALANCE' | 'BOTH' | 'MANUAL'; // Phân loại âm
  currentBalance: number | null;                       // Số dư TKKQ hiện tại (VND), null = Chưa có dữ liệu phiên
  availableMargin: number | null;                      // Ký quỹ khả dụng (VND), null = Chưa có dữ liệu phiên
  additionalMargin: number | null;                     // Mức bổ sung ký quỹ (VND), null = Chưa có dữ liệu phiên
  initialRequiredMargin?: number | null;               // Ký quỹ ban đầu IMR (VND)
  recordedSessionDate: string | null;                  // Phiên ghi nhận (YYYY-MM-DD), null = Chưa xác định phiên
  system: 'MS' | 'CCP';                                // Nguồn phân hệ
  updatedAt: string | null;                            // ISO Timestamp
  note?: string;                                       // Ghi chú
}

export interface CurrentNegativeAccountDetail {
  account: string;
  negativeType: 'IMR' | 'BALANCE' | 'BOTH' | 'MANUAL';
  currentBalance: number;
  availableMargin: number;
  additionalMargin: number;
  initialRequiredMargin?: number;
}

/**
 * Chuẩn hóa danh sách tài khoản lưu trong DB sang dạng MonitoredNegativeAccount[].
 * Tuân thủ nguyên tắc không bịa đặt số liệu (Zero Fabricated Data):
 * - Nếu là chuỗi string hoặc chưa qua quét EOD: các trường số dư và ngày phiên để là null (N/A).
 * - Tuyệt đối không tự ý gán bằng 0 hoặc new Date().
 */
export function normalizeMonitoredNegativeAccounts(
  rawList: any,
  defaultSystem: 'MS' | 'CCP' = 'MS',
): MonitoredNegativeAccount[] {
  if (!Array.isArray(rawList)) return [];

  const result: MonitoredNegativeAccount[] = [];
  for (const item of rawList) {
    if (!item) continue;
    if (typeof item === 'string') {
      const cleanAcc = item.trim().toUpperCase();
      if (!cleanAcc) continue;
      result.push({
        account: cleanAcc,
        negativeType: 'MANUAL',
        currentBalance: null,
        availableMargin: null,
        additionalMargin: null,
        initialRequiredMargin: null,
        recordedSessionDate: null,
        system: defaultSystem,
        updatedAt: null,
        note: 'Chờ phiên EOD quét đối soát số liệu',
      });
    } else if (typeof item === 'object' && item.account) {
      const cleanAcc = String(item.account).trim().toUpperCase();
      if (!cleanAcc) continue;
      result.push({
        account: cleanAcc,
        negativeType: item.negativeType || 'MANUAL',
        currentBalance: item.currentBalance !== undefined && item.currentBalance !== null ? Number(item.currentBalance) : null,
        availableMargin: item.availableMargin !== undefined && item.availableMargin !== null ? Number(item.availableMargin) : null,
        additionalMargin: item.additionalMargin !== undefined && item.additionalMargin !== null ? Number(item.additionalMargin) : null,
        initialRequiredMargin: item.initialRequiredMargin !== undefined && item.initialRequiredMargin !== null ? Number(item.initialRequiredMargin) : null,
        recordedSessionDate: item.recordedSessionDate || null,
        system: item.system || defaultSystem,
        updatedAt: item.updatedAt || null,
        note: item.note,
      });
    }
  }
  return result;
}

/**
 * Hàm điều phối nghiệp vụ đối soát danh sách âm:
 * - Dọn dẹp tài khoản đã nạp tiền (không còn âm trong phiên hôm nay).
 * - Cập nhật số liệu cho các tài khoản âm cũ đang theo dõi.
 * - Phát hiện tài khoản âm MỚI và tự động đưa vào danh sách.
 */
export function reconcileNegativeMarginList(params: {
  currentNegativeMap: Map<string, CurrentNegativeAccountDetail>;
  savedAccounts: MonitoredNegativeAccount[];
  sessionDateStr: string;
  systemType: 'MS' | 'CCP';
}): {
  updatedSavedList: MonitoredNegativeAccount[];
  newNegativeAccounts: MonitoredNegativeAccount[];
  resolvedAccounts: string[];
  persistentAccounts: MonitoredNegativeAccount[];
} {
  const { currentNegativeMap, savedAccounts, sessionDateStr, systemType } = params;
  const safeSavedList = Array.isArray(savedAccounts) ? savedAccounts : [];
  const safeCurrentMap = currentNegativeMap instanceof Map ? currentNegativeMap : new Map<string, CurrentNegativeAccountDetail>();

  const savedMap = new Map<string, MonitoredNegativeAccount>();
  for (const acc of safeSavedList) {
    if (acc && acc.account) {
      savedMap.set(acc.account.toUpperCase(), acc);
    }
  }

  const updatedSavedList: MonitoredNegativeAccount[] = [];
  const newNegativeAccounts: MonitoredNegativeAccount[] = [];
  const persistentAccounts: MonitoredNegativeAccount[] = [];
  const resolvedAccounts: string[] = [];

  // 1. Kiểm tra tài khoản cũ trong DB:
  // Nếu hôm nay không còn âm trong file EOD/QLTKGD -> "Đã nạp tiền thì thôi" (gỡ bỏ)
  for (const saved of safeSavedList) {
    if (!saved || !saved.account) continue;
    const accKey = saved.account.toUpperCase();
    if (safeCurrentMap.has(accKey)) {
      const latest = safeCurrentMap.get(accKey)!;
      const updatedAcc: MonitoredNegativeAccount = {
        ...saved,
        currentBalance: latest.currentBalance,
        availableMargin: latest.availableMargin,
        additionalMargin: latest.additionalMargin,
        initialRequiredMargin: latest.initialRequiredMargin ?? saved.initialRequiredMargin,
        negativeType: latest.negativeType,
        recordedSessionDate: saved.recordedSessionDate || sessionDateStr,
        updatedAt: new Date().toISOString(),
      };
      persistentAccounts.push(updatedAcc);
      updatedSavedList.push(updatedAcc);
    } else {
      // Tài khoản đã nộp tiền, không còn âm
      resolvedAccounts.push(saved.account);
    }
  }

  // 2. Kiểm tra tài khoản âm hôm nay:
  // Nếu CHƯA CÓ trong CSDL -> "Máy tự thêm sau mỗi phiên có TK âm mới"
  for (const [accKey, detail] of safeCurrentMap.entries()) {
    if (!savedMap.has(accKey)) {
      const newAcc: MonitoredNegativeAccount = {
        account: detail.account,
        negativeType: detail.negativeType,
        currentBalance: detail.currentBalance,
        availableMargin: detail.availableMargin,
        additionalMargin: detail.additionalMargin,
        initialRequiredMargin: detail.initialRequiredMargin,
        recordedSessionDate: sessionDateStr,
        system: systemType,
        updatedAt: new Date().toISOString(),
      };
      newNegativeAccounts.push(newAcc);
      updatedSavedList.push(newAcc);
    }
  }

  return {
    updatedSavedList,
    newNegativeAccounts,
    resolvedAccounts,
    persistentAccounts,
  };
}
