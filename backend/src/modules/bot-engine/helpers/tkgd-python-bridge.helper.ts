import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface PythonExtractorInput {
  accountCode: string;
  hopDongPath?: string;
  phuLucPath?: string;
  cccdFrontPath?: string;
  cccdBackPath?: string;
}

export interface PythonExtractorResult {
  accountCode: string;
  hopDong?: {
    hoTen?: string;
    maTKGD?: string;
    soHopDong?: string;
    soCCCD?: string;
    ngaySinh?: string;
    rawNgaySinh?: string;
    ngayCap?: string;
    rawNgayCap?: string;
    gioiTinh?: string;
    rawGioiTinh?: string;
    diaChi?: string;
    noiCap?: string;
    hasSignature?: boolean;
    hasStamp?: boolean;
    totalPages?: number;
    dinhDangLoi?: string[];
    warning?: string;
  };
  phuLuc?: {
    tenKH?: string;
    maTKGD?: string;
    isPl01?: boolean;
    hasSignature?: boolean;
    hasStamp?: boolean;
    warning?: string;
  };
  canCuoc?: {
    soCCCD?: string;
    hoTen?: string;
    ngaySinh?: string;
    rawNgaySinh?: string;
    gioiTinh?: string;
    ngayCap?: string;
    rawNgayCap?: string;
    noiCap?: string;
    diaChi?: string;
    source?: string;
    canhBaoChatLuong?: string[];
  };
  warnings?: string[];
}

/**
 * Tìm đường dẫn python khả dụng trên hệ thống (python3 trên Linux/Ubuntu, python trên Windows)
 */
function getPythonExecutable(): string {
  if (process.platform === 'win32') {
    return 'python';
  }
  return 'python3';
}

/**
 * Gọi Python Worker trích xuất dữ liệu hợp đồng, phụ lục, CCCD và phát hiện lỗi định dạng/mất góc
 */
export async function runPythonExtractor(input: PythonExtractorInput): Promise<PythonExtractorResult | null> {
  const candidatePaths = [
    path.resolve(process.cwd(), 'src/scripts/python/tkgd_extractor_worker.py'),
    path.resolve(__dirname, '../../../../src/scripts/python/tkgd_extractor_worker.py'),
    '/opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py',
    path.resolve(process.cwd(), 'dist/scripts/python/tkgd_extractor_worker.py'),
    path.resolve(__dirname, '../../../scripts/python/tkgd_extractor_worker.py'),
  ];
  const pythonScript = candidatePaths.find((p) => fs.existsSync(p));

  if (!pythonScript) {
    console.warn(`[PYTHON-BRIDGE] Không tìm thấy worker script trong các đường dẫn:`, candidatePaths);
    return null;
  }

  const pythonBin = getPythonExecutable();
  const args = [
    pythonScript,
    '--code', input.accountCode || '',
  ];

  if (input.hopDongPath && fs.existsSync(input.hopDongPath)) {
    args.push('--hopdong', input.hopDongPath);
  }
  if (input.phuLucPath && fs.existsSync(input.phuLucPath)) {
    args.push('--phuluc', input.phuLucPath);
  }
  if (input.cccdFrontPath && fs.existsSync(input.cccdFrontPath)) {
    args.push('--front', input.cccdFrontPath);
  }
  if (input.cccdBackPath && fs.existsSync(input.cccdBackPath)) {
    args.push('--back', input.cccdBackPath);
  }

  try {
    const { stdout } = await execFileAsync(pythonBin, args, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf-8',
    });

    const parsed: PythonExtractorResult = JSON.parse(stdout.trim());
    return parsed;
  } catch (err: any) {
    console.error(`[PYTHON-BRIDGE] Lỗi thực thi Python worker cho ${input.accountCode}:`, err.message);
    return null;
  }
}
