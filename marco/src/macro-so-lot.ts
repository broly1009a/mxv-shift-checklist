/**
 * macro-so-lot.ts
 * Entry point thay thế Sub copyfile() trong VBA File 2
 * "Thống kê số lot giao dịch có ACM"
 *
 * Usage:
 *   npx ts-node marco/src/macro-so-lot.ts --config config.json
 *   npx ts-node marco/src/macro-so-lot.ts --dsgd "path/to/dsgd.xlsx" --fr "..." --date 2026-07-16
 */

import * as path from 'path';
import * as fs from 'fs';
import { readExcelSheet, toNumber } from './utils/excel-reader';
import { formatDateDDMMYYYY } from './utils/date-utils';
import { classifyAllTrades } from './services/trade-classifier.service';
import { calculateDailyLotReport, FrExclusionConfig, aggregateByProduct, aggregateByTvkd } from './services/lot-calculator.service';
import { DsgdRow, FrRow, TtmRow, OpRow, PsRow, TtttRow, MacroConfig } from './types/trade-data.types';
import { DailyLotReport } from './types/report.types';

// ─── Parse CLI args ──────────────────────────────────────────────────────────

function parseArgs(): Partial<MacroConfig> & { configFile?: string; dryRun?: boolean } {
  const args = process.argv.slice(2);
  const result: Partial<MacroConfig> & { configFile?: string; dryRun?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config': result.configFile = args[++i]; break;
      case '--dsgd': result.pathDsgd = args[++i]; break;
      case '--fr': result.pathFr = args[++i]; break;
      case '--ttm': result.pathTtm = args[++i]; break;
      case '--tttt': result.pathTttt = args[++i]; break;
      case '--op': result.pathOp = args[++i]; break;
      case '--ps': result.pathPs = args[++i]; break;
      case '--gdt': result.pathGdt = args[++i]; break;
      case '--output': result.pathOutputHistory = args[++i]; break;
      case '--date': result.ngayGD = new Date(args[++i]); break;
      case '--dry-run': result.dryRun = true; break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }
  return result;
}

function printHelp() {
  console.log(`
Thống kê số lot giao dịch có ACM
Thay thế: Macro thong ke so lot giao dich có ACM.xlsm

Usage:
  npx ts-node marco/src/macro-so-lot.ts [options]

Options:
  --config <file>   File JSON cấu hình đường dẫn (thay cho Sheet2 trong macro)
  --dsgd <path>     File DSGD (CQG data)
  --fr <path>       File FR (MXV system)
  --ttm <path>      File TTM (Trading ticket master)
  --tttt <path>     File TTTT (Tổng thể tất toán)
  --op <path>       File OP (Open position)
  --ps <path>       File PS (Pending settlement)
  --gdt <path>      File GDT (Global data table - để append)
  --output <path>   File output lịch sử
  --date <YYYY-MM-DD>  Ngày giao dịch (mặc định: hôm nay)
  --dry-run         Chỉ tính, không ghi file
  --help            Hiển thị hướng dẫn này

Config file format (JSON):
  {
    "ngayGD": "2026-07-16",
    "pathDsgd": "C:/path/to/dsgd.xlsx",
    "pathFr": "C:/path/to/fr.xlsx",
    "pathTtm": "C:/path/to/ttm.xlsx",
    "pathTttt": "C:/path/to/tttt.xlsx",
    "pathOp": "C:/path/to/op.xlsx",
    "pathPs": "C:/path/to/ps.xlsx",
    "pathOutputHistory": "C:/path/to/output.xlsx",
    "truDates": ["2026-07-16", "2026-07-15", "2026-07-14", "2026-07-11"],
    "fefDates": ["2026-07-16", "2026-07-15"],
    "zftDates": ["2026-07-16", "2026-07-15"]
  }
`);
}

// ─── Load config ─────────────────────────────────────────────────────────────

interface FullConfig extends MacroConfig {
  truDates?: string[];
  fefDates?: string[];
  zftDates?: string[];
  deadline?: number;
  filterMaKyHan?: string;
}

function loadConfig(args: ReturnType<typeof parseArgs>): FullConfig {
  let config: Partial<FullConfig> = {};

  if (args.configFile) {
    const raw = fs.readFileSync(args.configFile, 'utf-8');
    config = JSON.parse(raw);
  }

  // CLI args override config file
  if (args.pathDsgd) config.pathDsgd = args.pathDsgd;
  if (args.pathFr) config.pathFr = args.pathFr;
  if (args.pathTtm) config.pathTtm = args.pathTtm;
  if (args.pathTttt) config.pathTttt = args.pathTttt;
  if (args.pathOp) config.pathOp = args.pathOp;
  if (args.pathPs) config.pathPs = args.pathPs;
  if (args.pathGdt) config.pathGdt = args.pathGdt;
  if (args.pathOutputHistory) config.pathOutputHistory = args.pathOutputHistory;
  if (args.ngayGD) config.ngayGD = args.ngayGD;

  // Default ngayGD = today
  if (!config.ngayGD) {
    config.ngayGD = new Date();
  } else if (typeof config.ngayGD === 'string') {
    config.ngayGD = new Date(config.ngayGD as string);
  }

  return config as FullConfig;
}

// ─── Load và chuẩn hóa dữ liệu từ Excel ─────────────────────────────────────

async function loadDsgdData(filePath: string): Promise<DsgdRow[]> {
  const { rows } = await readExcelSheet(filePath, 0);
  return rows.map((r) => ({
    stt: toNumber(r['col1']),
    ngayGD: r['col2'] as string | Date,
    gioGD: r['col3'] as string,
    maTKGD: r['col4'] as string,        // Field 4 trong VBA filter
    maNDT: r['col5'] as string,
    loaiHD: r['col6'] as string,         // Field 6 cho Options
    col7: r['col7'] as string,
    maSanPham: r['col8'] as string,      // mã sản phẩm/hàng hóa
    maKyHan: r['col9'] as string,
    col10: r['col10'],
    col11: r['col11'],
    col12: r['col12'],
    side: r['col13'] as string,          // BUY/SELL
    col14: r['col14'],
    col15: r['col15'],
    gia: toNumber(r['col16']),
    khoiLuong: toNumber(r['col17']),     // Cột Q trong VBA
    ...r,
  } as DsgdRow));
}

async function loadFrData(filePath: string): Promise<FrRow[]> {
  const { rows } = await readExcelSheet(filePath, 0);
  return rows.map((r) => {
    const khoiLuongRaw = r['col6'];
    const khoiLuongNum = toNumber(khoiLuongRaw);
    const maSanPham = r['col3'] as string || '';
    // J = LEFT(C, LEN(C)-3) = bỏ 3 ký tự cuối
    const maSPNgan = maSanPham.length > 3 ? maSanPham.substring(0, maSanPham.length - 3) : maSanPham;

    return {
      maTKGD: r['col1'] as string,
      thoiGian: r['col2'],
      col3: r['col3'],
      col4: r['col4'],
      col5: r['col5'],
      khoiLuong: khoiLuongRaw,
      khoiLuongNum,
      maSPNgan,
      ngayGD: undefined,   // Sẽ tính sau bằng normalizeFrTradingDate
      thoiDiem: undefined, // Sẽ tính sau
      ...r,
    } as FrRow;
  });
}

async function loadGenericData<T>(filePath: string): Promise<T[]> {
  const { rows } = await readExcelSheet(filePath, 0);
  return rows as unknown as T[];
}

// ─── In kết quả ──────────────────────────────────────────────────────────────

function printReport(report: DailyLotReport) {
  console.log('\n' + '='.repeat(70));
  console.log(`📊 BÁO CÁO SỐ LOT GIAO DỊCH - ${formatDateDDMMYYYY(report.ngayGD)}`);
  console.log('='.repeat(70));

  console.log('\n📦 DSGD (CQG):');
  console.log(`  Product:  ${report.dsgdProduct.toLocaleString()} lot`);
  console.log(`  Spread:   ${report.dsgdSpread.toLocaleString()} lot`);
  console.log(`  LME:      ${report.dsgdLme.toLocaleString()} lot`);
  console.log(`  Options:  ${report.dsgdOptions.toLocaleString()} lot`);
  console.log(`  TOTAL:    ${report.dsgdTotal.toLocaleString()} lot`);

  console.log('\n📋 FR (MXV System):');
  console.log(`  Product:  ${report.frProduct.toLocaleString()} lot`);
  console.log(`  Spread:   ${report.frSpread.toLocaleString()} lot`);
  console.log(`  LME:      ${report.frLme.toLocaleString()} lot`);
  console.log(`  Options:  ${report.frOptions.toLocaleString()} lot`);

  console.log('\n🔄 Tất Toán (TTTT):');
  console.log(`  Product:  ${report.ttttProduct.toLocaleString()} lot`);
  console.log(`  Spread:   ${report.ttttSpread.toLocaleString()} lot`);
  console.log(`  LME:      ${report.ttttLme.toLocaleString()} lot`);
  console.log(`  Options:  ${report.ttttOptions.toLocaleString()} lot`);

  console.log('\n📂 Trạng Thái Mở (TTM):');
  console.log(`  Product:  ${report.ttmProduct.toLocaleString()} lot`);
  console.log(`  Spread:   ${report.ttmSpread.toLocaleString()} lot`);
  console.log(`  LME:      ${report.ttmLme.toLocaleString()} lot`);
  console.log(`  Options:  ${report.ttmOptions.toLocaleString()} lot`);

  console.log('\n🏦 ACM:');
  console.log(`  DSGD:  ${report.acmDsgdLot.toLocaleString()} lot`);
  console.log(`  TTTT:  ${report.acmTtttLot.toLocaleString()} lot`);
  console.log(`  TTM:   ${report.acmTtmLot.toLocaleString()} lot`);

  console.log('\n' + '─'.repeat(70));
  console.log('✅ VALIDATION RESULTS:');
  for (const v of report.validations) {
    const icon = v.passed ? '  ✅' : '  ❌';
    console.log(`${icon} ${v.field}: ${v.expected} vs ${v.actual}`);
  }
  console.log('='.repeat(70) + '\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Macro So Lot Giao Dich - TypeScript Version');

  const args = parseArgs();
  const config = loadConfig(args);

  // Validate required paths
  const required: (keyof MacroConfig)[] = ['pathDsgd', 'pathFr'];
  for (const key of required) {
    if (!config[key]) {
      console.error(`❌ Thiếu cấu hình: ${key}`);
      console.error('Chạy với --help để xem hướng dẫn');
      process.exit(1);
    }
  }

  console.log(`📅 Ngày giao dịch: ${formatDateDDMMYYYY(config.ngayGD)}`);

  try {
    // 1. Load dữ liệu
    console.log('📂 Đang load dữ liệu...');
    const dsgdRows = await loadDsgdData(config.pathDsgd);
    const frRows = await loadFrData(config.pathFr);
    const ttmRows = config.pathTtm ? await loadGenericData<TtmRow>(config.pathTtm) : [];
    const ttttRows = config.pathTttt ? await loadGenericData<TtttRow>(config.pathTttt) : [];
    const opRows = config.pathOp ? await loadGenericData<OpRow>(config.pathOp) : [];
    const psRows = config.pathPs ? await loadGenericData<PsRow>(config.pathPs) : [];

    console.log(`  DSGD: ${dsgdRows.length} rows`);
    console.log(`  FR:   ${frRows.length} rows`);
    console.log(`  TTM:  ${ttmRows.length} rows`);
    console.log(`  TTTT: ${ttttRows.length} rows`);
    console.log(`  OP:   ${opRows.length} rows`);
    console.log(`  PS:   ${psRows.length} rows`);

    // 2. Phân loại giao dịch
    console.log('🔄 Đang phân loại giao dịch...');
    const classified = classifyAllTrades({
      dsgdRows,
      frRows,
      ttmRows,
      opRows,
      psRows,
      ttttRows,
      filterMaKyHan: config.filterMaKyHan,
    });

    // 3. Tính báo cáo
    console.log('📊 Đang tính số lot...');
    const ngayGD = config.ngayGD instanceof Date ? config.ngayGD : new Date(config.ngayGD);
    const frConfig: FrExclusionConfig = {
      ngayGD,
      truDates: (config as FullConfig).truDates?.map((d) => new Date(d)) ?? [],
      fefDates: (config as FullConfig).fefDates?.map((d) => new Date(d)) ?? [],
      zftDates: (config as FullConfig).zftDates?.map((d) => new Date(d)) ?? [],
      deadline: (config as FullConfig).deadline,
    };

    const report = calculateDailyLotReport(classified, frConfig);

    // 4. In kết quả
    printReport(report);

    // 5. Xuất JSON (nếu không dry-run)
    if (!args.dryRun) {
      const outputJson = path.join(
        path.dirname(config.pathOutputHistory || '.'),
        `so-lot-report-${formatDateDDMMYYYY(ngayGD).replace(/\//g, '-')}.json`,
      );
      fs.writeFileSync(outputJson, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`💾 Kết quả đã lưu: ${outputJson}`);
    } else {
      console.log('ℹ️  Dry-run mode: không ghi file');
    }

    // 6. Exit code dựa trên validation
    const hasErrors = report.validations.some((v) => !v.passed);
    if (hasErrors) {
      console.warn('⚠️  Có validation errors - kiểm tra dữ liệu!');
      process.exit(2);
    }

    console.log('✅ Hoàn thành!');

  } catch (err) {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  }
}

main();
