import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as XLSX from 'xlsx';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { RpaDownloaderService } from '../modules/bot-engine/rpa-downloader.service';
import { decrypt, encrypt } from '../modules/bot-engine/utils/crypto';

dotenv.config();

// Ép buộc hiển thị giao diện Chrome (HEADED) để quan sát
process.env.HEADLESS_BOT = 'false';
process.env.PLAYWRIGHT_HEADLESS = 'false';

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
  console.log('   KIỂM THỬ ĐỘC LẬP TẢI VÀ SO SÁNH 4 BÁO CÁO CQG (FR, PS, OP, OD)   ');
  console.log('======================================================================\n');

  // Lấy tài khoản CQG trực tiếp từ MongoDB atlas
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mxv-checklist';
  await mongoose.connect(mongoUri);
  const setting = await mongoose.connection.db!.collection('system_settings').findOne({ key: 'bot_credentials_cqg' });
  await mongoose.disconnect();

  if (!setting || !setting.value) {
    console.error('❌ Không tìm thấy bot_credentials_cqg trong CSDL MongoDB!');
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
    setSetting: async () => {},
  };

  const rpaDownloader = new RpaDownloaderService(mockSettingsService);

  console.log(`📂 Thư mục lưu kết quả: ${destDir}`);
  console.log(`🌐 Chế độ: HEADED (Trình duyệt Chrome mở trực tiếp trên màn hình)`);
  console.log(`⏳ Bắt đầu tải bộ 4 file FR1, PS1, OP1, OD1...\n`);

  const expectedList = [
    { file: 'FR1.xlsx', type: 'FR' },
    { file: 'PS1.xlsx', type: 'PS' },
    { file: 'OP1.xlsx', type: 'OP' },
    { file: 'OD1.xlsx', type: 'OD' },
  ];

  try {
    const result = await rpaDownloader.downloadCqgBackup(
      { FR1: true, PS1: true, OP1: true, OD1: true },
      destDir,
    );

    console.log('\n======================================================================');
    console.log('                 BÁO CÁO PHÂN TÍCH & SO SÁNH CHI TIẾT                 ');
    console.log('======================================================================\n');

    if (result.errors && result.errors.length > 0) {
      console.log('⚠️ Cảnh báo / lỗi phát sinh:');
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

    // Kết luận tổng thể
    const allMatch = analyses.every((a) => a.isMatch);
    console.log('\n🎯 KẾT LUẬN CUỐI CÙNG:');
    if (allMatch && !hasDuplicate) {
      console.log('   🎉 BUG ĐÃ ĐƯỢC KHẮC PHỤC TRIỆT ĐỂ! Không còn hiện tượng các file bị tải nhầm thành Positions.');
      console.log(`   📂 File thực tế được lưu tại: ${destDir}`);
    } else {
      console.log('   ⚠️ Vẫn còn file chưa khớp hoặc bị trùng lặp, vui lòng kiểm tra lại log chi tiết ở trên.');
    }
  } catch (err: any) {
    console.error(`❌ Lỗi thực thi: ${err.message}`);
  }
}

run();
