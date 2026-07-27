import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BotJobQueueService } from './modules/bot-engine/bot-job-queue.service';

async function run() {
  console.log('🚀 Khởi tạo NestJS Application Context cho kịch bản Test Cảnh Báo Lệch Khớp Lệnh (CSV/Excel)...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const botJobQueueService = app.get(BotJobQueueService);

  try {
    console.log('📧 Đang tạo dữ liệu Job giả lập có danh sách lệch khớp lệnh lớn...');
    
    // Giao dịch lệch khớp lệnh giả lập tương tự như payload thật của user
    const mockMismatchedTrades = [
      {
        source: "MSystem",
        maLenh: "1831286442",
        maTKGD: "003C0376669",
        maHD: "ZCEU26",
        giaKhop: 459.25,
        klGiaoDich: 1,
        ngayGio: "27-07-2026 11:12:20",
        reason: "Giao dịch M-System không tìm thấy bên CQG"
      },
      {
        source: "MSystem",
        maLenh: "1831226583",
        maTKGD: "012C0600288",
        maHD: "ZCEU26",
        giaKhop: 459.25,
        klGiaoDich: 1,
        ngayGio: "27-07-2026 11:12:20",
        reason: "Giao dịch M-System không tìm thấy bên CQG"
      },
      {
        source: "MSystem",
        maLenh: "1831256587",
        maTKGD: "003C3993999",
        maHD: "ZMEH27",
        giaKhop: 335.7,
        klGiaoDich: 1,
        ngayGio: "27-07-2026 11:12:00",
        reason: "Giao dịch M-System không tìm thấy bên CQG"
      },
      {
        source: "MSystem",
        maLenh: "1831281434",
        maTKGD: "080C8151073",
        maHD: "SILZ26",
        giaKhop: 60.125,
        klGiaoDich: 2,
        ngayGio: "27-07-2026 11:11:20",
        reason: "Giao dịch M-System không tìm thấy bên CQG"
      },
      {
        source: "MSystem",
        maLenh: "1831256419",
        maTKGD: "080C2623968",
        maHD: "SILU26",
        giaKhop: 59.49,
        klGiaoDich: 1,
        ngayGio: "27-07-2026 11:09:24",
        reason: "Giao dịch M-System không tìm thấy bên CQG"
      },
      {
        source: "MSystem",
        maLenh: "1831231440",
        maTKGD: "012C0656688",
        maHD: "SILU26",
        giaKhop: 59.5,
        klGiaoDich: 1,
        ngayGio: "27-07-2026 11:09:24",
        reason: "Giao dịch M-System không tìm thấy bên CQG"
      }
    ];

    // Tạo thêm khoảng 20 dòng để payload vượt quá 3000 ký tự và kích hoạt đính kèm file .json + .csv
    for (let i = 1; i <= 20; i++) {
      mockMismatchedTrades.push({
        source: "MSystem",
        maLenh: `1831251556${i}`,
        maTKGD: `072C86831${10 + i}`,
        maHD: "ZLEQ26",
        giaKhop: 72.89 + i * 0.1,
        klGiaoDich: 1,
        ngayGio: `27-07-2026 11:09:${10 + i}`,
        reason: "Giao dịch M-System không tìm thấy bên CQG"
      });
    }

    const mockJob: any = {
      _id: '6a67314a08bd0f6a862fb29c',
      jobType: 'CHECK_KLGD',
      attempts: 3,
      maxAttempts: 3,
      createdAt: new Date(),
      logs: [
        'Initialize auto-checking...',
        'Connecting to database...',
        'Read M365 watcher email config...',
        'Fetch trade history from M-System...',
        'Fetch transaction reports from CQG...',
        'Match trades between systems...',
        'Error: Detected trade mismatches (differ = 1105)'
      ],
      payload: {
        taskId: "TASK_CHECK_KLGD_s1",
        shiftLogId: "6a672fd808bd0f6a862fb261",
        sessionDay: "2026-07-27",
        result: {
          totals: {
            totalDSGD: 1105,
            totalFR: 0,
            totalACM: 439,
            totalNano: 439,
            differ: 1105,
            differACM: 0,
            totalTTTT: 0,
            totalPS: 4856,
            differTTTT: 4856
          },
          mismatchedTrades: mockMismatchedTrades
        }
      }
    };

    console.log('📬 Đang gọi hàm gửi email cảnh báo sendOperationalFailureAlert với dữ liệu test...');
    
    // Gọi hàm private của service
    const errorMsg = 'Phát hiện chênh lệch khớp lệnh trong phiên (KLGD). Vui lòng kiểm tra báo cáo đính kèm.';
    await (botJobQueueService as any).sendOperationalFailureAlert(mockJob, errorMsg);
    
    console.log('🎉 KỊCH BẢN CHẠY TEST THÀNH CÔNG! Hãy check mail nhận thư cảnh báo kèm file CSV Excel.');

  } catch (err: any) {
    console.error('\n❌ LỖI TRONG QUÁ TRÌNH CHẠY TEST:');
    console.error(err.message);
  } finally {
    await app.close();
    console.log('\n⌛ Đã đóng NestJS Application Context.');
  }
}

run().catch((err) => {
  console.error('Lỗi nghiêm trọng:', err);
  process.exit(1);
});
