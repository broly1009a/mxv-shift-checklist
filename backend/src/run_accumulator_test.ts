import * as fs from 'fs';
import * as path from 'path';
import { LotStatisticsService } from './modules/lot-statistics/lot-statistics.service';
import { toDate } from './modules/lot-statistics/helpers/excel-parser.helper';
import * as ExcelJS from 'exceljs';

async function runTest() {
  console.log('=== STARTING AUTOMATED CUMULATIVE RECONCILIATION TEST ===');

  const workspaceRoot = path.join(__dirname, '..', '..');
  const sampleMsDir = path.join(
    workspaceRoot,
    'Marco thong ke lot',
    'Backup MS',
    '16.07',
  );
  const sampleCqgDir = path.join(
    workspaceRoot,
    'Marco thong ke lot',
    'Backup CQG',
    '16.07',
  );
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
    pathAcm: path.join(
      testTempDir,
      'Thong ke so lot giao dich ACM 2026 2.xlsx',
    ),
    pathLme: path.join(testTempDir, 'Thong ke so lot giao dich LME 2026.xlsx'),
    pathOptions: path.join(
      testTempDir,
      'Thong ke so lot giao dich Options 2026.xlsx',
    ),
    pathSpread: path.join(
      testTempDir,
      'Thong ke so lot giao dich Spread 2026.xlsx',
    ),
  };

  console.log('Processing lot statistics and updating cumulative files...');
  const result = await service.processLotStatistics(files, params);

  // Verification phase
  console.log('\n--- VERIFYING STYLE HIGHLIGHTS IN NORMAL TRACKER ---');
  const normalWb = new ExcelJS.Workbook();
  await normalWb.xlsx.readFile(params.pathNormal);
  const normalWs = normalWb.getWorksheet('T07.2026')!;

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

  let foundRowNormal = -1;
  for (let r = 5; r <= normalWs.rowCount; r++) {
    const val = normalWs.getCell(r, 2).value;
    if (checkDate(val, '2026-07-16')) {
      foundRowNormal = r;
      break;
    }
  }

  if (foundRowNormal !== -1) {
    console.log(`Found 2026-07-16 in Normal tracker at Row ${foundRowNormal}`);
    const colsToCheck = [3, 17];
    for (const col of colsToCheck) {
      const cell = normalWs.getCell(foundRowNormal, col);
      console.log(
        `Col ${col} (${normalWs.getCell(4, col).value || normalWs.getCell(5, col).value}):`,
      );
      console.log(`  Value: ${JSON.stringify(cell.value)}`);
      console.log(`  Fill:  ${JSON.stringify(cell.fill)}`);
      console.log(`  Font:  ${JSON.stringify(cell.font)}`);
    }
  } else {
    console.log(`[FAIL] Could not find 2026-07-16 in Normal tracker`);
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
