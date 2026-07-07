import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { connect } from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://[::1]:5000/api/v1';

async function runE2ETest() {
  console.log('--- BẮT ĐẦU TEST E2E ZIP DOWNLOAD FLOW (FETCH) ---');

  // 1. Đăng nhập admin
  console.log('1. Đăng nhập bằng tài khoản admin...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'Admin@MXV123',
    }),
  });
  if (!loginRes.ok) {
    throw new Error(`Đăng nhập thất bại: ${loginRes.statusText}`);
  }
  const loginData = (await loginRes.json()) as any;
  const token = loginData.access_token;
  console.log('✅ Đăng nhập thành công! Token:', token.substring(0, 15) + '...');

  // 2. Trigger download job
  console.log('2. Gửi yêu cầu trigger download báo cáo...');
  const triggerRes = await fetch(`${API_BASE}/bot-engine/trigger-download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      targets: ['NKTTHT', 'DSTKGD-Futures', 'NR'],
    }),
  });
  if (!triggerRes.ok) {
    throw new Error(`Trigger thất bại: ${triggerRes.statusText}`);
  }
  const triggerData = (await triggerRes.json()) as any;
  const jobId = triggerData.jobId;
  console.log(`✅ Tạo job thành công! Job ID: ${jobId}`);

  // 3. Giả lập quá trình chạy Job thành công (để không cần chạy thật qua Playwright)
  // Kết nối DB trực tiếp để giả lập trạng thái COMPLETED và lưu file giả lập
  console.log('3. Kết nối DB để giả lập lưu file và chuyển trạng thái job sang COMPLETED...');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mxv-shift-checklist';
  const connection = await connect(mongoUri);
  const db = connection.connection.db;
  if (!db) {
    throw new Error('Database connection failed');
  }
  const botjobsCollection = db.collection('bot_jobs');

  // Tạo thư mục tạm và lưu file giả lập
  const tempJobDir = path.join(process.cwd(), 'temp', 'reports', jobId);
  if (!fs.existsSync(tempJobDir)) {
    fs.mkdirSync(tempJobDir, { recursive: true });
  }
  fs.writeFileSync(path.join(tempJobDir, 'NKTTHT.xlsx'), 'NKTTHT Mock Excel Data');
  fs.writeFileSync(path.join(tempJobDir, 'DSTKGD-Futures.xlsx'), 'Futures Mock Excel Data');
  fs.writeFileSync(path.join(tempJobDir, 'NR.xlsx'), 'NR Mock Excel Data');
  console.log(`✅ Đã tạo các file báo cáo giả lập tại thư mục: temp/reports/${jobId}`);

  // Cập nhật trạng thái job thành COMPLETED
  console.log(`Kết nối MongoDB URI: ${mongoUri.replace(/:[^@]+@/, ':***@')}`);
  const updateResult = await botjobsCollection.updateOne(
    { _id: new (require('mongoose').Types.ObjectId)(jobId) },
    {
      $set: {
        status: 'COMPLETED',
        logs: [
          'Attempt 1 started',
          'Successfully logged in M-System',
          'Downloaded NKTTHT.xlsx',
          'Downloaded DSTKGD-Futures.xlsx',
          'Downloaded NR.xlsx',
          'Job completed successfully.',
        ],
      },
    }
  );
  console.log(`✅ Cập nhật trạng thái Job sang COMPLETED thành công! Matched: ${updateResult.matchedCount}, Modified: ${updateResult.modifiedCount}`);

  // 4. Download file ZIP qua API
  console.log(`4. Gửi yêu cầu tải file ZIP từ endpoint /bot-engine/jobs/${jobId}/download-zip...`);
  const downloadRes = await fetch(`${API_BASE}/bot-engine/jobs/${jobId}/download-zip`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!downloadRes.ok) {
    const errText = await downloadRes.text();
    throw new Error(`Tải file ZIP thất bại: ${downloadRes.statusText} - Chi tiết: ${errText}`);
  }

  const zipArrayBuffer = await downloadRes.arrayBuffer();
  const zipBuffer = Buffer.from(zipArrayBuffer);
  console.log(`✅ Nhận được file ZIP. Dung lượng: ${zipBuffer.length} bytes`);

  // 5. Kiểm tra giải nén và cấu trúc file
  console.log('5. Đang giải nén file ZIP để kiểm tra cấu trúc và tính đúng đắn của file...');
  const zip = await JSZip.loadAsync(zipBuffer);
  const zipFiles = Object.keys(zip.files);
  console.log('Danh sách các file trong ZIP:', zipFiles);

  const expectedFiles = ['NKTTHT.xlsx', 'DSTKGD-Futures.xlsx', 'NR.xlsx'];
  let passed = true;
  for (const exp of expectedFiles) {
    if (zipFiles.includes(exp)) {
      const content = await zip.file(exp)?.async('string');
      console.log(`- [OK] ${exp} tồn tại trong file ZIP. Nội dung mẫu: "${content}"`);
    } else {
      console.error(`- [FAIL] Không tìm thấy file ${exp} trong file ZIP!`);
      passed = false;
    }
  }

  // 6. Dọn dẹp thư mục tạm
  console.log('6. Đang dọn dẹp thư mục tạm...');
  fs.unlinkSync(path.join(tempJobDir, 'NKTTHT.xlsx'));
  fs.unlinkSync(path.join(tempJobDir, 'DSTKGD-Futures.xlsx'));
  fs.unlinkSync(path.join(tempJobDir, 'NR.xlsx'));
  fs.rmdirSync(tempJobDir);
  console.log('✅ Đã dọn dẹp thư mục tạm thành công.');

  await connection.disconnect();

  if (passed) {
    console.log('\n⭐ TẤT CẢ CÁC BƯỚC TEST ĐÃ THÀNH CÔNG RỰC RỠ! ⭐');
  } else {
    console.error('\n❌ TEST THẤT BẠI!');
    process.exit(1);
  }
}

runE2ETest().catch((err) => {
  console.error('Lỗi chạy test:', err);
  process.exit(1);
});
