import * as path from 'path';
import * as fs from 'fs';
import { provisionExcelColumn } from '../modules/trading-ops/helpers/ccp-column-provisioner.helper';
import { CcpAccumulatorService } from '../modules/trading-ops/services/ccp-accumulator.service';

async function testAccumulatorIntegration() {
  console.log('======================================================================');
  console.log('  TEST KIỂM CHỨNG TÍCH HỢP CCP ACCUMULATOR SERVICE & PROVISIONER');
  console.log('======================================================================\n');

  const rootDir = path.resolve(__dirname, '../../..');
  const sourceTemplateDir = path.join(rootDir, 'Bao cao - Thong ke');

  // Tạo thư mục sandbox biệt lập để test an toàn không xung đột file lock với Excel đang mở
  const sandboxDir = path.join(__dirname, '../../scratch/test_accumulator_templates');
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
  fs.mkdirSync(sandboxDir, { recursive: true });

  // Copy các file mẫu cần thiết vào sandbox
  const sampleFiles = [
    'Thong ke so lot giao dich ACM 2026 (trên CCP).xlsx',
    'Thong ke gia tri giao dich ACM 2026 (Theo CCP).xlsx',
    'Thong ke so lot giao dich 2026.xlsx',
    'Thong ke gia tri giao dich 2026.xlsx',
  ];

  for (const f of sampleFiles) {
    const src = path.join(sourceTemplateDir, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(sandboxDir, f));
    }
  }
  console.log(`1. [Sandbox Setup] Đã chuẩn bị thư mục test biệt lập:\n   ${sandboxDir}\n`);

  const accumulatorService = new CcpAccumulatorService();

  // 2. Kiểm tra helper provisionExcelColumn dry-run trên sandbox
  const testFileLot = path.join(sandboxDir, 'Thong ke so lot giao dich ACM 2026 (trên CCP).xlsx');
  console.log('2. Test dry-run mở rộng cột TVKD 098:');
  const dryRunRes = provisionExcelColumn({
    filePath: testFileLot,
    type: 'tvkd',
    code: '098',
    label: 'Thanh vien Test 098',
    dryRun: true,
  });
  console.log('   Dry-run result:', dryRunRes);
  if (!dryRunRes.success) throw new Error(`Dry-run failed: ${dryRunRes.message}`);

  // 3. Kiểm tra provisionAllTemplates trên sandbox
  console.log('\n3. Test provisionAllTemplates (thực thi ghi thực trên sandbox):');
  const allTemplatesRes = await accumulatorService.provisionAllTemplates({
    customTargetRoot: sandboxDir,
    type: 'commodity',
    code: 'GLD3',
    label: 'Vang Sieu Mini',
    dryRun: false,
  });
  console.log(`   Đã xử lý ${allTemplatesRes.length} templates:`);
  for (const r of allTemplatesRes) {
    console.log(`   - ${r.file}: success=${r.result.success} (${r.result.durationMs}ms)`);
  }
  const failedProvision = allTemplatesRes.filter(r => !r.result.success);
  if (failedProvision.length > 0) {
    throw new Error(`Có ${failedProvision.length} template provision thất bại: ${JSON.stringify(failedProvision)}`);
  }

  // 4. Kiểm tra writeLotStatsToAccumulator trên sandbox
  console.log('\n4. Test ghi lũy kế Số Lot (writeLotStatsToAccumulator) trên sandbox:');
  const writeLotRes = await accumulatorService.writeLotStatsToAccumulator({
    targetDate: '2026-10-15',
    customTargetRoot: sandboxDir,
    summary: {
      dsgdTotal: 1500,
      frTotal: 1500,
      ttmTotal: 800,
      opTotal: 800,
      ttttTotal: 400,
      psTotal: 400,
      acmTotal: 1200,
      differKlgd: 0,
      differTtm: 0,
      differTttt: 0,
    },
    byProduct: [
      { maSP: 'SI5CO', klm: 300, klb: 300, total: 600 },
      { maSP: 'PL1NY', klm: 200, klb: 200, total: 400 },
      { maSP: 'GLD1', klm: 100, klb: 100, total: 200 },
    ],
    byTvkd: [
      { tvkd: 'HN 001', klm: 150, klb: 150, total: 300 },
      { tvkd: 'SF 002', klm: 100, klb: 100, total: 200 },
      { tvkd: 'Thanh vien ABC 099', klm: 50, klb: 50, total: 100 },
    ],
  });

  console.log('   Kết quả ghi số lot:');
  for (const r of writeLotRes) {
    console.log(`   - ${r.file} [Sheet: ${r.sheet}, Row: ${r.row}]: success=${r.success}`);
  }
  const successLot = writeLotRes.filter(r => r.success);
  console.log(`   Tổng file ghi số lot thành công: ${successLot.length}/${writeLotRes.length}`);
  if (successLot.length === 0) {
    throw new Error('Ghi số lot vào accumulator thất bại!');
  }

  // 5. Kiểm tra writeValueStatsToAccumulator trên sandbox
  console.log('\n5. Test ghi lũy kế Giá Trị (writeValueStatsToAccumulator) trên sandbox:');
  const writeValueRes = await accumulatorService.writeValueStatsToAccumulator({
    targetDate: '2026-10-15',
    customTargetRoot: sandboxDir,
    result: {
      sessionDate: '2026-10-15',
      totalLots: 1200,
      totalValueVnd: 50000000000,
      breakdownByProduct: [
        { product: 'SI5CO', lots: 600, valueVnd: 30000000000, currency: 'USD', exchangeRate: 25400 },
        { product: 'PL1NY', lots: 400, valueVnd: 15000000000, currency: 'USD', exchangeRate: 25400 },
        { product: 'GLD1', lots: 200, valueVnd: 5000000000, currency: 'USD', exchangeRate: 25400 },
      ],
      rates: {
        usdLoss: 25400,
        usdGain: 25400,
        myrLoss: 5800,
        myrGain: 5800,
        jpyLoss: 170,
        jpyGain: 170,
        rmbLoss: 3500,
        rmbGain: 3500,
      },
      passed: true,
      calculatedAt: new Date(),
    },
  });

  console.log('   Kết quả ghi giá trị:');
  for (const r of writeValueRes) {
    console.log(`   - ${r.file} [Sheet: ${r.sheet}, Row: ${r.row}]: success=${r.success}`);
  }
  const successValue = writeValueRes.filter(r => r.success);
  console.log(`   Tổng file ghi giá trị thành công: ${successValue.length}/${writeValueRes.length}`);
  if (successValue.length === 0) {
    throw new Error('Ghi giá trị vào accumulator thất bại!');
  }

  // Dọn dẹp sandbox
  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n======================================================================');
  console.log('  TẤT CẢ CÁC BƯỚC KIỂM CHỨNG TÍCH HỢP HỆ THỐNG ĐÃ HOÀN TẤT XUẤT SẮC!  ');
  console.log('======================================================================');
}

testAccumulatorIntegration().catch((err) => {
  console.error('\nLỖI KIỂM CHỨNG:', err);
  process.exit(1);
});
