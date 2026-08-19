import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import {
  ValueStatisticsService,
  getMaHHFromDsgd,
  getMaHHFromSpread,
} from '../modules/lot-statistics/value-statistics.service';
import {
  NORMAL_COMMODITIES,
  SPREAD_COMMODITIES,
  LME_COMMODITIES,
  OPTIONS_COMMODITIES,
  ACM_COMMODITIES,
} from '../modules/lot-statistics/helpers/excel-value-accumulator.helper';

// Dummy Settings Service for testing
class DummySettingsService {
  async getSetting(key: string, defaultVal: string): Promise<string> {
    return defaultVal;
  }
}

async function runTest() {
  console.log('=== BẮT ĐẦU CHẠY THỬ NGHIỆM VALUE STATISTICS ===');

  const targetDate = new Date('2026-07-14');
  const workspaceRoot =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist';
  const macroPath = path.join(
    workspaceRoot,
    'marco',
    'Thong ke gia tri giao dich có ACM',
    'Macro thong ke gia tri giao dich có ACM.xlsm',
  );
  const dsgdPath = path.join(workspaceRoot, '14.07', 'DSGD.xlsx');

  // Create a temp folder for test output files
  const testRoot = path.join(workspaceRoot, 'temp', 'test_value_run');
  if (!fs.existsSync(testRoot)) {
    fs.mkdirSync(testRoot, { recursive: true });
  }

  // 1. Initialize dummy cumulative files with correct headers in row 4
  const sheetName = 'T07.2026';

  const createDummyTracker = async (
    filename: string,
    commodities: string[],
  ) => {
    const filePath = path.join(testRoot, filename);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);

    // Add row 4 headers
    const headers = ['STT', 'Ngày', ...commodities];
    ws.getRow(4).values = headers;

    // Add row 5 (with dummy date/STT) to simulate existing data
    const dummyDate = new Date('2026-07-13');
    ws.getRow(5).values = [1, dummyDate, ...commodities.map(() => 0)];
    ws.getRow(5).getCell(2).numFmt = 'yyyy-mm-dd';

    // Add row 6 "Tổng"
    ws.getRow(6).values = ['Tổng', '', ...commodities.map(() => 0)];

    await wb.xlsx.writeFile(filePath);
    console.log(`Đã tạo file lũy kế giả lập: ${filePath}`);
    return filePath;
  };

  const pathNormal = await createDummyTracker(
    'Thong ke gia tri giao dich 2026.xlsx',
    NORMAL_COMMODITIES,
  );
  const pathSpread = await createDummyTracker(
    'Thong ke gia tri giao dich Spread 2026.xlsx',
    SPREAD_COMMODITIES,
  );
  const pathLme = await createDummyTracker(
    'Thong ke gia tri giao dich LME 2026.xlsx',
    LME_COMMODITIES,
  );
  const pathOptions = await createDummyTracker(
    'Thong ke gia tri giao dich Options 2026.xlsx',
    OPTIONS_COMMODITIES,
  );
  const pathAcm = await createDummyTracker(
    'Thong ke gia tri giao dich ACM 2026.xlsx',
    ACM_COMMODITIES,
  );

  // Configure paths inside targetRoot
  // We'll mimic the required directory structure under testRoot:
  // - testRoot\Thong ke gia tri giao dich\Thong ke gia tri giao dich 2026.xlsx
  // - testRoot\Backup MS\Spread\2026\Thong ke gia tri giao dich Spread 2026.xlsx
  // - testRoot\Backup CQG\LME\2026\Thong ke gia tri giao dich LME 2026.xlsx
  // - testRoot\Thong ke gia tri giao dich\Thong ke gia tri giao dich Options 2026.xlsx
  // - testRoot\Thong ke gia tri giao dich\Thong ke gia tri giao dich ACM 2026.xlsx
  // - testRoot\Backup MS\Futures\2026\T07.2026\14.07\DSGD.xlsx

  const setupDir = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  };

  setupDir(path.join(testRoot, 'Thong ke gia tri giao dich'));
  setupDir(path.join(testRoot, 'Backup MS', 'Spread', '2026'));
  setupDir(path.join(testRoot, 'Backup CQG', 'LME', '2026'));
  setupDir(
    path.join(testRoot, 'Backup MS', 'Futures', '2026', 'T07.2026', '14.07'),
  );

  // Move / Copy the initialized files to their structure paths
  fs.copyFileSync(
    pathNormal,
    path.join(
      testRoot,
      'Thong ke gia tri giao dich',
      'Thong ke gia tri giao dich 2026.xlsx',
    ),
  );
  fs.copyFileSync(
    pathSpread,
    path.join(
      testRoot,
      'Backup MS',
      'Spread',
      '2026',
      'Thong ke gia tri giao dich Spread 2026.xlsx',
    ),
  );
  fs.copyFileSync(
    pathLme,
    path.join(
      testRoot,
      'Backup CQG',
      'LME',
      '2026',
      'Thong ke gia tri giao dich LME 2026.xlsx',
    ),
  );
  fs.copyFileSync(
    pathOptions,
    path.join(
      testRoot,
      'Thong ke gia tri giao dich',
      'Thong ke gia tri giao dich Options 2026.xlsx',
    ),
  );
  fs.copyFileSync(
    pathAcm,
    path.join(
      testRoot,
      'Thong ke gia tri giao dich',
      'Thong ke gia tri giao dich ACM 2026.xlsx',
    ),
  );

  // Copy DSGD.xlsx to test structure
  fs.copyFileSync(
    dsgdPath,
    path.join(
      testRoot,
      'Backup MS',
      'Futures',
      '2026',
      'T07.2026',
      '14.07',
      'DSGD.xlsx',
    ),
  );

  // 2. Trigger native calculations
  const settingsService = new DummySettingsService() as any;
  const service = new ValueStatisticsService(settingsService);

  console.log('\nChạy tính toán native...');
  const result = await service.processValueStatistics(targetDate, {
    macroPath,
    targetRoot: testRoot,
  });

  console.log('Hoàn tất tính toán native!');
  console.log('Kết quả:', result);

  // 3. Read the expected values from Sheet1 of Macro workbook template
  console.log('\nĐang đọc các giá trị kì vọng từ file Macro gốc...');
  const macroWb = new ExcelJS.Workbook();
  await macroWb.xlsx.readFile(macroPath);
  const sheet1 = macroWb.worksheets.find(
    (w) => w.name.toLowerCase() === 'sheet1',
  )!;

  // Read Sheet1 J11:L77 (Normal)
  const expectedNormal = new Map<string, number>();
  for (let r = 11; r <= 77; r++) {
    const sp = String(sheet1.getCell(`J${r}`).value || '').trim();
    const valCell = sheet1.getCell(`L${r}`);
    const val =
      typeof valCell.value === 'object' &&
        valCell.value !== null &&
        'result' in valCell.value
        ? Number(valCell.value.result)
        : Number(valCell.value || 0);
    if (sp) expectedNormal.set(sp, val);
  }

  // Read Sheet1 N12:N20 (Spread)
  const expectedSpread = new Map<string, number>();
  const spreadSpOrder = [
    'ZSE',
    'C.ZCE',
    'ZLE',
    'ZCE',
    'P.ZCE',
    'ZRE',
    'XC',
    'TRU',
    'MHG',
  ];
  for (let i = 0; i < spreadSpOrder.length; i++) {
    const sp = spreadSpOrder[i];
    const r = 12 + i;
    const valCell = sheet1.getCell(`N${r}`);
    const val =
      typeof valCell.value === 'object' &&
        valCell.value !== null &&
        'result' in valCell.value
        ? Number(valCell.value.result)
        : Number(valCell.value || 0);
    expectedSpread.set(sp, val);
  }

  // 4. Read the written values from the generated test trackers and verify
  console.log('\nĐang so sánh đối chiếu giá trị tính toán với kì vọng...');

  let mismatchCount = 0;

  const verifyTracker = async (
    filePath: string,
    commodities: string[],
    expectedMap: Map<string, number>,
    label: string,
  ) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const ws = wb.getWorksheet(sheetName)!;

    // Find the row for 2026-07-14
    let targetRowIndex = -1;
    for (let r = 5; r <= ws.rowCount; r++) {
      const cellVal = ws.getCell(r, 2).value;
      let dateObj: Date | null = null;
      if (cellVal instanceof Date) {
        dateObj = cellVal;
      } else if (typeof cellVal === 'string') {
        dateObj = new Date(cellVal);
      } else if (typeof cellVal === 'number') {
        const epoch = new Date(1899, 11, 30);
        dateObj = new Date(epoch.getTime() + cellVal * 86400000);
      }
      if (
        dateObj &&
        !isNaN(dateObj.getTime()) &&
        dateObj.toISOString().startsWith('2026-07-14')
      ) {
        targetRowIndex = r;
        break;
      }
    }

    if (targetRowIndex === -1) {
      console.error(
        `❌ Lỗi: Không tìm thấy dòng cho ngày 2026-07-14 trong file ${label}`,
      );
      mismatchCount++;
      return;
    }

    console.log(`\n--- Đối chiếu file: ${label} ---`);
    for (let i = 0; i < commodities.length; i++) {
      const code = commodities[i];
      const writtenVal = Number(ws.getCell(targetRowIndex, 3 + i).value || 0);
      const expectedVal = expectedMap.get(code) || 0;

      const diff = Math.abs(writtenVal - expectedVal);
      if (diff > 0.01) {
        console.error(
          `❌ BẤT ĐỒNG: [${code}] Lũy kế=${writtenVal.toLocaleString()} vs Kỳ vọng=${expectedVal.toLocaleString()} (Lệch: ${diff.toLocaleString()})`,
        );
        mismatchCount++;
      } else {
        console.log(`✅ Khớp: [${code}] ${writtenVal.toLocaleString()}`);
      }
    }
  };

  // Verify Normal Tracker
  await verifyTracker(
    path.join(
      testRoot,
      'Thong ke gia tri giao dich',
      'Thong ke gia tri giao dich 2026.xlsx',
    ),
    NORMAL_COMMODITIES,
    expectedNormal,
    'Normal (L11:L77)',
  );

  // Verify Spread Tracker
  await verifyTracker(
    path.join(
      testRoot,
      'Backup MS',
      'Spread',
      '2026',
      'Thong ke gia tri giao dich Spread 2026.xlsx',
    ),
    SPREAD_COMMODITIES,
    expectedSpread,
    'Spread (N12:N20)',
  );

  // Verify LME Tracker
  await verifyTracker(
    path.join(
      testRoot,
      'Backup CQG',
      'LME',
      '2026',
      'Thong ke gia tri giao dich LME 2026.xlsx',
    ),
    LME_COMMODITIES,
    expectedNormal, // LME values are normal values
    'LME (L69:L77)',
  );

  // Verify Options Tracker
  await verifyTracker(
    path.join(
      testRoot,
      'Thong ke gia tri giao dich',
      'Thong ke gia tri giao dich Options 2026.xlsx',
    ),
    OPTIONS_COMMODITIES,
    expectedNormal, // Options values are normal values
    'Options (O11:O26)',
  );

  // Verify ACM Tracker
  await verifyTracker(
    path.join(
      testRoot,
      'Thong ke gia tri giao dich',
      'Thong ke gia tri giao dich ACM 2026.xlsx',
    ),
    ACM_COMMODITIES,
    expectedNormal, // ACM values are normal values
    'ACM (T11:T13)',
  );

  console.log('\n================================================');
  if (mismatchCount === 0) {
    console.log('🎉🎉 THÀNH CÔNG: TẤT CẢ GIÁ TRỊ ĐÃ KHỚP 100% PARITY! 🎉🎉');
  } else {
    console.error(
      `❌ THẤT BẠI: Có ${mismatchCount} lỗi lệch giá trị đối chiếu.`,
    );
  }
  console.log('================================================');
}

runTest().catch(console.error);
