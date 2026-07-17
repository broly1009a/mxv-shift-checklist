import * as fs from 'fs';
import * as path from 'path';
import { LotStatisticsService } from './modules/lot-statistics/lot-statistics.service';
import { toDate } from './modules/lot-statistics/helpers/excel-parser.helper';
import * as ExcelJS from 'exceljs';

async function runTest() {
  console.log('=== STARTING AUTOMATED CUMULATIVE RECONCILIATION TEST ===');

  const workspaceRoot = path.join(__dirname, '..', '..');
  const sampleMsDir = path.join(workspaceRoot, 'Marco thong ke lot', 'Backup MS', '16.07');
  const sampleCqgDir = path.join(workspaceRoot, 'Marco thong ke lot', 'Backup CQG', '16.07');
  const sampleCumulativeDir = path.join(workspaceRoot, 'Marco thong ke lot');

  const testTempDir = path.join(__dirname, '..', 'temp_test_cumulative');
  if (!fs.existsSync(testTempDir)) {
    fs.mkdirSync(testTempDir, { recursive: true });
  }

  // Copy sample cumulative files to temp test folder to prevent overwriting originals
  const trackerFiles = [
    'DSGD T07.2026.xlsx',
    'Thong ke so lot giao dich 2026 2.xlsx',
    'Thong ke so lot giao dich ACM 2026 2.xlsx',
    'Thong ke so lot giao dich LME 2026.xlsx',
    'Thong ke so lot giao dich Options 2026.xlsx',
    'Thong ke so lot giao dich Spread 2026.xlsx',
  ];

  console.log('Copying sample tracker files to temp test directory...');
  for (const file of trackerFiles) {
    const src = path.join(sampleCumulativeDir, file);
    const dest = path.join(testTempDir, file);
    fs.copyFileSync(src, dest);
    console.log(`- Copied ${file}`);
  }

  // Set up service and inputs
  const service = new LotStatisticsService({
    getSetting: async () => '{}',
  } as any);

  console.log('Scanning daily directories...');
  const files = service.loadFilesFromDirectories(sampleMsDir, sampleCqgDir);

  const params = {
    ngayGD: '2026-07-16',
    truDates: ['2026-07-16', '2026-07-15', '2026-07-14'],
    fefDates: ['2026-07-16', '2026-07-15'],
    zftDates: ['2026-07-16', '2026-07-15'],
    filterLmeKyHan: 'U26',
    deadline: 46217.208333,
    updateCumulative: true,
    pathDsgdCumulative: path.join(testTempDir, 'DSGD T07.2026.xlsx'),
    pathNormal: path.join(testTempDir, 'Thong ke so lot giao dich 2026 2.xlsx'),
    pathAcm: path.join(testTempDir, 'Thong ke so lot giao dich ACM 2026 2.xlsx'),
    pathLme: path.join(testTempDir, 'Thong ke so lot giao dich LME 2026.xlsx'),
    pathOptions: path.join(testTempDir, 'Thong ke so lot giao dich Options 2026.xlsx'),
    pathSpread: path.join(testTempDir, 'Thong ke so lot giao dich Spread 2026.xlsx'),
  };

  console.log('Processing lot statistics and updating cumulative files...');
  const result = await service.processLotStatistics(files, params);

  console.log('\n--- DAILY SUMMARIES ---');
  console.log(`Normal Futures (DSGD): ${result.summary.dsgdProduct}`);
  console.log(`LME (DSGD):           ${result.summary.dsgdLme}`);
  console.log(`Options (DSGD):       ${result.summary.dsgdOptions}`);
  console.log(`Spread (DSGD):        ${result.summary.dsgdSpread}`);
  console.log(`ACM (DSGD):           ${result.summary.acmLot}`);

  // Verification phase
  console.log('\n--- VERIFYING CUMULATIVE UPDATES ---');

  // Helper function for date matching in test
  function checkDate(cellVal: any, targetStr: string): boolean {
    if (!cellVal) return false;
    if (cellVal instanceof Date) {
      return cellVal.toISOString().startsWith(targetStr);
    }
    if (typeof cellVal === 'object' && 'result' in cellVal) {
      return checkDate(cellVal.result, targetStr);
    }
    return String(cellVal).includes(targetStr);
  }

  // Verify LME
  const lmeWb = new ExcelJS.Workbook();
  await lmeWb.xlsx.readFile(params.pathLme);
  const lmeWs = lmeWb.getWorksheet('T07.2026')!;
  console.log(`LME Sheet: T07.2026 row count = ${lmeWs.rowCount}`);
  let foundRowLme = -1;
  for (let r = 5; r <= lmeWs.rowCount; r++) {
    const val = lmeWs.getCell(r, 2).value;
    if (checkDate(val, '2026-07-16')) {
      foundRowLme = r;
      break;
    }
  }
  if (foundRowLme !== -1) {
    console.log(`[PASS] Found 2026-07-16 in LME tracker at Row ${foundRowLme}`);
    for (let c = 1; c <= lmeWs.columnCount; c++) {
      const v = lmeWs.getCell(foundRowLme, c).value;
      if (v !== null && v !== undefined) {
        console.log(`  Col ${c} (${lmeWs.getCell(4, c).value}): ${JSON.stringify(v)}`);
      }
    }
  } else {
    console.log(`[FAIL] Could not find 2026-07-16 in LME tracker`);
  }

  // Verify ACM
  const acmWb = new ExcelJS.Workbook();
  await acmWb.xlsx.readFile(params.pathAcm);
  const acmWs = acmWb.getWorksheet('T07.2026')!;
  let foundRowAcm = -1;
  for (let r = 5; r <= acmWs.rowCount; r++) {
    const val = acmWs.getCell(r, 2).value;
    if (checkDate(val, '2026-07-16')) {
      foundRowAcm = r;
      break;
    }
  }
  if (foundRowAcm !== -1) {
    console.log(`[PASS] Found 2026-07-16 in ACM tracker at Row ${foundRowAcm}`);
    for (let c = 1; c <= acmWs.columnCount; c++) {
      const v = acmWs.getCell(foundRowAcm, c).value;
      if (v !== null && v !== undefined) {
        console.log(`  Col ${c} (${acmWs.getCell(4, c).value}): ${JSON.stringify(v)}`);
      }
    }
  } else {
    console.log(`[FAIL] Could not find 2026-07-16 in ACM tracker`);
  }

  // Clean up
  console.log('\nCleaning up temporary test files...');
  for (const file of trackerFiles) {
    fs.unlinkSync(path.join(testTempDir, file));
  }
  fs.rmdirSync(testTempDir);
  console.log('Test completed successfully!');
}

runTest().catch((err) => {
  console.error('Test run failed with error:', err);
});
