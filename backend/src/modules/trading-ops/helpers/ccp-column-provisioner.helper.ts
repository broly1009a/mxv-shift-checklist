import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';
import { Logger } from '@nestjs/common';

const logger = new Logger('CcpColumnProvisioner');

export interface ProvisionColumnParams {
  filePath: string;
  type: 'tvkd' | 'commodity';
  code: string;
  label: string;
  dryRun?: boolean;
  jobLogs?: string[];
}

export interface ProvisionColumnResult {
  success: boolean;
  message: string;
  durationMs: number;
}

/**
 * Tự động mở rộng cột TVKD mới hoặc Mã Hàng Hóa mới trên file Excel lũy kế bằng Python openpyxl.
 * Tuân thủ mô hình Safe Transactional Atomic Write Pattern (Snapshot Backup -> Staging -> Integrity Check -> Atomic Swap).
 * Hỗ trợ đa nền tảng Ubuntu Linux / Windows, đồng bộ kép PM2 Logger & DB jobLogs.
 */
export function provisionExcelColumn(params: ProvisionColumnParams): ProvisionColumnResult {
  const { filePath, type, code, label, dryRun, jobLogs } = params;
  const startTime = Date.now();

  if (!fs.existsSync(filePath)) {
    const msg = `[Auto-Provision] File không tồn tại để mở rộng cột: ${filePath}`;
    logger.warn(msg);
    jobLogs?.push(msg);
    return { success: false, message: msg, durationMs: Date.now() - startTime };
  }

  // Danh sách các ứng viên đường dẫn script python (hỗ trợ cả môi trường dev src lẫn build dist và Docker/Ubuntu)
  const candidatePaths = [
    path.resolve(__dirname, '..', '..', '..', 'scripts', 'python', 'ccp_column_provisioner.py'),
    path.resolve(process.cwd(), 'dist', 'scripts', 'python', 'ccp_column_provisioner.py'),
    path.resolve(process.cwd(), 'src', 'scripts', 'python', 'ccp_column_provisioner.py'),
    '/opt/mxv-checklist/backend/dist/scripts/python/ccp_column_provisioner.py',
    '/opt/mxv-checklist/backend/src/scripts/python/ccp_column_provisioner.py',
  ];

  const scriptPath = candidatePaths.find((p) => fs.existsSync(p));

  if (!scriptPath) {
    const msg = `[Auto-Provision] Không tìm thấy script python ccp_column_provisioner.py trong các thư mục hợp lệ.`;
    logger.warn(msg);
    jobLogs?.push(msg);
    return { success: false, message: msg, durationMs: Date.now() - startTime };
  }

  // Tự động nhận diện python trên Ubuntu (python3) hoặc Windows (python)
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const fileName = path.basename(filePath);

  const startMsg = `[Auto-Provision] Đang mở rộng cột ${type.toUpperCase()} '${code}' (${label}) cho: ${fileName}...`;
  logger.log(startMsg);
  jobLogs?.push(startMsg);

  const cliArgs = [
    scriptPath,
    '--file', filePath,
    '--type', type,
    '--code', code,
    '--label', label,
  ];

  if (dryRun) {
    cliArgs.push('--dry-run');
  }

  try {
    const result = spawnSync(pythonBin, cliArgs, {
      encoding: 'utf-8',
      timeout: 90000, // 90 giây timeout cho file lớn hoặc CIFS
      windowsHide: true,
    });

    const durationMs = Date.now() - startTime;

    if (result.status === 0) {
      const successMsg = `[Auto-Provision] Mở rộng thành công ${type.toUpperCase()} '${code}' trong ${fileName} (${durationMs}ms).`;
      logger.log(successMsg);
      jobLogs?.push(successMsg);
      return { success: true, message: successMsg, durationMs };
    } else {
      const detailErr =
        result.stderr?.trim() ||
        result.stdout?.trim() ||
        result.error?.message ||
        (result.status === null ? 'Quá thời gian chờ (Timeout > 90s)' : `Thoát với mã ${result.status}`);
      const errMsg = `[Auto-Provision] Lỗi khi mở rộng ${type.toUpperCase()} '${code}' trong ${fileName}: ${detailErr}`;
      logger.error(errMsg);
      jobLogs?.push(errMsg);
      return { success: false, message: errMsg, durationMs };
    }
  } catch (err: any) {
    const excMsg = `[Auto-Provision] Ngoại lệ khi kích hoạt Python provisioner cho ${fileName}: ${err.message}`;
    logger.error(excMsg);
    jobLogs?.push(excMsg);
    return { success: false, message: excMsg, durationMs: Date.now() - startTime };
  }
}
