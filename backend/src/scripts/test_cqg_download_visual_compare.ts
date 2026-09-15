import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SystemSettingsService } from '../modules/system-settings/system-settings.service';
import { RpaDownloaderService } from '../modules/bot-engine/rpa-downloader.service';
import { decrypt, encrypt } from '../modules/bot-engine/utils/crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as XLSX from 'xlsx';

/**
 * ======================================================================================
 * SCRIPT KIỂM THỬ TRỰC QUAN PLAYWRIGHT & SO SÁNH NỘI DUNG CÁC FILE TẢI VỀ TỪ CQG
 * ======================================================================================
 * - Tự động lấy tài khoản CQG từ CSDL UBUNTU SERVER (10.0.0.26): mxvtradingdesk1 / mxvtradingdesk3
 * - Bật Chrome có giao diện (HEADED MODE) trên màn hình để quan sát trực tiếp từng thao tác.
 * - Tải bộ 4 file: FR1 (Fills), PS1 (P&S), OP1 (Positions), OD1 (Orders).
 * - Sau khi tải: Tự động đọc từng file Excel, bóc tách tiêu đề báo cáo, tính mã MD5,
 *   so sánh chéo để đảm bảo không bị trùng/đè file Positions như trước.
 *
 * Cách chạy mặc định (Lưu vào thư mục temp để kiểm tra an toàn):
 *   cd backend
 *   npx ts-node src/scripts/test_cqg_download_visual_compare.ts
 *
 * Tùy chọn lưu trực tiếp vào ổ mạng M:\ (Thư mục ngày 14.09):
 *   npx ts-node src/scripts/test_cqg_download_visual_compare.ts --dest-m
 *
 * Tùy chọn tải cả CQG1 và CQG2:
 *   npx ts-node src/scripts/test_cqg_download_visual_compare.ts --all
 * ======================================================================================
 */

// ÉP BUỘC CHẠY CÓ GIAO DIỆN TRÌNH DUYỆT (HEADED)
process.env.HEADLESS_BOT = 'false';
process.env.PLAYWRIGHT_HEADLESS = 'false';

function calculateMD5(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Lấy cấu hình bot_credentials_cqg trực tiếp từ CSDL Ubuntu Server (10.0.0.26)
 */
async function fetchUbuntuCqgCredentials(): Promise<any> {
  return new Promise((resolve) => {
    try {
      const { Client } = require('ssh2');
      const conn = new Client();
      let output = '';

      const timer = setTimeout(() => {
        try { conn.end(); } catch { }
        resolve(null);
      }, 8000);

      conn.on('ready', () => {
        const nodeScript = `
          const mongoose = require('mongoose');
          const crypto = require('crypto');
          require('dotenv').config();

          function decrypt(text) {
            if (!text) return '';
            const parts = text.split(':');
            if (parts.length !== 2) return text;
            const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
            const secretKey = crypto.createHash('sha256').update(rawKey).digest();
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = Buffer.from(parts[1], 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
            let dec = decipher.update(encrypted);
            dec = Buffer.concat([dec, decipher.final()]);
            return dec.toString('utf8');
          }

          async function run() {
            try {
              await mongoose.connect(process.env.MONGODB_URI);
              const s = await mongoose.connection.db.collection('system_settings').findOne({ key: 'bot_credentials_cqg' });
              if (s) {
                console.log('__UBUNTU_CQG_CREDS__' + decrypt(s.value));
              }
              await mongoose.disconnect();
            } catch(e) {}
          }
          run();
        `;
        conn.exec(`cd /opt/mxv-checklist/backend && node -e "${nodeScript.replace(/"/g, '\\"')}"`, (err: any, stream: any) => {
          if (err) {
            clearTimeout(timer);
            conn.end();
            return resolve(null);
          }
          stream.on('data', (d: any) => { output += d.toString(); });
          stream.on('close', () => {
            clearTimeout(timer);
            conn.end();
            const match = output.match(/__UBUNTU_CQG_CREDS__(\{.*\})/);
            if (match) {
              try {
                return resolve(JSON.parse(match[1]));
              } catch { }
            }
            resolve(null);
          });
        });
      });

      conn.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });

      conn.connect({
        host: '10.0.0.26',
        port: 22,
        username: 'mxvadmin',
        password: 'MxV!,#2o26',
        readyTimeout: 6000,
      });
    } catch {
      resolve(null);
    }
  });
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
  console.log('  KIỂM THỬ TRỰC QUAN TẢI FILE CQG (PLAYWRIGHT HEADED) & SO SÁNH FILE  ');
  console.log('======================================================================\n');

  const isAll = process.argv.includes('--all');
  const isDestM = process.argv.includes('--dest-m');

  console.log(' Đang kết nối CSDL Ubuntu Server (10.0.0.26) để lấy tài khoản CQG...');
  const ubuntuCreds = await fetchUbuntuCqgCredentials();

  console.log(' Đang khởi tạo ứng dụng NestJS...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const settingsService = app.get(SystemSettingsService);
  const rpaDownloader = app.get(RpaDownloaderService);

  let creds: any;
  if (ubuntuCreds && (ubuntuCreds.username1 || ubuntuCreds.usernameCQG1)) {
    console.log(' Đã lấy thành công tài khoản CQG từ Database Ubuntu Server (10.0.0.26)!');
    creds = ubuntuCreds;
    // Đồng bộ lại vào settings để rpaDownloader sử dụng trực tiếp
    await settingsService.setSetting('bot_credentials_cqg', encrypt(JSON.stringify(ubuntuCreds)));
  } else {
    console.log(' Không kết nối được SSH Ubuntu, sử dụng bot_credentials_cqg từ CSDL cục bộ.');
    const credRaw = await settingsService.getSetting('bot_credentials_cqg', '');
    if (!credRaw) {
      console.error(' Chưa cấu hình bot_credentials_cqg trong Settings.');
      await app.close();
      process.exit(1);
    }
    try {
      creds = JSON.parse(decrypt(credRaw));
    } catch (err: any) {
      console.error(` Lỗi giải mã bot_credentials_cqg: ${err.message}`);
      await app.close();
      process.exit(1);
    }
  }

  // Xác định thư mục lưu file
  let destDir: string;
  if (isDestM) {
    const today = new Date();
    const year = today.getFullYear().toString();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    destDir = path.join('M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures', subFolder);
  } else {
    destDir = path.join(process.cwd(), 'temp', 'test_cqg_downloads');
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  console.log(`\n📂 THƯ MỤC LƯU FILE: ${destDir}`);
  console.log(`👤 Tài khoản CQG1: ${creds.username1 || creds.usernameCQG1 || 'Chưa cấu hình'}`);
  if (isAll) {
    console.log(`👤 Tài khoản CQG2: ${creds.username2 || creds.usernameCQG2 || 'Chưa cấu hình'}`);
  }
  console.log(`🌐 Chế độ: HEADED (Trình duyệt Chrome sẽ hiển thị trực tiếp trên màn hình)`);
  console.log('\n Bắt đầu tải file CQG... Xin vui lòng quan sát cửa sổ Chrome đang mở...');

  const reportsToDownload: any = isAll
    ? { FR1: true, PS1: true, OP1: true, OD1: true, FR2: true, PS2: true, OP2: true, OD2: true }
    : { FR1: true, PS1: true, OP1: true, OD1: true };

  const expectedList: Array<{ file: string; type: string }> = isAll
    ? [
      { file: 'FR1.xlsx', type: 'FR' },
      { file: 'PS1.xlsx', type: 'PS' },
      { file: 'OP1.xlsx', type: 'OP' },
      { file: 'OD1.xlsx', type: 'OD' },
      { file: 'FR2.xlsx', type: 'FR' },
      { file: 'PS2.xlsx', type: 'PS' },
      { file: 'OP2.xlsx', type: 'OP' },
      { file: 'OD2.xlsx', type: 'OD' },
    ]
    : [
      { file: 'FR1.xlsx', type: 'FR' },
      { file: 'PS1.xlsx', type: 'PS' },
      { file: 'OP1.xlsx', type: 'OP' },
      { file: 'OD1.xlsx', type: 'OD' },
    ];

  try {
    const result = await rpaDownloader.downloadCqgBackup(reportsToDownload, destDir);

    console.log('\n======================================================================');
    console.log('                 BÁO CÁO PHÂN TÍCH & SO SÁNH CHI TIẾT                 ');
    console.log('======================================================================\n');

    if (result.errors && result.errors.length > 0) {
      console.log(' Các cảnh báo/lỗi trong quá trình tải:');
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
      const statusStr = a.isMatch ? ' CHUẨN' : ' LỆCH';
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
          console.log(`    PHÁT HIỆN TRÙNG LẶP: ${analyses[i].fileName} và ${analyses[j].fileName} có mã MD5 giống hệt nhau (${analyses[i].md5})!`);
          hasDuplicate = true;
        }
      }
    }

    if (!hasDuplicate) {
      console.log('    TUYỆT VỜI: Tất cả các file tải về đều có mã MD5 khác nhau và độc lập 100%!');
    }

    // Kết luận tổng thể
    const allMatch = analyses.every((a) => a.isMatch);
    console.log('\n🎯 KẾT LUẬN CUỐI CÙNG:');
    if (allMatch && !hasDuplicate) {
      console.log('   🎉 BUG ĐÃ ĐƯỢC KHẮC PHỤC TRIỆT ĐỂ! Không còn hiện tượng các file bị tải nhầm thành Positions.');
      console.log(`   📂 File thực tế được lưu tại: ${destDir}`);
    } else {
      console.log('    Vẫn còn file chưa khớp hoặc bị trùng lặp, vui lòng kiểm tra lại log chi tiết ở trên.');
    }
  } catch (err: any) {
    console.error(` Lỗi thực thi script kiểm thử: ${err.message}`);
  } finally {
    await app.close();
    console.log('\nĐã hoàn tất phiên kiểm thử.\n');
  }
}

run();
