export interface BotTaskDefinition {
  jobType: string;      // Loại job trong bot_jobs (VD: 'CHECK_KLGD')
  botCheckType: string; // Loại bot gắn trên template ca trực (VD: 'CHECK_KLGD')
  displayName: string;  // Tên hiển thị loại bot
  description: string;  // Mô tả chức năng nghiệp vụ
}

/**
 * Danh mục các loại Bot được hệ thống hỗ trợ (Capabilities Catalog).
 * Tuyệt đối KHÔNG chứa bất kỳ Task ID, Alias hay Pattern ID cụ thể nào (Tuân thủ AGENTS.md Mục 7).
 */
export const BOT_TASK_REGISTRY: Record<string, BotTaskDefinition> = {
  CHECK_KLGD: {
    jobType: 'CHECK_KLGD',
    botCheckType: 'CHECK_KLGD',
    displayName: 'Đối Chiếu Khớp Lệnh Trong Phiên',
    description: 'Đối chiếu khớp lệnh trong phiên (M-System vs CQG vs ACM)',
  },
  CHECK_PRE_EOD: {
    jobType: 'CHECK_PRE_EOD',
    botCheckType: 'CHECK_PRE_EOD',
    displayName: 'Đối Chiếu Pre-EOD',
    description: 'Đối chiếu 3 bên trước EOD',
  },
  AUTO_CHECK_SOD: {
    jobType: 'AUTO_CHECK_SOD',
    botCheckType: 'AUTO_CHECK_SOD',
    displayName: 'Đối Chiếu Đầu Ngày SOD',
    description: 'Đối chiếu số dư đầu ngày SOD (M-System vs CQG)',
  },
  SCAN_NEGATIVE_MARGIN: {
    jobType: 'SCAN_NEGATIVE_MARGIN',
    botCheckType: 'SCAN_NEGATIVE_MARGIN',
    displayName: 'Quét Tài Khoản Âm Ký Quỹ',
    description: 'Quét và phân tích tài khoản âm ký quỹ',
  },
  CHECK_EOD_MM: {
    jobType: 'CHECK_EOD_MM',
    botCheckType: 'CHECK_EOD_MM',
    displayName: 'Lọc Ký Quỹ Cuối Ngày MM',
    description: 'Lọc tài khoản âm ký quỹ cuối ngày',
  },
  RUN_MACRO: {
    jobType: 'RUN_MACRO',
    botCheckType: 'RUN_MACRO',
    displayName: 'Thống Kê Khối Lượng CCP (Macro)',
    description: 'Chạy macro thống kê số lô & giá trị giao dịch CCP',
  },
  CHECK_MARGIN_DECISION: {
    jobType: 'CHECK_MARGIN_DECISION',
    botCheckType: 'CHECK_MARGIN_DECISION',
    displayName: 'Quét Quyết Định Ký Quỹ',
    description: 'Quét thư mục Quyết định thay đổi ký quỹ',
  },
};

/**
 * Tìm kiếm Task Con (chạy bot) và Task Cha (chứa task con) trong ca trực hoàn toàn ĐỘNG
 * dựa vào dữ liệu thực tế trong Database (details của ca trực).
 * Tuyệt đối không phụ thuộc vào chuỗi Task ID cụ thể.
 */
export function findBotTasksInShift(
  details: any[] = [],
  botKeyOrJobType: string,
): { subTask: any; parentTask: any } {
  if (!Array.isArray(details) || details.length === 0) {
    return { subTask: null, parentTask: null };
  }

  const normalizedKey = String(botKeyOrJobType || '').trim().toUpperCase();
  const config =
    BOT_TASK_REGISTRY[normalizedKey] ||
    Object.values(BOT_TASK_REGISTRY).find(
      (def) =>
        def.jobType.toUpperCase() === normalizedKey ||
        def.botCheckType.toUpperCase() === normalizedKey,
    );

  const targetBotType = config?.botCheckType || normalizedKey;

  // 1. Tìm Task Con chạy bot dựa 100% vào thuộc tính botCheckType do Admin gán trong Template/Ca
  let subTask = details.find(
    (t) =>
      (t.botCheckTypeSnapshot && t.botCheckTypeSnapshot.toUpperCase() === targetBotType) ||
      (t.botCheckType && t.botCheckType.toUpperCase() === targetBotType),
  );

  // 2. Tìm Task Cha dựa 100% vào quan hệ parentTaskIdSnapshot lưu trong Database
  let parentTask: any = null;
  if (subTask?.parentTaskIdSnapshot) {
    parentTask = details.find((t) => t.taskId === subTask.parentTaskIdSnapshot) || null;
  }

  // 3. Fallback: Nếu không tìm thấy theo botCheckType (do ca trực custom), tìm theo taskId khớp trực tiếp
  if (!subTask) {
    subTask = details.find(
      (t) => t.taskId && t.taskId.toUpperCase() === normalizedKey,
    );
    if (subTask?.parentTaskIdSnapshot) {
      parentTask = details.find((t) => t.taskId === subTask.parentTaskIdSnapshot) || null;
    }
  }

  return { subTask, parentTask };
}

/**
 * Trả về danh sách tất cả các ID liên quan (cha + con + anh em) của một taskId bất kỳ
 * dựa HOÀN TOÀN ĐỘNG vào cấu trúc cây trong ca trực (details).
 * Tuyệt đối không dùng bất kỳ chuỗi hardcode nào (Tuân thủ AGENTS.md Mục 7).
 */
export function getRelatedTaskIds(taskId: string, details?: any[]): string[] {
  if (!taskId) return [];

  const result = new Set<string>([taskId]);

  if (Array.isArray(details) && details.length > 0) {
    // 1. Nếu taskId là Task Cha -> Lấy tất cả Task Con có parentTaskIdSnapshot === taskId
    details.forEach((t) => {
      if (t.parentTaskIdSnapshot === taskId) {
        result.add(t.taskId);
      }
    });

    // 2. Nếu taskId là Task Con -> Lấy Task Cha và toàn bộ Task anh em cùng cha
    const current = details.find((t) => t.taskId === taskId);
    if (current?.parentTaskIdSnapshot) {
      result.add(current.parentTaskIdSnapshot);
      details.forEach((t) => {
        if (t.parentTaskIdSnapshot === current.parentTaskIdSnapshot) {
          result.add(t.taskId);
        }
      });
    }

    // 3. Nếu task có botCheckTypeSnapshot, liên kết với các task khác cùng chung loại bot trong ca
    if (current?.botCheckTypeSnapshot) {
      details.forEach((t) => {
        if (
          t.botCheckTypeSnapshot &&
          t.botCheckTypeSnapshot.toUpperCase() === current.botCheckTypeSnapshot.toUpperCase()
        ) {
          result.add(t.taskId);
          if (t.parentTaskIdSnapshot) {
            result.add(t.parentTaskIdSnapshot);
          }
        }
      });
    }
  }

  return Array.from(result);
}
