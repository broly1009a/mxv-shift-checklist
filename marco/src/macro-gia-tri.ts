/**
 * macro-gia-tri.ts
 * Entry point thay thế Sub Chay_file() trong VBA File 1
 * "Thống kê giá trị giao dịch có ACM"
 *
 * Usage:
 *   npx ts-node marco/src/macro-gia-tri.ts --config config-giatri.json
 *   npx ts-node marco/src/macro-gia-tri.ts --dsgd "path/to/dsgd.xlsx" --date 2026-07-16
 */

import * as path from 'path';
import * as fs from 'fs';
import { readExcelSheet, toNumber } from './utils/excel-reader';
import { formatDateDDMMYYYY } from './utils/date-utils';
import { classifyDsgd } from './services/trade-classifier.service';
import {
  calculateGtgdReport,
  buildHHMap,
  formatGtgd,
  DEFAULT_HH_LOOKUP,
  HHLookupEntry,
} from './services/value-calculator.service';
import { DsgdRow, TyGiaConfig } from './types/trade-data.types';

// ─── CLI ─────────────────────────────────────────────────────────────────────

interface CliConfig {
  configFile?: string;
  pathDsgd?: string;
  pathHhLookup?: string;
  pathOutput?: string;
  ngayGD?: Date;
  tyGiaDefault?: number;
  tyGiaTru?: number;
  tyGiaMpo?: number;
  dryRun?: boolean;
}

function parseArgs(): CliConfig {
  const args = process.argv.slice(2);
  const result: CliConfig = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config': result.configFile = args[++i]; break;
      case '--dsgd': result.pathDsgd = args[++i]; break;
      case '--hh-lookup': result.pathHhLookup = args[++i]; break;
      case '--output': result.pathOutput = args[++i]; break;
      case '--date': result.ngayGD = new Date(args[++i]); break;
      case '--ty-gia': result.tyGiaDefault = parseFloat(args[++i]); break;
      case '--ty-gia-tru': result.tyGiaTru = parseFloat(args[++i]); break;
      case '--ty-gia-mpo': result.tyGiaMpo = parseFloat(args[++i]); break;
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
Thống kê giá trị giao dịch có ACM
Thay thế: Macro thong ke gia tri giao dich có ACM.xlsm

Usage:
  npx ts-node marco/src/macro-gia-tri.ts [options]

Options:
  --config <file>       File JSON cấu hình
  --dsgd <path>         File DSGD (CQG data)
  --hh-lookup <path>    File tra cứu hàng hóa (HH + Hhoa Vlookup sheets)
  --output <path>       File output
  --date <YYYY-MM-DD>   Ngày giao dịch
  --ty-gia <number>     Tỷ giá USD/VND mặc định (Sheet1!D2)
  --ty-gia-tru <number> Tỷ giá TRU (Sheet1!D3)
  --ty-gia-mpo <number> Tỷ giá MPO (Sheet1!D4)
  --dry-run             Chỉ tính, không ghi file
  --help                Hiển thị hướng dẫn

Config file format (JSON):
  {
    "ngayGD": "2026-07-16",
    "pathDsgd": "C:/path/to/dsgd.xlsx",
    "tyGiaDefault": 25000,
    "tyGiaTru": 25000,
    "tyGiaMpo": 25000,
    "hhLookup": [
      { "maHH": "TRU", "tenHH": "Cao su", "heSo": 1000, "donViQuyDoi": 1 }
    ]
  }
`);
}

// ─── Load config ─────────────────────────────────────────────────────────────

interface FullGtgdConfig {
  ngayGD: Date;
  pathDsgd: string;
  pathOutput?: string;
  tyGiaDefault: number;
  tyGiaTru: number;
  tyGiaMpo: number;
  hhLookup?: HHLookupEntry[];
  dryRun?: boolean;
}

function loadConfig(args: CliConfig): FullGtgdConfig {
  let raw: Record<string, unknown> = {};
  if (args.configFile) {
    raw = JSON.parse(fs.readFileSync(args.configFile, 'utf-8'));
  }

  return {
    ngayGD: args.ngayGD ?? (raw.ngayGD ? new Date(raw.ngayGD as string) : new Date()),
    pathDsgd: args.pathDsgd ?? (raw.pathDsgd as string) ?? '',
    pathOutput: args.pathOutput ?? (raw.pathOutput as string),
    tyGiaDefault: args.tyGiaDefault ?? (raw.tyGiaDefault as number) ?? 25000,
    tyGiaTru: args.tyGiaTru ?? (raw.tyGiaTru as number) ?? 25000,
    tyGiaMpo: args.tyGiaMpo ?? (raw.tyGiaMpo as number) ?? 25000,
    hhLookup: raw.hhLookup as HHLookupEntry[] | undefined,
    dryRun: args.dryRun,
  };
}

// ─── Load DSGD ───────────────────────────────────────────────────────────────

async function loadDsgdData(filePath: string): Promise<DsgdRow[]> {
  const { rows } = await readExcelSheet(filePath, 0);
  return rows.map((r) => ({
    maTKGD: r['col4'] as string,
    loaiHD: r['col6'] as string,
    maSanPham: r['col8'] as string,
    maKyHan: r['col9'] as string,
    side: r['col13'] as string,
    gia: toNumber(r['col16']),
    khoiLuong: toNumber(r['col17']),
    ...r,
  } as DsgdRow));
}

// ─── Load HH Lookup từ file Excel ────────────────────────────────────────────

async function loadHHLookup(filePath: string): Promise<HHLookupEntry[]> {
  try {
    // VBA đọc từ sheet "HH" (cột A: mã, cột B: tên) và "Hhoa Vlookup" (cột A: mã, cột B: heSo, cột C: donVi)
    const hhSheet = await readExcelSheet(filePath, 'HH');
    const vlookupSheet = await readExcelSheet(filePath, 'Hhoa Vlookup');

    const vlookupMap = new Map<string, { heSo: number; donVi: number }>();
    for (const row of vlookupSheet.rows) {
      const ma = String(row['col1'] ?? '').trim();
      if (ma) {
        vlookupMap.set(ma, {
          heSo: toNumber(row['col2']),
          donVi: toNumber(row['col3']),
        });
      }
    }

    return hhSheet.rows
      .map((row) => {
        const maHH = String(row['col1'] ?? '').trim();
        const tenHH = String(row['col2'] ?? '').trim();
        const vl = vlookupMap.get(maHH) ?? { heSo: 1, donVi: 1 };
        return { maHH, tenHH, heSo: vl.heSo, donViQuyDoi: vl.donVi };
      })
      .filter((e) => e.maHH);
  } catch {
    console.warn('⚠️  Không load được HH Lookup từ file, dùng giá trị mặc định');
    return DEFAULT_HH_LOOKUP;
  }
}

// ─── Print kết quả ────────────────────────────────────────────────────────────

function printGtgdReport(params: {
  ngayGD: Date;
  dsgdByHH: { maHH: string; gtgd: number }[];
  spreadByHH: { maHH: string; gtgd: number }[];
  totalGtgd: number;
  totalSpreadGtgd: number;
}) {
  console.log('\n' + '='.repeat(70));
  console.log(`💰 BÁO CÁO GIÁ TRỊ GIAO DỊCH - ${formatDateDDMMYYYY(params.ngayGD)}`);
  console.log('='.repeat(70));

  console.log('\n📦 GTGD Futures theo Hàng Hóa:');
  for (const row of params.dsgdByHH) {
    console.log(`  ${row.maHH.padEnd(10)} ${formatGtgd(row.gtgd).padStart(20)} VNĐ`);
  }
  console.log(`  ${'TỔNG'.padEnd(10)} ${formatGtgd(params.totalGtgd).padStart(20)} VNĐ`);

  console.log('\n📊 GTGD Spread theo Hàng Hóa:');
  for (const row of params.spreadByHH) {
    console.log(`  ${row.maHH.padEnd(10)} ${formatGtgd(row.gtgd).padStart(20)} VNĐ`);
  }
  console.log(`  ${'TỔNG'.padEnd(10)} ${formatGtgd(params.totalSpreadGtgd).padStart(20)} VNĐ`);

  console.log('='.repeat(70) + '\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Macro Gia Tri Giao Dich - TypeScript Version');

  const args = parseArgs();
  const config = loadConfig(args);

  if (!config.pathDsgd) {
    console.error('❌ Thiếu --dsgd (đường dẫn file DSGD)');
    process.exit(1);
  }

  console.log(`📅 Ngày giao dịch: ${formatDateDDMMYYYY(config.ngayGD)}`);
  console.log(`💱 Tỷ giá: Default=${config.tyGiaDefault}, TRU=${config.tyGiaTru}, MPO=${config.tyGiaMpo}`);

  try {
    // 1. Load dữ liệu
    console.log('📂 Đang load dữ liệu DSGD...');
    const dsgdRows = await loadDsgdData(config.pathDsgd);
    console.log(`  Tổng: ${dsgdRows.length} rows`);

    // 2. Load HH lookup
    const hhEntries = config.hhLookup ?? DEFAULT_HH_LOOKUP;
    const hhMap = buildHHMap(hhEntries);
    console.log(`📋 HH Lookup: ${hhMap.size} hàng hóa`);

    // 3. Phân loại DSGD
    const { dsgd, dsgdSpread, dsgdLme, dsgdOptions, dsgdAcm } = classifyDsgd(dsgdRows);
    console.log(`  Futures: ${dsgd.length}, Spread: ${dsgdSpread.length}, LME: ${dsgdLme.length}, Options: ${dsgdOptions.length}, ACM: ${dsgdAcm.length}`);

    // 4. Tính GTGD
    const tyGia: TyGiaConfig = {
      tyGiaDefault: config.tyGiaDefault,
      tyGiaTru: config.tyGiaTru,
      tyGiaMpo: config.tyGiaMpo,
    };

    const report = calculateGtgdReport({
      dsgdRows: dsgd,
      spreadRows: dsgdSpread,
      hhMap,
      tyGia,
    });

    // 5. In kết quả
    printGtgdReport({
      ngayGD: config.ngayGD,
      ...report,
    });

    // 6. Lưu JSON
    if (!config.dryRun) {
      const dateStr = formatDateDDMMYYYY(config.ngayGD).replace(/\//g, '-');
      const outputPath = config.pathOutput
        ?? path.join(process.cwd(), `gia-tri-report-${dateStr}.json`);

      fs.writeFileSync(
        outputPath,
        JSON.stringify(
          {
            ngayGD: formatDateDDMMYYYY(config.ngayGD),
            tyGia,
            dsgdByHH: report.dsgdByHH,
            spreadByHH: report.spreadByHH,
            totalGtgd: report.totalGtgd,
            totalSpreadGtgd: report.totalSpreadGtgd,
          },
          null,
          2,
        ),
        'utf-8',
      );
      console.log(`💾 Kết quả đã lưu: ${outputPath}`);
    } else {
      console.log('ℹ️  Dry-run mode: không ghi file');
    }

    console.log('✅ Hoàn thành!');
  } catch (err) {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  }
}

main();
