import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';

const rootDir = path.resolve(__dirname, '..');
const sourceTemplatesDir = path.join(rootDir, 'Bao cao - Thong ke');
const sandboxDir = path.join(__dirname, 'sandbox_bao_cao_thong_ke');

// 1. Sao chép 13 file template vào Sandbox
if (!fs.existsSync(sandboxDir)) fs.mkdirSync(sandboxDir, { recursive: true });

const templateFiles = fs.readdirSync(sourceTemplatesDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));
console.log(`================================================================`);
console.log(`KIỂM CHỨNG TOÀN DIỆN PIPELINE TÍNH TOÁN & GHI 13 BÁO CÁO CORECCP`);
console.log(`================================================================\n`);
console.log(`1. Sao lưu 13 file template sang Sandbox an toàn: ${sandboxDir}`);
for (const f of templateFiles) {
  fs.copyFileSync(path.join(sourceTemplatesDir, f), path.join(sandboxDir, f));
}
console.log(`   Đã sao chép thành công ${templateFiles.length} file template.\n`);

// 2. Load Dữ liệu nguồn thực tế từ CoreCCP API / Backup
const dsgdFile = path.join(rootDir, 'coreccp-api-client', 'output', 'ORDERMATCH_DETAIL_32985.xlsx');
console.log(`2. Nạp dữ liệu nguồn CoreCCP thực tế: ${dsgdFile}`);
const wbDsgd = XLSX.readFile(dsgdFile);
const rawRows = XLSX.utils.sheet_to_json(wbDsgd.Sheets[wbDsgd.SheetNames[0]]) as any[];
console.log(`   Số dòng khớp lệnh: ${rawRows.length}`);

// Từ điển hàng hoá và độ lớn hợp đồng (doCao)
const COMMODITY_SPECS: Record<string, { doCao: number; tienTe: string }> = {
  // ACM
  SI5CO: { doCao: 100, tienTe: 'USD' },
  CP2CO: { doCao: 1000, tienTe: 'USD' },
  PL1NY: { doCao: 5, tienTe: 'USD' },
  GLD1:  { doCao: 10, tienTe: 'USD' },
  // Normal
  ZLE: { doCao: 600, tienTe: 'USD' },
  ZCE: { doCao: 50, tienTe: 'USD' },
  ZSE: { doCao: 50, tienTe: 'USD' },
  ZME: { doCao: 100, tienTe: 'USD' },
  ZWA: { doCao: 50, tienTe: 'USD' },
  // LME
  CAD: { doCao: 25, tienTe: 'USD' },
  AHD: { doCao: 25, tienTe: 'USD' },
  PBD: { doCao: 25, tienTe: 'USD' },
  SND: { doCao: 5, tienTe: 'USD' },
  ZDS: { doCao: 25, tienTe: 'USD' },
  NID: { doCao: 6, tienTe: 'USD' },
  // Bạc thỏi
  SIV: { doCao: 1, tienTe: 'VND' },
  SIVE: { doCao: 1, tienTe: 'VND' },
};

const TY_GIA: Record<string, number> = {
  USD: 25920,
  VND: 1,
};

// Hàm trích xuất mã Hàng hoá từ Mã HĐ CoreCCP
function extractMaHH(maHD: string): string {
  maHD = String(maHD || '').trim().toUpperCase();
  if (/^[CP]\./.test(maHD)) {
    // Option: C.ZCEZ26 430 -> C.ZCE
    const m = maHD.match(/^([CP]\.[A-Z0-9]+?)([FGHJKMNQUVXZ]|\d{2})/);
    return m ? m[1] : maHD.split(/\s+/)[0];
  }
  // Thử match các mã đã biết
  for (const k of Object.keys(COMMODITY_SPECS)) {
    if (maHD.startsWith(k)) return k;
  }
  // Fallback loại bỏ ký tự tháng năm cuối (Z26, H27, 0926)
  const m2 = maHD.match(/^([A-Z0-9]+?)([FGHJKMNQUVXZ]\d{2}|\d{4})$/);
  return m2 ? m2[1] : maHD;
}

// 3. Phân loại 5 phân hệ
interface TradeItem {
  tvkd: string;
  maTKGD: string;
  maHD: string;
  maHH: string;
  kl: number;
  gia: number;
  gtgd: number;
}

const buckets: Record<'normal' | 'acm' | 'spread' | 'lme' | 'options' | 'bacThoi', TradeItem[]> = {
  normal: [],
  acm: [],
  spread: [],
  lme: [],
  options: [],
  bacThoi: [],
};

for (const r of rawRows) {
  const maTKGD = String(r['Mã TKGD'] || '').trim().toUpperCase();
  const maHD = String(r['Mã HĐ'] || '').trim();
  const kl = Number(r['KL khớp']) || 0;
  const gia = Number(r['Giá khớp trung bình']) || 0;
  const tvkd = String(r['Mã thành viên'] || maTKGD.substring(0, 3)).padStart(3, '0');
  const maHH = extractMaHH(maHD);

  const spec = COMMODITY_SPECS[maHH] || { doCao: 1, tienTe: 'USD' };
  const rate = TY_GIA[spec.tienTe] || 25920;
  const gtgd = Math.round(kl * gia * spec.doCao * rate);

  const item: TradeItem = { tvkd, maTKGD, maHD, maHH, kl, gia, gtgd };

  if (maTKGD.endsWith('-A') || ['SI5CO', 'CP2CO', 'PL1NY'].includes(maHH)) {
    buckets.acm.push(item);
  } else if (maTKGD.endsWith('-M') || ['SIV', 'SIVE'].includes(maHH)) {
    buckets.bacThoi.push(item);
  } else if (/^[CP]\./.test(maHD)) {
    buckets.options.push(item);
  } else if (maTKGD.endsWith('-S') || maHD.includes('-')) {
    buckets.spread.push(item);
  } else if (maTKGD.endsWith('L') || ['CAD', 'AHD', 'PBD', 'SND', 'ZDS', 'NID'].includes(maHH)) {
    buckets.lme.push(item);
  } else {
    buckets.normal.push(item);
  }
}

console.log(`\n3. Kết quả phân loại 5 phân hệ CoreCCP:`);
console.log(`   - ACM:      ${buckets.acm.length} lệnh, tổng ${buckets.acm.reduce((s,i)=>s+i.kl, 0)} lot, GTGD: ${buckets.acm.reduce((s,i)=>s+i.gtgd, 0).toLocaleString()} VND`);
console.log(`   - Bạc Thỏi: ${buckets.bacThoi.length} lệnh, tổng ${buckets.bacThoi.reduce((s,i)=>s+i.kl, 0)} lot, GTGD: ${buckets.bacThoi.reduce((s,i)=>s+i.gtgd, 0).toLocaleString()} VND`);
console.log(`   - Spread:   ${buckets.spread.length} lệnh, tổng ${buckets.spread.reduce((s,i)=>s+i.kl, 0)} lot`);
console.log(`   - LME:      ${buckets.lme.length} lệnh, tổng ${buckets.lme.reduce((s,i)=>s+i.kl, 0)} lot`);
console.log(`   - Options:  ${buckets.options.length} lệnh, tổng ${buckets.options.reduce((s,i)=>s+i.kl, 0)} lot`);
console.log(`   - Normal:   ${buckets.normal.length} lệnh, tổng ${buckets.normal.reduce((s,i)=>s+i.kl, 0)} lot`);

// 4. Thử nghiệm ghi vào các Template trong Sandbox và phát hiện bất cập
async function testTemplateWriting() {
  console.log(`\n================================================================`);
  console.log(`BƯỚC 4: THỬ NGHIỆM GHI VÀO TỪNG TEMPLATE TRONG SANDBOX`);
  console.log(`================================================================`);

  const issues: string[] = [];

  // Helper tìm dòng theo ngày
  function findRowByDate(ws: ExcelJS.Worksheet, dateCol: number, targetDay: number): number {
    for (let r = 5; r <= 35; r++) {
      const v = ws.getRow(r).getCell(dateCol).value;
      if (v instanceof Date) {
        if (v.getDate() === targetDay) return r;
      } else if (typeof v === 'string') {
        const m = v.match(/(\d{1,2})[\/\-]/);
        if (m && parseInt(m[1]) === targetDay) return r;
      } else if (typeof v === 'number') {
        // Excel serial date
        const d = new Date(Math.round((v - 25569) * 86400 * 1000));
        if (d.getUTCDate() === targetDay) return r;
      }
    }
    return -1;
  }

  // --- TEST 1: Thong ke so lot giao dich ACM 2026 (trên CCP).xlsx ---
  try {
    const f = 'Thong ke so lot giao dich ACM 2026 (trên CCP).xlsx';
    const filePath = path.join(sandboxDir, f);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const ws = wb.getWorksheet('T10.2026');
    if (!ws) throw new Error('Sheet T10.2026 khong ton tai');

    const targetRow = findRowByDate(ws, 2, 13); // Ngày 13/10
    console.log(`\n[Test 1] ${f} - Sheet: T10.2026, Row ngày 13/10: ${targetRow}`);

    // Map cột TVKD ở Row 4
    const r4 = ws.getRow(4);
    const tvkdColMap = new Map<string, number>();
    for (let c = 11; c <= 75; c++) {
      const v = String(r4.getCell(c).value || '');
      const m = v.match(/\b(\d{3})\b/);
      if (m) tvkdColMap.set(m[1], c);
    }
    console.log(`   Tìm thấy ${tvkdColMap.size} cột TVKD trong template ACM`);

    // Kiểm tra unmapped TVKD từ dữ liệu CoreCCP
    const acmByTvkd = new Map<string, number>();
    for (const item of buckets.acm) {
      acmByTvkd.set(item.tvkd, (acmByTvkd.get(item.tvkd) || 0) + item.kl);
    }

    let unmappedTvkdCount = 0;
    for (const [tvkd, lot] of acmByTvkd.entries()) {
      if (!tvkdColMap.has(tvkd)) {
        unmappedTvkdCount++;
        issues.push(`[${f}] TVKD ${tvkd} có phát sinh ${lot} lot nhưng CHƯA CÓ CỘT trong template! Cần chạy provisioner.`);
      }
    }
    console.log(`   Số TVKD chưa có cột: ${unmappedTvkdCount}`);

    // Map cột Hàng hoá Nano ở Row 4/5
    const r5 = ws.getRow(5);
    const hhColMap = new Map<string, number>();
    for (let c = 75; c <= 85; c++) {
      const v4 = String(r4.getCell(c).value || '').toUpperCase();
      const v5 = String(r5.getCell(c).value || '').toUpperCase();
      ['SI5CO', 'PL1NY', 'CP2CO', 'GLD1'].forEach(hh => {
        if (v4.includes(hh) || v5.includes(hh)) hhColMap.set(hh, c);
      });
    }
    console.log(`   Tìm thấy ${hhColMap.size} cột Hàng hoá Nano:`, Array.from(hhColMap.keys()));

  } catch (err: any) {
    issues.push(`Lỗi Test 1: ${err.message}`);
  }

  // --- TEST 2: Thong ke gia tri giao dich ACM 2026 (Theo CCP).xlsx ---
  try {
    const f = 'Thong ke gia tri giao dich ACM 2026 (Theo CCP).xlsx';
    const filePath = path.join(sandboxDir, f);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const ws = wb.getWorksheet('T10.2026');
    if (!ws) throw new Error('Sheet T10.2026 khong ton tai');

    const targetRow = findRowByDate(ws, 1, 13);
    console.log(`\n[Test 2] ${f} - Sheet: T10.2026, Row ngày 13/10: ${targetRow}`);

    // Bất cập phát hiện: Cột ngày ở Col 1 (không có cột STT), khác với file Số lot (Col 2)!
    console.log(`   Cột ngày là Cột 1. Row 5 chứa các mã: ${[2,3,4,5,6].map(c=>ws.getRow(5).getCell(c).value).join(', ')}`);
  } catch (err: any) {
    issues.push(`Lỗi Test 2: ${err.message}`);
  }

  // --- TEST 3: Thong ke so lot giao dich Spread 2026.xlsx ---
  try {
    const f = 'Thong ke so lot giao dich Spread 2026.xlsx';
    const filePath = path.join(sandboxDir, f);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const ws = wb.getWorksheet('T10.2026');
    console.log(`\n[Test 3] ${f} - Sheet: T10.2026`);
    const r4 = ws?.getRow(4);
    let tvkdCount = 0;
    let hhCount = 0;
    for (let c = 3; c <= 96; c++) {
      const v = String(r4?.getCell(c).value || '');
      if (/\b\d{3}\b/.test(v)) tvkdCount++;
      if (['ZME', 'ZLE', 'ZCE', 'KCE', 'LRC', 'CLE', 'QO'].some(k => v.includes(k))) hhCount++;
    }
    console.log(`   Spread Template: ${tvkdCount} TVKDs, ${hhCount} Hàng hoá Spread.`);
    if (tvkdCount === 0) issues.push(`[${f}] Không quét được TVKD ở Row 4!`);
  } catch (err: any) {
    issues.push(`Lỗi Test 3: ${err.message}`);
  }

  // --- TEST 4: Thong ke gia tri giao dich 2026 theo TVKD.xlsx ---
  try {
    const f = 'Thong ke gia tri giao dich 2026 theo TVKD.xlsx';
    const filePath = path.join(sandboxDir, f);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const ws = wb.getWorksheet('T10.2026');
    console.log(`\n[Test 4] ${f} - Sheet: T10.2026`);
    // Bất cập phát hiện: Đây là file GIÁ TRỊ nhưng cấu trúc cột theo TVKD, Cột ngày là Col 2!
    // Hàm writeValueStatsToAccumulator hiện tại chỉ tìm Hàng hoá ở Col 2+, không map được TVKD!
    issues.push(`[BẤT CẬP QUAN TRỌNG: ${f}] CcpAccumulatorService CHƯA CÓ hàm ghi GTGD theo TVKD! File này có 64 cột TVKD cần ghi giá trị VND thay vì Hàng hoá.`);
  } catch (err: any) {
    issues.push(`Lỗi Test 4: ${err.message}`);
  }

  // --- TỔNG KẾT CÁC BẤT CẬP PHÁT HIỆN ---
  console.log(`\n================================================================`);
  console.log(`TỔNG HỢP CÁC BẤT CẬP & ĐIỂM NGHẼN LOGIC ĐÃ PHÁT HIỆN`);
  console.log(`================================================================`);
  issues.forEach((iss, idx) => console.log(`${idx + 1}. ${iss}`));
}

testTemplateWriting().catch(console.error);
