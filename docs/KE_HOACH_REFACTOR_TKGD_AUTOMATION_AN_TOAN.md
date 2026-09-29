# Kế hoạch refactor TKGD Automation an toàn

## 1. Mục tiêu

Giảm độ phức tạp của `backend/src/modules/tkgd-automation/tkgd-automation.service.ts` mà không làm thay đổi behavior của luồng production đang hoạt động.

Mục tiêu thực tế:

- Không ép service chính xuống 300 dòng.
- Giảm dần từ khoảng 4.500 dòng xuống khoảng 2.500-3.500 dòng nếu không cần tách luồng rủi ro cao.
- Mỗi nghiệp vụ chỉ có một implementation đang được sử dụng.
- Có test bảo vệ trước khi xóa fallback hoặc chuyển ownership.
- Mỗi phase có thể rollback độc lập.

## 2. Phạm vi không được thay đổi trong giai đoạn đầu

Giữ nguyên trong `TkgdAutomationService` cho đến khi có test integration và cơ chế khóa phù hợp:

- `syncMailOpeningAccounts()` và toàn bộ Graph API/attachment ingestion.
- `syncMSystemAccounts()` và Playwright login/scraping.
- `reparseAccount()` và Python OCR/document extraction.
- `runReconciliation()` cùng các thao tác ghi kết luận vào MongoDB.
- `runPipelineAll()`.
- `runAutoPipelineCycle()`.
- `handleCronAutoPipeline()` và `handleCronAutoReconcilePending()`.
- Các bulk operation có thể ghi đồng thời vào cùng hồ sơ.

Không chạy implementation cũ và implementation mới song song nếu cả hai cùng ghi vào `CleanAccountRecord`.

## 3. Phần được phép tách

### 3.1 Đã hoàn tất

- Helper thuần trong `tkgd-automation.helpers.ts`:
  - parse/format/normalize ngày.
  - kiểm tra ngày.
  - chuẩn hóa tên.
  - so sánh giới tính.
  - suy luận giới tính/năm sinh từ CCCD.
- Activity log read path: `getActivityLogs()` delegate sang `TkgdQueryAnalyticsService`.
- `getTkgdStats()` delegate sang `TkgdQueryAnalyticsService`.
- `getLatestExcelFilePath()` delegate sang `TkgdQueryAnalyticsService`.
- `TkgdQueryAnalyticsService` đã là dependency bắt buộc của Facade.

### 3.2 Được tách tiếp sau khi có test

- `getRecords()` và grouping read-only.
- `getAnalyticsSummary()`.
- `getAccountFilesManifest()`.
- `resolveAttachmentFilePath()`.
- Các hàm pure còn nằm trong service nếu chưa được dùng bởi side effect.

### 3.3 Chưa tách

- M-System browser/session.
- Mail ingest.
- OCR/reparse.
- Cron/auto-pipeline.
- Reconciliation có write side effect.

## 4. Nguyên tắc ownership

| Miền nghiệp vụ | Owner hiện tại trong giai đoạn an toàn |
|---|---|
| Mail ingestion | `TkgdAutomationService` |
| M-System scraping | `TkgdAutomationService` |
| OCR/reparse | `TkgdAutomationService` |
| Reconciliation write | `TkgdAutomationService` |
| Query/read-only | `TkgdQueryAnalyticsService` |
| Activity log read | `TkgdQueryAnalyticsService` |
| Progress | Chưa chuyển ownership; phải chọn một store duy nhất trước |
| Cron/pipeline | `TkgdAutomationService` |
| Realtime thử nghiệm | `TkgdRealtimePipelineService`, chỉ qua endpoint/feature đã định |

Không inject ngược `TkgdAutomationService` vào sub-service. Không tạo circular dependency.

## 5. Lộ trình thực hiện

### Phase 0: Baseline và rollback

1. Xác nhận backend build được bằng `npm.cmd run build`.
2. Ghi nhận các lỗi nền ngoài phạm vi refactor.
3. Tạo commit hoặc tag riêng trước mỗi phase.
4. Không dùng `git reset --hard` hoặc khôi phục file ngoài ý muốn.

### Phase 1: Pure helpers

Trạng thái: đã thực hiện.

Kiểm tra bắt buộc:

```powershell
Push-Location backend
npm.cmd run build
Pop-Location
```

### Phase 2: Query read-only

Thứ tự:

1. `getActivityLogs()`.
2. `getTkgdStats()`.
3. `getLatestExcelFilePath()`.
4. Bổ sung test cho `getRecords()`.
5. Chỉ sau khi test đủ mới xóa fallback `getRecords()` trong Facade.
6. Tiếp tục với `getAnalyticsSummary()`.
7. Cuối cùng là manifest/path resolver vì có filesystem và enrichment bất đồng bộ.

Test tối thiểu cho `getRecords()`:

- grouping base account và sub-account.
- status precedence: `LECH` > `CAN_KIEM_TRA` > `KHOP` > `KHOP_TEXT` > `CHUA_XU_LY`.
- filter status.
- search.
- pagination.
- ACM/LME/SPREAD/FUTURES.
- soft warning chuyển `KHOP` thành `CAN_KIEM_TRA`.
- bù trừ HĐ/CCCD.

Lệnh kiểm tra:

```powershell
Push-Location backend
npm.cmd test -- --runInBand modules/tkgd-automation/services/tkgd-query-analytics.service.spec.ts
npm.cmd run build
Pop-Location
```

### Phase 3: Reconciliation pure logic

Chỉ tách các hàm không tự ghi MongoDB:

- status precedence.
- normalize dữ liệu trước khi so sánh.
- evaluate rule.
- infer CCCD.

Rule engine phải có input/output test độc lập. Hàm có `updateOne`, `updateMany`, `save` vẫn giữ ở owner hiện tại.

### Phase 4: File utilities

Có thể tách `TkgdFileService` sau khi xác định rõ:

- path nào được phép truy cập.
- path traversal policy.
- batchDate fallback.
- thứ tự ưu tiên thư mục.
- behavior khi file không tồn tại.

Không chuyển phần OCR enrichment vào file service.

### Phase 5: Đánh giá lại các miền rủi ro cao

Chỉ thực hiện khi có đủ:

- integration test với MongoDB test database.
- lock theo user/account.
- idempotency key.
- cancellation thật cho timeout.
- write contract rõ ràng.
- metric so sánh output cũ/mới.

Nếu thiếu một trong các điều kiện trên, giữ nguyên logic chính.

## 6. Các rủi ro phải kiểm soát

### 6.1 Hai nguồn progress

Hiện có nguy cơ Facade và `TkgdProgressService` cùng giữ state. Không chuyển realtime traffic sang progress service cho đến khi controller đọc cùng một source of truth.

### 6.2 Persistent browser dùng chung user

Không dùng một `page/context` toàn cục cho nhiều user nếu chưa có session isolation hoặc global queue. Không chuyển traffic production sang persistent browser chỉ vì build thành công.

### 6.3 Timeout không hủy task

`Promise.race()` chỉ trả timeout, không tự hủy OCR/Playwright task. Trước khi tách pipeline phải có cancellation hoặc job state để tránh cycle cũ tiếp tục ghi database.

### 6.4 Ghi đè MongoDB

Các flow mail, OCR, MS và reconciliation có thể cùng cập nhật một record. Mọi migration phải xác định field ownership và thứ tự ghi.

## 7. Quy tắc rollback

Mỗi phase phải đáp ứng:

- Có một commit riêng.
- Không đổi schema database nếu không cần.
- Không đổi public API của controller.
- Có thể khôi phục bằng cách đưa Facade adapter về implementation cũ.
- Không xóa fallback cùng lúc với việc đổi behavior.

Nếu test fail hoặc output dashboard thay đổi ngoài dự kiến:

1. Giữ nguyên service mới để phân tích.
2. Khôi phục adapter về owner cũ.
3. Không tiếp tục phase kế tiếp.
4. Ghi lại input gây khác biệt thành regression test.

## 8. Definition of Done

Một phase chỉ được coi là hoàn tất khi:

- `npm.cmd run build` thành công.
- Test liên quan pass.
- Không có duplicate owner đang chạy.
- Controller vẫn giữ nguyên response contract.
- Không có thay đổi ngoài phạm vi trong MongoDB output.
- Có cách rollback rõ ràng.
- Facade giảm code nhưng không tăng độ khó trace flow chính.

## 9. Kết luận

Đây là refactor kiểu strangler migration, không phải rewrite. Luồng chính được giữ nguyên; chỉ phần pure/read-only được chuyển dần sang service chuyên trách. Mục tiêu thành công là code dễ đọc và dễ kiểm thử hơn, không phải đạt một con số dòng code cố định.
