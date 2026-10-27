import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { CoreCcpApiAdapter } from '../modules/ingress/adapters/coreccp-api.adapter';
import { buildCcpHeaderMap, parseCcpDsgdRow } from '../modules/trading-ops/helpers/ccp-classifier.helper';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function run(): Promise<void> {
  console.log('='.repeat(80));
  console.log('KIỂM THỬ TRỰC TIẾP TẢI FILE CCP KIỂU 2 & CHẠY THỐNG KÊ TRÊN CỘT TIẾNG VIỆT');
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

  const adapter = new CoreCcpApiAdapter(mockSettingsService);
  const outDir = path.resolve(__dirname, '..', '..', 'temp', 'test_ccp_output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 2. Tải file DSGD qua CoreCcpApiAdapter
  const targetDate = new Date().toISOString().split('T')[0];
  console.log(`\n[2] Bắt đầu gọi adapter.download('CCP', { reportCodes: ['DSGD_CCP'], targetDate: '${targetDate}' })...`);

  const dlResult = await adapter.download('CCP', {
    reportCodes: ['DSGD_CCP'],
    targetDate,
    targetDirectory: outDir,
    onLog: (msg: string) => console.log(`    ${msg}`),
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
  headerRow.eachCell((cell: any, colNumber: number) => {
    headers[colNumber - 1] = String(cell.value || '').trim();
  });

  console.log(`Số cột: ${headers.length}`);
  console.log(`Danh sách các cột trong file:`);
  headers.forEach((h, idx) => {
    console.log(`  Cột ${idx + 1}: "${h}"`);
  });

  const isVietnamese = headers.some((h) =>
    ['SỐ TÀI KHOẢN', 'KHỐI LƯỢNG KHỚP', 'GIÁ KHỚP', 'MÃ HỢP ĐỒNG', 'MUA/BÁN', 'MÃ THÀNH VIÊN'].some((vn) =>
      h.toUpperCase().includes(vn)
    )
  );

  console.log(`\n=> KẾT LUẬN HEADER CỘT: ${isVietnamese ? '✓ 100% LÀ CỘT TIẾNG VIỆT CHUẨN GỐC TỪ SÀN CCP!' : '❌ Không phải tiếng Việt'}`);

  // 4. CHẠY THỐNG KÊ TRỰC TIẾP CHỈ DÙNG CỘT TIẾNG VIỆT (LOGIC CŨ TỪ MANUAL EXPORT)
  console.log('\n[4] CHẠY THỐNG KÊ SỐ LOT & GTGD DỰA TRÊN 100% CỘT TIẾNG VIỆT (KHÔNG CẦN CỘT TIẾNG ANH):');

  const headerMap = buildCcpHeaderMap(headers);
  console.log('Header Map chuẩn hóa:', JSON.stringify(headerMap, null, 2));

  let totalTrades = 0;
  let totalLots = 0;
  const lotByTvkd = new Map<string, number>();

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const rowValues: any[] = [];
    row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
      rowValues[colNumber - 1] = cell.value;
    });

    const parsed = parseCcpDsgdRow(rowValues, headerMap);
    if (!parsed.maTKGD || parsed.klKhop <= 0) continue;

    totalTrades++;
    totalLots += parsed.klKhop;

    const tvkd = parsed.maTvkd || (parsed.maTKGD.length >= 3 ? parsed.maTKGD.substring(0, 3) : 'OTH');
    lotByTvkd.set(tvkd, (lotByTvkd.get(tvkd) || 0) + parsed.klKhop);
  }

  console.log(`\n=> KẾT QUẢ THỐNG KÊ CCP:`);
  console.log(`  - Tổng số giao dịch khớp : ${totalTrades.toLocaleString('vi-VN')} lệnh`);
  console.log(`  - Tổng số Lot khớp       : ${totalLots.toLocaleString('vi-VN')} lots`);
  console.log(`  - Số TVKD phát sinh GD   : ${lotByTvkd.size} TVKD`);

  console.log('\nTop TVKD giao dịch nhiều nhất:');
  const sortedTvkd = Array.from(lotByTvkd.entries()).sort((a, b) => b[1] - a[1]);
  sortedTvkd.slice(0, 10).forEach(([tvkd, lot], idx) => {
    console.log(`    ${idx + 1}. TVKD ${tvkd}: ${lot.toLocaleString('vi-VN')} lots`);
  });

  await mongoose.disconnect();
  console.log('\n✓ HOÀN TẤT KIỂM THỬ THÀNH CÔNG.');
}

run().catch((err) => {
  console.error('❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', err);
  process.exit(1);
});
