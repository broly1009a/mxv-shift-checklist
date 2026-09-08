import { Injectable, Logger } from '@nestjs/common';

export interface TkgdProgressState {
  isProcessing: boolean;
  taskType: 'MAIL' | 'MSYSTEM' | 'RECONCILE' | 'ALL' | 'IDLE';
  current: number;
  total: number;
  percent: number;
  currentCode?: string;
  currentName?: string;
  stage: string;
  error?: string;
  updatedAt: number;
}

@Injectable()
export class TkgdProgressService {
  private readonly logger = new Logger(TkgdProgressService.name);
  private progressMap: Map<string, TkgdProgressState> = new Map();

  /**
   * Cập nhật tiến độ xử lý cho từng chuyên viên (theo email)
   */
  updateProgress(userEmail: string, state: Partial<TkgdProgressState>): void {
    const key = (userEmail || 'default').toLowerCase().trim();
    const current = this.progressMap.get(key) || {
      isProcessing: false,
      taskType: 'IDLE',
      current: 0,
      total: 0,
      percent: 0,
      stage: '',
      updatedAt: Date.now(),
    };

    const nextState: TkgdProgressState = {
      ...current,
      ...state,
      updatedAt: Date.now(),
    };

    if (nextState.total > 0 && nextState.current >= 0) {
      nextState.percent = Math.min(
        100,
        Math.round((nextState.current / nextState.total) * 100)
      );
    }

    this.progressMap.set(key, nextState);
  }

  /**
   * Lấy tiến độ thời gian thực của user
   */
  getProgress(userEmail: string): TkgdProgressState {
    const key = (userEmail || 'default').toLowerCase().trim();
    const state = this.progressMap.get(key);

    if (!state) {
      return {
        isProcessing: false,
        taskType: 'IDLE',
        current: 0,
        total: 0,
        percent: 0,
        stage: '',
        updatedAt: Date.now(),
      };
    }

    // Tự động giải phóng trạng thái nếu quá 10 phút không có update
    if (Date.now() - state.updatedAt > 10 * 60 * 1000 && state.isProcessing) {
      state.isProcessing = false;
      state.stage = 'Đã hết thời gian chờ';
      this.progressMap.set(key, state);
    }

    return state;
  }

  /**
   * Reset tiến độ về IDLE
   */
  clearProgress(userEmail: string): void {
    const key = (userEmail || 'default').toLowerCase().trim();
    this.progressMap.delete(key);
  }
}
