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

/**
 * Chuẩn hóa họ tên tiếng Việt để so sánh không phân biệt hoa thường và khoảng trắng
 */
function normalizeName(name: string | undefined | null): string {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
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
    'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Auto Data mail.xlsm',
    'M:\\Quanlygiaodich\\Tai lieu hoat dong\\Auto Data mail.xlsm',
  ];
  for (const p of networkCandidates) {
    if (fs.existsSync(p)) return p;
  }

  // 2. Fallback template gốc trong project
  return path.resolve(
    __dirname,
    '../../../../../POC/TKGD-Automation/inputs/excel-templates/Auto Data mail.xlsm',
  );
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
    }

    const ketQuaText = isMatched
      ? (targetAccountCode.includes('-A') ? 'so sánh mã TKGD với bên PL01 khớp' : 'so sánh mã TKGD với bên HĐ, MS khớp')
      : `Lệch: ${errors.join('; ')}`;

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
          if (isMatched) {
            cell.fill = styleKhop.fill;
            cell.font = styleKhop.font;
          } else {
            cell.fill = styleLech.fill;
            cell.font = styleLech.font;
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
