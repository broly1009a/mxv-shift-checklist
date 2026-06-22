# Agile User Stories & Sprint Backlog - MXV Trading Shift Operation Engine

Tài liệu này bóc tách từ SOP/SRS của module **Trading Shift Operation Engine** cho hệ thống **MXV Shift Checklist Digitalization**.

Stack triển khai:

```text
Backend: NestJS + MongoDB/Mongoose
Frontend: NextJS
Auth/Realtime: JWT + WebSocket nếu cần
```

Actors chính:

* **System**: Cron-job / automation engine, tự động quét, cảnh báo, backup, ghi log.
* **Operator**: Kỹ sư trực ca, thực hiện kiểm tra, tích chọn, nhập kết quả, báo cáo sự cố.
* **Approver**: Kỹ sư ca 2 / Trưởng bộ phận, phê duyệt thay đổi cấu hình hoặc thao tác rủi ro cao.
* **Admin**: Quản trị hệ thống, cấu hình checklist template, shift slot, calendar, notification rule.

---

## Epic 1 - Shift Checklist Execution

### User Story 1.1 - Thực hiện checklist đầu phiên

**As a** Operator  
**I want to** xem và thực hiện danh sách checklist đầu phiên theo đúng timeline/SLA  
**So that** tôi đảm bảo các hệ thống giao dịch sẵn sàng trước khi phiên vận hành bắt đầu.

#### Acceptance Criteria

* Operator nhìn thấy danh sách task thuộc `OPEN SESSION`.
* Mỗi task hiển thị tên task, thời gian trigger, SLA, mô tả hành động, mức ưu tiên.
* Operator có thể đánh dấu task là `PASSED`, `FAILED`, `SKIPPED`, hoặc `NEEDS_ATTENTION`.
* Operator có thể nhập ghi chú xử lý cho từng task.
* Hệ thống lưu thời gian cập nhật, người cập nhật và trạng thái task.
* Nếu task bị `FAILED` hoặc quá SLA, hệ thống ghi nhận exception event.
* Mọi thao tác phải được ghi audit log.

#### Sprint Backlog Items

* Backend NestJS:
  * Mở rộng `ChecklistTemplate.tasks` với các field: `sessionType`, `triggerTime`, `slaDeadline`, `slaWindowStart`, `slaWindowEnd`, `actionDescription`, `exceptionCode`, `priority`.
  * Mở rộng `ShiftLogDetail` hoặc `ShiftJobTaskSnapshot` với `status`, `resultNote`, `startedAt`, `completedAt`, `failedAt`.
  * Thêm API cập nhật task status: `PATCH /api/v1/shifts/items/status`.
  * Thêm audit log cho status transition.
* MongoDB:
  * Cập nhật schema task snapshot.
  * Index theo `shiftDate`, `sessionType`, `status`.
* NextJS:
  * Cập nhật checklist page để hiển thị timeline/SLA.
  * Thêm control chọn trạng thái task.
  * Hiển thị cảnh báo task quá hạn.

---

### User Story 1.2 - Kiểm tra Job Snapshot đầu ngày

**As a** Operator  
**I want to** ghi nhận kết quả kiểm tra email Job Snapshot lúc 05h00  
**So that** hệ thống xác định dữ liệu đầu ngày đã sẵn sàng hoặc cần phối hợp Newgen xử lý.

#### Acceptance Criteria

* Task `Kiểm tra Job Snapshot Đầu Ngày` được sinh trong checklist đầu phiên.
* Trigger time mặc định là `05:00`.
* Operator có thể chọn kết quả `SUCCESS` hoặc `FAILED`.
* Nếu chọn `FAILED`, hệ thống tự tạo exception `IF_SNAPSHOT_FAILED`.
* Exception yêu cầu hành động bắt buộc: phối hợp Newgen xử lý kết chuyển dữ liệu.
* Exception phải hiển thị trên dashboard và trong lịch sử sự cố.

#### Sprint Backlog Items

* Backend NestJS:
  * Seed template task cho Job Snapshot.
  * Thêm exception creation service.
  * Thêm endpoint lấy exception theo shift job.
* MongoDB:
  * Tạo schema `OperationalException` nếu chưa có.
  * Fields: `code`, `taskId`, `jobId`, `severity`, `requiredAction`, `status`, `detectedAt`, `resolvedAt`.
* NextJS:
  * Hiển thị exception banner trong checklist.
  * Thêm quick action "Tạo ghi chú phối hợp Newgen".

---

### User Story 1.3 - Đối chiếu và chạy EOD MS

**As a** Operator  
**I want to** thực hiện đối chiếu dữ liệu T-1 giữa M-System, CQG và ACM trong khung 06h00-07h00  
**So that** dữ liệu EOD chính xác trước khi khởi tạo ngày giao dịch mới.

#### Acceptance Criteria

* Task hiển thị SLA window `06:00 - 07:00`.
* Operator có thể nhập kết quả đối chiếu từng nền tảng.
* Operator có thể xác nhận Settlement Price chính xác.
* Operator có thể xác nhận đã kích hoạt chạy EOD thủ công.
* Nếu quá `07:30` mà task chưa hoàn tất, hệ thống tạo exception `SLA_BREACH_0730`.
* Exception yêu cầu gửi thông báo lùi thời gian EOD và sao kê thủ công cho TVKD.

#### Sprint Backlog Items

* Backend NestJS:
  * Thêm task fields cho reconciliation checklist.
  * Thêm SLA monitor service dạng cron quét task quá hạn.
  * API ghi nhận reconciliation result.
* MongoDB:
  * Tạo embedded field `checkResults` hoặc collection `TaskExecutionEvidence`.
  * Lưu `platform`, `status`, `note`, `evidenceUrl`.
* NextJS:
  * UI nhập kết quả đối chiếu M-System/CQG/ACM.
  * Hiển thị countdown hoặc overdue state.

---

### User Story 1.4 - Xử lý Post-EOD và lỗi dữ liệu sau EOD

**As a** Operator  
**I want to** ghi nhận backup file EOD và xử lý lỗi dữ liệu sau EOD trong SLA 5 phút  
**So that** dữ liệu vận hành được lưu trữ và khắc phục kịp thời khi phát sinh lỗi.

#### Acceptance Criteria

* Task Post-EOD chỉ được kích hoạt sau khi EOD thành công.
* Operator có thể xác nhận backup file EOD.
* Operator có thể ghi nhận danh sách tài khoản âm ký quỹ đầu ngày.
* Nếu phát hiện lỗi dữ liệu, hệ thống tạo exception `IF_POST_EOD_ERROR`.
* Exception có SLA xử lý 5 phút.
* Khi exception resolved, hệ thống ghi nhận kết quả gửi email thông báo.

#### Sprint Backlog Items

* Backend NestJS:
  * Thêm dependency rule giữa task EOD và Post-EOD.
  * Thêm exception SLA timer.
  * API resolve exception.
* MongoDB:
  * Thêm field `dependsOnTaskIds`.
  * Thêm `OperationalException.slaDeadlineAt`.
* NextJS:
  * Disable task Post-EOD cho đến khi EOD task hoàn tất.
  * UI resolve exception và ghi kết quả.

---

### User Story 1.5 - Khởi tạo ngày mới SOD

**As a** Operator  
**I want to** thực hiện Start of Day trong vòng 30 phút sau khi EOD được xác nhận  
**So that** hệ thống M-System sẵn sàng cho ngày giao dịch mới.

#### Acceptance Criteria

* Task SOD được mở sau khi EOD confirmed.
* SLA deadline được tính tự động: EOD confirmed time + 30 phút.
* Operator có thể ghi nhận kết quả SOD.
* Nếu SOD lỗi, tạo exception `IF_SOD_ERROR`.
* Task gửi sao kê TKGD thủ công trước 08h00 được hiển thị là manual backup action.

#### Sprint Backlog Items

* Backend NestJS:
  * Thêm dynamic SLA deadline calculation.
  * Thêm manual backup action task type.
* MongoDB:
  * Thêm `slaType: FIXED_TIME | DYNAMIC_AFTER_TASK`.
  * Thêm `manualBackupAction`.
* NextJS:
  * Hiển thị deadline động.
  * Hiển thị task song song/manual backup action.

---

## Epic 2 - During Session Operations

### User Story 2.1 - Thay đổi ký quỹ theo Maker-Checker

**As a** Operator  
**I want to** tạo yêu cầu thay đổi ký quỹ hàng hóa trong phiên  
**So that** thay đổi chỉ có hiệu lực sau khi Approver kiểm tra và phê duyệt.

#### Acceptance Criteria

* Operator ca 1 có thể tạo bản ghi thay đổi ký quỹ.
* Bản ghi ban đầu có trạng thái `PENDING_APPROVAL`.
* Người tạo không được tự phê duyệt bản ghi của mình.
* Approver ca 2 hoặc Trưởng bộ phận có thể approve/reject.
* Khi approve, hệ thống ghi nhận approver, thời gian duyệt, nội dung duyệt.
* Tất cả thao tác tạo/duyệt/từ chối phải có audit log.

#### Sprint Backlog Items

* Backend NestJS:
  * Tạo module `margin-change-requests`.
  * API create/list/detail/approve/reject.
  * Guard kiểm tra maker khác checker.
* MongoDB:
  * Schema `MarginChangeRequest`: `commodity`, `oldMargin`, `newMargin`, `effectiveSession`, `status`, `createdBy`, `approvedBy`.
* NextJS:
  * Form tạo yêu cầu thay đổi ký quỹ.
  * Inbox phê duyệt cho Approver.
  * Badge trạng thái approval.

---

### User Story 2.2 - Giám sát đối chiếu realtime định kỳ

**As a** System  
**I want to** tạo checklist đối chiếu realtime mỗi 1 giờ  
**So that** Operator không bỏ sót việc kiểm tra cân bằng dữ liệu giữa M-System và CQG.

#### Acceptance Criteria

* Hệ thống sinh hoặc nhắc task đối chiếu realtime mỗi 1 giờ trong phiên.
* Operator có thể ghi nhận kết quả cân bằng hoặc lệch dữ liệu.
* Nếu lệch dữ liệu, tạo exception `UNBALANCED_DATA`.
* Exception yêu cầu phân loại nguyên nhân: thiếu cấu hình hoặc mất đồng bộ tin nhắn.
* Dashboard hiển thị số lần đối chiếu đã hoàn thành trong phiên.

#### Sprint Backlog Items

* Backend NestJS:
  * Thêm recurring task support.
  * Cron/scheduler tạo task instance theo frequency.
  * Exception rule cho unbalanced data.
* MongoDB:
  * Thêm `frequencyMinutes`.
  * Thêm `recurrenceGroupId`.
* NextJS:
  * UI nhóm các lần kiểm tra định kỳ.
  * Dashboard frequency compliance.

---

### User Story 2.3 - Quản lý danh mục hợp đồng theo tháng

**As a** Operator  
**I want to** mở mới các hợp đồng Futures, Spreads, ACM theo định kỳ tháng  
**So that** danh mục hợp đồng luôn sẵn sàng và tuân thủ giới hạn tối đa 1 năm.

#### Acceptance Criteria

* Operator có thể tạo checklist mở mới hợp đồng theo tháng.
* Hệ thống validate không cho mở hợp đồng quá 1 năm từ ngày hiện tại.
* Hợp đồng có loại: `FUTURES`, `SPREADS`, `ACM`.
* Mọi thay đổi danh mục hợp đồng được audit.

#### Sprint Backlog Items

* Backend NestJS:
  * Tạo module `contract-catalog`.
  * API create/update/list contract setup task.
  * Validate max maturity date <= today + 1 year.
* MongoDB:
  * Schema `ContractCatalogItem`.
* NextJS:
  * Page quản lý hợp đồng.
  * Form validate ngày đáo hạn.

---

### User Story 2.4 - Giám sát tất toán hợp đồng đáo hạn

**As a** Operator  
**I want to** theo dõi các hợp đồng đến hạn tất toán và ghi nhận hành động xử lý  
**So that** TVKD được thông báo đúng hạn và hệ thống có thể force close khi cần.

#### Acceptance Criteria

* Hệ thống hiển thị danh sách hợp đồng đến hạn theo commodity rule.
* Operator có thể ghi nhận đã gửi thông báo tất toán cho TVKD.
* Nếu TVKD không tự xử lý đúng hạn, Operator có thể ghi nhận action hủy lệnh chờ và force close.
* Force close là hành động rủi ro cao và cần quyền phù hợp.
* Tất cả action phải có audit log.

#### Sprint Backlog Items

* Backend NestJS:
  * API maturity monitoring.
  * Action log cho notify/cancel pending orders/force close.
  * Role guard cho force close.
* MongoDB:
  * Schema `ContractMaturityAction`.
* NextJS:
  * UI maturity list.
  * Confirmation modal cho force close.

---

### User Story 2.5 - Báo cáo định kỳ Ban Giám Sát

**As a** Operator  
**I want to** nhận nhắc việc và ghi nhận báo cáo tại các mốc 16h00, 23h00, 05h00  
**So that** dữ liệu giao dịch phát sinh được gửi đúng hạn cho Ban Giám Sát.

#### Acceptance Criteria

* Hệ thống tạo task báo cáo tại 16h00, 23h00, 05h00.
* Operator có thể upload/đính kèm hoặc ghi link file báo cáo.
* Task ghi nhận kênh gửi: Whatsapp API hoặc thủ công.
* Nếu quá hạn chưa gửi, task chuyển trạng thái overdue.
* Dashboard hiển thị trạng thái báo cáo định kỳ.

#### Sprint Backlog Items

* Backend NestJS:
  * Scheduled report task generator.
  * API update report delivery result.
* MongoDB:
  * Fields: `reportType`, `deliveryChannel`, `fileLocation`, `sentAt`.
* NextJS:
  * UI report milestone checklist.
  * Badge delivered/overdue.

---

## Epic 3 - Close Session Operations

### User Story 3.1 - Sao lưu EOD cuối phiên

**As a** System  
**I want to** hỗ trợ kiểm soát thứ tự backup cuối phiên  
**So that** CE và ACM được backup trước các phân hệ khác theo đúng priority constraint.

#### Acceptance Criteria

* Checklist close session có task backup các phân hệ: M-System, CQG, ACM, CE/CCP.
* CE và ACM phải được đánh dấu là priority backup.
* Operator không thể hoàn tất close session nếu CE/ACM chưa được xác nhận backup.
* Operator có thể ghi nhận file location của báo cáo cuối ngày.
* Hệ thống lưu audit log cho từng backup confirmation.

#### Sprint Backlog Items

* Backend NestJS:
  * Add task priority/dependency validation before close.
  * API close session validation.
* MongoDB:
  * Add `blockingBeforeClose`, `backupPriority`.
* NextJS:
  * Disable close button nếu required backup chưa xong.
  * UI nhập file location.

---

## Epic 4 - Exception Management

### User Story 4.1 - Ghi nhận sự cố mạng/phần mềm

**As a** Operator  
**I want to** tạo sự cố khi phát hiện mất kết nối API hoặc lỗi phần mềm  
**So that** các bên liên quan được thông báo và toàn bộ diễn biến được lưu vết.

#### Acceptance Criteria

* Operator có thể tạo incident loại `SYSTEM_OR_NETWORK_ERROR`.
* Incident lưu thời gian phát hiện.
* Hệ thống tính SLA thông báo Newgen/CNTT trong 5 phút.
* Hệ thống tính SLA thông báo ĐVNV/TVKD trong 10 phút.
* Operator có thể ghi nhận recovery action.
* Khi resolved, Operator có thể ghi nhận đã kiểm tra đối chiếu chéo và gửi email khắc phục.
* Incident được đưa vào báo cáo mẫu `01/QT/TVH`.

#### Sprint Backlog Items

* Backend NestJS:
  * Tạo module `incidents`.
  * API create/update/resolve/list incidents.
  * SLA fields và overdue calculation.
* MongoDB:
  * Schema `Incident`.
  * Schema `IncidentTimeline`.
* NextJS:
  * Incident form.
  * Incident timeline.
  * SLA countdown.

---

### User Story 4.2 - Xử lý lệch dữ liệu lệnh/giao dịch

**As a** Operator  
**I want to** phân loại nguyên nhân lệch dữ liệu và ghi nhận hướng xử lý  
**So that** hệ thống theo dõi được việc khắc phục thiếu cấu hình hoặc mất đồng bộ tin nhắn.

#### Acceptance Criteria

* Operator có thể tạo incident loại `UNBALANCED_DATA`.
* Trong 30 phút phải nhập nguyên nhân kỹ thuật và danh sách tài khoản bị lệch.
* Operator chọn root cause: `MISSING_CONFIGURATION` hoặc `MESSAGE_SYNC_LOSS`.
* Nếu thiếu cấu hình, ghi nhận đã thông báo TVKD qua room hỗ trợ nghiệp vụ.
* Nếu mất đồng bộ, ghi nhận đã gọi API/tiến trình Newgen pull lệnh thiếu.
* Incident có trạng thái resolved sau khi kiểm tra cân bằng lại thành công.

#### Sprint Backlog Items

* Backend NestJS:
  * Add incident root cause workflow.
  * API attach affected accounts.
  * API mark rebalanced.
* MongoDB:
  * `affectedAccounts`, `rootCause`, `technicalCause`, `remediationAction`.
* NextJS:
  * Root cause selection UI.
  * Affected account input/table.

---

### User Story 4.3 - Tiếp nhận yêu cầu/khiếu nại từ TVKD

**As a** Operator  
**I want to** ghi nhận và xử lý yêu cầu/khiếu nại từ TVKD trong vòng 15 phút  
**So that** phản hồi kỹ thuật được chuẩn hóa và có lịch sử truy vết.

#### Acceptance Criteria

* Operator có thể tạo case loại `MEMBER_REQUEST_OR_COMPLAINT`.
* Case lưu nguồn tiếp nhận: Microsoft Teams hoặc Email.
* Hệ thống tính SLA tiếp nhận 15 phút.
* Operator có thể tra cứu/gắn log liên quan.
* Operator ghi nhận nguyên nhân gốc rễ và nội dung phản hồi.
* Case được đóng khi đã phản hồi TVKD.

#### Sprint Backlog Items

* Backend NestJS:
  * Add `support-cases` module or reuse `incidents` with type.
  * API create/update/close case.
* MongoDB:
  * Fields: `sourceChannel`, `receivedAt`, `acceptedAt`, `rootCause`, `responseSummary`.
* NextJS:
  * Support case form.
  * SLA receive badge.

---

## Epic 5 - Notification & SLA Monitoring

### User Story 5.1 - Cấu hình notification rule

**As an** Admin  
**I want to** cấu hình rule gửi thông báo theo loại sự kiện  
**So that** hệ thống không hardcode người nhận và có thể thay đổi khi nghiệp vụ chốt yêu cầu.

#### Acceptance Criteria

* Admin có thể tạo rule theo `eventType`.
* Rule có thể giới hạn theo department, shift slot, priority.
* Rule có thể chọn channel: Telegram, Email, Web, Manual.
* Rule có thể bật/tắt.
* Notification attempt được ghi log.

#### Sprint Backlog Items

* Backend NestJS:
  * Module `notifications`.
  * CRUD notification channels/rules/logs.
  * Notification dispatcher stub.
* MongoDB:
  * `NotificationChannel`, `NotificationRule`, `NotificationLog`.
* NextJS:
  * Admin notification config page.
  * Notification log viewer.

---

### User Story 5.2 - Theo dõi SLA task và incident

**As a** System  
**I want to** quét các task/incident có SLA và đánh dấu overdue  
**So that** dashboard có thể cảnh báo đúng các rủi ro vận hành.

#### Acceptance Criteria

* System cron chạy định kỳ để kiểm tra SLA.
* Task/incident chưa hoàn tất quá deadline được đánh dấu overdue.
* Mỗi lần phát hiện overdue tạo system log.
* Nếu có notification rule active, tạo notification log.
* Không hardcode recipient khi rule chưa cấu hình.

#### Sprint Backlog Items

* Backend NestJS:
  * SLA monitor service.
  * Cron every minute or configurable interval.
  * Emit WebSocket event `sla-breached`.
* MongoDB:
  * Add `slaStatus`, `slaBreachedAt`.
* NextJS:
  * Dashboard overdue cards.
  * Checklist/incident overdue badge.

---

## Epic 6 - Reporting & Audit

### User Story 6.1 - Xem lịch sử vận hành theo ca

**As an** Approver  
**I want to** xem toàn bộ lịch sử thao tác trong một ca trực  
**So that** tôi có thể hậu kiểm và truy vết khi có sự cố.

#### Acceptance Criteria

* Approver xem được timeline task updates, incident updates, approval actions.
* Timeline hiển thị actor, timestamp, action, before/after nếu có.
* Có filter theo event type.
* Dữ liệu không cho phép sửa/xóa từ UI.

#### Sprint Backlog Items

* Backend NestJS:
  * Aggregate audit endpoint by shift job.
  * Normalize audit/activity/system logs.
* MongoDB:
  * Ensure indexes by `jobId`, `createdAt`.
* NextJS:
  * Timeline audit component.

---

### User Story 6.2 - Xuất báo cáo sự cố mẫu 01/QT/TVH

**As an** Operator  
**I want to** xuất báo cáo sự cố theo mẫu 01/QT/TVH  
**So that** sự cố mạng/phần mềm và lỗi giao dịch được báo cáo theo chuẩn nội bộ.

#### Acceptance Criteria

* Operator chọn incident và xuất báo cáo.
* Báo cáo bao gồm timeline, nguyên nhân, hành động xử lý, kết quả khắc phục.
* Báo cáo có thể xuất CSV/PDF/DOCX tùy giai đoạn triển khai.
* File export được ghi nhận vào incident history.

#### Sprint Backlog Items

* Backend NestJS:
  * Export endpoint.
  * Report payload builder.
* MongoDB:
  * Store export metadata.
* NextJS:
  * Export button.
  * Report preview basic.

---

## Epic 7 - Dynamic Checklist & SLA Configuration

### User Story 7.1 - Cấu hình checklist template động

**As an** Admin  
**I want to** thêm, sửa, xóa, và kích hoạt/vô hiệu hóa các đầu việc (task) trong checklist template trực tiếp trên Web UI  
**So that** tôi có thể tinh chỉnh quy trình trực ca theo các quyết định nghiệp vụ mới mà không cần chỉnh sửa mã nguồn.

#### Acceptance Criteria

* Admin có quyền truy cập vào màn hình quản trị cấu hình mẫu (Checklist Template Admin Portal).
* Hỗ trợ tạo mới/cập nhật đầu việc với các thuộc tính: `taskName`, `sessionType` (OPEN/DURING/CLOSE), `triggerTime`, `slaDeadline`, `priority` (LOW/MEDIUM/HIGH), và `actionDescription`.
* Hỗ trợ thiết lập trạng thái `isActive` (bật/tắt đầu việc).
* Hỗ trợ cấu hình `dependsOnTaskIds` (danh sách ID đầu việc cần hoàn thành trước).
* Khi Admin cập nhật template, các ca trực đang chạy (active shift jobs) sẽ giữ nguyên snapshot cũ để tránh làm sai lệch dữ liệu hiện tại, các ca trực tiếp theo sẽ được tạo theo template mới.

#### Sprint Backlog Items

* Backend NestJS:
  * CRUD API cho `ChecklistTemplate` (`/api/v1/admin/templates`).
  * Cơ chế snapshot isolation: Khi shift job được sinh, hệ thống sao chép template hiện hành vào `ShiftJobTaskSnapshot` thay vì tham chiếu trực tiếp.
* MongoDB:
  * Schema `ChecklistTemplate`: `_id`, `departmentCode`, `sessionType`, `isActive`, `version`, `tasks: [{ taskId, taskName, triggerTime, slaDeadline, priority, actionDescription, dependsOnTaskIds, isActive }]`.
* NextJS:
  * Giao diện Checklist Template Editor cho Admin.
  * Form UI để thêm/sửa/xóa và thay đổi thứ tự sắp xếp của từng task.

---

### User Story 7.2 - Cấu hình tham số SLA và thời gian ca trực động

**As an** Admin  
**I want to** cấu hình thời gian bắt đầu/kết thúc các ca trực (Shift Slots) và các cảnh báo trễ SLA  
**So that** hệ thống tự động tính toán thời hạn SLA dựa trên giờ thực tế thay vì hardcode.

#### Acceptance Criteria

* Admin có thể thay đổi thời gian bắt đầu và kết thúc của các Shift Slots (ví dụ: Ca 1 từ 05h00 - 13h00, Ca 2 từ 13h00 - 21h00...).
* Hỗ trợ cấu hình `gracePeriodMinutes` (thời gian ân hạn trước khi đánh dấu quá hạn SLA).
* Hỗ trợ chọn kiểu tính SLA cho mỗi task: `FIXED_TIME` (mốc giờ cứng như EOD lúc 07h30) hoặc `DYNAMIC_AFTER_TASK` (tính từ thời điểm task trước đó được tích xong + X phút).

#### Sprint Backlog Items

* Backend NestJS:
  * CRUD API cho `ShiftSlotConfig` (`/api/v1/admin/shift-slots`).
  * Service tính toán dynamic deadline khi job khởi tạo hoặc task trước đó hoàn tất.
* MongoDB:
  * Schema `ShiftSlotConfig`: `_id`, `departmentCode`, `shiftName`, `startTime`, `endTime`, `gracePeriodMinutes`.
* NextJS:
  * Giao diện cấu hình Ca trực và tham số SLA.

---

## Recommended Sprint Plan

### Sprint 2A - Technical Foundation

Mục tiêu: dựng nền kỹ thuật không phụ thuộc requirement chi tiết.

Backlog:

* Production dashboard APIs.
* Notification skeleton.
* System log schema.
* SLA placeholder fields.
* WebSocket event naming.
* Dashboard dùng dữ liệu thật thay vì mock.

### Sprint 2B - SOP Checklist Expansion

Mục tiêu: đưa các task OPEN/DURING/CLOSE trong SOP vào checklist engine.

Backlog:

* Seed SOP task templates.
* Task status mở rộng.
* SLA window/deadline.
* Dependency task.
* Recurring task.
* Checklist UI nâng cấp.

### Sprint 2C - Exception Management

Mục tiêu: quản lý incident và exception workflow.

Backlog:

* Operational exception schema.
* Incident module.
* SLA breach monitor.
* Exception dashboard.
* Incident timeline.

### Sprint 2D - Maker-Checker & High-Risk Actions

Mục tiêu: triển khai approval workflow cho các thao tác rủi ro cao.

Backlog:

* Margin change request.
* Approval/reject workflow.
* Maker-checker guard.
* Approval inbox UI.

### Sprint 2E - Dynamic Configurations

Mục tiêu: triển khai giao diện Web UI và API cho phép Admin cấu hình động danh sách công việc, thời gian trực ca và các tham số SLA mà không cần sửa code/database thủ công.

Backlog:

* CRUD API cho Checklist Template (`ChecklistTemplate`).
* CRUD API cho cấu hình ca trực (`ShiftSlotConfig`).
* Giao diện Checklist Template Editor cho Admin.
* Giao diện cấu hình ca trực và tham số SLA.
* Cơ chế snapshot template khi tạo ca trực (Active Shift Job).

### Sprint 3 - Automation & Integration

Mục tiêu: triển khai bot/automation thật sau khi có requirement đầy đủ.

Backlog:

* Bot engine.
* Automated validation rules.
* Reconciliation connectors.
* Notification sending integrations.
* Report export nâng cao.

---

## Definition of Done

Một User Story được coi là hoàn thành khi:

* Backend API hoàn thiện và có guard phù hợp.
* MongoDB schema/index được cập nhật.
* Frontend có UI đủ dùng cho actor tương ứng.
* Audit/system log được ghi cho thao tác quan trọng.
* Không phá vỡ luồng Sprint 1: generate job, execute checklist, close job, history.
* `npm run build` backend/frontend chạy thành công hoặc lỗi được ghi rõ là pre-existing.
* Có hướng dẫn test thủ công cho story đó.

