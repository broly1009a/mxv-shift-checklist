import { Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';

const logger = new Logger('CcpAdHocTemplateHelper');

export interface PythonWriterResult {
  success: boolean;
  outputPath?: string;
  filename?: string;
  fileSizeBytes?: number;
  targetRow?: number;
  tongRow?: number;
  clearedRows?: number;
  writtenTvkd?: number;
  writtenHh?: number;
  error?: string;
}

/**
 * Tìm đường dẫn file script Python ccp_adhoc_template_writer.py
 */
function resolvePythonScriptPath(): string | null {
  const candidatePaths = [
    path.resolve(__dirname, '..', '..', '..', 'scripts', 'python', 'ccp_adhoc_template_writer.py'),
    path.resolve(process.cwd(), 'dist', 'scripts', 'python', 'ccp_adhoc_template_writer.py'),
    path.resolve(process.cwd(), 'src', 'scripts', 'python', 'ccp_adhoc_template_writer.py'),
    '/opt/mxv-checklist/backend/dist/scripts/python/ccp_adhoc_template_writer.py',
    '/opt/mxv-checklist/backend/src/scripts/python/ccp_adhoc_template_writer.py',
  ];

  return candidatePaths.find((p) => fs.existsSync(p)) || null;
}

/**
 * Gọi Python openpyxl để nhân bản Template Master chuẩn và điền số liệu kỳ đột xuất
 * Giữ nguyên 100% dòng TỔNG CỘNG với công thức =SUM(...) nguyên bản của MXV.
 */
export function executePythonTemplateWriter(params: {
  templatePath: string;
  outputPath: string;
  dateLabel: string;
  targetMonth: string;
  data: {
    reportType: 'LOT' | 'GTGD';
    totalLot: number;
    totalGtgd: number;
    totalKltt?: number;
    totalTtm?: number;
    tvkdMap: Record<string, number>;
    hhMap: Record<string, number>;
  };
  jobLogs?: string[];
}): PythonWriterResult {
  const { templatePath, outputPath, dateLabel, targetMonth, data, jobLogs } = params;

  if (!fs.existsSync(templatePath)) {
    const msg = `[Python-Writer] File template Master không tồn tại: ${templatePath}`;
    logger.error(msg);
    jobLogs?.push(msg);
    return { success: false, error: msg };
  }

  const scriptPath = resolvePythonScriptPath();
  if (!scriptPath) {
    const msg = `[Python-Writer] Không tìm thấy script python ccp_adhoc_template_writer.py`;
    logger.error(msg);
    jobLogs?.push(msg);
    return { success: false, error: msg };
  }

  // Tạo tệp JSON tạm để truyền dữ liệu an toàn tránh tràn tham số CLI
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const tempJsonPath = path.join(tempDir, `adhoc_payload_${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
  fs.writeFileSync(tempJsonPath, JSON.stringify(data, null, 2), 'utf-8');

  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const startTime = Date.now();

  try {
    const logMsg = `[Python-Writer] Đang nhân bản template ${path.basename(templatePath)} và ghi kỳ "${dateLabel}" vào ${path.basename(outputPath)}...`;
    logger.log(logMsg);
    jobLogs?.push(logMsg);

    const execResult = spawnSync(
      pythonBin,
      [
        scriptPath,
        '--template-path', templatePath,
        '--output-path', outputPath,
        '--date-label', dateLabel,
        '--target-month', targetMonth,
        '--data-json', tempJsonPath,
      ],
      {
        encoding: 'utf-8',
        timeout: 90000, // 90 giây timeout cho ổ đĩa mạng CIFS/Samba
        windowsHide: true,
      },
    );

    // Dọn dẹp tệp JSON tạm
    try {
      if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
    } catch {}

    const durationMs = Date.now() - startTime;

    if (execResult.status === 0) {
      // Phân tích kết quả JSON từ stdout của Python
      const stdout = execResult.stdout?.trim() || '';
      const lines = stdout.split('\n');
      let parsedJson: any = null;

      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const obj = JSON.parse(lines[i]);
          if (obj && typeof obj === 'object' && 'success' in obj) {
            parsedJson = obj;
            break;
          }
        } catch {}
      }

      if (parsedJson && parsedJson.success) {
        const succMsg = `[Python-Writer] ✅ Đã hoàn tất nhân bản và ghi vào template: ${path.basename(outputPath)} (Row ${parsedJson.targetRow}, bảo toàn dòng TỔNG Row ${parsedJson.tongRow}, ${durationMs}ms)`;
        logger.log(succMsg);
        jobLogs?.push(succMsg);
        return {
          success: true,
          ...parsedJson,
        };
      }
    }

    const detailErr =
      execResult.stderr?.trim() ||
      execResult.stdout?.trim() ||
      execResult.error?.message ||
      `Thoát với mã ${execResult.status}`;
    const errMsg = `[Python-Writer] Lỗi xử lý template: ${detailErr}`;
    logger.error(errMsg);
    jobLogs?.push(errMsg);
    return { success: false, error: errMsg };
  } catch (err: any) {
    try {
      if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
    } catch {}
    const excMsg = `[Python-Writer] Ngoại lệ khi kích hoạt Python: ${err.message}`;
    logger.error(excMsg);
    jobLogs?.push(excMsg);
    return { success: false, error: excMsg };
  }
}
