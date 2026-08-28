import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';
import { Logger } from '@nestjs/common';

const logger = new Logger('ExcelSheetCloner');

/**
 * Tự động kiểm tra và sinh âm thầm Sheet tháng mới bằng Python openpyxl trên Ubuntu Linux / Windows
 * nếu Sheet tháng chưa tồn tại trong file Excel.
 */
export function ensureMonthSheetExists(
  excelFilePath: string,
  targetSheetName: string,
): boolean {
  if (!fs.existsSync(excelFilePath)) {
    logger.warn(`File không tồn tại để kiểm tra/sinh Sheet: ${excelFilePath}`);
    return false;
  }

  const scriptPath = path.join(
    __dirname,
    '..',
    'scripts',
    'excel_sheet_cloner.py',
  );

  if (!fs.existsSync(scriptPath)) {
    logger.warn(`Không tìm thấy script python: ${scriptPath}`);
    return false;
  }

  // Tự động nhận diện lệnh python trên Ubuntu (python3) hoặc Windows (python)
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';

  logger.log(
    `[Auto-Clone] Đang kiểm tra / tự động sinh Sheet '${targetSheetName}' cho file: ${path.basename(excelFilePath)}...`,
  );

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

    if (result.status === 0) {
      logger.log(
        `[Auto-Clone] ✅ Hoàn tất đảm bảo Sheet '${targetSheetName}' trong ${path.basename(excelFilePath)}`,
      );
      return true;
    } else {
      logger.error(
        `[Auto-Clone] ❌ Lỗi khi chạy python script: ${result.stderr || result.stdout}`,
      );
      return false;
    }
  } catch (err: any) {
    logger.error(`[Auto-Clone] ❌ Ngoại lệ khi kích hoạt Python cloner: ${err.message}`);
    return false;
  }
}
