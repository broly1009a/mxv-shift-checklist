# ACTIVE_FIX_STATE.md - Trạng Thái Khắc Phục Lỗi Hệ Thống & Bộ Nhớ Phiên Làm Việc

> **Mục đích**: Lưu trữ ngữ cảnh cố định và lộ trình kỹ thuật chuẩn xác, không phỏng đoán, không bỏ sót. Mỗi lượt làm việc mới AI bắt buộc đọc file này trước tiên để biết mình đang ở đâu và làm gì tiếp theo.  
> **Cập nhật lần cuối**: 2026-11-10T12:08:00+07:00  
> **Server Production**: Ubuntu `10.0.0.26` (PM2 Backend PID: `2711248`, Frontend PID: `2665593`)  
> **Nhánh Git hiện tại**: `v10-update-permisson-request-auth-module`

---

## 1. Bảng Tổng Hợp Tiến Độ 10 Task Kỹ Thuật (Ground Truth Progress Audit)

| Task | Mô tả & File tác động | Trạng thái kỹ thuật | Testcase / Bằng chứng kiểm chứng |
| :---: | :--- | :---: | :--- |
| **Task 1** | **Bịt Endpoint công khai**<br>[`trading-recon-log.controller.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/controllers/trading-recon-log.controller.ts) | 🟢 **100% HOÀN THÀNH** | • Thêm `@UseGuards(JwtAuthGuard)`<br>• Spec `trading-recon-log.controller.spec.ts` **4/4 PASS** |
| **Task 2** | **Chống Seed tự phát & Xóa mật khẩu cứng**<br>[`seed.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/database/seed.service.ts) | 🟢 **100% HOÀN THÀNH** | • Xóa 100% mật khẩu hardcode, cấm chạy trên production, yêu cầu `ALLOW_DB_SEED=true` và `INITIAL_ADMIN_PASSWORD`<br>• Spec `seed.service.spec.ts` **4/4 PASS** |
| **Task 3** | **Chống Hardcode Secret & Bắt buộc biến môi trường**<br>[`crypto.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/shared/helpers/crypto.ts) | 🟢 **100% HOÀN THÀÝ** | • Hỗ trợ giải mã 3 tầng tương thích ngược MongoDB cũ<br>• Spec `crypto.spec.ts` **6/6 PASS** |
| **Task 4** | **Ổn định CoreCCP & Chặn Stampede**<br>[`coreccp-api.adapter.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/ingress/adapters/coreccp-api.adapter.ts) | 🟢 **100% HOÀN THÀNH** | • Mutex Lock `refreshPromise`, self-healing Basic Auth<br>• **Live Test Server 10.0.0.26: PASS trong 580ms** (User `tradingdesk`) |
| **Task 5** | **Ổn định CoreExchange & Bắt `/change-password`**<br>[`coreex-api.adapter.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/ingress/adapters/coreex-api.adapter.ts) | 🟢 **100% HOÀN THÀNH** | • Bắt lỗi chuyển hướng `/change-password`, ném `[PARTNER_SERVICE_UNAVAILABLE]`<br>• **Live Test Server 10.0.0.26: PASS trong 962ms** (User `anhdao`) |
| **Task 6** | **Dọn sạch URL hardcode & Fail-Fast**<br>[`ingress.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/ingress/ingress.service.ts) & [`ccp-scraper.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/ingress/scrapers/ccp-scraper.service.ts) | 🟡 **XONG CODE (CHỜ TEST TẢI FILE)** | • Loại bỏ URL hardcode `coreccp.mxv.com.vn`<br>• Spec `ingress-failfast.spec.ts` **4/4 PASS**<br>• *Chờ live test tải file Excel thật về disk.* |
| **Task 7** | **Rào chắn Pre-Flight Ingress Barrier**<br>[`recon-ingress-pipeline.service.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/ingress/services/recon-ingress-pipeline.service.ts) & [`klgd-recon.worker.ts`](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-modular-refactor/backend/src/modules/trading-ops/workers/klgd-recon.worker.ts) | 🟢 **100% HOÀN THÀNH** | • Ngắt ngay trước khi bật Chromium CQG nếu MS/ACM/CCP lỗi<br>• Đồng bộ trạng thái `ABORTED` kích hoạt Cooldown 15p<br>• Spec `klgd-recon.worker.spec.ts` **3/3 PASS** |
| **Task 8** | **Dọn sạch Git Index & `.gitignore`** | 🟢 **100% HOÀN THÀNH** | • Loại bỏ 285 file nháp khỏi Git tracking, commit sạch sẽ. |
| **Task 9** | **Build Verification & Architecture Boundary Gates** | 🟢 **100% HOÀN THÀNH** | • **11/11 Test Suites, 37/37 Tests PASS 100%**<br>• Module Boundary Test `module-isolation.spec.ts` **PASS**<br>• Backend `nest build`: **Exit code 0** (0 errors)<br>• Frontend `next build`: **Exit code 0** (50/50 routes) |
| **Task 10** | **Deploy lên Server 10.0.0.26 & Xác Minh Live** | 🟡 **ĐÃ HOÀN THÀNH 50%** | • Backend PM2 online PID `2711248`<br>• Đã live test Auth CoreCCP & CoreEX thành công<br>• *Cần thực hiện: Live Ingress MS API, Live SFTP ACM, Live download report.* |

---

## 2. Kế Hoạch Các Bước Kế Tiếp Cần Hoàn Thành Nốt (Next Action Items)

1. **Bước 1**: Đẩy code mới (Task 2 + Task 7 + Module Isolation fixes) lên Server `10.0.0.26`.
2. **Bước 2**: Thực hiện Live Test cho **M-System REST API** và **ACM SFTP/ETP** trên Server `10.0.0.26`.
3. **Bước 3**: Thực hiện Live Download 1 file Excel báo cáo thực tế từ CoreCCP về thư mục backup trên Server `10.0.0.26` để nghiệm thu dứt điểm Task 6.
4. **Bước 4**: Báo cáo tổng thể đầy đủ bằng chứng thực tế cho USER trước khi bật Master Switch `bot_auto_recon_enabled = true`.
