import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '@nestjs/common';

const logger = new Logger('ReconPythonBridge');

function getPythonExecutable(): string {
  return process.platform === 'win32' ? 'python' : 'python3';
}

function findWorkerScript(): string | null {
  const candidatePaths = [
    path.resolve(process.cwd(), 'src/scripts/python/recon_data_worker.py'),
    path.resolve(__dirname, '../../../../src/scripts/python/recon_data_worker.py'),
    path.resolve(process.cwd(), 'dist/scripts/python/recon_data_worker.py'),
    '/opt/mxv-checklist/backend/src/scripts/python/recon_data_worker.py',
    '/opt/mxv-checklist/backend/dist/scripts/python/recon_data_worker.py',
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

export interface ReconPythonResult {
  success: boolean;
  error?: string;
  [key: string]: any;
}

/**
 * Gọi Python Worker chuyên trách xử lý dữ liệu giao dịch bằng Pandas
 * Tự động parse JSON từ stdout, bắt log debug từ stderr.
 */
export function executeReconWorker(
  action: 'MERGE_CQG' | 'PARSE_STRAITS' | 'RECON_KLGD' | 'RECON_PRE_EOD' | 'SCAN_MARGIN',
  payload: Record<string, any>,
  timeoutMs: number = 60000,
): ReconPythonResult {
  const scriptPath = findWorkerScript();
  if (!scriptPath) {
    logger.warn(`[Python-Bridge] Không tìm thấy recon_data_worker.py. Fallback về TypeScript parser.`);
    return {
      success: false,
      error: 'PYTHON_WORKER_SCRIPT_NOT_FOUND',
    };
  }

  const pythonBin = getPythonExecutable();
  const payloadStr = JSON.stringify(payload);

  try {
    const startTime = Date.now();
    const result = spawnSync(
      pythonBin,
      [scriptPath, '--action', action, '--payload', payloadStr],
      {
        encoding: 'utf-8',
        timeout: timeoutMs,
        windowsHide: true,
      },
    );

    const duration = Date.now() - startTime;

    if (result.error) {
      logger.error(`[Python-Bridge] Lỗi spawn process: ${result.error.message}`);
      return { success: false, error: result.error.message };
    }

    if (result.stderr && result.stderr.trim()) {
      logger.debug(`[Python-Worker stderr] ${result.stderr.trim()}`);
    }

    if (result.status !== 0) {
      logger.warn(`[Python-Bridge] Worker exit với code ${result.status}`);
    }

    const stdout = (result.stdout || '').trim();
    if (!stdout) {
      return {
        success: false,
        error: `Python worker không trả về dữ liệu (exit code: ${result.status})`,
      };
    }

    // Parse JSON
    const parsed = JSON.parse(stdout);
    logger.log(`[Python-Bridge] Thực thi ${action} thành công trong ${duration}ms`);
    return parsed;
  } catch (err: any) {
    logger.error(`[Python-Bridge] Ngoại lệ khi thực thi worker: ${err.message}`);
    return {
      success: false,
      error: err.message,
    };
  }
}
