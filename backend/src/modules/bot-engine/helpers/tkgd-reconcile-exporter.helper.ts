import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';

export interface ReconcileExportOptions {
  templatePath?: string;
  outputPath?: string;
}

export interface ReconcileSummary {
  totalRecords: number;
  khopCount: number;
  lechCount: number;
  outputFilePath: string;
}

/**
 * Format ngày Date sang chuỗi 'DD/MM/YYYY'
 */
function formatDate(date: Date | string | undefined | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function normalizeName(name: string | undefined | null): string {
  if (!name) return '';
  let s = name.trim().replace(/\s+(TVKD|đã đính kèm|đề nghị|cam kết|kính gửi).*$/i, '').trim();
  s = s.replace(/[;,.\-]+$/, '').trim();
  return s.toLowerCase().replace(/\s+/g, ' ');
}

function normalizeDateStr(d: string | undefined | null): string {
  if (!d) return '';
  const s = d.trim().replace(/-/g, '/');
  const parts = s.split('/');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
  }
  return s;
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
    } catch {}
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
    } catch {}

    const winShortMnt = 'M:\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD';
    try {
      if (fs.existsSync('M:\\')) {
        if (!fs.existsSync(winShortMnt)) fs.mkdirSync(winShortMnt, { recursive: true });
        return winShortMnt;
      }
    } catch {}
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
 * Lấy thư mục lưu trữ hồ sơ đính kèm (mặc định HoSo_DinhKem trên ổ M:\ hoặc customPath)
 */
export function getTkgdAttachmentDirectory(customPath?: string, dateStr?: string, accountCode?: string): string {
  let baseDir = '';
  if (customPath && customPath.trim()) {
    baseDir = customPath.trim();
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
    } catch {}
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

  // Chuẩn hóa tiêu đề cột Kết Quả cho sheet NoiDungMail
  if (sheetNoiDungMail) {
    const d1 = sheetNoiDungMail.getCell('D1');
    d1.value = 'Kết quả';
    d1.font = { bold: true };
    d1.alignment = { horizontal: 'center', vertical: 'middle' };
  }


  // Style helper cho ô kết quả khớp (xanh lá) và lệch (đỏ/cam)
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

    // 1. Logic đối soát giữa Mail và M-System chuẩn xác theo đúng mã tiểu khoản
    let isMatched = true;
    const errors: string[] = [];

    const targetAccountCode = (record.maTKGD || ms.maTKGD || mail.maTKGD_Futures || mail.maTKGD_ACM || mail.maTKGD_LME || mail.maTKGD_Spread || '').trim();
    const baseCode = (record.maTKGDBase || mail.maTKGD_Futures || targetAccountCode.split('-')[0] || '').trim();
    const msCode = (ms.maTKGD || '').trim();
    const mailName = normalizeName(mail.tenTaiKhoan);
    const msName = normalizeName(ms.hoVaTen || ms.tenTKGD);

    if (!ms.isFoundOnMS) {
      isMatched = false;
      errors.push('Tài khoản chưa được tạo trên M-System');
    } else {
      const isSubAccount = targetAccountCode.includes('-A') || targetAccountCode.includes('-L') || targetAccountCode.includes('-S');
      if (isSubAccount) {
        const msBaseCode = msCode.split('-')[0].toUpperCase();
        if (baseCode && msBaseCode && baseCode.toUpperCase() !== msBaseCode) {
          isMatched = false;
          errors.push(`Lệch mã cơ sở (Yêu cầu: ${baseCode} != MS: ${msCode})`);
        }
      } else {
        if (targetAccountCode && msCode && targetAccountCode.toUpperCase() !== msCode.toUpperCase()) {
          isMatched = false;
          errors.push(`Lệch mã TKGD (Yêu cầu: ${targetAccountCode} != MS: ${msCode})`);
        }
      }
      if (mailName && msName && mailName !== msName) {
        isMatched = false;
        errors.push(`Lệch họ tên (Mail: ${mail.tenTaiKhoan} != MS: ${ms.hoVaTen})`);
      }

      const mailCccd = (hd.soCanCuoc || cccd.soCanCuoc || pl.soCanCuoc || '').trim();
      const msCccd = (ms.soCMND_HoChieu || ms.cccdOcr_soCanCuoc || '').trim();
      if (mailCccd && msCccd && mailCccd !== msCccd) {
        isMatched = false;
        errors.push(`Lệch số CCCD (HĐ: ${mailCccd} != MS: ${msCccd})`);
      }

      // 4. Đối chiếu Ngày sinh
      const hdDob = hd.rawNgaySinh || (hd.ngaySinh ? formatDate(hd.ngaySinh) : '');
      const cccdDob = cccd.ngaySinh ? formatDate(cccd.ngaySinh) : '';
      if (hdDob && cccdDob && normalizeDateStr(hdDob) !== normalizeDateStr(cccdDob)) {
        isMatched = false;
        errors.push(`Lệch ngày sinh (HĐ: ${hdDob} != CCCD: ${cccdDob})`);
      }

      // 5. Đối chiếu Ngày cấp
      const hdIssue = hd.rawNgayCap || (hd.ngayCap ? formatDate(hd.ngayCap) : '');
      const cccdIssue = cccd.ngayCap ? formatDate(cccd.ngayCap) : '';
      if (hdIssue && cccdIssue && normalizeDateStr(hdIssue) !== normalizeDateStr(cccdIssue)) {
        isMatched = false;
        errors.push(`Lệch ngày cấp (HĐ: ${hdIssue} != CCCD: ${cccdIssue})`);
      }

      // 6. Đối chiếu Giới tính
      const hdSex = hd.rawGioiTinh || hd.gioiTinh;
      const cccdSex = cccd.gioiTinh;
      if (hdSex && cccdSex && !isGenderMatch(hdSex, cccdSex)) {
        isMatched = false;
        errors.push(`Lệch giới tính (HĐ: ${hdSex} != CCCD: ${cccdSex})`);
      }
    }

    // 7. Kiểm tra lỗi định dạng trên Hợp đồng (YYYY-MM-DD, female/male)
    if (hd.dinhDangLoi && Array.isArray(hd.dinhDangLoi) && hd.dinhDangLoi.length > 0) {
      isMatched = false;
      errors.push(...hd.dinhDangLoi);
    }

    // 8. Kiểm tra lỗi chất lượng ảnh CCCD (mất góc, lẹm viền, cắt chữ)
    if (cccd.canhBaoChatLuong && Array.isArray(cccd.canhBaoChatLuong) && cccd.canhBaoChatLuong.length > 0) {
      isMatched = false;
      errors.push(...cccd.canhBaoChatLuong);
    }

    const mailCccdVal = (hd.soCanCuoc || cccd.soCanCuoc || pl.soCanCuoc || '').trim();
    const msCccdVal = (ms.soCMND_HoChieu || ms.cccdOcr_soCanCuoc || '').trim();
    const isFullKhop = isMatched && !!(mailCccdVal && msCccdVal && mailCccdVal === msCccdVal);

    const ketQuaText = !isMatched
      ? `Lệch: ${errors.join('; ')}`
      : isFullKhop
      ? (targetAccountCode.includes('-A') ? 'so sánh mã TKGD, CCCD với bên PL01, MS khớp 100%' : 'so sánh mã TKGD, CCCD với bên HĐ, MS khớp 100%')
      : 'Khớp thông tin cơ bản (Chưa quét đính kèm)';

    if (isMatched) {
      khopCount++;
    } else {
      lechCount++;
    }

    // 2. Ghi vào Sheet "NoiDungMail"
    // Col 1: STT | Col 2: Mã TKGD | Col 3: Tên tài khoản | Col 4: Kết quả
    if (sheetNoiDungMail) {
      const row = sheetNoiDungMail.addRow([
        sttNoiDung++,
        targetAccountCode,
        mail.tenTaiKhoan || '',
        ketQuaText,
      ]);

      row.eachCell((cell, colNumber) => {
        cell.border = borderThin;
        if (colNumber === 1 || colNumber === 2) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { vertical: 'middle' };
        }
        if (colNumber === 4) {
          if (!isMatched) {
            cell.fill = styleLech.fill;
            cell.font = styleLech.font;
          } else if (isFullKhop) {
            cell.fill = styleKhop.fill;
            cell.font = styleKhop.font;
          } else {
            cell.fill = styleKhopText.fill;
            cell.font = styleKhopText.font;
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
        ms.soCMND_HoChieu || cccd.soCanCuoc || '',
        formatDate(ms.ngaySinh || cccd.ngaySinh),
        formatDate(ms.ngayCap || cccd.ngayCap),
        ms.noiCap || cccd.noiCap || '',
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

    /* =========================================================================
     * [CODE CŨ DỰ PHÒNG BACKUP]: Ghi tất cả bản ghi (kể cả tiểu khoản -A) vào sheet MS
     * =========================================================================
     * if (sheetMS && ms.isFoundOnMS) {
     *   const row = sheetMS.addRow([
     *     sttMs++,
     *     ms.maTKGD || targetAccountCode,
     *     ms.tenTKGD || mail.tenTaiKhoan || '',
     *     ms.hoVaTen || mail.tenTaiKhoan || '',
     *     ms.soCMND_HoChieu || cccd.soCanCuoc || '',
     *     formatDate(ms.ngaySinh || cccd.ngaySinh),
     *     formatDate(ms.ngayCap || cccd.ngayCap),
     *     ms.noiCap || cccd.noiCap || '',
     *     formatDate(ms.ngayThamGia),
     *     ms.loaiHinhTaiKhoan || 'Cá nhân',
     *     ms.chuKy || 'Đã ký',
     *     'So sánh với thông tin với căn cước khớp',
     *   ]);
     *   row.eachCell((cell, colNumber) => {
     *     cell.border = borderThin;
     *     if ([1, 2, 5, 6, 7, 9, 10, 11].includes(colNumber)) {
     *       cell.alignment = { horizontal: 'center', vertical: 'middle' };
     *     } else {
     *       cell.alignment = { vertical: 'middle' };
     *     }
     *     if (colNumber === 12) {
     *       cell.fill = styleKhop.fill;
     *       cell.font = styleKhop.font;
     *     }
     *   });
     * }
     * ========================================================================= */

    // 4. Ghi vào Sheet "Cancuoc" (nếu có dữ liệu CCCD từ Giai đoạn 2 hoặc mock)
    const cccdKey = (cccd.soCanCuoc || ms.soCMND_HoChieu || baseCode || mail.tenTaiKhoan || '').trim();
    if (sheetCancuoc && cccdKey && !writtenCccdSet.has(cccdKey)) {
      writtenCccdSet.add(cccdKey);
      const row = sheetCancuoc.addRow([
        sttCccd++,
        cccd.hoVaTen || ms.hoVaTen || mail.tenTaiKhoan || '',
        cccd.soCanCuoc || ms.soCMND_HoChieu || '',
        formatDate(cccd.ngaySinh || ms.ngaySinh),
        formatDate(cccd.coGiaTriDen),
        formatDate(cccd.ngayCap || ms.ngayCap),
        cccd.noiCap || ms.noiCap || '',
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

    // 5. Ghi vào Sheet "HopDong" (nếu có Hợp đồng)
    const isSubAccount = targetAccountCode.includes('-');
    if (sheetHopDong && baseCode && !isSubAccount && !writtenHopDongSet.has(baseCode)) {
      writtenHopDongSet.add(baseCode);
      const row = sheetHopDong.addRow([
        sttHopDong++,
        baseCode,
        hd.hoVaTen || ms.hoVaTen || mail.tenTaiKhoan || '',
        hd.soCanCuoc || ms.soCMND_HoChieu || '',
        formatDate(hd.ngaySinh || ms.ngaySinh),
        formatDate(hd.ngayCap || ms.ngayCap),
        hd.noiCap || ms.noiCap || '',
        formatDate(hd.ngayKyHD || ms.ngayThamGia),
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

    // 6. Ghi vào Sheet "Phuluc" (nếu có Phụ lục PL01 / ACM)
    const subAccountCode = targetAccountCode.includes('-')
      ? targetAccountCode
      : mail.maTKGD_ACM || (mail.hasACMRequest ? `${baseCode}-A` : '');
    if (sheetPhuluc && subAccountCode && subAccountCode.includes('-') && !writtenPhulucSet.has(subAccountCode)) {
      writtenPhulucSet.add(subAccountCode);
      const row = sheetPhuluc.addRow([
        sttPhuluc++,
        subAccountCode,
        pl.hoVaTen || ms.hoVaTen || mail.tenTaiKhoan || '',
        pl.soCanCuoc || ms.soCMND_HoChieu || '',
        formatDate(pl.ngaySinh || ms.ngaySinh),
        formatDate(pl.ngayCap || ms.ngayCap),
        pl.noiCap || ms.noiCap || '',
        formatDate(pl.ngayKyHD || ms.ngayThamGia),
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
  console.log(`   - Số bản ghi Lệch: ${lechCount}`);
  console.log(`   - Đường dẫn file:  ${outputPath}\n`);

  return {
    totalRecords: records.length,
    khopCount,
    lechCount,
    outputFilePath: outputPath,
  };
}
