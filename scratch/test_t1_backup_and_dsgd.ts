import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { DsgdBeforeEodService } from '../backend/src/modules/trading-ops/services/dsgd-before-eod.service';

async function testT1BackupAndDsgd() {
  console.log('================================================================================');
  console.log('KIỂM TRA ĐƯỜNG DẪN FILE BACKUP T-1 VÀ LOGIC TẢI DSGD TƯƠI VỚI BỘ LỌC T-1');
  console.log('================================================================================\n');

  // 1. Khởi tạo service
  const mockSettings: any = {
    getSetting: async (key: string, defVal: string) => {
      if (key === 'bot_backup_path_ms') {
        return process.env.DEFAULT_BACKUP_PATH_MS || 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures';
      }
      if (key === 'bot_backup_path_acm') {
        return process.env.DEFAULT_BACKUP_PATH_ACM || 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup ACM\\Futures';
      }
      return defVal;
    },
  };

  const service = new DsgdBeforeEodService(mockSettings);

  // 2. Tính ngày T-1
  const today = new Date();
  const prevSession = await service.getPreviousTradingSession(today);
  console.log(`1. Thời điểm hiện tại: ${today.toLocaleDateString('vi-VN')} (${today.toISOString()})`);
  console.log(`   • Ngày phiên T-1 tính toán được: ${prevSession.dateFormatted} (Ngày: ${prevSession.day}, Tháng: ${prevSession.month}, Năm: ${prevSession.year})`);

  // 3. Kiểm tra các thư mục Backup MS ứng với ngày T-1
  console.log('\n2. Kiểm tra thư mục Backup MS T-1 trên đĩa:');
  const possibleMsBases = [
    'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    path.join(process.cwd(), 'backend', 'data', 'backup', 'ms'),
    path.join(process.cwd(), 'data', 'backup', 'ms'),
  ];

  let foundDailyMsDir: string | null = null;
  for (const base of possibleMsBases) {
    const dailyPath = path.join(base, prevSession.year, `T${prevSession.month}.${prevSession.year}`, `${prevSession.day}.${prevSession.month}`);
    const exists = fs.existsSync(dailyPath);
    console.log(`   - [${exists ? 'TỒN TẠI' : 'KHÔNG TÌM THẤY'}] ${dailyPath}`);
    if (exists && !foundDailyMsDir) {
      foundDailyMsDir = dailyPath;
    }
  }

  // 4. Nếu tìm thấy thư mục MS, kiểm tra file bên trong
  if (foundDailyMsDir) {
    console.log(`\n3. Danh sách file tại thư mục T-1 (${foundDailyMsDir}):`);
    const files = fs.readdirSync(foundDailyMsDir);
    files.forEach((f) => console.log(`   • ${f}`));

    const hasOriginal = fs.existsSync(path.join(foundDailyMsDir, 'DSGD.xlsx'));
    const snapshotCandidates = files.filter((f) => /^DSGD.+\.xlsx$/i.test(f) && f.toLowerCase() !== 'dsgd.xlsx');
    console.log(`\n   -> File DSGD gốc (DSGD.xlsx): ${hasOriginal ? ' CÓ' : '❌ THIẾU'}`);
    console.log(`   -> File DSGD snapshot: ${snapshotCandidates.length > 0 ? ` CÓ (${snapshotCandidates.join(', ')})` : '❌ THIẾU'}`);
  } else {
    console.log('\n3. Không tìm thấy thư mục backup MS ngày T-1 trên các ổ đĩa cục bộ / mạng.');
  }

  // 5. Thử chạy hàm runAutoCheckDSGDBeforeEOD
  console.log('\n4. Chạy thử nghiệm runAutoCheckDSGDBeforeEOD:');
  try {
    const res = await service.runAutoCheckDSGDBeforeEOD({ tradingDate: today });
    console.log('   -> Kết quả đối chiếu:', JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.log(`   -> Thông báo / Ngoại lệ: ${err.message}`);
  }

  console.log('\n================================================================================');
}

testT1BackupAndDsgd().catch(console.error);
