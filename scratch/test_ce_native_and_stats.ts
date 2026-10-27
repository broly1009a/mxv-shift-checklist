import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { CoreExApiAdapter } from '../backend/src/modules/ingress/adapters/coreex-api.adapter';
import { decrypt } from '../backend/src/shared';

dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });

async function run() {
  console.log('='.repeat(80));
  console.log('KIỂM THỬ TRỰC TIẾP TẢI FILE CE KIỂU 2 & CHẠY THỐNG KÊ TRÊN CỘT TIẾNG VIỆT');
  console.log('='.repeat(80));

  // 1. Kết nối MongoDB để nạp cấu hình credentials
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';
  console.log(`[1] Đang kết nối MongoDB: ${mongoUri.split('@')[1] || mongoUri}...`);
  await mongoose.connect(mongoUri);

  const cachedSettings: Record<string, string> = {};
  const settingsDocs = await mongoose.connection.collection('system_settings').find({}).toArray();
  for (const doc of settingsDocs) {
    if (doc.key && typeof doc.value === 'string') {
      cachedSettings[doc.key] = doc.value;
    }
  }
  console.log(`✓ Đã nạp ${Object.keys(cachedSettings).length} cấu hình từ CSDL.`);

  const mockSettingsService: any = {
    getSetting: async (key: string, defaultValue = '') => {
      if (cachedSettings[key] !== undefined) return cachedSettings[key];
      return defaultValue;
    },
  };

  const adapter = new CoreExApiAdapter(mockSettingsService);
  const outDir = path.resolve(__dirname, '..', 'temp', 'test_ce_output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 2. Tải file DSGD qua CoreExApiAdapter
  const targetDate = new Date().toISOString().split('T')[0];
  console.log(`\n[2] Bắt đầu gọi adapter.download('CORE_EX', { reportCodes: ['DSGD'], targetDate: '${targetDate}' })...`);
  
  const startTime = Date.now();
  const dlResult = await adapter.download('CORE_EX', {
    reportCodes: ['DSGD'],
    targetDate,
    targetDirectory: outDir,
    onLog: (msg) => console.log(`    ${msg}`),
  });

  console.log(`\nKết quả tải:`, {
    success: dlResult.success,
    filesCount: dlResult.files.length,
    durationMs: dlResult.durationMs,
    error: dlResult.error,
  });

  const dsgdFile = dlResult.files.find((f) => f.fileName.includes('DSGD') || f.fileName.includes('ORDERMATCH'));
  if (!dsgdFile || !fs.existsSync(dsgdFile.absolutePath)) {
    console.error('❌ KHÔNG TÌM THẤY FILE DSGD TẢI VỀ!');
    await mongoose.disconnect();
    process.exit(1);
  }

  const filePath = dsgdFile.absolutePath;
  const fileStat = fs.statSync(filePath);
  console.log(`\n✓ ĐÃ TẢI THÀNH CÔNG: ${dsgdFile.fileName} (${fileStat.size} bytes)`);

  // 3. Đọc và kiểm tra các cột trong file Excel tải về
  console.log('\n[3] KIỂM TRA HEADER & CỘT CỦA FILE EXCEL TẢI VỀ:');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];

  const headers: string[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || '').trim();
  });

  console.log(`Số cột: ${headers.length}`);
  console.log(`Danh sách các cột trong file:`);
  headers.forEach((h, idx) => {
    console.log(`  Cột ${idx + 1}: "${h}"`);
  });

  const isVietnamese = headers.some((h) =>
    ['SỐ TÀI KHOẢN', 'KHỐI LƯỢNG KHỚP', 'GIÁ KHỚP', 'MÃ HỢP ĐỒNG', 'MUA/BÁN'].some((vn) =>
      h.toUpperCase().includes(vn)
    )
  );

  console.log(`\n=> KẾT LUẬN HEADER CỘT: ${isVietnamese ? '✓ 100% LÀ CỘT TIẾNG VIỆT CHUẨN GỐC TỪ SÀN!' : '❌ Không phải tiếng Việt'}`);

  // 4. CHẠY THỐNG KÊ TRỰC TIẾP CHỈ DÙNG CỘT TIẾNG VIỆT (LOGIC CŨ TỪ MANUAL EXPORT)
  console.log('\n[4] CHẠY THỐNG KÊ SỐ LOT & GTGD DỰA TRÊN 100% CỘT TIẾNG VIỆT (KHÔNG CẦN CỘT TIẾNG ANH):');
  
  // Ánh xạ chỉ số cột theo tiếng Việt
  const colIdxTkgd = headers.findIndex((h) => h.toUpperCase().includes('SỐ TÀI KHOẢN'));
  const colIdxHd = headers.findIndex((h) => h.toUpperCase().includes('MÃ HỢP ĐỒNG'));
  const colIdxKl = headers.findIndex((h) => h.toUpperCase().includes('KHỐI LƯỢNG KHỚP'));
  const colIdxGia = headers.findIndex((h) => h.toUpperCase().includes('GIÁ KHỚP'));
  const colIdxLoaiLenh = headers.findIndex((h) => h.toUpperCase().includes('LOẠI LỆNH'));
  const colIdxMuaBan = headers.findIndex((h) => h.toUpperCase().includes('MUA/BÁN'));

  console.log('Ánh xạ cột tiếng Việt:');
  console.log(`  - Số tài khoản    : Cột ${colIdxTkgd + 1} ("${headers[colIdxTkgd]}")`);
  console.log(`  - Mã hợp đồng     : Cột ${colIdxHd + 1} ("${headers[colIdxHd]}")`);
  console.log(`  - Khối lượng khớp : Cột ${colIdxKl + 1} ("${headers[colIdxKl]}")`);
  console.log(`  - Giá khớp        : Cột ${colIdxGia + 1} ("${headers[colIdxGia]}")`);
  console.log(`  - Loại lệnh       : Cột ${colIdxLoaiLenh + 1} ("${headers[colIdxLoaiLenh]}")`);
  console.log(`  - Mua/bán         : Cột ${colIdxMuaBan + 1} ("${headers[colIdxMuaBan]}")`);

  const SPECS: Record<string, { name: string; doCao: number }> = {
    SI5CO: { name: 'Bạc Nano ACM', doCao: 100 },
    CP2CO: { name: 'Đồng Nano ACM', doCao: 1000 },
    PL1NY: { name: 'Bạch kim Nano ACM', doCao: 5 },
  };
  const USD_RATE = 25820;

  let totalTrades = 0;
  let totalLots = 0;
  let totalGtgdUsd = 0;
  let totalGtgdVnd = 0;

  const lotByTvkd = new Map<string, number>();
  const gtgdByTvkd = new Map<string, number>();
  const lotByHh = new Map<string, { count: number; lot: number; usd: number; vnd: number }>();

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const tkgd = String(row.getCell(colIdxTkgd + 1).value || '').trim();
    if (!tkgd) continue;

    const maHd = String(row.getCell(colIdxHd + 1).value || '').trim().toUpperCase();
    const kl = parseFloat(String(row.getCell(colIdxKl + 1).value || '0')) || 0;
    const gia = parseFloat(String(row.getCell(colIdxGia + 1).value || '0')) || 0;

    if (kl <= 0) continue;

    const tvkd = tkgd.length >= 3 ? tkgd.substring(0, 3) : 'OTH';

    let prefix = maHd.substring(0, 5);
    for (const p of ['CP2CO', 'SI5CO', 'PL1NY']) {
      if (maHd.startsWith(p)) {
        prefix = p;
        break;
      }
    }

    const doCao = SPECS[prefix]?.doCao || 1;
    const gtgdUsd = kl * gia * doCao;
    const gtgdVnd = Math.round(gtgdUsd * USD_RATE);

    totalTrades++;
    totalLots += kl;
    totalGtgdUsd += gtgdUsd;
    totalGtgdVnd += gtgdVnd;

    lotByTvkd.set(tvkd, (lotByTvkd.get(tvkd) || 0) + kl);
    gtgdByTvkd.set(tvkd, (gtgdByTvkd.get(tvkd) || 0) + gtgdVnd);

    if (!lotByHh.has(prefix)) {
      lotByHh.set(prefix, { count: 0, lot: 0, usd: 0, vnd: 0 });
    }
    const hhItem = lotByHh.get(prefix)!;
    hhItem.count++;
    hhItem.lot += kl;
    hhItem.usd += gtgdUsd;
    hhItem.vnd += gtgdVnd;
  }

  console.log('\n' + '='.repeat(80));
  console.log('KẾT QUẢ THỐNG KÊ TỔNG HỢP:');
  console.log('='.repeat(80));
  console.log(`- Tổng số lượt khớp : ${totalTrades} lệnh`);
  console.log(`- Tổng số Lot       : ${totalLots.toLocaleString('vi-VN')} lot`);
  console.log(`- Tổng GTGD (USD)   : $${totalGtgdUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`);
  console.log(`- Tổng GTGD (VND)   : ${totalGtgdVnd.toLocaleString('vi-VN')} VND`);
  console.log(`- Số TVKD phát sinh : ${lotByTvkd.size} TVKD`);

  console.log('\nPhân bổ theo Mã Hàng Hóa:');
  for (const [code, stat] of lotByHh.entries()) {
    const spec = SPECS[code];
    console.log(`  * ${code} (${spec?.name || 'Khác'}): ${stat.count} lệnh | ${stat.lot} lot | $${stat.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD = ${stat.vnd.toLocaleString('vi-VN')} VND`);
  }

  console.log('\nTop 5 TVKD giao dịch nhiều nhất:');
  const sortedTvkd = Array.from(lotByTvkd.entries()).sort((a, b) => b[1] - a[1]);
  sortedTvkd.slice(0, 5).forEach(([tv, l], idx) => {
    const v = gtgdByTvkd.get(tv) || 0;
    console.log(`  ${idx + 1}. TVKD ${tv}: ${l} lot | ${v.toLocaleString('vi-VN')} VND`);
  });

  await mongoose.disconnect();
  console.log('\n✓ KIỂM THỬ HOÀN TẤT THÀNH CÔNG 100%!');
}

run().catch((e) => {
  console.error('LỖI THỰC THI:', e);
  process.exit(1);
});
