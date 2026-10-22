import { BOT_TASK_REGISTRY } from '../../bot-engine/constants/bot-task-registry';
import {
  PreflightFileSpec,
  PreflightAccumulatorSpec,
  TradingOpsTaskPreflightDefinition,
} from './preflight.types';

export type {
  PreflightFileSpec,
  PreflightAccumulatorSpec,
  TradingOpsTaskPreflightDefinition,
};

/**
 * TRADING_OPS_PREFLIGHT_REGISTRY được trích xuất hoàn toàn ĐỘNG từ BOT_TASK_REGISTRY (Master Registry).
 * Không còn tồn tại 2 Registry độc lập! Toàn bộ hệ thống dùng DUY NHẤT 1 nguồn sự thật (Single Source of Truth).
 */
export const TRADING_OPS_PREFLIGHT_REGISTRY: Record<string, TradingOpsTaskPreflightDefinition> = {};

// Khởi tạo dynamic view từ Master BOT_TASK_REGISTRY
for (const [key, def] of Object.entries(BOT_TASK_REGISTRY)) {
  if (def.preflightSpec) {
    TRADING_OPS_PREFLIGHT_REGISTRY[def.preflightSpec.taskKey || key] = def.preflightSpec;
  }
}

/**
 * Tra cứu cấu hình tác vụ Pre-flight hoàn toàn linh hoạt từ BOT_TASK_REGISTRY theo taskKey hoặc alias.
 */
export function getPreflightTaskDefinition(
  rawKey: string,
): TradingOpsTaskPreflightDefinition | null {
  if (!rawKey) return null;
  const normalized = String(rawKey).trim().toUpperCase();

  // 1. Khớp trực tiếp key trong BOT_TASK_REGISTRY
  if (BOT_TASK_REGISTRY[normalized]?.preflightSpec) {
    return BOT_TASK_REGISTRY[normalized].preflightSpec!;
  }

  // 2. Tra cứu alias thường dùng (CE, CCP, KLGD, EOD, MARGIN)
  const aliasMap: Record<string, string> = {
    CE: 'CE_STATISTICS',
    COREEX: 'CE_STATISTICS',
    CE_LOT: 'CE_STATISTICS',
    RUN_MACRO_CE: 'CE_STATISTICS',
    CCP: 'RUN_MACRO',
    CORECCP: 'RUN_MACRO',
    CCP_LOT: 'RUN_MACRO',
    CCP_STATISTICS: 'RUN_MACRO',
    RUN_MACRO: 'RUN_MACRO',
    KLGD: 'CHECK_KLGD',
    RECON_KLGD: 'CHECK_KLGD',
    DSGD_EOD: 'CHECK_DSGD_BEFORE_EOD',
    RECON_EOD: 'CHECK_DSGD_BEFORE_EOD',
    MARGIN: 'SCAN_NEGATIVE_MARGIN',
    NEGATIVE_MARGIN: 'SCAN_NEGATIVE_MARGIN',
  };

  const mappedKey = aliasMap[normalized];
  if (mappedKey && BOT_TASK_REGISTRY[mappedKey]?.preflightSpec) {
    return BOT_TASK_REGISTRY[mappedKey].preflightSpec!;
  }

  // 3. Khớp theo jobType, botCheckType hoặc taskKey bên trong Master BOT_TASK_REGISTRY
  const found = Object.values(BOT_TASK_REGISTRY).find(
    (item) =>
      item.preflightSpec &&
      (item.jobType?.toUpperCase() === normalized ||
        item.botCheckType?.toUpperCase() === normalized ||
        item.preflightSpec.taskKey?.toUpperCase() === normalized),
  );

  return found?.preflightSpec || null;
}

/**
 * Lấy toàn bộ danh mục các tác vụ có hỗ trợ Pre-flight check từ Master Registry.
 */
export function getAllPreflightTasks(): TradingOpsTaskPreflightDefinition[] {
  return Object.values(BOT_TASK_REGISTRY)
    .filter((task) => !!task.preflightSpec)
    .map((task) => task.preflightSpec!);
}
