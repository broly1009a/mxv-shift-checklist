/**
 * Task Hierarchy Helper (Dynamic Tree Resolver)
 * 
 * Chuẩn hóa 100% quan hệ Cây Gia Phả Tác Vụ (Cha - Con - Anh em) trong Ca trực MXV.
 * Tuân thủ tuyệt đối AGENTS.md Mục 6 & 7 (Zero Hardcoding & Data-Driven Architecture):
 * - Tuyệt đối KHÔNG hardcode Task ID hoặc suy diễn cắt/nối chuỗi string (cấm '_s1', '_s2').
 * - Hoạt động trơn tru 100% với các ID ngẫu nhiên (UUID/cuid) tạo động từ giao diện Web.
 * - Giải quyết quan hệ thuần túy dựa trên trường CSDL `parentTaskIdSnapshot` và `botCheckTypeSnapshot`.
 */

export interface ITaskItem {
  taskId: string;
  parentTaskIdSnapshot?: string | null;
  botCheckTypeSnapshot?: string | null;
  botCheckType?: string | null;
  isBotCheck?: boolean;
  isBotCheckSnapshot?: boolean;
  status?: string;
  isChecked?: boolean;
  [key: string]: any;
}

export interface ITaskTreeNode extends ITaskItem {
  children: ITaskTreeNode[];
}

export class TaskHierarchyHelper {
  /**
   * 1. Tìm Task Cha của một task con bất kỳ dựa trên `parentTaskIdSnapshot`.
   */
  static findParentTask<T extends ITaskItem>(taskId: string, details: T[]): T | null {
    if (!taskId || !Array.isArray(details) || details.length === 0) return null;
    const current = details.find((t) => t.taskId === taskId);
    if (!current || !current.parentTaskIdSnapshot) return null;
    return details.find((t) => t.taskId === current.parentTaskIdSnapshot) || null;
  }

  /**
   * 2. Tìm tất cả Task Con của một Task Cha bất kỳ.
   */
  static findSubTasks<T extends ITaskItem>(parentTaskId: string, details: T[]): T[] {
    if (!parentTaskId || !Array.isArray(details) || details.length === 0) return [];
    return details.filter((t) => t.parentTaskIdSnapshot === parentTaskId);
  }

  /**
   * 3. Tìm tất cả Task Anh Em (cùng chung cha) của một task bất kỳ.
   */
  static getSiblings<T extends ITaskItem>(taskId: string, details: T[], includeSelf: boolean = false): T[] {
    if (!taskId || !Array.isArray(details) || details.length === 0) return [];
    const current = details.find((t) => t.taskId === taskId);
    if (!current || !current.parentTaskIdSnapshot) return includeSelf && current ? [current] : [];

    return details.filter((t) => {
      const isSameParent = t.parentTaskIdSnapshot === current.parentTaskIdSnapshot;
      return includeSelf ? isSameParent : (isSameParent && t.taskId !== taskId);
    });
  }

  /**
   * 4. Trả về toàn bộ ID gia phả (Bản thân + Cha + Toàn bộ con + Toàn bộ anh em + Task cùng loại bot).
   * Phục vụ truy vấn MongoDB `bot_jobs` với Zero Hardcoded Task ID.
   */
  static getRelatedTaskIds(taskId: string, details?: ITaskItem[]): string[] {
    if (!taskId) return [];
    const result = new Set<string>([taskId]);
    if (!Array.isArray(details) || details.length === 0) return Array.from(result);

    const current = details.find((t) => t.taskId === taskId);

    // a. Nếu là Task Cha: Lấy tất cả Task Con
    details.forEach((t) => {
      if (t.parentTaskIdSnapshot === taskId) {
        result.add(t.taskId);
      }
    });

    // b. Nếu là Task Con: Lấy Task Cha và tất cả Task Anh Em
    if (current?.parentTaskIdSnapshot) {
      result.add(current.parentTaskIdSnapshot);
      details.forEach((t) => {
        if (t.parentTaskIdSnapshot === current.parentTaskIdSnapshot) {
          result.add(t.taskId);
        }
      });
    }

    // c. Nếu có botCheckType/botCheckTypeSnapshot: Liên kết các task cùng loại bot trong ca
    const currentBotType = (current?.botCheckTypeSnapshot || current?.botCheckType || '').toUpperCase();
    if (currentBotType) {
      details.forEach((t) => {
        const tBotType = (t.botCheckTypeSnapshot || t.botCheckType || '').toUpperCase();
        if (tBotType && tBotType === currentBotType) {
          result.add(t.taskId);
          if (t.parentTaskIdSnapshot) {
            result.add(t.parentTaskIdSnapshot);
          }
        }
      });
    }

    return Array.from(result);
  }

  /**
   * 5. Tìm cặp { subTask, parentTask } phục vụ chạy Bot theo loại năng lực (Data-Driven Capability)
   */
  static findBotTaskPair<T extends ITaskItem>(
    capabilityOrKey: string,
    details: T[],
  ): { subTask: T | null; parentTask: T | null } {
    if (!capabilityOrKey || !Array.isArray(details) || details.length === 0) {
      return { subTask: null, parentTask: null };
    }

    const normalizedKey = capabilityOrKey.trim().toUpperCase();

    // Ưu tiên 1: Tìm theo botCheckType do Admin cấu hình trên Template/Ca
    let subTask = details.find((t) => {
      const botType = (t.botCheckTypeSnapshot || t.botCheckType || '').toUpperCase();
      return botType === normalizedKey;
    }) || null;

    // Fallback: Tìm theo taskId khớp trực tiếp (trong trường hợp ca trực dùng ID trùng với loại bot)
    if (!subTask) {
      subTask = details.find((t) => (t.taskId || '').toUpperCase() === normalizedKey) || null;
    }

    let parentTask: T | null = null;
    if (subTask?.parentTaskIdSnapshot) {
      parentTask = details.find((t) => t.taskId === subTask!.parentTaskIdSnapshot) || null;
    }

    return { subTask, parentTask };
  }

  /**
   * 6. Kiểm tra xem tất cả các Task Con của một Task Cha đã hoàn thành hay chưa.
   * Hỗ trợ tự động tick hoàn thành Task Cha khi toàn bộ Task Con đã xong.
   */
  static isAllSubTasksCompleted<T extends ITaskItem>(
    parentTaskId: string,
    details: T[],
    completedStatuses: string[] = ['COMPLETED', 'PASSED', 'DONE'],
  ): boolean {
    const subTasks = this.findSubTasks(parentTaskId, details);
    if (subTasks.length === 0) return false;

    return subTasks.every((t) => {
      const isStatusDone = t.status && completedStatuses.includes(t.status.toUpperCase());
      return t.isChecked === true || isStatusDone;
    });
  }

  /**
   * 7. Xây dựng toàn bộ cây tác vụ dạng phân cấp (Hierarchical Tree) từ mảng phẳng (Flat Array).
   */
  static buildTaskTree<T extends ITaskItem>(details: T[]): ITaskTreeNode[] {
    if (!Array.isArray(details) || details.length === 0) return [];

    const itemMap = new Map<string, ITaskTreeNode>();
    const rootNodes: ITaskTreeNode[] = [];

    // Bước 1: Khởi tạo tất cả node kèm mảng children rỗng
    details.forEach((item) => {
      itemMap.set(item.taskId, { ...item, children: [] });
    });

    // Bước 2: Nối các node con vào node cha tương ứng
    details.forEach((item) => {
      const node = itemMap.get(item.taskId)!;
      if (item.parentTaskIdSnapshot && itemMap.has(item.parentTaskIdSnapshot)) {
        const parentNode = itemMap.get(item.parentTaskIdSnapshot)!;
        parentNode.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }
}
