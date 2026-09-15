/**
 * test/tkgd-inspect-account.ts
 * CLI TOOL TRA CỨU & ĐỐI SOÁT THÔNG TIN TÀI KHOẢN TKGD (MAIL VS MS)
 * 
 * Cách dùng:
 *   npx ts-node test/tkgd-inspect-account.ts <MÃ_TK_HOẶC_TÊN>
 * 
 * Ví dụ:
 *   npx ts-node test/tkgd-inspect-account.ts 045C9934931
 *   npx ts-node test/tkgd-inspect-account.ts 086C2659556
 *   npx ts-node test/tkgd-inspect-account.ts "NGUYỄN ĐỨC HẠNH"
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import mongoose from 'mongoose';
import { Client } from 'ssh2';
import {
  inspectAccountDetails,
  formatReportToConsole,
} from '../src/modules/bot-engine/helpers/tkgd-account-inspector.helper';

// 1. Tự động nạp cấu hình .env (Ưu tiên /opt trên Ubuntu VM, sau đó là local)
const envPaths = [
  '/opt/mxv-checklist/backend/.env',
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

/**
 * Thực thi lệnh tra cứu trực tiếp trên Ubuntu VM (10.0.0.26) qua SSH
 */
function runViaUbuntuSsh(query: string): Promise<void> {
  return new Promise((resolve) => {
    console.log(`\n🌐 Đang kết nối SSH tới Ubuntu VM (10.0.0.26) để tra cứu Database thực tế...`);
    const conn = new Client();

    conn.on('ready', () => {
      const sanitizedQuery = query.replace(/"/g, '\\"');
      const cmd = `cd /opt/mxv-checklist/backend && npx ts-node test/tkgd-inspect-account.ts "${sanitizedQuery}" --direct`;
      
      conn.exec(cmd, (err, stream) => {
        if (err) {
          console.error('❌ Lỗi thực thi SSH:', err.message);
          conn.end();
          resolve();
          return;
        }

        stream.on('data', (data: Buffer) => {
          process.stdout.write(data.toString());
        });

        stream.stderr.on('data', (data: Buffer) => {
          process.stderr.write(data.toString());
        });

        stream.on('close', () => {
          conn.end();
          resolve();
        });
      });
    }).on('error', (err) => {
      console.error('❌ Không thể kết nối SSH tới Ubuntu VM (10.0.0.26):', err.message);
      resolve();
    }).connect({
      host: '10.0.0.26',
      port: 22,
      username: 'mxvadmin',
      password: 'MxV!,#2o26',
      readyTimeout: 10000,
    });
  });
}

async function main() {
  const query = process.argv[2];
  const isDirect = process.argv.includes('--direct');

  if (!query || !query.trim() || query.startsWith('--')) {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                     CÔNG CỤ TRA CỨU & KIỂM TRA HỒ SƠ TKGD                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

  ❌ Vui lòng cung cấp Mã TKGD, Họ tên hoặc Số CCCD cần kiểm tra!

  👉 Ví dụ câu lệnh:
     npm run test:tkgd-inspect 045C9934931
     npm run test:tkgd-inspect 045C1761188
     npm run test:tkgd-inspect "NGUYỄN ĐỨC HẠNH"
     npm run test:tkgd-inspect 075085004956
`);
    process.exit(1);
  }

  // Nếu đang ở Windows và không có cờ --direct, thử kiểm tra local trước, nếu không có thì tự động tra cứu trên Ubuntu
  const isWindows = process.platform === 'win32';
  const mongoUri =
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/mxv_shift_checklist';

  let foundCount = 0;
  let localConnected = false;

  if (!isDirect) {
    console.log(`\n🔍 Đang tra cứu trên Local Database: "${query}"...`);
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
      localConnected = true;
      const db = mongoose.connection.db;

      const report = await inspectAccountDetails(query, db);
      foundCount = report.matchedCount;

      if (foundCount > 0) {
        const output = formatReportToConsole(report);
        console.log(output);
      }
    } catch (err: any) {
      // Local connect fail, will fallback to Ubuntu
    } finally {
      if (localConnected) {
        await mongoose.disconnect();
      }
    }

    // Nếu không tìm thấy hồ sơ trên máy local và đang ở môi trường dev Windows, tự động kết nối Ubuntu VM
    if (foundCount === 0 && isWindows) {
      console.log(`ℹ️  Không có dữ liệu trên Local. Tự động chuyển hướng sang Database trên Ubuntu VM (10.0.0.26)...`);
      await runViaUbuntuSsh(query);
      process.exit(0);
    }
  } else {
    // Chế độ direct (chạy trực tiếp trên Ubuntu hoặc khi có cờ --direct)
    console.log(`\n🔍 Đang kết nối cơ sở dữ liệu trên Ubuntu và tra cứu: "${query}"...`);
    try {
      await mongoose.connect(mongoUri);
      const db = mongoose.connection.db;

      const report = await inspectAccountDetails(query, db);
      const output = formatReportToConsole(report);

      console.log(output);
    } catch (err: any) {
      console.error(`\n❌ Lỗi trong quá trình tra cứu:`, err.message);
    } finally {
      await mongoose.disconnect();
      process.exit(0);
    }
  }
}

main();
