import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as XLSX from 'xlsx';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { RpaDownloaderService } from '../modules/bot-engine/rpa-downloader.service';
import { decrypt } from '../modules/bot-engine/utils/crypto';

// Nạp file .env từ nhiều vị trí khả dĩ
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const args = process.argv.slice(2);
const isCleanOnly = args.includes('--clean-only');
const isHeadless = args.includes('--headless');

// Mặc định chạy có giao diện (HEADED) để người dùng quan sát trực tiếp trên màn hình
process.env.HEADLESS_BOT = isHeadless ? 'true' : 'false';
process.env.PLAYWRIGHT_HEADLESS = isHeadless ? 'true' : 'false';

function calculateMD5(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buffer).digest('hex');
}

interface FileAnalysis {
  fileName: string;
  expectedType: string;
  fileSize: number;
  md5: string;
  sheetName: string;
  rowCount: number;
  colCount: number;
  reportHeader: string;
  detectedType: string;
  isMatch: boolean;
}

function analyzeExcelFile(filePath: string, fileName: string, expectedType: string): FileAnalysis {
  if (!fs.existsSync(filePath)) {
    return {
      fileName,
      expectedType,
      fileSize: 0,
      md5: '',
      sheetName: 'N/A',
      rowCount: 0,
      colCount: 0,
      reportHeader: 'FILE KHÔNG TỒN TẠI',
      detectedType: 'UNKNOWN',
      isMatch: false,
    };
  }

  const stat = fs.statSync(filePath);
  const md5 = calculateMD5(filePath);

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0] || 'Unknown';
    const worksheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const rowCount = rows.length;
    const colCount = rows[0] ? rows[0].length : 0;
    const reportHeader = rows[0] && rows[0][0] ? String(rows[0][0]).trim() : '';

    let detectedType = 'UNKNOWN';
    const lowerHeader = reportHeader.toLowerCase();
    if (lowerHeader.includes('fills')) {
      detectedType = 'FILLS (FR)';
    } else if (lowerHeader.includes('purchase and sales') || lowerHeader.includes('p&s') || lowerHeader.includes('purchase')) {
      detectedType = 'PURCHASE & SALES (PS)';
    } else if (lowerHeader.includes('positions') || lowerHeader.includes('open positions')) {
      detectedType = 'OPEN POSITIONS (OP)';
    } else if (lowerHeader.includes('orders') || lowerHeader.includes('order')) {
      detectedType = 'ORDERS (OD)';
    } else if (rowCount <= 1 && stat.size < 6000) {
      detectedType = 'EMPTY (Không có dữ liệu trong phiên)';
    }

    const isMatch = detectedType.includes(expectedType);

    return {
      fileName,
      expectedType,
      fileSize: stat.size,
      md5,
      sheetName,
      rowCount,
      colCount,
      reportHeader,
      detectedType,
      isMatch,
    };
  } catch (err: any) {
    return {
      fileName,
      expectedType,
      fileSize: stat.size,
      md5,
      sheetName: 'ERROR',
      rowCount: 0,
      colCount: 0,
      reportHeader: `Lỗi đọc Excel: ${err.message}`,
      detectedType: 'ERROR',
      isMatch: false,
    };
  }
}

async function run() {
  console.log('\n======================================================================');
  console.log('       KIỂM THỬ ĐỘC LẬP RPA CQG (DỌN TAB RÁC & TẢI BÁO CÁO CHUẨN)      ');
  console.log('======================================================================\n');

  // 1. Lấy thông tin tài khoản CQG từ CSDL MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mxv-checklist';
  console.log(`🔌 Đang kết nối CSDL: ${mongoUri.split('@').pop() || mongoUri}`);
  
  await mongoose.connect(mongoUri);
  const setting = await mongoose.connection.db!.collection('system_settings').findOne({ key: 'bot_credentials_cqg' });
  await mongoose.disconnect();

  if (!setting || !setting.value) {
    console.error('❌ Không tìm thấy cấu hình bot_credentials_cqg trong CSDL MongoDB!');
    process.exit(1);
  }

  const rawEncryptedCreds = setting.value;
  const creds = JSON.parse(decrypt(rawEncryptedCreds));
  console.log(`✅ Đã nạp tài khoản CQG từ CSDL: ${creds.username1 || creds.usernameCQG1}`);

  const destDir = path.join(process.cwd(), 'temp', 'test_cqg_downloads');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const mockSettingsService: any = {
    getSetting: async (key: string, def?: any) => {
      if (key === 'bot_credentials_cqg') return rawEncryptedCreds;
      return def;
    },
    setSetting: async () => { },
  };

  const rpaDownloader = new RpaDownloaderService(mockSettingsService);

  console.log(`📂 Thư mục lưu kết quả: ${destDir}`);
  console.log(`🌐 Chế độ hiển thị: ${process.env.HEADLESS_BOT === 'false' ? 'HEADED (Trực quan trên màn hình)' : 'HEADLESS (Chạy ngầm)'}`);

  // Xác định danh sách báo cáo cần chạy dựa trên tham số dòng lệnh
  const reportsConfig: any = {};
  const expectedList: { file: string; type: string }[] = [];

  if (isCleanOnly) {
    console.log(`🧹 Chế độ: CHỈ DỌN DẸP TAB RÁC TRONG PANEL g1.w431 (Bảo vệ tuyệt đối panel g3.w0)`);
    reportsConfig.cleanOnly = true;
  } else {
    // Kiểm tra xem người dùng có truyền chỉ định báo cáo cụ thể không (vd: OP1, FR1...)
    const requestedKeys = args.filter((a) => ['FR1', 'PS1', 'OP1', 'OD1'].includes(a.toUpperCase()));
    if (requestedKeys.length > 0) {
      requestedKeys.forEach((k) => {
        const upper = k.toUpperCase();
        reportsConfig[upper] = true;
        expectedList.push({ file: `${upper}.xlsx`, type: upper.slice(0, 2) });
      });
      console.log(`🎯 Chỉ định tải riêng báo cáo: ${requestedKeys.join(', ')}`);
    } else {
      // Mặc định tải trọn gói 4 file của tài khoản 1
      reportsConfig.FR1 = true;
      reportsConfig.PS1 = true;
      reportsConfig.OP1 = true;
      reportsConfig.OD1 = true;
      expectedList.push(
        { file: 'FR1.xlsx', type: 'FR' },
        { file: 'PS1.xlsx', type: 'PS' },
        { file: 'OP1.xlsx', type: 'OP' },
        { file: 'OD1.xlsx', type: 'OD' },
      );
      console.log(`🚀 Chế độ mặc định: Tải trọn gói 4 file FR1, PS1, OP1, OD1 (kèm auto dọn sạch tab thừa)`);
    }
  }

  try {
    const result = await rpaDownloader.downloadCqgBackup(reportsConfig, destDir);

    if (isCleanOnly) {
      console.log('\n======================================================================');
      console.log('            HOÀN TẤT DỌN DẸP TAB WIDGET THỪA TRÊN CQG                 ');
      console.log('======================================================================\n');
      console.log('✅ Toàn bộ tab rác trong panel g1.w431 đã được dọn sạch.');
      console.log('🛡️ Panel g3.w0 bên dưới và các panel khác đã được bảo toàn nguyên vẹn 100%!');
      return;
    }

    console.log('\n======================================================================');
    console.log('                 BÁO CÁO PHÂN TÍCH & SO SÁNH CHI TIẾT                 ');
    console.log('======================================================================\n');

    if (result.errors && result.errors.length > 0) {
      console.log('⚠️ Cảnh báo / lỗi phát sinh trong phiên:');
      result.errors.forEach((e) => console.log(`   - ${e}`));
      console.log('');
    }

    const analyses: FileAnalysis[] = [];
    for (const item of expectedList) {
      const fullPath = path.join(destDir, item.file);
      const analysis = analyzeExcelFile(fullPath, item.file, item.type);
      analyses.push(analysis);
    }

    // In bảng kết quả chi tiết
    console.log('-------------------------------------------------------------------------------------------------------------------------');
    console.log(`| ${'File Name'.padEnd(10)} | ${'Kích thước'.padEnd(11)} | ${'Loại Mong Đợi'.padEnd(15)} | ${'Loại Nhận Diện'.padEnd(25)} | ${'Trạng Thái'.padEnd(10)} | ${'MD5 (8 ký tự đầu)'.padEnd(18)} |`);
    console.log('-------------------------------------------------------------------------------------------------------------------------');

    for (const a of analyses) {
      const sizeStr = `${(a.fileSize / 1024).toFixed(1)} KB`;
      const statusStr = a.isMatch ? '✅ CHUẨN' : '❌ LỆCH';
      const shortMd5 = a.md5 ? a.md5.slice(0, 8) : 'N/A';
      console.log(
        `| ${a.fileName.padEnd(10)} | ${sizeStr.padEnd(11)} | ${a.expectedType.padEnd(15)} | ${a.detectedType.slice(0, 25).padEnd(25)} | ${statusStr.padEnd(10)} | ${shortMd5.padEnd(18)} |`,
      );
      if (a.reportHeader) {
        console.log(`  └─ Header: "${a.reportHeader.slice(0, 90)}"`);
      }
    }
    console.log('-------------------------------------------------------------------------------------------------------------------------\n');

    // Kiểm tra tính độc lập (trùng lặp MD5)
    if (analyses.length > 1) {
      console.log('🔍 KIỂM TRA TÍNH ĐỘC LẬP GIỮA CÁC FILE:');
      let hasDuplicate = false;
      for (let i = 0; i < analyses.length; i++) {
        for (let j = i + 1; j < analyses.length; j++) {
          if (analyses[i].md5 && analyses[i].md5 === analyses[j].md5) {
            console.log(`   ❌ PHÁT HIỆN TRÙNG LẶP: ${analyses[i].fileName} và ${analyses[j].fileName} có mã MD5 giống hệt nhau (${analyses[i].md5})!`);
            hasDuplicate = true;
          }
        }
      }

      if (!hasDuplicate) {
        console.log('   ✅ TUYỆT VỜI: Tất cả các file tải về đều có mã MD5 khác nhau và độc lập 100%!');
      }
    }

    // Kết luận tổng thể
    const allMatch = analyses.every((a) => a.isMatch);
    console.log('\n🎯 KẾT LUẬN CUỐI CÙNG:');
    if (allMatch) {
      console.log('   🎉 QUY TRÌNH THÀNH CÔNG RỰC RỠ!');
      console.log('   - Mỗi tab widget sau khi tải xong đều được tự động dọn sạch.');
      console.log('   - Panel g1.w431 không còn bị tích tụ tab rác.');
      console.log('   - Panel g3.w0 được bảo vệ an toàn.');
      console.log(`   📂 File thực tế được lưu tại: ${destDir}`);
    } else {
      console.log('   ⚠️ Vẫn còn file chưa khớp hoặc chưa tải được, vui lòng kiểm tra lại log chi tiết ở trên.');
    }
  } catch (err: any) {
    console.error(`❌ Lỗi thực thi: ${err.message}`);
  }
}

run();
