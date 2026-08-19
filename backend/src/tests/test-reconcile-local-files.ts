import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ReconciliationService } from '../modules/reconciliation/reconciliation.service';
import * as path from 'path';
import * as fs from 'fs';

async function testLocalReconciliation() {
  console.log('=== KHỞI CHẠY KIỂM THỬ ĐỐI CHIẾU DỮ LIỆU THỰC TẾ ===');
  console.log('Khởi tạo ứng dụng NestJS context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const reconService = app.get(ReconciliationService);

  const sampleDir = path.join(process.cwd(), '../14.07');

  console.log(`\n📂 Thư mục chứa file mẫu: ${sampleDir}`);

  if (!fs.existsSync(sampleDir)) {
    console.error(
      `❌ Thư mục ${sampleDir} không tồn tại. Vui lòng kiểm tra lại đường dẫn!`,
    );
    await app.close();
    process.exit(1);
  }

  // Helper to read file to buffer safely
  const readBuffer = (filename: string): Buffer => {
    const filePath = path.join(sampleDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Không tìm thấy file bắt buộc: ${filename}`);
    }
    return fs.readFileSync(filePath);
  };

  // =========================================================================
  // PHẦN 1: KIỂM THỬ ĐỐI CHIẾU KHỚP LỆNH (checkKLGD)
  // =========================================================================
  console.log('\n------------------------------------------------------------');
  console.log('1. ĐANG CHẠY ĐỐI CHIẾU KHỚP LỆNH (checkKLGD)...');
  console.log('------------------------------------------------------------');
  try {
    const klgdFiles = {
      dsgd: readBuffer('DSGD.xlsx'),
      fr1: readBuffer('FR1.xlsx'),
      fr2: readBuffer('FR2.xlsx'),
      nano: readBuffer('Nano.xls'),
      op1: readBuffer('OP1.xlsx'),
      op2: readBuffer('OP2.xlsx'),
      ttm: readBuffer('TTM.xlsx'),
      tttt: readBuffer('TTTT.xlsx'),
      ps1: readBuffer('PS1.xlsx'),
      ps2: readBuffer('PS2.xlsx'),
    };

    // Assume trading date is 2026-07-14 based on directory
    const tradingDate = new Date('2026-07-14');
    const resultKLGD = await reconService.checkKLGD(
      klgdFiles,
      tradingDate,
      [],
      '05:00',
    );

    console.log('\n✅ KẾT QUẢ ĐỐI CHIẾU KHỚP LỆNH:');
    console.log(
      `• Tổng khớp lệnh thường MS:  ${resultKLGD.totals.totalDSGD} lot`,
    );
    console.log(
      `• Tổng khớp lệnh thường CQG: ${resultKLGD.totals.totalFR} lot`,
    );
    console.log(
      `• Chênh lệch thường (MS-CQG): ${resultKLGD.totals.differ} lot`,
    );
    console.log(
      `• Tổng khớp tự doanh MS:      ${resultKLGD.totals.totalACM} lot`,
    );
    console.log(
      `• Tổng khớp tự doanh Nano:    ${resultKLGD.totals.totalNano} lot`,
    );
    console.log(
      `• Chênh lệch tự doanh:        ${resultKLGD.totals.differACM} lot`,
    );
    console.log(
      `• Tổng TTTT MS:               ${resultKLGD.totals.totalTTTT} lot`,
    );
    console.log(
      `• Tổng PS CQG:                ${resultKLGD.totals.totalPS} lot`,
    );
    console.log(
      `• Chênh lệch TTTT vs PS:      ${resultKLGD.totals.differTTTT} lot`,
    );

    console.log(
      `• Số giao dịch lệch chi tiết: ${resultKLGD.mismatchedTrades.length}`,
    );
    if (resultKLGD.mismatchedTrades.length > 0) {
      console.log('⚠️ Danh sách giao dịch lệch (tối đa 10 dòng):');
      resultKLGD.mismatchedTrades.slice(0, 10).forEach((t, i) => {
        console.log(
          `  [${i + 1}] Source: ${t.source} | TK: ${t.maTKGD} | HĐ: ${t.maHD} | Giá: ${t.giaKhop} | Qty: ${t.klGiaoDich} -> Lý do: ${t.reason}`,
        );
      });
    } else {
      console.log('✓ Không có giao dịch lệch chi tiết.');
    }

    console.log(
      `• Số tài khoản chênh lệch TTM (Trạng thái mở): ${resultKLGD.mismatchedTTM.length}`,
    );
    if (resultKLGD.mismatchedTTM.length > 0) {
      console.log('⚠️ Danh sách tài khoản lệch TTM:');
      resultKLGD.mismatchedTTM.forEach((t, i) => {
        console.log(
          `  [${i + 1}] TK: ${t.maTKGD} | MS TTM: ${t.ttmValue} | CQG Open: ${t.opValue} | Lệch: ${t.differ}`,
        );
      });
    } else {
      console.log('✓ Không có tài khoản lệch TTM.');
    }

    console.log(
      `• Số tài khoản chênh lệch TTTT vs PS: ${resultKLGD.mismatchedTTTT ? resultKLGD.mismatchedTTTT.length : 0}`,
    );
    if (resultKLGD.mismatchedTTTT && resultKLGD.mismatchedTTTT.length > 0) {
      console.log('⚠️ Danh sách tài khoản lệch TTTT vs PS:');
      resultKLGD.mismatchedTTTT.forEach((t, i) => {
        console.log(
          `  [${i + 1}] TK: ${t.maTKGD} | MS TTTT: ${t.ttttValue} | CQG PS: ${t.psValue} | Lệch: ${t.differ}`,
        );
      });
    } else {
      console.log('✓ Không có tài khoản lệch TTTT vs PS.');
    }
  } catch (err: any) {
    console.error('❌ Lỗi khi đối chiếu khớp lệnh:', err.message);
  }

  // =========================================================================
  // PHẦN 2: KIỂM THỬ ĐỐI CHIẾU SỐ DƯ EOD (checkEOD)
  // =========================================================================
  console.log('\n------------------------------------------------------------');
  console.log('2. ĐANG CHẠY ĐỐI CHIẾU SỐ DƯ EOD (checkEOD)...');
  console.log('------------------------------------------------------------');
  try {
    const eodFiles = {
      qltkgd: readBuffer('QLTKGD.xlsx'),
      eod: readBuffer('eod.2025-08-05.csv'),
      tttt: readBuffer('TTTT.xlsx'),
    };

    const resultEOD = await reconService.checkEOD(eodFiles);

    console.log('\n✅ KẾT QUẢ ĐỐI CHIẾU SỐ DƯ EOD:');
    console.log(
      `• Số tài khoản lệch số dư EOD (>= 1,000đ): ${resultEOD.mismatchedEOD.length}`,
    );
    if (resultEOD.mismatchedEOD.length > 0) {
      console.log('⚠️ Danh sách tài khoản lệch EOD (tối đa 10 dòng):');
      resultEOD.mismatchedEOD.slice(0, 10).forEach((t, i) => {
        console.log(
          `  [${i + 1}] TK: ${t.maTKGD} | Tính toán: ${t.calculatedBalance.toLocaleString()}đ | EOD: ${t.eodBalance.toLocaleString()}đ | Lệch: ${t.differ.toLocaleString()}đ`,
        );
      });
    } else {
      console.log('✓ Số dư khớp hoàn toàn hoặc không lệch vượt ngưỡng.');
    }

    console.log(
      `• Số tài khoản âm ký quỹ khả dụng (IMR): ${resultEOD.negativeIMRAcc.length}`,
    );
    if (resultEOD.negativeIMRAcc.length > 0) {
      console.log(
        `🚨 Tài khoản âm ký quỹ: ${resultEOD.negativeIMRAcc.join(', ')}`,
      );
    }
  } catch (err: any) {
    console.error('❌ Lỗi khi đối chiếu EOD:', err.message);
  }

  // =========================================================================
  // PHẦN 3: KIỂM THỬ ĐỐI CHIẾU SỐ DƯ CQG (checkEODCQG)
  // =========================================================================
  console.log('\n------------------------------------------------------------');
  console.log('3. ĐANG CHẠY ĐỐI CHIẾU SỐ DƯ CQG (checkEODCQG)...');
  console.log('------------------------------------------------------------');
  try {
    const cqgFiles = {
      qltkgd: readBuffer('QLTKGD.xlsx'),
      accountsBalances: readBuffer('Accounts_Balances.xlsx'),
    };

    const usdRate = 25220; // Tỷ giá mặc định
    const resultCQG = await reconService.checkEODCQG(cqgFiles, usdRate);

    console.log('\n✅ KẾT QUẢ ĐỐI CHIẾU SỐ DƯ CQG:');
    console.log(
      `• Số tài khoản lệch số dư CQG (> 100 USD): ${resultCQG.length}`,
    );
    if (resultCQG.length > 0) {
      console.log('⚠️ Danh sách tài khoản lệch CQG (tối đa 10 dòng):');
      resultCQG.slice(0, 10).forEach((t, i) => {
        console.log(
          `  [${i + 1}] TK: ${t.maTKGD} | MS: $${t.calculatedBalance} | CQG: $${t.cqgBalance} | Lệch: $${t.differ.toFixed(2)} | In MS: ${t.inMS} | In CQG: ${t.inCQG}`,
        );
      });
    } else {
      console.log('✓ Số dư CQG khớp hoàn toàn.');
    }
  } catch (err: any) {
    console.error('❌ Lỗi khi đối chiếu CQG:', err.message);
  }

  console.log('\n============================================================');
  console.log('=== KẾT THÚC KIỂM THỬ ===');
  await app.close();
}

testLocalReconciliation().catch((err) => {
  console.error('❌ Lỗi nghiêm trọng:', err);
  process.exit(1);
});
