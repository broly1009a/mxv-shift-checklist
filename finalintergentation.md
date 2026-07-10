Dễ — vì hạ tầng cốt lõi đã có sẵn gần đủ. Đây là đánh giá nhanh:

Hiện trạng đã có ✅
Thành phần	Trạng thái
BotJobQueue — hàng đợi job async	✅ Có sẵn
readIfExists() — tự tìm file trong thư mục chỉ định	✅ Có sẵn (reconciliation.controller.ts line 408)
Cấu hình đường dẫn thư mục qua Admin UI	✅ Đã có (backup paths)
Playwright login tự động (MS, CQG, ACM, CAST)	✅ Scripts đã có
Gửi email kết quả	✅ Có sẵn trong IT Tool
Phần cần thêm (không nhiều)
1. Cron scheduler (NestJS @Schedule)         → ~1 ngày
   - 07:00: tải file CAST → checkSOD
   - 08:00: tải MS reports → checkKLGD
   - 16:30: checkPreEOD
   - 18:00: checkEOD, checkMM
   
2. Cấu hình schedule qua Admin UI           → ~0.5 ngày
   - Enable/disable từng task
   - Set giờ chạy
   - Chọn thư mục nguồn file
   
3. Auto-detect file mới nhất trong thư mục  → ~2 giờ
   - Đã có readIfExists(), chỉ cần thêm 
     logic lấy file mới nhất theo ngày
Kiến trúc tổng thể
Admin UI (bật/tắt + set giờ)
        │
        ▼
NestJS @Cron(schedule)
        │
        ├──► BotJobQueue.enqueue('DOWNLOAD_CAST') → Playwright tải Accounts_Balances
        ├──► BotJobQueue.enqueue('DOWNLOAD_MS')   → Playwright tải QLTKGD, DSGD...
        │
        ▼
readLatestFileInDir(folder)   ← tự tìm file mới nhất
        │
        ▼
reconciliationService.checkEOD/SOD/KLGD()
        │
        ▼
Email alert kết quả
Kết luận: Phần lớn là nối dây giữa những thứ đã có, không phải xây mới. Khi bạn muốn làm, chỉ cần nói tôi bắt đầu từ module nào (schedule, UI cấu hình, hay file-finder) là được.







Có đủ thông tin rồi. Câu trả lời thực tế:

Đánh giá thực tế: 1 ngày KHÔNG đủ, cần 2–3 ngày làm việc
Tại sao?
Tin vui: @nestjs/schedule đã cài sẵn (line 41 package.json) nhưng chưa được sử dụng. BotJobQueueService.enqueue() đã hoàn thiện (line 91). Tức là scaffold hạ tầng đã có ~60%.

Khó hơn dự kiến vì:

Ngày 1 (~8 tiếng)
├── Viết SchedulerService + đăng ký @Cron theo config DB     ~3h
├── Thêm handler 'DOWNLOAD_CAST' + 'AUTO_CHECK_SOD' vào
│   processQueue() của BotJobQueueService                     ~2h
├── Hàm readLatestFileInDir(folder, pattern) tự tìm file     ~1h
└── Test từng bước: cron → enqueue → job chạy               ~2h
Ngày 2 (~8 tiếng)
├── Admin UI: toggle enable/disable, set giờ, thư mục       ~3h
├── Lưu schedule config vào DB (SystemSettings)              ~1h
├── Nối thêm 3 check còn lại (KLGD, PreEOD, EOD)            ~2h
└── Email alert sau mỗi check                               ~2h
Ngày 3 (nếu cần)
└── Fix bugs, test end-to-end với dữ liệu thực               ~4h
Điều kiện để rút ngắn xuống 1.5 ngày
✅ CAST script test pass trước (cần credentials)
✅ Xác nhận email service dùng cái có sẵn của IT Tool hay viết mới
✅ Chỉ làm SOD + KLGD trước, để PreEOD/EOD sau
Kết luận: Khi nào bạn muốn bắt đầu, nói tôi để làm lần lượt — bắt đầu từ SchedulerService + processQueue handler trước sẽ nhanh nhất.