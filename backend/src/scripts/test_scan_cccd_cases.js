const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Test Suite: Đánh giá chất lượng và độ ổn định của Module Scan CCCD 100%
 * Chế độ: Read-Only (Không ghi đè, không sửa đổi dữ liệu DB)
 */

const pythonWorker = path.join(__dirname, 'python/tkgd_extractor_worker.py');
const pythonBin = process.platform === 'win32' ? 'python' : 'python3';

const testDir = path.join(__dirname, '../../data/test_cccd_images');

const testCases = [
  {
    id: 'TC-01',
    name: 'Hồ sơ đầy đủ chuẩn (003C1399395 - Nguyễn Thị Thu Thủy)',
    args: [
      '--code', '003C1399395',
      '--hopdong', path.join(testDir, '003C1399395_NGUYEN-THI-THU-THUY-mxv.pdf'),
      '--phuluc', path.join(testDir, '003C1399395_NGUYEN-THI-THU-THUY-PL01.pdf'),
      '--front', path.join(testDir, '003C1399395_NGUYEN-THI-THU-THUY-CCCD-truoc.jpg'),
      '--back', path.join(testDir, '003C1399395_NGUYEN-THI-THU-THUY-CCCD-sau.jpg'),
    ],
    verify: (res) => {
      const okCCCD = res.canCuoc?.soCCCD && res.canCuoc.soCCCD.length === 12;
      const okScore = res.canCuoc?.confidenceScore >= 0.90;
      const okGen = !!res.canCuoc?.theGeneration;
      return {
        pass: okCCCD && okScore && okGen,
        details: `CCCD: ${res.canCuoc?.soCCCD}, Gen: ${res.canCuoc?.theGeneration}, Confidence: ${res.canCuoc?.confidenceScore}, Warnings: ${res.canCuoc?.canhBaoChatLuong?.length || 0}`,
      };
    },
  },
  {
    id: 'TC-02',
    name: 'Hồ sơ thẻ căn cước có HĐ (003C8946619 - Nguyễn Thị Phương Thúy)',
    args: [
      '--code', '003C8946619',
      '--hopdong', path.join(testDir, '003C8946619_NGUYEN-THI-PHUONG-THUY-mxv.pdf'),
      '--front', path.join(testDir, '003C8946619_NGUYEN-THI-PHUONG-THUY-CCCD-truoc.jpg'),
      '--back', path.join(testDir, '003C8946619_NGUYEN-THI-PHUONG-THUY-CCCD-sau.jpg'),
    ],
    verify: (res) => {
      const okCCCD = res.canCuoc?.soCCCD && res.canCuoc.soCCCD.length === 12;
      const okScore = res.canCuoc?.confidenceScore >= 0.90;
      return {
        pass: okCCCD && okScore,
        details: `CCCD: ${res.canCuoc?.soCCCD}, Gen: ${res.canCuoc?.theGeneration}, Confidence: ${res.canCuoc?.confidenceScore}`,
      };
    },
  },
  {
    id: 'TC-03',
    name: 'Kiểm tra phát hiện mất góc chỉ định (003C9462626 - Lâm Thành Danh)',
    args: [
      '--code', '003C9462626',
      '--front', path.join(testDir, '003C9462626_LAM-THANH-DANH-CCCD-truoc.jpg'),
      '--back', path.join(testDir, '003C9462626_LAM-THANH-DANH-CCCD-sau.jpg'),
    ],
    verify: (res) => {
      const hasWarning = (res.canCuoc?.canhBaoChatLuong || []).some(w => w.includes('mất góc'));
      return {
        pass: hasWarning,
        details: `Bắt đúng cảnh báo mất góc: ${hasWarning} (${res.canCuoc?.canhBaoChatLuong?.join('; ')})`,
      };
    },
  },
];

async function runWorker(args) {
  return new Promise((resolve, reject) => {
    execFile(pythonBin, [pythonWorker, ...args], { timeout: 20000, encoding: 'utf-8' }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || err.message));
      }
      try {
        const json = JSON.parse(stdout.trim());
        resolve(json);
      } catch (e) {
        reject(new Error(`JSON Parse Error: ${e.message}\nOutput: ${stdout}`));
      }
    });
  });
}

async function main() {
  console.log('='.repeat(75));
  console.log('🚀 BẮT ĐẦU BỘ KIỂM THỬ MODULE SCAN CCCD (VERIFICATION TEST SUITE)');
  console.log('='.repeat(75));
  console.log(`- Python Worker: ${pythonWorker}`);
  console.log(`- Python Bin:    ${pythonBin}\n`);

  let passCount = 0;

  for (const tc of testCases) {
    process.stdout.write(`▶ Chạy [${tc.id}] ${tc.name}... `);
    try {
      const res = await runWorker(tc.args);
      const v = tc.verify(res);
      if (v.pass) {
        passCount++;
        console.log('✅ PASS');
        console.log(`   ↳ Chi tiết: ${v.details}`);
        if (res.canCuoc?.boundingBoxes && Object.keys(res.canCuoc.boundingBoxes).length > 0) {
          console.log(`   ↳ Bounding Boxes: ${JSON.stringify(res.canCuoc.boundingBoxes)}`);
        }
      } else {
        console.log('❌ FAIL');
        console.log(`   ↳ Chi tiết: ${v.details}`);
      }
    } catch (err) {
      console.log('💥 ERROR');
      console.log(`   ↳ Lỗi thực thi: ${err.message}`);
    }
    console.log('-'.repeat(75));
  }

  console.log(`\n KẾT QUẢ TỔNG THỂ: ${passCount}/${testCases.length} Testcases ĐẠT (Pass Rate: ${Math.round(passCount / testCases.length * 100)}%)`);
  console.log('='.repeat(75));
}

main().catch(console.error);
