import { PreEodReconService } from '../modules/reconciliation/services/pre-eod-recon.service';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('================================================================================');
  console.log('🧪 KIỂM THỬ THỰC TẾ HÀM checkPreEOD VỚI DỮ LIỆU CHUẨN NGÀY 25/09/2026');
  console.log('================================================================================');

  const baseDir = 'C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Pictures\\Dữ liệu chuẩn ngày 25';

  if (!fs.existsSync(baseDir)) {
    console.error(`❌ Thư mục không tồn tại: ${baseDir}`);
    process.exit(1);
  }

  const dsgdPath = path.join(baseDir, '25.09 MS', 'DSGD.xlsx');
  const ttttPath = path.join(baseDir, '25.09 MS', 'TTTT.xlsx');
  const acmPath = path.join(
    baseDir,
    '25.09 ACM',
    'EOD FO trades_PT Straits Financial Indonesia - 10017890000_25092026.csv',
  );
  const frPath = path.join(baseDir, '25.09 CQG', 'FR.xlsx');
  const psPath = path.join(baseDir, '25.09 CQG', 'PS.xlsx');

  console.log('📁 Danh sách file đầu vào:');
  console.log(` • M-System DSGD : ${dsgdPath} (Tồn tại: ${fs.existsSync(dsgdPath)})`);
  console.log(` • M-System TTTT : ${ttttPath} (Tồn tại: ${fs.existsSync(ttttPath)})`);
  console.log(` • ACM Straits   : ${acmPath} (Tồn tại: ${fs.existsSync(acmPath)})`);
  console.log(` • CQG FR        : ${frPath} (Tồn tại: ${fs.existsSync(frPath)})`);
  console.log(` • CQG PS        : ${psPath} (Tồn tại: ${fs.existsSync(psPath)})`);

  const missing = [dsgdPath, ttttPath, acmPath, frPath, psPath].filter(p => !fs.existsSync(p));
  if (missing.length > 0) {
    console.error(`❌ Thiếu các file sau: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Khởi tạo trực tiếp PreEodReconService với lightweight mocks
  const mockSettingsService: any = {
    getSetting: async (key: string, def: string) => def,
    setSetting: async () => {},
  };
  const mockTelegramService: any = {
    sendMessage: async () => {},
  };
  const mockMarginCheckerService: any = {
    loadConfig: async () => ({ preEodCheck: { isSendWarning: false } }),
    sendEmailNotification: async () => {},
  };

  const preEodService = new PreEodReconService(
    mockSettingsService,
    mockTelegramService,
    mockMarginCheckerService,
  );

  try {
    // Ngày ca trực hiện tại: Thứ Hai 28/09/2026 -> T-1 lùi weekend là Thứ Sáu 25/09/2026
    const tradingDate = new Date('2026-09-28T00:00:00.000Z');
    const acmTradesName = path.basename(acmPath);

    console.log(`\n🚀 Bắt đầu gọi checkPreEOD (Ngày ca trực: 28/09/2026, File ACM: ${acmTradesName})...`);
    console.log('⏳ Đang nạp Buffer và phân tích các tệp tin Excel/CSV lớn...');
    const startTime = Date.now();

    const result = await preEodService.checkPreEOD(
      {
        dsgd: fs.readFileSync(dsgdPath),
        acmTrades: fs.readFileSync(acmPath),
        cqgFr: fs.readFileSync(frPath),
        tttt: fs.readFileSync(ttttPath),
        cqgPs: fs.readFileSync(psPath),
      },
      acmTradesName,
      tradingDate,
      [],
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️ Thời gian thực thi: ${elapsed}s`);

    console.log('\n================================================================================');
    console.log(`📊 KẾT QUẢ ĐỐI CHIẾU PRE-EOD: ${result.passed ? '✅ KHỚP 100%' : '⚠️ CÓ CHÊNH LỆCH'}`);
    console.log('================================================================================');
    console.log(`• Phiên T-1 đã giải quyết : ${new Date(result.targetDate).toLocaleDateString('vi-VN')}`);
    console.log(`• Trạng thái chung (Passed): ${result.passed}`);

    console.log('\n--- 1. TỔNG HỢP KHỐI LƯỢNG GIAO DỊCH (KLGD) ---');
    console.log(' [ACM / Tự Doanh]');
    console.log(`   - M-System (tài khoản đuôi A) : ${result.totals.totalACM_MS.toLocaleString()} lot`);
    console.log(`   - ACM Straits (file CSV)      : ${result.totals.totalACM_Straits.toLocaleString()} lot`);
    console.log(`   - Chênh lệch ACM              : ${result.totals.differACM.toLocaleString()} lot ${result.totals.differACM === 0 ? '✓' : '⚠️'}`);
    console.log(' [CQG / Khách Hàng Thường]');
    console.log(`   - M-System (các tài khoản khác): ${result.totals.totalCQG_MS.toLocaleString()} lot`);
    console.log(`   - CQG FR (loại trừ ZWAZCE)    : ${result.totals.totalCQG_FR.toLocaleString()} lot`);
    console.log(`   - Chênh lệch CQG              : ${result.totals.differCQG.toLocaleString()} lot ${result.totals.differCQG === 0 ? '✓' : '⚠️'}`);

    console.log('\n--- 2. CHI TIẾT LỆNH LỆCH KHỚP LỆNH (Mismatched Trades) ---');
    console.log(`• Tổng số lệnh lệch: ${result.mismatchedTrades.length}`);
    if (result.mismatchedTrades.length > 0) {
      console.log('Top 10 lệnh lệch đầu tiên:');
      result.mismatchedTrades.slice(0, 10).forEach((t, idx) => {
        console.log(`  [${idx + 1}] [${t.source}] Mã lệnh: ${t.maLenh || '-'} | TK: ${t.maTKGD} | HĐ: ${t.maHD} | Giá: ${t.giaKhop} | Qty: ${t.klGiaoDich} | Lý do: ${t.reason}`);
      });
      if (result.mismatchedTrades.length > 10) {
        console.log(`  ... và còn ${result.mismatchedTrades.length - 10} lệnh lệch khác.`);
      }
    } else {
      console.log('✓ Khớp lệnh 2 chiều trùng khớp 100%. Không có lệnh lệch!');
    }

    console.log('\n--- 3. CHI TIẾT LỆCH VỊ THẾ TẤT TOÁN NET (Mismatched Positions: TTTT vs PS) ---');
    console.log(`• Tổng số vị thế net lệch: ${result.mismatchedPositions.length}`);
    if (result.mismatchedPositions.length > 0) {
      console.log('Top 10 vị thế lệch đầu tiên:');
      result.mismatchedPositions.slice(0, 10).forEach((p, idx) => {
        console.log(`  [${idx + 1}] TK: ${p.account} | HĐ: ${p.symbol} | MS: ${p.msPosition} | CQG: ${p.cqgPosition} | Lệch: ${p.differ}`);
      });
      if (result.mismatchedPositions.length > 10) {
        console.log(`  ... và còn ${result.mismatchedPositions.length - 10} vị thế lệch khác.`);
      }
    } else {
      console.log('✓ Vị thế tất toán Net giữa M-System (TTTT) và CQG (PS) trùng khớp 100%!');
    }

    console.log('================================================================================');
  } catch (err: any) {
    console.error('❌ Lỗi xảy ra trong quá trình đối chiếu Pre-EOD:', err.message);
    if (err.stack) console.error(err.stack);
  }
}

main().catch(console.error);
