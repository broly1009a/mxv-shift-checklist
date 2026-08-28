import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';
import { Logger } from '@nestjs/common';

const logger = new Logger('ExcelSheetCloner');

/**
 * Tự động kiểm tra và sinh âm thầm Sheet tháng mới bằng Python openpyxl trên Ubuntu Linux / Windows
 * Hỗ trợ mô hình Dual-Tier Logging (DB job.logs cho Web UI + NestJS Logger/PM2 cho Server Ops).
 */
export function ensureMonthSheetExists(
  excelFilePath: string,
  targetSheetName: string,
  jobLogs?: string[],
): boolean {
  if (!fs.existsSync(excelFilePath)) {
    const msg = `[Auto-Clone] ⚠️ File không tồn tại để kiểm tra/sinh Sheet: ${excelFilePath}`;
    logger.warn(msg);
    jobLogs?.push(msg);
    return false;
  }

  // Cấu trúc thư mục song song 1:1 chuẩn giữa helpers/ và scripts/
  const scriptPath = path.resolve(
    __dirname,
    '..',
    'scripts',
    'excel_sheet_cloner.py',
  );

  if (!fs.existsSync(scriptPath)) {
    const msg = `[Auto-Clone] ⚠️ Không tìm thấy script python: ${scriptPath}`;
    logger.warn(msg);
    jobLogs?.push(msg);
    return false;
  }

  // Tự động nhận diện lệnh python trên Ubuntu (python3) hoặc Windows (python)
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const fileName = path.basename(excelFilePath);
  const startTime = Date.now();

  const startMsg = `[Auto-Clone] ℹ️ Đang kiểm tra / tự động sinh Sheet '${targetSheetName}' cho: ${fileName}...`;
  logger.log(startMsg);
  jobLogs?.push(startMsg);

  try {
    const result = spawnSync(
      pythonBin,
      [scriptPath, '--file', excelFilePath, '--sheet', targetSheetName],
      {
        encoding: 'utf-8',
        timeout: 30000, // 30 giây timeout
        windowsHide: true,
      },
    );

    const durationMs = Date.now() - startTime;

    if (result.status === 0) {
      const successMsg = `[Auto-Clone] ✅ Tự động sinh Sheet '${targetSheetName}' trong ${fileName} thành công (${durationMs}ms).`;
      logger.log(successMsg);
      jobLogs?.push(successMsg);
      return true;
    } else {
      const errMsg = `[Auto-Clone] ❌ Lỗi khi tự động sinh Sheet '${targetSheetName}' trong ${fileName}: ${result.stderr || result.stdout}`;
      logger.error(errMsg);
      jobLogs?.push(errMsg);
      return false;
    }
  } catch (err: any) {
    const excMsg = `[Auto-Clone] ❌ Ngoại lệ khi kích hoạt Python cloner cho ${fileName}: ${err.message}`;
    logger.error(excMsg);
    jobLogs?.push(excMsg);
    return false;
  }
}
