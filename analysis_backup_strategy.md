# Phân Tích Chiến Lược: Hybrid IT Backup + Bot Fallback

## Đánh giá ý tưởng của bạn

Ý tưởng của bạn **về cơ bản là đúng và thực tế**. Đây chính là pattern **"Trust but Verify + Fallback"** trong hệ thống vận hành, được dùng rộng rãi trong các môi trường production. Tuy nhiên có một số điểm cần tinh chỉnh.

---

## Vấn đề hiện tại (để có góc nhìn đầy đủ)

```
Tool IT backup toàn bộ file   →   Thi thoảng timeout 3 file   →   Nghiệp vụ backup thủ công
       ↑ Primary                          ↑ Pain point                     ↑ Tốn thời gian
```

Cách tiếp cận hiện tại của bạn (bot tải toàn bộ) có vấn đề:
- ❌ Tái tạo toàn bộ logic đã có sẵn → phức tạp, dễ lỗi
- ❌ Playwright chạy lâu → tốn tài nguyên server
- ❌ Anti-bot risk mỗi lần chạy
- ❌ Bảo trì khó khi M-System thay đổi giao diện

---

## Phương án tối ưu: "Smart Audit + Targeted Recovery"

```
                    ┌─────────────────────────────────┐
                    │   IT Backup Tool (Primary)       │
                    │   Tự động theo lịch cố định      │
                    │   Lưu vào: \\server\backup\date\ │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────▼──────────────────┐
                    │   Bot Kiểm Tra File (Monitor)    │
                    │   Chạy SAU khi IT tool xong      │
                    │   Scan danh sách file cần có     │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────▼──────────────────┐
                    │         Phân loại kết quả        │
                    ├──────────────┬──────────────────┤
                    │   ✅ Đủ file │  ❌ Thiếu file    │
                    │   → Done     │  → Bot tự tải     │
                    └─────────────┴──────────────────-┘
                                   │ (chỉ ~3 file)
                    ┌──────────────▼──────────────────┐
                    │  Playwright: Targeted Download   │
                    │  Chỉ đăng nhập khi CÓ thiếu file│
                    │  Tải đúng file bị thiếu → xong  │
                    └─────────────────────────────────┘
```

---

## Điểm mấu chốt cần làm rõ (câu hỏi bạn cần trả lời)

> [!IMPORTANT]
> Trước khi implement, cần biết:
> 1. **Backup tool lưu file ở đâu?** — Network share? Local path? FTP?
> 2. **Cấu trúc thư mục backup?** — `\\server\backup\2026-07-07\NKTTHT.xlsx` hay khác?
> 3. **IT tool backup xong lúc mấy giờ?** — Để bot chạy kiểm tra SAU đó
> 4. **3 file hay bị timeout là file nào?** — Để define "critical files" cần retry

---

## Chi tiết triển khai kỹ thuật

### 1. Config backup path (trong Admin UI hoặc .env)
```
BACKUP_NETWORK_PATH = \\192.168.1.100\backup\reports\
```

### 2. Logic luồng mới (thay thế `handleRpaDownloadJob`)

```typescript
async handleFileAuditJob(job: BotJob) {
  const sessionDate = job.payload.sessionDate; // 'YYYY-MM-DD'
  const backupDir = path.join(BACKUP_PATH, sessionDate);

  // BƯỚC 1: Kiểm tra từng file bắt buộc
  const required = ['NKTTHT.xlsx', 'NR.xlsx', 'QLTKGD.xlsx', 'DSGD.xlsx', ...];
  const missing = required.filter(f => !fs.existsSync(path.join(backupDir, f)));

  if (missing.length === 0) {
    // ✅ Đủ hết, ghi log và done
    job.logs.push('✅ Đủ tất cả file backup. Không cần tải thêm.');
    return;
  }

  // BƯỚC 2: Chỉ đăng nhập Playwright khi có file thiếu
  job.logs.push(`⚠️ Thiếu ${missing.length} file: ${missing.join(', ')}. Đang tự động tải bổ sung...`);
  const { browser, page } = await this.rpaService.loginMSystem(tempDir);

  try {
    for (const filename of missing) {
      // Tải đúng file bị thiếu vào thư mục backup
      const destFile = path.join(backupDir, filename);
      await this.downloadByFilename(page, filename, destFile);
      job.logs.push(`✅ Đã tải bổ sung: ${filename}`);
    }
  } finally {
    await browser.close();
  }
}
```

### 3. Checklist task mapping

Thay vì checklist task trigger "tải file", nó trigger "kiểm tra file":
```
Checklist item: "Xác nhận backup file cuối phiên"
  → Bot job: FILE_AUDIT (không phải RPA_DOWNLOAD)
  → Kết quả: "✅ 15/15 file đầy đủ" hoặc "⚠️ Đã tự động bổ sung 2 file bị thiếu"
```

---

## So sánh phương án

| Tiêu chí | Hiện tại (bot tải tất cả) | Đề xuất mới (Audit + Fallback) |
|---|---|---|
| Playwright sessions/phiên | 1 session dài (15+ file) | 0 (nếu đủ) hoặc 1 ngắn (chỉ file thiếu) |
| Risk anti-bot | Cao (chạy mỗi phiên) | Thấp (chỉ chạy khi cần) |
| Thời gian chạy | ~15-20 phút | ~30 giây (audit) + 3-5 phút (nếu thiếu) |
| Độ phức tạp bảo trì | Cao | Thấp |
| Giá trị thực tế | Thấp (trùng lặp IT tool) | Cao (giải quyết pain point thực) |
| Rủi ro khi M-System đổi UI | Cao (toàn bộ download logic) | Thấp (chỉ 3 file critical) |

---

## Kế hoạch triển khai (ưu tiên)

- `[ ]` **Bước 1**: Xác nhận đường dẫn thư mục backup với team IT
- `[ ]` **Bước 2**: Xác định danh sách 3 file hay bị timeout (critical files)
- `[ ]` **Bước 3**: Tạo job type mới `FILE_AUDIT` thay thế `RPA_DOWNLOAD_REPORTS`
- `[ ]` **Bước 4**: Implement `handleFileAuditJob` với logic scan → fallback download
- `[ ]` **Bước 5**: Cập nhật Admin UI ẩn nút "Tải toàn bộ", thêm nút "Kiểm tra file"
- `[ ]` **Bước 6**: Map checklist tasks sang job type mới
- `[ ]` **Bước 7** (optional): Giữ nguyên download methods trong `rpa-downloader.service.ts` nhưng không expose ra UI

> [!NOTE]
> Giữ nguyên toàn bộ code download hiện tại trong `rpa-downloader.service.ts` — 
> không cần xóa, chỉ không gọi khi file đã có sẵn từ IT backup. 
> Code đó vẫn là "safety net" tốt.
