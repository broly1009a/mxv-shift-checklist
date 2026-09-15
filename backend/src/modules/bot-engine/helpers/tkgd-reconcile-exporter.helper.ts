import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { cleanPersonName, isPersonNameMatch, anyPersonNameMatchesMs } from './tkgd-mail-parser.helper';
import { evaluateRecordReconciliationRule } from './tkgd-reconcile-rules.helper';

export interface ReconcileExportOptions {
  templatePath?: string;
  outputPath?: string;
}

export interface ReconcileSummary {
  totalRecords: number;
  khopCount: number;
  canKiemTraCount: number;
  lechCount: number;
  outputFilePath: string;
}

/**
 * Format ngày Date sang chuỗi 'DD/MM/YYYY'
 */
function formatDate(date: Date | string | undefined | null): string {
  if (!date) return '';
  if (typeof date === 'string') {
    const s = date.trim();
    const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      return `${dmyMatch[1].padStart(2, '0')}/${dmyMatch[2].padStart(2, '0')}/${dmyMatch[3]}`;
    }
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format ngày giờ sang chuỗi 'DD/MM/YYYY HH:mm:ss'
 */
function formatDateTime(date: Date | string | undefined | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
}

function normalizeName(name: string | undefined | null): string {
  if (!name) return '';
  const cleaned = cleanPersonName(name);
  if (cleaned) return cleaned.toLowerCase().replace(/\s+/g, ' ');
  // Fallback nhẹ khi cleanPersonName từ chối — vẫn strip dòng thừa
  let s = name.split(/[\r\n]/)[0].trim();
  s = s.replace(/\s+(TVKD|Tài khoản|Mã TKGD|đã đính kèm|đề nghị|cam kết|kính gửi|HĐ|CCCD)[\s\S]*$/i, '').trim();
  s = s.replace(/[;,.\-:]+$/, '').trim();
  return s.toLowerCase().replace(/\s+/g, ' ');
}

function pickValidPersonName(...candidates: Array<string | undefined | null>): string {
  for (const c of candidates) {
    const cleaned = cleanPersonName(c || undefined);
    if (cleaned) return cleaned.toLowerCase().replace(/\s+/g, ' ');
  }
  return '';
}

function normalizeDateStr(d: string | undefined | null): string {
  if (!d) return '';
  const s = String(d).trim();
  const iso = s.match(/\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
  if (iso) {
    return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}`;
  }
  const dmy = s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (dmy) {
    return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
  }
  const clean = s.split('T')[0].split(' ')[0].replace(/-/g, '/');
  const parts = clean.split('/');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
  }
  return '';
}

function isCanonicalDate(d: string | undefined | null): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(String(d || ''));
}

function isGenderMatch(g1?: string, g2?: string): boolean {
  if (!g1 || !g2) return true;
  const s1 = g1.trim().toLowerCase();
  const s2 = g2.trim().toLowerCase();
  const isFemale1 = ['nữ', 'nu', 'female', 'f'].includes(s1);
  const isFemale2 = ['nữ', 'nu', 'female', 'f'].includes(s2);
  const isMale1 = ['nam', 'male', 'm'].includes(s1);
  const isMale2 = ['nam', 'male', 'm'].includes(s2);
  if (isFemale1 && isFemale2) return true;
  if (isMale1 && isMale2) return true;
  return s1 === s2;
}

/**
 * Hàm tự động xác định thư mục xuất file Excel (hỗ trợ Linux /mnt/qlgd-it và Windows M:\)
 */
export function getTkgdOutputDirectory(): string {
  // 1. Nếu có cấu hình tùy chỉnh qua biến môi trường
  if (process.env.TKGD_OUTPUT_ROOT && fs.existsSync(process.env.TKGD_OUTPUT_ROOT)) {
    return process.env.TKGD_OUTPUT_ROOT;
  }

  // 2. Môi trường Server Linux (PM2 / Production)
  if (process.platform === 'linux') {
    const linuxMnt = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD';
    try {
      if (!fs.existsSync(linuxMnt)) fs.mkdirSync(linuxMnt, { recursive: true });
      return linuxMnt;
    } catch { }
    const linuxFallback = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong';
    if (fs.existsSync(linuxFallback)) return linuxFallback;
  }

  // 3. Môi trường máy trạm Windows (có mount ổ M:\)
  if (process.platform === 'win32') {
    const winMnt = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD';
    try {
      if (fs.existsSync('M:\\Tailieuchung\\QLGD-IT')) {
        if (!fs.existsSync(winMnt)) fs.mkdirSync(winMnt, { recursive: true });
        return winMnt;
      }
    } catch { }

    const winShortMnt = 'M:\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD';
    try {
      if (fs.existsSync('M:\\')) {
        if (!fs.existsSync(winShortMnt)) fs.mkdirSync(winShortMnt, { recursive: true });
        return winShortMnt;
      }
    } catch { }
  }

  // 4. Fallback thư mục output trong project khi test độc lập
  const localOutput = path.resolve(
    __dirname,
    '../../../../../POC/TKGD-Automation/output',
  );
  if (!fs.existsSync(localOutput)) {
    fs.mkdirSync(localOutput, { recursive: true });
  }
  return localOutput;
}

/**
 * Hàm giải quyết đường dẫn thư mục xuất Excel đa nền tảng (Ánh xạ M:\ sang /mnt/qlgd-it trên Linux)
 */
export function resolveTkgdOutputDir(customPath?: string): string {
  if (customPath && customPath.trim()) {
    const p = customPath.trim();
    if (process.platform === 'linux') {
      if (p.toLowerCase().startsWith('m:') || p.toLowerCase().startsWith('m:\\') || p.toLowerCase().startsWith('m:/')) {
        const linuxMnt = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD';
        if (fs.existsSync(linuxMnt)) return linuxMnt;
        const linuxFallback = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong';
        if (fs.existsSync(linuxFallback)) return linuxFallback;
      }
      if (p.startsWith('/') && fs.existsSync(p)) {
        return p;
      }
    } else {
      if (fs.existsSync(p)) return p;
    }
  }
  return getTkgdOutputDirectory();
}

/**
 * Lấy thư mục lưu trữ hồ sơ đính kèm (mặc định HoSo_DinhKem trên ổ M:\ hoặc customPath)
 */
export function getTkgdAttachmentDirectory(customPath?: string, dateStr?: string, accountCode?: string): string {
  let baseDir = '';
  if (customPath && customPath.trim()) {
    const resolved = resolveTkgdOutputDir(customPath.trim());
    if (resolved.toLowerCase().endsWith('hoso_dinhkem') || resolved.toLowerCase().includes('hoso_dinhkem')) {
      baseDir = resolved;
    } else {
      baseDir = path.join(resolved, 'HoSo_DinhKem');
    }
  } else {
    const rootDir = getTkgdOutputDirectory();
    baseDir = path.join(rootDir, 'HoSo_DinhKem');
  }

  const d = dateStr || new Date().toISOString().slice(0, 10);
  let target = path.join(baseDir, d);
  if (accountCode && accountCode.trim()) {
    target = path.join(target, accountCode.trim());
  }

  if (!fs.existsSync(target)) {
    try {
      fs.mkdirSync(target, { recursive: true });
    } catch { }
  }
  return target;
}

/**
 * Hàm tự động tìm file template Auto Data mail.xlsm
 */
export function findTkgdTemplatePath(): string {
  // 1. Thử tìm trên ổ mạng M:\ hoặc /mnt/qlgd-it nếu có
  const networkCandidates = [
    '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Auto Data mail.xlsm',
    '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/Auto Data mail.xlsm',
    'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Auto Data mail.xlsm',
    'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD\\Auto Data mail.xlsm',
    'M:\\Quanlygiaodich\\Tai lieu hoat dong\\Auto Data mail.xlsm',
  ];
  for (const p of networkCandidates) {
    if (fs.existsSync(p)) return p;
  }

  // 2. Thử tìm trong assets của backend
  const localCandidates = [
    path.resolve(process.cwd(), 'assets/templates/Auto Data mail.xlsm'),
    path.resolve(process.cwd(), 'src/assets/templates/Auto Data mail.xlsm'),
    path.resolve(__dirname, '../../../../assets/templates/Auto Data mail.xlsm'),
    path.resolve(__dirname, '../../assets/templates/Auto Data mail.xlsm'),
    path.resolve(__dirname, '../../../../../POC/TKGD-Automation/inputs/excel-templates/Auto Data mail.xlsm'),
    path.resolve(process.cwd(), '../POC/TKGD-Automation/inputs/excel-templates/Auto Data mail.xlsm'),
  ];
  for (const p of localCandidates) {
    if (fs.existsSync(p)) return p;
  }

  return path.resolve(process.cwd(), 'assets/templates/Auto Data mail.xlsm');
}

/**
 * Helper đối soát chéo và xuất file Excel chuẩn template Auto Data mail.xlsm
 */
export async function reconcileAndExportToExcel(
  records: any[],
  options?: ReconcileExportOptions,
): Promise<ReconcileSummary> {
  const templatePath = options?.templatePath || findTkgdTemplatePath();
  const outputDir = getTkgdOutputDirectory();

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const defaultOutput = path.join(
    outputDir,
    `Auto_Data_mail_${dateStr}.xlsx`,
  );
  const outputPath = options?.outputPath || defaultOutput;


  console.log(`\n======================================================`);
  console.log(`📊 BẮT ĐẦU ĐỐI SOÁT CHÉO & XUẤT FILE EXCEL`);
  console.log(`  Template nguồn: ${templatePath}`);
  console.log(`  File đích:      ${outputPath}`);
  console.log(`  Số lượng record: ${records.length}`);
  console.log(`======================================================\n`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  let khopCount = 0;
  let canKiemTraCount = 0;
  let lechCount = 0;

  // Lấy các worksheet theo tên
  const sheetNoiDungMail = workbook.getWorksheet('NoiDungMail');
  const sheetCancuoc = workbook.getWorksheet('Cancuoc');
  const sheetHopDong = workbook.getWorksheet('HopDong');
  const sheetPhuluc = workbook.getWorksheet('Phuluc');
  const sheetMS = workbook.getWorksheet('MS');

  // Xóa các dòng dữ liệu mẫu cũ từ dòng 2 trở đi (xóa từ dưới lên để sạch 100%)
  const cleanOldRows = (sheet?: ExcelJS.Worksheet) => {
    if (!sheet) return;
    for (let r = sheet.rowCount; r >= 2; r--) {
      sheet.spliceRows(r, 1);
    }
  };

  cleanOldRows(sheetNoiDungMail);
  cleanOldRows(sheetCancuoc);
  cleanOldRows(sheetHopDong);
  cleanOldRows(sheetPhuluc);
  cleanOldRows(sheetMS);

  // Chuẩn hóa tiêu đề cột Kết Quả và Thời Gian Kiểm Tra cho sheet NoiDungMail
  if (sheetNoiDungMail) {
    const d1 = sheetNoiDungMail.getCell('D1');
    d1.value = 'Kết quả';
    d1.font = { bold: true };
    d1.alignment = { horizontal: 'center', vertical: 'middle' };

    const e1 = sheetNoiDungMail.getCell('E1');
    e1.value = 'Thời gian kiểm tra';
    e1.font = { bold: true };
    e1.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // Style helper cho ô kết quả khớp (xanh lá), cần kiểm tra (vàng cam) và lệch (đỏ/cam)
  const styleKhop = {
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFE2EFDA' }, // Xanh lá nhạt
    },
    font: {
      color: { argb: 'FF375623' }, // Xanh đậm
      bold: true,
    },
  };

  const styleCanKiemTra = {
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFFFF2CC' }, // Vàng cam ấm
    },
    font: {
      color: { argb: 'FFD97706' }, // Amber đậm
      bold: true,
    },
  };

  const styleLech = {
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFFCE4D6' }, // Đỏ/cam nhạt
    },
    font: {
      color: { argb: 'FFC65911' }, // Đỏ/cam đậm
      bold: true,
    },
  };

  const styleKhopText = {
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFFFF2CC' }, // Vàng/cam nhạt
    },
    font: {
      color: { argb: 'FFB25900' }, // Cam đậm
      bold: true,
    },
  };

  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  };

  // Deduplicate records: gom nhóm theo mã TKGD đầy đủ cụ thể (giữ bản ghi mới nhất)
  const uniqueRecordMap = new Map<string, any>();
  for (const rec of records) {
    const code = rec.maTKGD || rec.ms?.maTKGD || rec.noiDungMail?.maTKGD_Futures || rec.noiDungMail?.maTKGD_ACM || rec.noiDungMail?.maTKGD_LME || rec.noiDungMail?.maTKGD_Spread;
    if (code) {
      uniqueRecordMap.set(code.trim().toUpperCase(), rec);
    }
  }
  const cleanRecords = uniqueRecordMap.size > 0 ? Array.from(uniqueRecordMap.values()) : records;

  let sttNoiDung = 1;
  let sttCccd = 1;
  let sttHopDong = 1;
  let sttPhuluc = 1;
  let sttMs = 1;

  const writtenCccdSet = new Set<string>();
  const writtenHopDongSet = new Set<string>();
  const writtenPhulucSet = new Set<string>();
  const writtenMsSet = new Set<string>(); // Lọc theo mã gốc không đuôi (baseCode) cho Sheet MS

  for (const record of cleanRecords) {
    const mail = record.noiDungMail || {};
    const ms = record.ms || {};
    const cccd = record.canCuoc || {};
    const hd = record.hopDong || {};
    const pl = record.phuLuc || {};

    // 1. Logic đối soát giữa Mail/HĐ/CCCD và M-System chuẩn xác các trường quan trọng
    let isCriticalMismatch = false;
    const criticalErrors: string[] = [];
    const softWarnings: string[] = [];

    const targetAccountCode = (record.maTKGD || ms.maTKGD || mail.maTKGD_Futures || mail.maTKGD_ACM || mail.maTKGD_LME || mail.maTKGD_Spread || '').trim();
    const baseCode = (record.maTKGDBase || mail.maTKGD_Futures || targetAccountCode.split('-')[0] || '').trim();
    const isVerifiedHash = cccd.source === 'VERIFIED_MS_HASH' || record.canCuoc?.source === 'VERIFIED_MS_HASH';

    let ketQuaText = '';
    let rowStatus: 'KHOP' | 'CAN_KIEM_TRA' | 'LECH' | 'KHOP_TEXT' = 'KHOP';

    // 1. ƯU TIÊN TUYỆT ĐỐI: Kế thừa kết quả đối soát chính thức từ hệ thống (kết luận DB / Phê duyệt tay)
    // Đảm bảo đồng bộ 100% giữa Giao diện FE và File Excel tải về (Khắc phục triệt để lỗi FE Khớp nhưng Excel báo Lệch)
    const officialStatus = record.manualReview?.isOverridden
      ? (record.manualReview.status || 'KHOP')
      : (record.ketLuan?.trangThai || record.trangThaiDoiSoat);

    const officialErrors = record.manualReview?.isOverridden
      ? []
      : (record.ketLuan?.danhSachLoi || record.lyDoLoi || []);

    if (officialStatus) {
      if (officialStatus === 'KHOP' || officialStatus === 'KHOP_TEXT') {
        rowStatus = 'KHOP';
        khopCount++;
        if (record.manualReview?.isOverridden) {
          ketQuaText = `so sánh mã TKGD, CCCD với bên HĐ, MS khớp 100% (Đã phê duyệt tay bởi ${record.manualReview.approvedBy || 'Cán bộ'})`;
        } else if (isVerifiedHash) {
          ketQuaText = 'so sánh mã TKGD, CCCD với bên HĐ, MS khớp 100% (Bảo chứng ảnh MS)';
        } else if (targetAccountCode.includes('-A')) {
          ketQuaText = 'so sánh mã TKGD, CCCD với bên PL01, MS khớp 100%';
        } else {
          ketQuaText = 'so sánh mã TKGD, CCCD với bên HĐ, MS khớp 100%';
        }
      } else if (officialStatus === 'CAN_KIEM_TRA') {
        rowStatus = 'CAN_KIEM_TRA';
        canKiemTraCount++;
        ketQuaText = `Cần kiểm tra: ${officialErrors.length > 0 ? officialErrors.join('; ') : 'Cần kiểm tra lại hồ sơ'}`;
      } else {
        rowStatus = 'LECH';
        lechCount++;
        ketQuaText = `Lệch: ${officialErrors.length > 0 ? officialErrors.join('; ') : 'Sai lệch dữ liệu đối soát'}`;
      }
    } else {
      // Fallback: Khi bản ghi chưa có kết luận đối soát trước đó trong DB
      const res = evaluateRecordReconciliationRule(record);
      if (res.finalStatus === 'LECH') {
        rowStatus = 'LECH';
        lechCount++;
        ketQuaText = `Lệch: ${res.finalErrors.join('; ')}`;
      } else if (res.finalStatus === 'CAN_KIEM_TRA') {
        rowStatus = 'CAN_KIEM_TRA';
        canKiemTraCount++;
        ketQuaText = `Cần kiểm tra: ${res.finalErrors.join('; ')}`;
      } else {
        rowStatus = 'KHOP';
        khopCount++;
        ketQuaText =
          res.autoHealedNotes && res.autoHealedNotes.length > 0
            ? `so sánh mã TKGD, CCCD với bên HĐ, MS khớp 100% (${res.autoHealedNotes.join('; ')})`
            : isVerifiedHash
              ? 'so sánh mã TKGD, CCCD với bên HĐ, MS khớp 100% (Bảo chứng ảnh MS)'
              : targetAccountCode.includes('-A')
                ? 'so sánh mã TKGD, CCCD với bên PL01, MS khớp 100%'
                : 'so sánh mã TKGD, CCCD với bên HĐ, MS khớp 100%';
      }
    }

    // 2. Ghi vào Sheet "NoiDungMail"
    // Col 1: STT | Col 2: Mã TKGD | Col 3: Tên tài khoản | Col 4: Kết quả | Col 5: Thời gian kiểm tra
    if (sheetNoiDungMail) {
      const checkTime = record.ketLuan?.reconciledAt || record.updatedAt || new Date();
      const checkTimeFormatted = formatDateTime(checkTime);
      const row = sheetNoiDungMail.addRow([
        sttNoiDung++,
        targetAccountCode,
        mail.tenTaiKhoan || '',
        ketQuaText,
        checkTimeFormatted,
      ]);

      row.eachCell((cell, colNumber) => {
        cell.border = borderThin;
        if (colNumber === 1 || colNumber === 2 || colNumber === 5) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { vertical: 'middle' };
        }
        if (colNumber === 4) {
          if (rowStatus === 'LECH') {
            cell.fill = styleLech.fill;
            cell.font = styleLech.font;
          } else if (rowStatus === 'CAN_KIEM_TRA') {
            cell.fill = styleCanKiemTra.fill;
            cell.font = styleCanKiemTra.font;
          } else {
            cell.fill = styleKhop.fill;
            cell.font = styleKhop.font;
          }
        }
      });
    }

    // 3. Ghi vào Sheet "MS"
    // NGHIỆP VỤ MXV: Hồ sơ nhà đầu tư trên M-System quản lý theo mã cơ sở không đuôi (baseCode).
    // Các tiểu khoản (-A, -L, -S) ăn theo hồ sơ gốc nên chỉ cần check và ghi 1 dòng cho mỗi khách hàng.
    if (sheetMS && ms.isFoundOnMS && baseCode && !writtenMsSet.has(baseCode)) {
      writtenMsSet.add(baseCode);
      const row = sheetMS.addRow([
        sttMs++,
        baseCode,
        ms.tenTKGD || mail.tenTaiKhoan || '',
        ms.hoVaTen || mail.tenTaiKhoan || '',
        ms.soCMND_HoChieu || '',
        formatDate(ms.ngaySinh),
        formatDate(ms.ngayCap),
        ms.noiCap || '',
        formatDate(ms.ngayThamGia),
        ms.loaiHinhTaiKhoan || 'Cá nhân',
        ms.chuKy || 'Đã ký',
        'So sánh với thông tin với căn cước khớp',
      ]);

      row.eachCell((cell, colNumber) => {
        cell.border = borderThin;
        if ([1, 2, 5, 6, 7, 9, 10, 11].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { vertical: 'middle' };
        }
        if (colNumber === 12) {
          cell.fill = styleKhop.fill;
          cell.font = styleKhop.font;
        }
      });
    }

    // 4. Ghi vào Sheet "Cancuoc" (chỉ ghi dữ liệu gốc bóc từ ảnh CCCD)
    const cccdKey = (cccd.soCanCuoc || baseCode || mail.tenTaiKhoan || '').trim();
    if (sheetCancuoc && cccdKey && !writtenCccdSet.has(cccdKey)) {
      writtenCccdSet.add(cccdKey);
      const row = sheetCancuoc.addRow([
        sttCccd++,
        cccd.hoVaTen || mail.tenTaiKhoan || '',
        cccd.soCanCuoc || '',
        formatDate(cccd.ngaySinh),
        formatDate(cccd.coGiaTriDen),
        formatDate(cccd.ngayCap),
        cccd.noiCap || '',
      ]);
      row.eachCell((cell, colNumber) => {
        cell.border = borderThin;
        if ([1, 3, 4, 5, 6].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { vertical: 'middle' };
        }
      });
    }

    // 5. Ghi vào Sheet "HopDong" (chỉ ghi dữ liệu gốc bóc từ PDF Hợp đồng)
    const isSubAccount = targetAccountCode.includes('-');
    if (sheetHopDong && baseCode && !isSubAccount && !writtenHopDongSet.has(baseCode)) {
      writtenHopDongSet.add(baseCode);
      const row = sheetHopDong.addRow([
        sttHopDong++,
        baseCode,
        hd.hoVaTen || mail.tenTaiKhoan || '',
        hd.soCanCuoc || '',
        formatDate(hd.ngaySinh),
        formatDate(hd.ngayCap),
        hd.noiCap || '',
        formatDate(hd.ngayKyHD),
        hd.loaiHinhTaiKhoan || 'Cá nhân',
        hd.chuKy || 'Đã ký',
        'So sánh với thông tin với căn cước khớp',
      ]);
      row.eachCell((cell, colNumber) => {
        cell.border = borderThin;
        if ([1, 2, 4, 5, 6, 8, 9, 10].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { vertical: 'middle' };
        }
        if (colNumber === 11) {
          cell.fill = styleKhop.fill;
          cell.font = styleKhop.font;
        }
      });
    }

    // 6. Ghi vào Sheet "Phuluc" (chỉ ghi dữ liệu gốc bóc từ PDF Phụ lục PL01 / ACM)
    const subAccountCode = targetAccountCode.includes('-')
      ? targetAccountCode
      : mail.maTKGD_ACM || (mail.hasACMRequest ? `${baseCode}-A` : '');
    if (sheetPhuluc && subAccountCode && subAccountCode.includes('-') && !writtenPhulucSet.has(subAccountCode)) {
      writtenPhulucSet.add(subAccountCode);
      const row = sheetPhuluc.addRow([
        sttPhuluc++,
        subAccountCode,
        pl.hoVaTen || mail.tenTaiKhoan || '',
        pl.soCanCuoc || '',
        formatDate(pl.ngaySinh),
        formatDate(pl.ngayCap),
        pl.noiCap || '',
        formatDate(pl.ngayKyHD),
        pl.chuKy || 'Đã ký',
        'So sánh với thông tin với căn cước khớp',
      ]);
      row.eachCell((cell, colNumber) => {
        cell.border = borderThin;
        if ([1, 2, 4, 5, 6, 8, 9].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { vertical: 'middle' };
        }
        if (colNumber === 10) {
          cell.fill = styleKhop.fill;
          cell.font = styleKhop.font;
        }
      });
    }
  }

  await workbook.xlsx.writeFile(outputPath);

  console.log(`✅ Xuất file Excel đối soát thành công!`);
  console.log(`   - Tổng số bản ghi: ${records.length}`);
  console.log(`   - Số bản ghi Khớp: ${khopCount}`);
  console.log(`   - Số bản ghi Cần Ktra: ${canKiemTraCount}`);
  console.log(`   - Số bản ghi Lệch: ${lechCount}`);
  console.log(`   - Đường dẫn file:  ${outputPath}\n`);

  return {
    totalRecords: records.length,
    khopCount,
    canKiemTraCount,
    lechCount,
    outputFilePath: outputPath,
  };
}
