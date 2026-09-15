/**
 * run_tkgd_golden_tests.ts
 * RUNNER KIỂM THỬ HỒI QUY TẬP TRUNG CHO BỘ TEST CASE VÀNG TKGD (MXV GOLDEN TEST SUITE)
 * Không cần kết nối database, chạy tức thì trong 2-3 giây, kiểm tra độ chính xác của logic đối soát.
 */

import * as fs from 'fs';
import * as path from 'path';
import { evaluateRecordReconciliationRule } from '../../src/modules/bot-engine/helpers/tkgd-reconcile-rules.helper';

interface GoldenTestCase {
  name: string;
  description: string;
  record: any;
  expected: {
    finalStatus: 'KHOP' | 'LECH' | 'CAN_KIEM_TRA';
    mustNotIncludeErrors?: string[];
    mustIncludeErrors?: string[];
  };
}

async function runGoldenTests() {
  const casesDir = path.join(__dirname, 'cases');
  if (!fs.existsSync(casesDir)) {
    console.error(`❌ Thư mục test cases không tồn tại: ${casesDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(casesDir).filter((f) => f.endsWith('.json'));
  console.log(`\n===============================================================`);
  console.log(`🚀 BẮT ĐẦU CHẠY BỘ KIỂM THỬ HỒI QUY TKGD (GOLDEN REGRESSION SUITE)`);
  console.log(`📁 Tổng số test cases phát hiện: ${files.length}`);
  console.log(`===============================================================\n`);

  let passCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(casesDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const testCase: GoldenTestCase = JSON.parse(content);

    const result = evaluateRecordReconciliationRule(testCase.record);
    const errors: string[] = [];

    // 1. Kiểm tra trạng thái cuối cùng
    if (result.finalStatus !== testCase.expected.finalStatus) {
      errors.push(
        `Sai trạng thái: Mong muốn '${testCase.expected.finalStatus}', Thực tế ra '${result.finalStatus}'`,
      );
    }

    // 2. Kiểm tra các lỗi cấm xuất hiện (mustNotIncludeErrors)
    if (testCase.expected.mustNotIncludeErrors) {
      for (const forbidden of testCase.expected.mustNotIncludeErrors) {
        const found = result.finalErrors.some((e) => e.toLowerCase().includes(forbidden.toLowerCase()));
        if (found) {
          errors.push(`Xuất hiện lỗi bị cấm: "${forbidden}"`);
        }
      }
    }

    // 3. Kiểm tra các lỗi bắt buộc xuất hiện (mustIncludeErrors)
    if (testCase.expected.mustIncludeErrors) {
      for (const required of testCase.expected.mustIncludeErrors) {
        const found = result.finalErrors.some((e) => e.toLowerCase().includes(required.toLowerCase()));
        if (!found) {
          errors.push(`Thiếu lỗi bắt buộc: "${required}"`);
        }
      }
    }

    if (errors.length === 0) {
      passCount++;
      console.log(`✅ [${i + 1}/${files.length}] PASS: ${testCase.name}`);
      if (result.autoHealedNotes && result.autoHealedNotes.length > 0) {
        console.log(`   💡 Auto-Heal: ${result.autoHealedNotes.join(' | ')}`);
      }
    } else {
      failCount++;
      console.error(`❌ [${i + 1}/${files.length}] FAIL: ${testCase.name}`);
      console.error(`   File: ${file}`);
      for (const err of errors) {
        console.error(`   👉 Lỗi: ${err}`);
      }
      console.error(`   Dữ liệu thực tế: finalStatus = ${result.finalStatus}`);
      console.error(`   Danh sách lỗi trả về: ${JSON.stringify(result.finalErrors)}`);
    }
    console.log(`---------------------------------------------------------------`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n===============================================================`);
  console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passCount}/${files.length} PASSED (${duration}s)`);
  if (failCount > 0) {
    console.error(`❌ CÓ ${failCount} TEST CASE BỊ THẤT BẠI! CHẶN DEPLOY!`);
    console.log(`===============================================================\n`);
    process.exit(1);
  } else {
    console.log(`🎉 TẤT CẢ TEST CASES ĐỀU ĐẠT CHUẨN 100%! HỆ THỐNG AN TOÀN!`);
    console.log(`===============================================================\n`);
    process.exit(0);
  }
}

runGoldenTests().catch((err) => {
  console.error('Fatal error during golden tests:', err);
  process.exit(1);
});
