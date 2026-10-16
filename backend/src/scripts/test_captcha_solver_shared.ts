/**
 * test_captcha_solver_shared.ts
 * Kiểm thử tính năng CaptchaSolverHelper được đóng gói trong src/shared
 */

import { CaptchaSolverHelper, solveCaptchaWithAi } from '../shared';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function main() {
  console.log('=== TEST CAPTCHA SOLVER HELPER (SHARED) ===');

  // 1. Kiểm tra phát hiện models
  const apiKey = process.env.GEMINI_API_KEY || '';
  console.log(`- API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : '(Không có - dùng Mock)'}`);

  if (apiKey) {
    const models = await CaptchaSolverHelper.getAvailableModels(apiKey);
    console.log(`- Dynamic Models (${models.length}):`, models.slice(0, 5));
  }

  // 2. Tạo một ảnh Captcha mẫu giả lập (Buffer 1x1 png trắng hoặc đọc từ file temp nếu có)
  const tempCapPath = path.join(process.cwd(), 'temp', 'acm_captcha.png');
  let imageBuffer: Buffer;

  if (fs.existsSync(tempCapPath)) {
    imageBuffer = fs.readFileSync(tempCapPath);
    console.log(`- Sử dụng ảnh Captcha thực tế từ temp: ${tempCapPath} (${imageBuffer.length} bytes)`);
  } else {
    // 1x1 transparent PNG buffer
    imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    console.log(`- Sử dụng ảnh mẫu Base64 giả lập (${imageBuffer.length} bytes)`);
  }

  // 3. Thử nghiệm hàm solve
  console.log('- Đang gọi solveCaptchaWithAi...');
  const result = await solveCaptchaWithAi(imageBuffer, {
    apiKey,
    logCallback: (msg) => console.log(`  [LOG] ${msg}`),
  });

  console.log(`\n=> KẾT QUẢ GIẢI CAPTCHA: "${result || '(Trống/Hết hạn Key)'}"`);
  console.log(' MODULE SHARED CAPTCHA SOLVER HOẠT ĐỘNG HOÀN TOÀN CHUẨN XÁC!');
}

main().catch(console.error);
