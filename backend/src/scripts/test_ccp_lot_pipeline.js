/**
 * test_ccp_lot_pipeline.js
 *
 * Script kiểm thử độc lập toàn bộ pipeline Thống Kê Số Lot & GTGD từ CoreCCP.
 * Sử dụng 4 file thực tế tại: backend/src/modules/lot-statistics/Example file ccp/
 *
 * Xuất kết quả chi tiết ra: backend/test_ccp_lot_result.txt
 *
 * Lệnh chạy (USER tự chạy trên terminal theo Quy tắc 4 của AGENTS.md):
 *   cd backend
 *   node src/scripts/test_ccp_lot_pipeline.js
 */

const fs = require('fs');
const path = require('path');

// Import compiled service and helpers from dist
const { CcpLotStatisticsService } = require('../../dist/modules/ccp-statistics/ccp-lot-statistics.service');

async function runTest() {
  const outputLines = [];
  const log = (msg = '') => {
    console.log(msg);
    outputLines.push(msg);
  };

  log('='.repeat(100));
  log('   BÁO CÁO KIỂM THỬ ĐỘC LẬP: MODULE THỐNG KÊ SỐ LOT & GIÁ TRỊ GIAO DỊCH CORECCP (ACM)');
  log('='.repeat(100));
  log(`Thời điểm kiểm thử: ${new Date().toLocaleString('vi-VN')}`);

  const exampleDir = path.join(__dirname, '..', 'modules', 'lot-statistics', 'Example file ccp');
  const dsgdPath = path.join(exampleDir, 'DSGD_14.6.xlsx');
  const ttmPath = path.join(exampleDir, 'TTM_14.06.xlsx');
  const ttttPath = path.join(exampleDir, 'TTTT_14.06.xlsx');
  const tyGiaPath = path.join(exampleDir, 'Tỷ giá_14.06.xlsx');
  const outputTxtPath = path.join(__dirname, '..', '..', 'test_ccp_lot_result.txt');

  log('\n' + '-'.repeat(100));
  log('1. DANH SÁCH FILE NGUỒN KIỂM THỬ:');
  log('-'.repeat(100));
  const checkFile = (label, fpath) => {
    if (fs.existsSync(fpath)) {
      const stats = fs.statSync(fpath);
      log(` • [${label}] Tồn tại: ${path.basename(fpath)} (${(stats.size / 1024).toFixed(1)} KB)`);
      return true;
    } else {
      log(` • [${label}] KHÔNG TÌM THẤY: ${path.basename(fpath)}`);
      return false;
    }
  };

  const hasDsgd = checkFile('DSGD CoreCCP (*)', dsgdPath);
  const hasTtm = checkFile('TTM (Mở)       ', ttmPath);
  const hasTttt = checkFile('TTTT (Tất toán) ', ttttPath);
  const hasTyGia = checkFile('Tỷ giá CCP     ', tyGiaPath);

  if (!hasDsgd) {
    log('\n LỖI: Thiếu file bắt buộc DSGD_14.6.xlsx! Dừng kiểm thử.');
    fs.writeFileSync(outputTxtPath, outputLines.join('\n'), 'utf8');
    process.exit(1);
  }

  const dsgdBuf = fs.readFileSync(dsgdPath);
  const ttmBuf = hasTtm ? fs.readFileSync(ttmPath) : undefined;
  const ttttBuf = hasTttt ? fs.readFileSync(ttttPath) : undefined;
  const tyGiaBuf = hasTyGia ? fs.readFileSync(tyGiaPath) : undefined;

  log('\n⏳ Đang nạp service và thực thi thuật toán bóc tách...');
  const mockSettingsService = { getSetting: async () => null };
  const service = new CcpLotStatisticsService(mockSettingsService);

  const startTime = Date.now();
  const result = await service.processCcpLotStatistics(
    {
      dsgdCcp: dsgdBuf,
      ttm: ttmBuf,
      tttt: ttttBuf,
      tyGia: tyGiaBuf,
    },
    {
      ngayGD: '2026-06-14',
    },
  );
  const elapsed = Date.now() - startTime;
  log(`✅ Quá trình tính toán hoàn tất trong: ${elapsed} ms`);

  // ── PHẦN 1: KPI TỔNG HỢP ──
  log('\n' + '='.repeat(100));
  log('2. TỔNG HỢP KPI TOÀN THỊ TRƯỜNG ACM (PHIÊN 14/06):');
  log('='.repeat(100));
  const usdRate = result.tyGiaUsed['USD'] || 25920;
  log(` • Tổng số Lot giao dịch (DSGD)     : ${result.totalSoLot.toLocaleString('vi-VN')} lot`);
  log(` • Tổng Giá Trị Giao Dịch (VND)      : ${result.totalGiaTri.toLocaleString('vi-VN')} đ`);
  log(` • Tỷ giá USD áp dụng quy đổi        : 1 USD = ${usdRate.toLocaleString('vi-VN')} VND (nguồn: Tỷ giá.xlsx)`);
  log(` • Vị thế mở TTM - Khối lượng Mua    : ${result.totalTtmMua.toLocaleString('vi-VN')} lot`);
  log(` • Vị thế mở TTM - Khối lượng Bán    : ${result.totalTtmBan.toLocaleString('vi-VN')} lot`);
  log(` • Vị thế mở TTM - Tổng vị thế mở    : ${result.totalTtmLot.toLocaleString('vi-VN')} lot`);
  log(` • Khối lượng tất toán (TTTT)        : ${result.totalKltt.toLocaleString('vi-VN')} lot`);
  log(` • Số lượng TVKD phát sinh giao dịch : ${result.byTvkd.filter((t) => t.soLot > 0).length} / ${result.byTvkd.length} thành viên`);

  // ── PHẦN 2: PHÂN BỔ HÀNG HÓA ──
  log('\n' + '='.repeat(100));
  log('3. PHÂN BỔ THEO MÃ HÀNG HÓA (COMMODITY BREAKDOWN):');
  log('='.repeat(100));
  log(' Quy tắc tách mã HH: 5 ký tự đầu của Mã HĐ (Ví dụ: SI5COZ26 -> SI5CO)');
  log(' Công thức GTGD    : Số_lot × Giá_khớp_TB × Hệ_số × Tỷ_giá_USD');
  log(' Hệ số quy đổi     : SI5CO = 100 | CP2CO = 1,000 | PL1NY = 5');
  log('-'.repeat(100));

  const hhMap = new Map();
  for (const tvkd of result.byTvkd) {
    for (const hh of tvkd.byHH || []) {
      const cur = hhMap.get(hh.maHH) || { soLot: 0, giaTri: 0 };
      cur.soLot += hh.soLot;
      cur.giaTri += hh.giaTri;
      hhMap.set(hh.maHH, cur);
    }
  }

  log(
    ` ${'Mã HH'.padEnd(8)} | ${'Tên Hàng Hóa'.padEnd(20)} | ` +
    `${'Số Lot Khớp'.padStart(12)} | ${'Tỷ Trọng Lot'.padStart(12)} | ` +
    `${'GTGD Quy Đổi (VND)'.padStart(25)} | ${'Tỷ Trọng GTGD'.padStart(13)}`
  );
  log('-'.repeat(100));

  const HH_NAMES = {
    SI5CO: 'Bạc Nano (100 oz)',
    CP2CO: 'Đồng Nano (1000 lbs)',
    PL1NY: 'Bạch Kim Nano (5 oz)',
  };

  const sortedHH = Array.from(hhMap.entries()).sort((a, b) => b[1].soLot - a[1].soLot);
  for (const [maHH, data] of sortedHH) {
    const hhName = HH_NAMES[maHH] || 'Hàng hóa CCP';
    const lotPct = result.totalSoLot > 0 ? ((data.soLot / result.totalSoLot) * 100).toFixed(2) : '0.00';
    const valPct = result.totalGiaTri > 0 ? ((data.giaTri / result.totalGiaTri) * 100).toFixed(2) : '0.00';

    log(
      ` ${maHH.padEnd(8)} | ${hhName.padEnd(20)} | ` +
      `${data.soLot.toLocaleString('vi-VN').padStart(12)} | ` +
      `${(lotPct + '%').padStart(12)} | ` +
      `${data.giaTri.toLocaleString('vi-VN').padStart(25)} | ` +
      `${(valPct + '%').padStart(13)}`
    );
  }

  // ── PHẦN 3: CHI TIẾT TỪNG THÀNH VIÊN KINH DOANH (TVKD) ──
  log('\n' + '='.repeat(100));
  log('4. CHI TIẾT THEO THÀNH VIÊN KINH DOANH (TVKD CÓ PHÁT SINH GIAO DỊCH):');
  log('='.repeat(100));
  log(
    ` ${'TVKD'.padEnd(6)} | ` +
    `${'Số Lot GD'.padStart(10)} | ` +
    `${'GTGD (VND)'.padStart(24)} | ` +
    `${'TTM Mua'.padStart(8)} | ` +
    `${'TTM Bán'.padStart(8)} | ` +
    `${'KLTT'.padStart(8)} | ` +
    ` 4 Loại Lệnh (MKT/LMT/STP/STL)`
  );
  log('-'.repeat(100));

  const activeTvkd = result.byTvkd.filter((t) => t.soLot > 0).sort((a, b) => b.soLot - a.soLot);
  for (const t of activeTvkd) {
    const orderStatus = t.isFull4Types
      ? '[ĐỦ 4 LOẠI]'
      : `[THIẾU: ${t.missingTypes.join('/')}]`;

    log(
      ` ${t.tvkd.padEnd(6)} | ` +
      `${t.soLot.toLocaleString('vi-VN').padStart(10)} | ` +
      `${t.giaTri.toLocaleString('vi-VN').padStart(24)} | ` +
      `${t.ttmMua.toLocaleString('vi-VN').padStart(8)} | ` +
      `${t.ttmBan.toLocaleString('vi-VN').padStart(8)} | ` +
      `${t.kltt.toLocaleString('vi-VN').padStart(8)} | ` +
      ` ${orderStatus}`
    );
  }

  // ── PHẦN 4: KIỂM TRA ĐIỀU KIỆN 4 LOẠI LỆNH ──
  log('\n' + '='.repeat(100));
  log('5. KẾT QUẢ THẨM ĐỊNH 4 LOẠI LỆNH (MKT, LMT, STP, STL):');
  log('='.repeat(100));

  const missingList = activeTvkd.filter((t) => !t.isFull4Types);
  const fullList = activeTvkd.filter((t) => t.isFull4Types);

  log(` • Tổng số TVKD có giao dịch           : ${activeTvkd.length} thành viên`);
  log(` • Số TVKD ĐÃ PHÁT SINH ĐỦ 4 loại lệnh : ${fullList.length} thành viên`);
  log(` • Số TVKD CHƯA ĐỦ 4 loại lệnh         : ${missingList.length} thành viên`);

  if (missingList.length > 0) {
    log('\n   DANH SÁCH TVKD CHƯA ĐỦ 4 LOẠI LỆNH:');
    for (const t of missingList) {
      log(`    - TVKD ${t.tvkd}: Đã có ${t.soLot} lot, THIẾU các loại lệnh -> [ ${t.missingTypes.join(', ')} ]`);
    }
  } else {
    log('\n 🎉 TẤT CẢ các TVKD có giao dịch đều đã phát sinh đầy đủ 4 loại lệnh!');
  }

  // ── PHẦN 5: TOP 5 TVKD DẪN ĐẦU KHỐI LƯỢNG ──
  log('\n' + '='.repeat(100));
  log('6. TOP 5 THÀNH VIÊN CÓ KHỐI LƯỢNG GIAO DỊCH LỚN NHẤT:');
  log('='.repeat(100));
  const top5 = activeTvkd.slice(0, 5);
  top5.forEach((t, i) => {
    const lotPct = ((t.soLot / result.totalSoLot) * 100).toFixed(2);
    log(`  ${i + 1}. TVKD ${t.tvkd}: ${t.soLot.toLocaleString('vi-VN')} lot (${lotPct}%) | GTGD: ${t.giaTri.toLocaleString('vi-VN')} đ`);
  });

  log('\n' + '='.repeat(100));
  log(`KẾT QUẢ ĐÃ ĐƯỢC LƯU TỰ ĐỘNG VÀO TỆP: ${outputTxtPath}`);
  log('='.repeat(100) + '\n');

  // Write all logs to txt file
  fs.writeFileSync(outputTxtPath, outputLines.join('\n'), 'utf8');
}

runTest().catch((err) => {
  console.error('\n Lỗi khi thực thi test script:', err);
  process.exit(1);
});
