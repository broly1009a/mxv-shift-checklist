'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export interface TutorialStep {
  /** CSS selector or element ID (with #) to spotlight */
  target: string;
  /** Bước tiêu đề */
  title: string;
  /** Mô tả chi tiết */
  description: string;
  /** Lucide icon component hiển thị trong tooltip */
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** Vị trí tooltip so với target. Auto nếu không khai báo */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Thêm padding xung quanh spotlight (px) */
  padding?: number;
}

export type TutorialPageKey = 'dashboard' | 'checklist' | 'settings';

interface TutorialContextValue {
  isActive: boolean;
  currentStep: number;
  steps: TutorialStep[];
  pageKey: TutorialPageKey | null;
  /** Bắt đầu tour với danh sách bước cho trang cụ thể */
  startTutorial: (key: TutorialPageKey, steps: TutorialStep[]) => void;
  /** Chuyển bước tiếp theo */
  nextStep: () => void;
  /** Quay lại bước trước */
  prevStep: () => void;
  /** Kết thúc/bỏ qua tutorial */
  closeTutorial: (markDone?: boolean) => void;
  /** Kiểm tra trang đã xem tutorial chưa */
  isDone: (key: TutorialPageKey) => boolean;
  /** Reset tutorial cho trang cụ thể (để xem lại) */
  resetTutorial: (key: TutorialPageKey) => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

const LS_PREFIX = 'mxv_tutorial_';

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [pageKey, setPageKey] = useState<TutorialPageKey | null>(null);
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());

  // Load done keys from localStorage on mount
  useEffect(() => {
    const keys: string[] = ['dashboard', 'checklist', 'settings'];
    const done = new Set<string>();
    keys.forEach(k => {
      if (localStorage.getItem(`${LS_PREFIX}${k}_done`) === 'true') {
        done.add(k);
      }
    });
    setDoneKeys(done);
  }, []);

  const startTutorial = useCallback((key: TutorialPageKey, newSteps: TutorialStep[]) => {
    setSteps(newSteps);
    setPageKey(key);
    setCurrentStep(0);
    setIsActive(true);
    // Prevent body scroll while tutorial is active
    document.body.style.overflow = 'hidden';
  }, []);

  const closeTutorial = useCallback((markDone = true) => {
    setIsActive(false);
    setCurrentStep(0);
    document.body.style.overflow = '';
    if (markDone && pageKey) {
      localStorage.setItem(`${LS_PREFIX}${pageKey}_done`, 'true');
      setDoneKeys(prev => new Set([...prev, pageKey!]));
    }
  }, [pageKey]);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => {
      if (prev >= steps.length - 1) {
        // Last step — close and mark done
        closeTutorial(true);
        return prev;
      }
      return prev + 1;
    });
  }, [steps.length, closeTutorial]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  const isDone = useCallback((key: TutorialPageKey) => {
    return doneKeys.has(key);
  }, [doneKeys]);

  const resetTutorial = useCallback((key: TutorialPageKey) => {
    localStorage.removeItem(`${LS_PREFIX}${key}_done`);
    setDoneKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  return (
    <TutorialContext.Provider value={{
      isActive,
      currentStep,
      steps,
      pageKey,
      startTutorial,
      nextStep,
      prevStep,
      closeTutorial,
      isDone,
      resetTutorial,
    }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  return ctx;
}
