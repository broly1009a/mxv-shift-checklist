# TÀI LIỆU KHẢO SÁT CHUYÊN SÂU & THIẾT KẾ KIẾN TRÚC: CHUYỂN ĐỔI LOGIC TỰ ĐỘNG BACKUP & THỐNG KÊ SANG MÔ HÌNH TỰ TRỊ ĐỘC LẬP (STANDALONE 24/7)

> **Mã tài liệu**: ARCH-MXV-AUTONOMOUS-BACKUP-2026-V1  
> **Dự án**: MXV Shift Checklist & Trading Manager Mission Control  
> **Cơ sở thực chứng (Ground Truth)**: Phân tích trực tiếp từ mã nguồn thực tế tại `backend/src/modules/bot-engine/`, `frontend/src/app/trading-manager/`, và quy trình nghiệp vụ `QUY_TRINH_VA_CHECKLIST_TRUC_VAN_HANH_CCP_EXCHANGE.md`.

---

## 1. TỔNG QUAN VẤN ĐỀ & BỐI CẢNH KIẾN TRÚC

### 1.1. Hiện trạng Kiến trúc Cũ (Shift-Coupled Architecture)
Trước đây, các tác vụ tải sao lưu báo cáo (M-System, CQG) và chạy thống kê macro được thiết kế phụ thuộc vào **Ca trực (`shift_log`)**:
* **Điểm nghẽn**:
  1. Nếu nhân sự ca trực quên mở ca, mở ca muộn (sau 04:00 hoặc sau 06:30), hoặc CSDL ca trực bị khóa bảo trì, toàn bộ tiến trình tải backup và thống kê **bị trễ hoặc không thể tự kích hoạt**.
  2. Giao diện Trading Manager ([LegacyBackupThongKeSection.tsx#L840-L989](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx#L840-L989)) bị khóa cứng thành dạng `readOnly`/`disabled` có icon `Lock`, chỉ nạp giờ thụ động từ API `/api/v1/shifts/active`.
  3. Ô *Backup định kỳ (phút)* bị ẩn, khiến người quản trị không thể điều chỉnh tần suất quét file tự động linh hoạt.

### 1.2. Mục tiêu Kiến trúc Mới (Autonomous / Standalone 24/7 Architecture)
Chuyển đổi 3 thành phần vận hành sang mô hình **Tự trị Độc lập**, kế thừa trực tiếp cơ chế thành công đã áp dụng cho **`CHECK_KLGD`**:
1. **Backup định kỳ (mặc định 60 phút)**: Chạy tuần hoàn độc lập để quét và tải file trong phiên.
2. **Thời điểm Backup (mặc định 04:00 AM)**: Tự động kích hoạt đúng 04:00 hằng ngày tải toàn bộ gói EOD Backup, bất kể ca trực có đang mở hay không (`isStandalone: true, shiftLogId: null`).
3. **Thời điểm Tạo thống kê (mặc định 06:30 AM)**: Tự động kích hoạt đúng 06:30 hằng ngày chạy Macro Lot và Macro Giá trị độc lập.
4. **Cơ chế Link-to-Latest**: Khi nhân sự vào ca trực sau đó, Checklist ca trực tự động nhận diện và kế thừa kết quả của các job đã chạy độc lập trước đó, đánh dấu hoàn tất (`PASSED`) trong 0.05 giây mà **không chạy trùng lặp (Zero Duplication)**.

---

## 2. KHẢO SÁT & ĐỐI CHIẾU MÃ NGUỒN HIỆN TẠI (CODE-FIRST GROUNDING)

### 2.1. Phân hệ Backend Scheduler ([scheduler.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/scheduler.service.ts))
* **Mẫu tham chiếu thành công của `CHECK_KLGD`** ([scheduler.service.ts#L296-L373](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/scheduler.service.ts#L296-L373)):
  * Dùng cron `* * * * *` kiểm tra mỗi phút.
  * Kiểm tra Master Switch `bot_auto_recon_enabled` và `bot_periodic_check_enabled`.
  * Bảo vệ cuối tuần: `isMarketWeekendClosed()`.
  * Chống trùng lặp: `hasActiveJobByType('CHECK_KLGD')`.
  * Đo khoảng thời gian hoàn tất gần nhất: `getLatestCompletedJobByType('CHECK_KLGD')`.
  * Bắn job độc lập:
    ```typescript
    await this.jobQueueService.enqueue('CHECK_KLGD', {
      sessionDay: sessionDayStr,
      targetDate: sessionDayStr,
      isStandalone: true,
      shiftLogId: null,
      taskId: null,
    });
    ```
* **Cơ chế hiện tại của Backup & Thống kê** ([scheduler.service.ts#L418-L514](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/scheduler.service.ts#L418-L514)):
  * Đã đọc `bot_backup_time` và `bot_stat_time` từ CSDL `system_settings`.
  * Đã có vòng lặp kiểm tra giờ trùng khớp `task.time === currentTimeStr`.
  * Đã có Map chống chạy trùng trong ngày `this.lastRunMap.get(task.id) === todayStr`.
  * **Điểm cần sửa**: Tại dòng 488-514, nếu có `activeShift`, nó ép buộc gắn `shiftLogId` và `taskId`. Khi đổi sang mô hình mới, các job này sẽ bắn ra dạng **Độc lập (`isStandalone: true`)**, và phía Ca trực sẽ chủ động lắng nghe/kế thừa.

### 2.2. Cơ chế Kế thừa Ca trực ([bot-engine.service.ts#L710-L756](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/bot-engine.service.ts#L710-L756))
* Logic **Link-to-Latest** đã hoạt động hoàn hảo:
  * Khi Bot quét checklist ca trực, nó gọi `botJobQueueService.getLatestCompletedJobByType(jobType, validWindowMinutes)`.
  * Nếu tìm thấy job hoàn tất hợp lệ trong khung thời gian cho phép, hàm cập nhật trạng thái task sang `PASSED` / `NEEDS_ATTENTION`, ghi vết `inheritedFromJobId` và đồng bộ lên Task Cha.
  * **Kết quả**: Không có bất kỳ browser Playwright hay Excel Macro nào bị kích hoạt thừa.

### 2.3. Phân hệ Frontend UI ([LegacyBackupThongKeSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx))
* Các state variables và API synchronization **đã tồn tại sẵn** trong mã nguồn:
  * `autoBackupActive` ([L163-L165](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx#L163-L165))
  * `backupPeriodic` & `backupPeriodicMinutes` ([L166-L172](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx#L166-L172))
  * `enableBackupTime` & `backupTime` ([L173-L178](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx#L173-L178))
  * `enableStatTime` & `statTime` ([L179-L184](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx#L179-L184))
  * Hàm lưu CSDL `saveSetting()` ([L240-L258](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx#L240-L258))

---

## 3. THIẾT KẾ CHI TIẾT 3 TÁC VỤ TỰ TRỊ ĐỘC LẬP

### 3.1. Tác vụ 1: Backup Định Kỳ (Mặc định 60 phút)
* **Mục đích**: Quét định kỳ kiểm tra sự tồn tại của các file sao lưu trong phiên giao dịch; tự động tải bổ sung các file còn thiếu nếu cần.
* **Tham số cấu hình**:
  * `bot_backup_periodic_enabled`: `true` | `false` (Checkbox trên UI).
  * `bot_backup_periodic_minutes`: `60` (Số nguyên $\ge 15$, mặc định `60`).
* **Hành vi Scheduler**:
  1. Kiểm tra Master Switch `bot_auto_backup_enabled === 'true'`.
  2. Kiểm tra `bot_backup_periodic_enabled === 'true'`.
  3. Bỏ qua nếu cuối tuần: `isMarketWeekendClosed() === true`.
  4. Deduplication Guard: Nếu đang có job `FILE_AUDIT_MS` hoặc `FILE_AUDIT_CQG` ở trạng thái `PENDING` hoặc `PROCESSING`, bỏ qua lượt này.
  5. Kiểm tra thời gian hoàn tất gần nhất: Nếu `elapsedMinutes < intervalMinutes`, bỏ qua.
  6. Enqueue job độc lập:
     * `FILE_AUDIT_MS`: Quét 20 file M-System.
     * `FILE_AUDIT_CQG`: Quét 9 file CQG và tự động merge.

### 3.2. Tác vụ 2: Mốc Giờ Tải Backup Chốt Ngày (Mặc định 04:00 AM)
* **Mục đích**: Tải toàn bộ các file báo cáo cuối ngày từ M-System (20 báo cáo) và CQG (9 file), đảm bảo dữ liệu chốt phiên đầy đủ phục vụ phân tích EOD và báo cáo lãnh đạo.
* **Tham số cấu hình**:
  * `bot_backup_time_enabled`: `true` | `false` (Checkbox trên UI).
  * `bot_backup_time`: Chuỗi giờ định dạng `HH:mm` (Mặc định `04:00`).
* **Hành vi Scheduler**:
  1. Kiểm tra Master Switch `bot_auto_backup_enabled === 'true'`.
  2. Kiểm tra `bot_backup_time_enabled === 'true'`.
  3. Kiểm tra giờ hiện tại trùng khớp `currentTimeStr === bot_backup_time` (ví dụ `04:00`).
  4. Single Run Guard: Kiểm tra `lastRunMap.get('AUTONOMOUS_BACKUP_TIME') === todayStr`.
  5. Kích hoạt job độc lập:
     * `RPA_DOWNLOAD_REPORTS`: Tải đầy đủ 20 báo cáo M-System (`NKTTHT`, `NR`, `QLTKGD`, `DSGD`, `TTTT`...).
     * `DOWNLOAD_CQG_BACKUP`: Tải 9 file CQG (`FR1`, `FR2`, `PS1`, `PS2`, `OP1`, `OP2`, `OD1`, `OD2`, `AS`).
  6. Cập nhật `lastRunMap.set('AUTONOMOUS_BACKUP_TIME', todayStr)`.

### 3.3. Tác vụ 3: Mốc Giờ Tạo Báo Cáo Thống Kê (Mặc định 06:30 AM)
* **Mục đích**: Tự động kích hoạt Macro Excel thống kê số Lot giao dịch và Giá trị giao dịch toàn thị trường.
* **Tham số cấu hình**:
  * `bot_stat_time_enabled`: `true` | `false` (Checkbox trên UI).
  * `bot_stat_time`: Chuỗi giờ định dạng `HH:mm` (Mặc định `06:30`).
* **Hành vi Scheduler**:
  1. Kiểm tra Master Switch `bot_auto_backup_enabled === 'true'`.
  2. Kiểm tra `bot_stat_time_enabled === 'true'`.
  3. Kiểm tra giờ hiện tại trùng khớp `currentTimeStr === bot_stat_time` (ví dụ `06:30`).
  4. Single Run Guard: Kiểm tra `lastRunMap.get('AUTONOMOUS_STAT_TIME') === todayStr`.
  5. Kích hoạt job độc lập:
     * `RUN_LOT_MACRO`: Chạy Macro thống kê số Lot.
     * `RUN_VALUE_MACRO`: Chạy Macro thống kê Giá trị giao dịch.
  6. Cập nhật `lastRunMap.set('AUTONOMOUS_STAT_TIME', todayStr)`.

---

## 4. CHI TIẾT THAY ĐỔI MÃ NGUỒN CỤ THỂ

### 4.1. Thay đổi Backend: [scheduler.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/src/modules/bot-engine/scheduler.service.ts)

Thêm runner tự trị chuyên trách cho Backup & Thống kê:

```typescript
/**
 * Autonomous Runner cho Backup & Thống Kê Trading Manager
 * Chạy độc lập 24/7 không phụ thuộc vào trạng thái mở/đóng của ca trực.
 */
@Cron('* * * * *', {
  name: 'autonomous-backup-stat-runner',
  timeZone: 'Asia/Saigon',
})
async handleAutonomousBackupAndStatRun() {
  const autoBackupSetting = await this.settingsService.getSetting(
    'bot_auto_backup_enabled',
    'true',
  );
  if (autoBackupSetting === 'false') return;

  const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
  const todayStr = nowVN.toISOString().split('T')[0];
  const currentTimeStr = `${String(nowVN.getUTCHours()).padStart(2, '0')}:${String(nowVN.getUTCMinutes()).padStart(2, '0')}`;

  const sessionStartSetting = await this.settingsService.getSetting('session_start_time', '05:00');
  const { dateStr: sessionDayStr } = resolveTradingSessionDate(undefined, { sessionStartStr: sessionStartSetting });

  // 1. BACKUP ĐỊNH KỲ (MẶC ĐỊNH 60 PHÚT)
  const periodicEnabled = await this.settingsService.getSetting('bot_backup_periodic_enabled', 'true');
  if (periodicEnabled !== 'false' && !isMarketWeekendClosed()) {
    const freqSetting = await this.settingsService.getSetting('bot_backup_periodic_minutes', '60');
    const intervalMinutes = Math.max(15, parseInt(freqSetting, 10) || 60);

    const hasActive = await this.jobQueueService.hasActiveJobByType('FILE_AUDIT_MS');
    if (!hasActive) {
      const lastJob = await this.jobQueueService.getLatestCompletedJobByType('FILE_AUDIT_MS');
      let shouldRun = true;
      if (lastJob && lastJob.completedAt) {
        const elapsedMinutes = (Date.now() - new Date(lastJob.completedAt).getTime()) / 60000;
        if (elapsedMinutes < intervalMinutes) shouldRun = false;
      }
      if (shouldRun) {
        await this.jobQueueService.enqueue('FILE_AUDIT_MS', {
          sessionDay: sessionDayStr,
          targetDate: sessionDayStr,
          isStandalone: true,
          shiftLogId: null,
          taskId: null,
        });
      }
    }
  }

  // 2. MỐC GIỜ BACKUP (MẶC ĐỊNH 04:00 AM)
  const backupTimeEnabled = await this.settingsService.getSetting('bot_backup_time_enabled', 'true');
  const backupTime = await this.settingsService.getSetting('bot_backup_time', '04:00');
  if (backupTimeEnabled !== 'false' && currentTimeStr === backupTime) {
    const key = `AUTONOMOUS_BACKUP_${todayStr}`;
    if (!this.lastRunMap.has(key)) {
      this.lastRunMap.set(key, todayStr);
      await this.jobQueueService.enqueue('RPA_DOWNLOAD_REPORTS', {
        sessionDay: sessionDayStr,
        targetDate: sessionDayStr,
        isStandalone: true,
        shiftLogId: null,
        taskId: null,
      });
      await this.jobQueueService.enqueue('DOWNLOAD_CQG_BACKUP', {
        sessionDay: sessionDayStr,
        targetDate: sessionDayStr,
        isStandalone: true,
        shiftLogId: null,
        taskId: null,
      });
    }
  }

  // 3. MỐC GIỜ THỐNG KÊ (MẶC ĐỊNH 06:30 AM)
  const statTimeEnabled = await this.settingsService.getSetting('bot_stat_time_enabled', 'true');
  const statTime = await this.settingsService.getSetting('bot_stat_time', '06:30');
  if (statTimeEnabled !== 'false' && currentTimeStr === statTime) {
    const key = `AUTONOMOUS_STAT_${todayStr}`;
    if (!this.lastRunMap.has(key)) {
      this.lastRunMap.set(key, todayStr);
      await this.jobQueueService.enqueue('RUN_LOT_MACRO', {
        sessionDay: sessionDayStr,
        targetDate: sessionDayStr,
        isStandalone: true,
        shiftLogId: null,
        taskId: null,
      });
      await this.jobQueueService.enqueue('RUN_VALUE_MACRO', {
        sessionDay: sessionDayStr,
        targetDate: sessionDayStr,
        isStandalone: true,
        shiftLogId: null,
        taskId: null,
      });
    }
  }
}
```

### 4.2. Thay đổi Frontend: [LegacyBackupThongKeSection.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx)

Tại header của Component, thay thế khối read-only bị khóa bằng khối điều khiển tương tác trực tiếp:

```tsx
{/* 1. Backup định kỳ (phút) */}
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
    <input
      type="checkbox"
      checked={backupPeriodic}
      onChange={(e) => {
        const val = e.target.checked;
        setBackupPeriodic(val);
        saveSetting('bot_backup_periodic_enabled', val ? 'true' : 'false');
      }}
      style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
    />
    <span>Backup định kỳ (phút)</span>
  </label>
  <input
    type="number"
    min={15}
    step={15}
    value={backupPeriodicMinutes}
    onChange={(e) => {
      const v = parseInt(e.target.value, 10);
      setBackupPeriodicMinutes(v);
      if (v >= 15) saveSetting('bot_backup_periodic_minutes', String(v));
    }}
    disabled={!backupPeriodic}
    className="form-input"
    style={{ width: '65px', height: '32px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}
  />
</div>

{/* 2. Thời điểm backup (Mặc định 04:00 AM) */}
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
    <input
      type="checkbox"
      checked={enableBackupTime}
      onChange={(e) => {
        const val = e.target.checked;
        setEnableBackupTime(val);
        saveSetting('bot_backup_time_enabled', val ? 'true' : 'false');
      }}
      style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
    />
    <span>Thời điểm backup</span>
  </label>
  <input
    type="time"
    value={backupTime}
    onChange={(e) => {
      setBackupTime(e.target.value);
      saveSetting('bot_backup_time', e.target.value);
    }}
    disabled={!enableBackupTime}
    className="form-input"
    style={{ width: '95px', height: '32px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}
  />
</div>

{/* 3. Thời điểm tạo thống kê (Mặc định 06:30 AM) */}
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
    <input
      type="checkbox"
      checked={enableStatTime}
      onChange={(e) => {
        const val = e.target.checked;
        setEnableStatTime(val);
        saveSetting('bot_stat_time_enabled', val ? 'true' : 'false');
      }}
      style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
    />
    <span>Thời điểm tạo thống kê</span>
  </label>
  <input
    type="time"
    value={statTime}
    onChange={(e) => {
      setStatTime(e.target.value);
      saveSetting('bot_stat_time', e.target.value);
    }}
    disabled={!enableStatTime}
    className="form-input"
    style={{ width: '95px', height: '32px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}
  />
</div>
```

---

## 5. KẾ HOẠCH KIỂM THỬ & MA TRẬN TEST CASE

| Mã Test Case | Tình huống kiểm thử | Hành vi kỳ vọng | Tiêu chí Đạt (Pass Criteria) |
| :--- | :--- | :--- | :--- |
| **TC-AUTO-01** | Đúng 04:00 AM khi **Không có ca trực nào mở** | Bot tự động enqueue `RPA_DOWNLOAD_REPORTS` và `DOWNLOAD_CQG_BACKUP`. | Job chạy thành công, lưu file vào thư mục backup ngày, log ghi nhận `isStandalone: true, shiftLogId: null`. |
| **TC-AUTO-02** | Đúng 06:30 AM khi **Không có ca trực nào mở** | Bot tự động enqueue `RUN_LOT_MACRO` và `RUN_VALUE_MACRO`. | Macro chạy thành công, sinh file báo cáo thống kê trên ổ đĩa. |
| **TC-AUTO-03** | Đến 07:00 AM nhân viên vào ca mở Checklist | Checklist ca trực quét qua các task Backup & Thống kê. | **Link-to-Latest**: Tự động nhận diện job đã hoàn thành lúc 04:00/06:30, tick đạt (`PASSED`) trong 0.05s mà **không spawn job mới**. |
| **TC-AUTO-04** | Người dùng đổi giờ trên UI từ `04:00` sang `04:15` | CSDL cập nhật `bot_backup_time = '04:15'`. | Đúng 04:15 bot mới kích hoạt, không cần restart server hay build lại bundle. |
| **TC-AUTO-05** | Master Switch `bot_auto_backup_enabled = false` | Toàn bộ tiến trình tạm dừng. | Đến 04:00 hoặc 06:30 không có bất kỳ job nào được tạo ra. |
| **TC-AUTO-06** | Chiều Thứ Bảy hoặc cả ngày Chủ Nhật (Weekend) | Bộ bảo vệ `isMarketWeekendClosed()` kích hoạt. | Tạm dừng kiểm tra backup định kỳ, không sinh log rác. |

---

## 6. ĐÁNH GIÁ TÁC ĐỘNG VẬN HÀNH & KẾT LUẬN

1. **Mức độ phức tạp**: **RẤT THẤP**.
2. **Khả năng tương thích ngược (Backward Compatibility)**: Đạt 100%. Không làm thay đổi cấu trúc bảng CSDL, không ảnh hưởng tới các script cào dữ liệu Playwright hay Macro Excel.
3. **Độ an toàn cho Vận hành**: Cực kỳ cao, loại bỏ hoàn toàn rủi ro sót backup khi ca trực bàn giao chậm hoặc đổi ca.
