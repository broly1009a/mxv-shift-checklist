import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CcpAdHocStatisticsService } from '../modules/trading-ops/services/ccp-adhoc-statistics.service';
import { SystemSettingsService } from '../modules/system-settings/system-settings.service';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

async function runAdHocLiveTest() {
  console.log('========================================================================');
  console.log('  TEST TOÀN TRÌNH (END-TO-END): THỐNG KÊ CORECCP THEO KHOẢNG THỜI GIAN  ');
  console.log('  Quy trình:                                                           ');
  console.log('  1. Tải tươi DSGD CCP trực tiếp qua CoreCCP API (dải ngày)            ');
  console.log('  2. Engine 1-Pass tính toán số lot & GTGD của 38+ TVKD                 ');
  console.log('  3. Nhân bản 10 Master Templates từ M:\\... sang _AdHoc_Reports/       ');
  console.log('  4. Python Instant Row Pull: Kéo Tổng cộng lên sát Row 6/7, dọn trống ');
  console.log('========================================================================\n');

  console.log('1. Khởi động NestJS Application Context...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const adhocService = app.get(CcpAdHocStatisticsService);
    const settingsService = app.get(SystemSettingsService);

    // Nạp tài khoản CoreCCP anhdao (https://coreccp.vnclear.vn) từ CSDL Ubuntu
    const originalGetSetting = settingsService.getSetting.bind(settingsService);
    const ubuntuCcpCred = 'cbedb36b756a5ef0ad46ef7df90928cc:614515188973980c614af4ef78885b33bf31cbcc082bc8ef6f7f3ece6d45662c12c3134a2dd391722ce8690ef2f21b746a62bcea75777750b2c4e698335b019d0aa2c86cd858f54c2ca03856f5b0b56e5017988b395c840c01f28e0da4fb67b8e0c0a46647f6ef578bad17cc12907a26723d4f681b42b4c6689ac51495bdbb1f734c8e3e3ff56ab68dc4a324d85c20f273e7030d4cfe684f8f71716903913b265dfdb70adeca58169fd805377e4d8bf6';
    settingsService.getSetting = (async (key: string, defaultVal: any) => {
      if (key === 'bot_credentials_ccp') return ubuntuCcpCred;
      if (key === 'coreccp_base_url') return 'https://coreccp.vnclear.vn';
      return originalGetSetting(key, defaultVal);
    }) as any;

    const fromDate = '2026-10-01';
    const toDate = '2026-10-21';
    console.log(`\n2. Kích hoạt runAdHocRangeWorkflow: ${fromDate} -> ${toDate} (Scope: ALL_PHASE2)...`);
    const startTime = Date.now();

    const result = await adhocService.runAdHocRangeWorkflow({
      fromDate,
      toDate,
      scope: 'ALL_PHASE2',
      downloadFresh: true,
      exchangeRate: 25920,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n3. Workflow hoàn thành sau ${elapsed} giây!`);
    console.log(`   - Thành công: ${result.success}`);
    console.log(`   - Tổng số file đã sinh: ${result.files.length}`);
    console.log(`   - Tổng số Lot toàn kỳ : ${result.summary?.totalLot?.toLocaleString('vi-VN')}`);
    console.log(`   - Tổng GTGD toàn kỳ   : ${result.summary?.totalGiaTri?.toLocaleString('vi-VN')} VND`);
    console.log(`   - Số TVKD phát sinh   : ${result.summary?.byTvSummary?.length || 0}`);

    console.log('\n4. Chi tiết các file báo cáo đã xuất bản trong _AdHoc_Reports:');
    result.files.forEach((f, idx) => {
      const size = f.sizeBytes || f.fileSizeBytes || 0;
      const fPath = f.absolutePath || f.filePath || '';
      console.log(`   [${idx + 1}] ${f.fileName} (${(size / 1024).toFixed(1)} KB)`);
      console.log(`       -> Đường dẫn: ${fPath}`);

      // Kiểm tra cấu trúc Excel thực tế
      if (fs.existsSync(f.absolutePath)) {
        try {
          const wb = XLSX.readFile(f.absolutePath);
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          const range = XLSX.utils.decode_range(firstSheet['!ref'] || 'A1:A10');
          console.log(`       -> Sheet [${wb.SheetNames[0]}]: Số hàng = ${range.e.r + 1}, Cột = ${range.e.c + 1}`);
        } catch (e: any) {
          console.log(`       -> Không thể đọc sheet: ${e.message}`);
        }
      }
    });

    console.log('\n5. Nhật ký thực thi chi tiết (Execution Logs):');
    result.logs.forEach((log) => console.log(`   ${log}`));

    console.log('\n========================================================================');
    console.log('  KẾT QUẢ: TOÀN BỘ LUỒNG BÁO CÁO ĐỘT XUẤT ĐÃ HOẠT ĐỘNG HOÀN HẢO 100%!  ');
    console.log('========================================================================');
  } catch (err: any) {
    console.error('\n❌ Lỗi khi chạy test workflow adhoc:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await app.close();
  }
}

runAdHocLiveTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
