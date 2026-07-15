import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ReconciliationService } from './modules/reconciliation/reconciliation.service';
import * as path from 'path';
import * as fs from 'fs';

async function testPreEod() {
  console.log('=== KHỞI CHẠY KIỂM THỬ ĐỐI CHIẾU PRE-EOD THỰC TẾ ===');
  console.log('Khởi tạo ứng dụng NestJS context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const reconService = app.get(ReconciliationService);

  const checkEodDir = path.join(process.cwd(), 'CHECKEOD');

  const readBuffer = (filename: string): Buffer => {
    const filePath = path.join(checkEodDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Không tìm thấy file: ${filename} tại ${filePath}`);
    }
    return fs.readFileSync(filePath);
  };

  try {
    const files = {
      dsgd: readBuffer('DSGD.xlsx'),
      acmTrades: readBuffer('EOD FO trades_PT Straits Financial Indonesia - 10017890000_06072026.csv'),
      cqgFr: readBuffer('FR.xlsx'),
      tttt: readBuffer('TTTT 3.xlsx'),
      cqgPs: readBuffer('PS 1.xlsx'),
    };

    const acmTradesName = 'EOD FO trades_PT Straits Financial Indonesia - 10017890000_06072026.csv';
    const tradingDate = new Date('2026-07-07T00:00:00.000Z');
    const sessionStartStr = '05:00';

    console.log('\nRunning checkPreEOD...');
    const result = await reconService.checkPreEOD(
      files,
      acmTradesName,
      tradingDate,
      [],
      sessionStartStr,
    );

    console.log('\n✅ KẾT QUẢ ĐỐI CHIẾU PRE-EOD CHUNG:');
    console.log(`• Passed Status: ${result.passed}`);
    console.log('\n--- 1. KHỚP LỆNH THƯỜNG (MS vs CQG) ---');
    console.log(`• Tổng khớp MS (CQG): ${result.totals.totalCQG_MS} lot`);
    console.log(`• Tổng khớp CQG (FR): ${result.totals.totalCQG_FR} lot`);
    console.log(`• Chênh lệch CQG:     ${result.totals.differCQG} lot`);
    console.log(`• Số giao dịch lệch:  ${result.mismatchedTrades.length}`);

    console.log('\n--- 2. KHỚP LỆNH TỰ DOANH (MS vs ACM) ---');
    console.log(`• Tổng khớp MS (ACM): ${result.totals.totalACM_MS} lot`);
    console.log(`• Tổng khớp ACM Straits: ${result.totals.totalACM_Straits} lot`);
    console.log(`• Chênh lệch ACM:     ${result.totals.differACM} lot`);

    console.log('\n--- 3. VỊ THẾ RÒNG (TTTT vs PS) ---');
    console.log(`• Số vị thế lệch:     ${result.mismatchedPositions.length}`);
    if (result.mismatchedPositions.length > 0) {
      console.log(' Danh sách vị thế lệch (tối đa 10 dòng):');
      result.mismatchedPositions.slice(0, 10).forEach((p: any, i: number) => {
        console.log(`  [${i + 1}] TK: ${p.account} | HĐ: ${p.symbol} | Vị thế MS: ${p.msPosition} | Vị thế CQG: ${p.cqgPosition} | Lệch: ${p.differ}`);
      });
    }

  } catch (err: any) {
    console.error('❌ Lỗi khi thực hiện đối chiếu:', err);
  } finally {
    await app.close();
  }
}

testPreEod().catch(err => {
  console.error('❌ Lỗi nghiêm trọng:', err);
  process.exit(1);
});
