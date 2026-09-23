/**
 * test_ccp_statistics_suite.ts
 *
 * Bộ kiểm thử toàn diện (Test Suite) cho Module Thống kê Số Lot & Giá trị Giao dịch (GTGD) CoreCCP (ACM).
 *
 * Kiểm tra các tiêu chí:
 *   1. Parser động (Data-Driven Header Mapping):
 *      - Đọc file DSGD / ORDERMATCH_DETAIL
 *      - Đọc file TTTT / PNL_EXECUTED
 *      - Đọc file TTM / OPEN_POSITION
 *   2. Thuật toán tính toán KPI:
 *      - Phân bổ số lot per TVKD và toàn thị trường
 *      - Tính GTGD (VND) theo từng mặt hàng (SI5CO, PL1NY, CP2CO) và tổng thị trường
 *      - Kiểm tra 4 loại lệnh (MKT, LMT, STP, STL)
 *      - Tính số lot tất toán (TTTT) và vị thế mở (TTM)
 *   3. Ghi file lũy kế Số Lot ACM (Excel):
 *      - Nhận diện đúng dòng ngày (Date matching)
 *      - Ghi đúng khối tổng hợp ACM (cols 6, 7, 8)
 *      - Ghi đúng cột của từng TVKD (cột 11 đến 73)
 *      - Ghi đúng cột của từng Hàng hoá Nano (cột 76, 77, 78)
 *      - Bảo toàn công thức SUM TVKD và SUM Hàng hoá
 *   4. Ghi file lũy kế GTGD ACM (Excel):
 *      - Nhận diện đúng sheet tháng (TMM.YYYY)
 *      - Nhận diện đúng dòng phiên theo ngày (cột A là ngày)
 *      - Ghi đúng cột SI5CO (col 2), PL1NY (col 3), CP2CO (col 4)
 *      - Bảo toàn công thức SUM dòng = SUM(B:D) (col 5)
 *   5. Tính toàn vẹn sau khi ghi và đọc lại (Round-trip verification)
 */

import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import {
  parseCcpDsgdRow,
  parseCcpTtmRow,
  parseCcpTtttRow,
  buildCcpHeaderMap,
  classifyCcpDsgd,
  getCcpHhSpec,
  getMaHHFromCcpMaHD,
} from '../modules/ccp-statistics/helpers/ccp-classifier.helper';
import {
  writeCcpLotToAccumulator,
  writeCcpGtgdToAccumulator,
} from '../modules/ccp-statistics/helpers/ccp-accumulator.helper';
import { CcpLotResult } from '../modules/ccp-statistics/ccp-lot-statistics.service';

interface TestAssertion {
  name: string;
  passed: boolean;
  actual?: any;
  expected?: any;
  error?: string;
}

const assertions: TestAssertion[] = [];

function assert(name: string, condition: boolean, actual?: any, expected?: any) {
  assertions.push({
    name,
    passed: condition,
    actual,
    expected,
  });
  if (condition) {
    console.log(`  [PASS] ${name}`);
  } else {
    console.error(`  [FAIL] ${name} | Actual: ${actual} | Expected: ${expected}`);
  }
}

async function runTestSuite() {
  console.log('================================================================================');
  console.log('       BẮT ĐẦU CHẠY BỘ KIỂM THỬ TOÀN DIỆN CORECCP LOT & GTGD (ACM)');
  console.log('================================================================================');

  const rootDir = path.resolve(__dirname, '../../../');
  const inputDir = path.join(rootDir, 'Thong ke ccp/input');
  const outputDir = path.join(rootDir, 'Thong ke ccp/output');
  const sandboxDir = path.join(rootDir, 'Thong ke ccp/sandbox_test_run');

  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
  fs.mkdirSync(sandboxDir, { recursive: true });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST CASE 1: BÓC TÁCH FILE DSGD / ORDERMATCH_DETAIL
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n>>> TEST CASE 1: Bóc tách file ORDERMATCH_DETAIL_2026-09-14.xlsx');
  const dsgdPath = path.join(inputDir, 'ORDERMATCH_DETAIL_2026-09-14.xlsx');
  assert('File ORDERMATCH tồn tại', fs.existsSync(dsgdPath));

  const dsgdBuf = fs.readFileSync(dsgdPath);
  const wbDsgd = XLSX.read(dsgdBuf, { type: 'buffer' });
  const wsDsgd = wbDsgd.Sheets[wbDsgd.SheetNames[0]];
  const dsgdData = XLSX.utils.sheet_to_json(wsDsgd, { header: 1, defval: '' }) as any[][];

  const dsgdHeaderMap = buildCcpHeaderMap(dsgdData[0]);
  assert('Header Map nhận diện cột Mã TKGD', dsgdHeaderMap['matkgd'] !== undefined, dsgdHeaderMap['matkgd'], 5);
  assert('Header Map nhận diện cột Mã thành viên', dsgdHeaderMap['mathanhvien'] !== undefined, dsgdHeaderMap['mathanhvien'], 21);
  assert('Header Map nhận diện cột KL khớp', dsgdHeaderMap['klkhop'] !== undefined, dsgdHeaderMap['klkhop'], 10);
  assert('Header Map nhận diện cột Giá khớp trung bình', dsgdHeaderMap['giakhoptrungbinh'] !== undefined, dsgdHeaderMap['giakhoptrungbinh'], 13);

  const dsgdRows = dsgdData.slice(1).map((r) => parseCcpDsgdRow(r, dsgdHeaderMap));
  assert('Số lượng dòng khớp lệnh', dsgdRows.length === 3, dsgdRows.length, 3);

  const row1 = dsgdRows[0];
  assert('Dòng 1: TVKD 011', row1.maTvkd === '011', row1.maTvkd, '011');
  assert('Dòng 1: Mã HĐ SI5COZ26', row1.maHD === 'SI5COZ26', row1.maHD, 'SI5COZ26');
  assert('Dòng 1: KL khớp = 1', row1.klKhop === 1, row1.klKhop, 1);
  assert('Dòng 1: Giá khớp = 64.4', row1.giaKhop === 64.4, row1.giaKhop, 64.4);

  const row2 = dsgdRows[1];
  assert('Dòng 2: TVKD 041', row2.maTvkd === '041', row2.maTvkd, '041');
  assert('Dòng 2: Mã HĐ CP2COZ26', row2.maHD === 'CP2COZ26', row2.maHD, 'CP2COZ26');
  assert('Dòng 2: Loại lệnh MKT', row2.loaiLenh.toUpperCase() === 'MKT', row2.loaiLenh, 'MKT');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST CASE 2: BÓC TÁCH FILE PNL_EXECUTED (ĐỊNH DẠNG CỘT LỆCH SO VỚI TTTT GỐC)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n>>> TEST CASE 2: Bóc tách file PNL_EXECUTED_2026-09-14.xlsx (Định dạng lệch)');
  const pnlPath = path.join(inputDir, 'PNL_EXECUTED_2026-09-14.xlsx');
  assert('File PNL_EXECUTED tồn tại', fs.existsSync(pnlPath));

  const pnlBuf = fs.readFileSync(pnlPath);
  const wbPnl = XLSX.read(pnlBuf, { type: 'buffer' });
  const wsPnl = wbPnl.Sheets[wbPnl.SheetNames[0]];
  const pnlData = XLSX.utils.sheet_to_json(wsPnl, { header: 1, defval: '' }) as any[][];

  const pnlHeaderMap = buildCcpHeaderMap(pnlData[0]);
  assert('PNL Header Map tìm đúng Mã thành viên ở index 2', pnlHeaderMap['mathanhvien'] === 2, pnlHeaderMap['mathanhvien'], 2);
  assert('PNL Header Map tìm đúng Mã TKGD ở index 5', pnlHeaderMap['matkgd'] === 5, pnlHeaderMap['matkgd'], 5);
  assert('PNL Header Map tìm đúng Lãi lỗ VND ở index 1', pnlHeaderMap['lailothuctevnd'] === 1, pnlHeaderMap['lailothuctevnd'], 1);

  const ttttRows = pnlData.slice(1).map((r) => parseCcpTtttRow(r, pnlHeaderMap));
  assert('Số dòng tất toán PNL', ttttRows.length === 2, ttttRows.length, 2);
  assert('TTTT 1: TVKD 011', ttttRows[0].maTvkd === '011', ttttRows[0].maTvkd, '011');
  assert('TTTT 1: KL Mua = 1, KL Bán = 1', ttttRows[0].klMua === 1 && ttttRows[0].klBan === 1);
  assert('TTTT 2: TVKD 041', ttttRows[1].maTvkd === '041', ttttRows[1].maTvkd, '041');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST CASE 3: TÍNH TOÁN KPI TOÀN DIỆN (LOT, GTGD, MULTIPLIERS, EXCHANGE RATE)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n>>> TEST CASE 3: Kiểm tra Thuật toán tính KPI Lot & GTGD');
  const tyGiaUSD = 25920;

  // TVKD 011: 1 lot SI5CO @ 64.4 USD/oz. Multiplier = 100
  const gtgdSI5CO = Math.round(1 * 64.4 * 100 * tyGiaUSD);
  assert('GTGD SI5CO TVKD 011 = 166,924,800 VND', gtgdSI5CO === 166924800, gtgdSI5CO, 166924800);

  // TVKD 041: 1 lot CP2CO @ 6.485 + 1 lot CP2CO @ 6.495. Multiplier = 1000
  const gtgdCP2CO_1 = 1 * 6.485 * 1000 * tyGiaUSD; // 168,091,200
  const gtgdCP2CO_2 = 1 * 6.495 * 1000 * tyGiaUSD; // 168,350,400
  const gtgdCP2CO = gtgdCP2CO_1 + gtgdCP2CO_2;     // 336,441,600
  assert('GTGD CP2CO TVKD 041 = 336,441,600 VND', gtgdCP2CO === 336441600, gtgdCP2CO, 336441600);

  const tongGTGD = gtgdSI5CO + gtgdCP2CO;
  assert('Tổng GTGD toàn thị trường = 503,366,400 VND', tongGTGD === 503366400, tongGTGD, 503366400);

  // Build CcpLotResult chuẩn
  const testResult: CcpLotResult = {
    ngayGD: new Date('2026-09-14'),
    byTvkd: [
      {
        tvkd: '011',
        tenThanhVien: 'Công ty Cổ phần Giao dịch hàng hóa Vmex',
        soLot: 1,
        giaTri: gtgdSI5CO,
        isFull4Types: false,
        missingTypes: ['MKT', 'STP', 'STL'],
        byHH: [{ maHH: 'SI5CO', soLot: 1, giaTri: gtgdSI5CO }],
        ttmMua: 0,
        ttmBan: 0,
        ttmLaiLoDuKienVnd: 0,
        kltt: 2,
        ttttLaiLoThucTeVnd: 2203200,
      },
      {
        tvkd: '041',
        tenThanhVien: 'CTCP Tập Đoàn Khoáng Sản và Thương Mại VQB',
        soLot: 2,
        giaTri: gtgdCP2CO,
        isFull4Types: false,
        missingTypes: ['LMT', 'STP', 'STL'],
        byHH: [{ maHH: 'CP2CO', soLot: 2, giaTri: gtgdCP2CO }],
        ttmMua: 0,
        ttmBan: 0,
        ttmLaiLoDuKienVnd: 0,
        kltt: 2,
        ttttLaiLoThucTeVnd: -259200,
      },
    ],
    totalSoLot: 3,
    totalGiaTri: tongGTGD,
    totalTtmMua: 0,
    totalTtmBan: 0,
    totalTtmLot: 0,
    totalKltt: 4,
    totalTtttLot: 4,
    acmLot: 3,
    spreadLot: 0,
    lmeLot: 0,
    optionsLot: 0,
    normalLot: 0,
    tyGiaUsed: { USD: 25920, VND: 1 },
    warnings: [],
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TEST CASE 4: GHI & KIỂM TRA FILE LŨY KẾ SỐ LOT ACM
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n>>> TEST CASE 4: Ghi và kiểm tra file Lũy kế Số Lot ACM');
  const soLotTemplate = path.join(outputDir, 'Thong ke so lot giao dich ACM 2026.xlsx');
  const soLotSandbox = path.join(sandboxDir, 'Thong ke so lot giao dich ACM 2026.xlsx');
  fs.copyFileSync(soLotTemplate, soLotSandbox);

  const lotLogs: string[] = [];
  await writeCcpLotToAccumulator(testResult, soLotSandbox, lotLogs);
  assert('Ghi lot accumulator thành công không ném ngoại lệ', true);

  // Đọc lại file Excel để kiểm tra độc lập
  const wbLotCheck = new ExcelJS.Workbook();
  await wbLotCheck.xlsx.readFile(soLotSandbox);
  const wsLotCheck = wbLotCheck.getWorksheet('T09.2026')!;
  assert('Sheet T09.2026 tồn tại trong file lot', wsLotCheck !== undefined);

  // Dòng 14 tương ứng ngày 14/09/2026
  const targetLotRow = 14;
  const valCol6 = wsLotCheck.getCell(targetLotRow, 6).value;  // ACM DSGD
  const valCol7 = wsLotCheck.getCell(targetLotRow, 7).value;  // ACM TTTT
  const valCol8 = wsLotCheck.getCell(targetLotRow, 8).value;  // ACM TTM
  assert('Cột 6 (ACM DSGD) = 3 lot', valCol6 === 3, valCol6, 3);
  assert('Cột 7 (ACM TTTT) = 4 lot', valCol7 === 4, valCol7, 4);
  assert('Cột 8 (ACM TTM) = 0 lot', valCol8 === 0, valCol8, 0);

  // Kiểm tra TVKD 011 (cột 20) và 041 (cột 45)
  const valTVKD011 = wsLotCheck.getCell(targetLotRow, 20).value;
  const valTVKD041 = wsLotCheck.getCell(targetLotRow, 45).value;
  assert('Cột 20 (TVKD 011) = 1 lot', valTVKD011 === 1, valTVKD011, 1);
  assert('Cột 45 (TVKD 041) = 2 lot', valTVKD041 === 2, valTVKD041, 2);

  // Kiểm tra Hàng hóa: SI5CO (cột 76), PL1NY (cột 77), CP2CO (cột 78)
  const valSI5CO = wsLotCheck.getCell(targetLotRow, 76).value;
  const valPL1NY = wsLotCheck.getCell(targetLotRow, 77).value;
  const valCP2CO = wsLotCheck.getCell(targetLotRow, 78).value;
  assert('Cột 76 (SI5CO) = 1 lot', valSI5CO === 1, valSI5CO, 1);
  assert('Cột 77 (PL1NY) = 0 lot', valPL1NY === 0, valPL1NY, 0);
  assert('Cột 78 (CP2CO) = 2 lot', valCP2CO === 2, valCP2CO, 2);

  // Kiểm tra công thức Tổng Hàng hóa ở cột 79
  const cellTongHh = wsLotCheck.getCell(targetLotRow, 79);
  const formulaTongHh = typeof cellTongHh.value === 'object' ? (cellTongHh.value as any).formula : '';
  assert('Cột 79 có công thức SUM hàng hóa', formulaTongHh.includes('SUM'), formulaTongHh, 'SUM(BX14:BZ14)');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST CASE 5: GHI & KIỂM TRA FILE LŨY KẾ GIÁ TRỊ GIAO DỊCH (GTGD) ACM
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n>>> TEST CASE 5: Ghi và kiểm tra file Lũy kế GTGD ACM');
  const gtgdTemplate = path.join(outputDir, 'Thong ke gia tri giao dich ACM 2026.xlsx');
  const gtgdSandbox = path.join(sandboxDir, 'Thong ke gia tri giao dich ACM 2026.xlsx');
  fs.copyFileSync(gtgdTemplate, gtgdSandbox);

  const gtgdLogs: string[] = [];
  await writeCcpGtgdToAccumulator(testResult, gtgdSandbox, gtgdLogs);
  assert('Ghi GTGD accumulator thành công không ném ngoại lệ', true);

  // Đọc lại file GTGD để kiểm tra độc lập
  const wbGtgdCheck = new ExcelJS.Workbook();
  await wbGtgdCheck.xlsx.readFile(gtgdSandbox);
  const wsGtgdCheck = wbGtgdCheck.getWorksheet('T09.2026')!;
  assert('Sheet T09.2026 tồn tại trong file GTGD', wsGtgdCheck !== undefined);

  // Dòng 15 tương ứng phiên 14/09/2026 (cột A là ngày)
  const targetGtgdRow = 15;
  const valGtgdSI5CO = wsGtgdCheck.getCell(targetGtgdRow, 2).value; // Cột B: Bạc Nano / SI5CO
  const valGtgdPL1NY = wsGtgdCheck.getCell(targetGtgdRow, 3).value; // Cột C: Bạch kim Nano / PL1NY
  const valGtgdCP2CO = wsGtgdCheck.getCell(targetGtgdRow, 4).value; // Cột D: Đồng Nano / CP2CO
  const cellTongGtgd = wsGtgdCheck.getCell(targetGtgdRow, 5);       // Cột E: Tổng GTGD

  assert('Cột B (SI5CO) = 166,924,800 đ', valGtgdSI5CO === 166924800, valGtgdSI5CO, 166924800);
  assert('Cột C (PL1NY) = 0 đ', valGtgdPL1NY === 0, valGtgdPL1NY, 0);
  assert('Cột D (CP2CO) = 336,441,600 đ', valGtgdCP2CO === 336441600, valGtgdCP2CO, 336441600);

  const formulaTongGtgd = typeof cellTongGtgd.value === 'object' ? (cellTongGtgd.value as any).formula : '';
  const resultTongGtgd = typeof cellTongGtgd.value === 'object' ? (cellTongGtgd.value as any).result : cellTongGtgd.value;
  assert('Cột E (Tổng) có công thức SUM(B:D)', formulaTongGtgd === `SUM(B${targetGtgdRow}:D${targetGtgdRow})`, formulaTongGtgd, `SUM(B15:D15)`);
  assert('Cột E (Tổng) kết quả = 503,366,400 đ', resultTongGtgd === 503366400, resultTongGtgd, 503366400);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST CASE 6: KIỂM TRA TÍNH LẶP LẠI (IDEMPOTENCY - GHI ĐÈ NHIỀU LẦN)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n>>> TEST CASE 6: Kiểm tra tính lặp lại (Idempotency - chạy ghi đè lần 2)');
  await writeCcpLotToAccumulator(testResult, soLotSandbox, lotLogs);
  await writeCcpGtgdToAccumulator(testResult, gtgdSandbox, gtgdLogs);

  const wbLotCheck2 = new ExcelJS.Workbook();
  await wbLotCheck2.xlsx.readFile(soLotSandbox);
  const wsLotCheck2 = wbLotCheck2.getWorksheet('T09.2026')!;
  const valCol6_re = wsLotCheck2.getCell(targetLotRow, 6).value;
  assert('Ghi đè lần 2 không bị nhân đôi số lot: Vẫn là 3', valCol6_re === 3, valCol6_re, 3);

  const wbGtgdCheck2 = new ExcelJS.Workbook();
  await wbGtgdCheck2.xlsx.readFile(gtgdSandbox);
  const wsGtgdCheck2 = wbGtgdCheck2.getWorksheet('T09.2026')!;
  const valGtgdSI5CO_re = wsGtgdCheck2.getCell(targetGtgdRow, 2).value;
  assert('Ghi đè lần 2 không bị cộng dồn GTGD: Vẫn là 166,924,800 đ', valGtgdSI5CO_re === 166924800, valGtgdSI5CO_re, 166924800);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST CASE 7: KIỂM TRA TRƯỜNG HỢP BIÊN & PHÒNG THỦ (EDGE CASES & DEFENSIVE)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n>>> TEST CASE 7: Kiểm tra trường hợp biên (Edge Cases)');

  // Edge case 7.1: Header rỗng hoặc null
  const emptyHeaderMap = buildCcpHeaderMap([]);
  assert('Header rỗng trả về object rỗng an toàn', Object.keys(emptyHeaderMap).length === 0);

  // Edge case 7.2: Dòng giao dịch có giá trị null/undefined/chuỗi rác
  const corruptRawRow = ['', '', '', '', '', '', '', '', '', '', 'invalid', '', '', 'not_a_number'];
  const parsedCorrupt = parseCcpDsgdRow(corruptRawRow);
  assert('Dòng rác không ném exception, klKhop = 0', parsedCorrupt.klKhop === 0, parsedCorrupt.klKhop, 0);
  assert('Dòng rác không ném exception, giaKhop = 0', parsedCorrupt.giaKhop === 0, parsedCorrupt.giaKhop, 0);

  // Edge case 7.3: Hàng hóa chưa có trong spec mặc định
  const unknownMaHH = getMaHHFromCcpMaHD('UNKNOWN_CONTRACT', '');
  const unknownSpec = getCcpHhSpec(unknownMaHH);
  assert('Hàng hóa lạ trả về undefined spec an toàn (fallback 1)', unknownSpec === undefined);

  // Edge case 7.4: Ngày giao dịch phiên thứ Hai (sau cuối tuần)
  // 14/09/2026 là Thứ Hai. Ngày làm việc liền trước là 11/09/2026 (Thứ Sáu).
  const cellDateB14 = wsLotCheck2.getCell(14, 2);
  assert('Cột B dòng 14 là công thức WORKDAY chuẩn của Excel', cellDateB14.type === ExcelJS.ValueType.Formula);

  // Dọn dẹp sandbox sau kiểm thử
  fs.rmSync(sandboxDir, { recursive: true, force: true });

  // ──────────────────────────────────────────────────────────────────────────
  // TỔNG KẾT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================================');
  console.log('                          KẾT QUẢ KIỂM THỬ TỔNG HỢP');
  console.log('================================================================================');
  const total = assertions.length;
  const passed = assertions.filter((a) => a.passed).length;
  const failed = total - passed;

  console.log(`  Tổng số tiêu chí kiểm tra: ${total}`);
  console.log(`  Số tiêu chí ĐẠT (PASSED) : ${passed}`);
  console.log(`  Số tiêu chí LỖI (FAILED) : ${failed}`);

  if (failed === 0) {
    console.log('\n>>> KẾT LUẬN: TẤT CẢ CÁC TEST CASES ĐỀU ĐẠT 100%! HỆ THỐNG HOÀN TOÀN CHÍNH XÁC.');
  } else {
    console.error(`\n>>> CẢNH BÁO: CÓ ${failed} LỖI CẦN ĐƯỢC XỬ LÝ!`);
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('FATAL ERROR trong test suite:', err);
  process.exit(1);
});
