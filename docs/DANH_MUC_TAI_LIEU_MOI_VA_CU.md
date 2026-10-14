# BẢNG PHÂN LOẠI TÀI LIỆU DỰ ÁN: MỚI & CŨ THEO NGÀY TẠO
> **Mục đích**: Tổng hợp và phân định rõ ràng các tài liệu kỹ thuật trong thư mục `docs/` thành 2 nhóm **MỚI (Hiện hành & Đang triển khai)** và **CŨ (Nền tảng & Đã hoàn thành/Lưu trữ)** theo ngày tạo thực tế để phục vụ đánh giá, rà soát đầu việc và thực thi chuyển đổi kiến trúc Modular Monolith.

---

## 📌 TỔNG QUAN PHÂN BỔ DỰ ÁN

| Phân Nhóm | Khoảng Thời Gian Tạo | Số Lượng | Trọng Tâm Nghiệp Vụ |
| :--- | :--- | :---: | :--- |
| **I. TÀI LIỆU MỚI (HIỆN HÀNH)** | **23/09/2026 – 14/10/2026** | **28 tài liệu** | Báo cáo nghiệm thu toàn trình 27 Task Modular Monolith V2, Kế hoạch 7 pha Modular Monolith V2, Thiết kế chi tiết Task 3.6/4.4/4.5 (DsgdBeforeEod, ValueStats, CcpEod), Kế hoạch Stage 2 Runtime & Off Playwright, Đặc tả Crawler Ingress CQG/MS/CCP, Cuốn chiếu đối soát Trading-Ops, Checklist ca trực 4 ca, Tách 2 trang Trading Manager. |
| **II. TÀI LIỆU CŨ (LƯU TRỮ)** | **14/09/2026 – 22/09/2026** | **17 tài liệu** | Phân hệ bóc tách hồ sơ mở TKGD (OCR CCCD/HĐ) đã chuyển vào `legacy/`, Khảo sát DOM CE, Thiết kế Trading Manager sơ khai ban đầu gộp chung. |

---

# PHẦN I: TÀI LIỆU MỚI (HIỆN HÀNH & CẦN ĐÁNH GIÁ ĐẦU VIỆC)
*Đây là nhóm tài liệu phản ánh kiến trúc và chức năng đang vận hành trực tiếp trên hệ thống hiện tại, bạn nên tập trung vào nhóm này để rà soát đầu việc.*

### 1. Ngày 14/10/2026 (Nghiệm thu V2 & Thiết kế Chi tiết Task 3.6 + 4.4 + 4.5)
| STT | Tài liệu | Ngày tạo | Đầu việc & Trọng tâm nghiệp vụ | Trạng thái |
| :---: | :--- | :---: | :--- | :---: |
| 1 | [BAO_CAO_NGHIEM_THU_TOAN_TRINH_MODULAR_MONOLITH_V2.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/BAO_CAO_NGHIEM_THU_TOAN_TRINH_MODULAR_MONOLITH_V2.md) | 14/10/2026 | **Báo cáo nghiệm thu toàn trình chuyển đổi Modular Monolith V2**: Hoàn thành 100% (27/27 tasks), kết quả Twin-Run Validation, kết quả biên dịch Backend NestJS (`nest build` Exit code 0) & Frontend Next.js Turbopack (`next build` 35/35 static pages Exit code 0), Unit test cây gia phả tác vụ động (7/7 cases pass), cơ chế multi-instance atomic lock trên MongoDB. | **Nghiệm Thu Toàn Trình Hoàn Tất** |
| 2 | [TAI_LIEU_THIET_KE_CHI_TIET_TASK_3_6_4_4_4_5_MIGRATION.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/TAI_LIEU_THIET_KE_CHI_TIET_TASK_3_6_4_4_4_5_MIGRATION.md) | 14/10/2026 | **Đặc tả thiết kế chi tiết 3 Task nguyên tử**: Task 3.6 di dời `DsgdBeforeEodService` (314 dòng, logic lọc tài khoản ACM `.endsWith('A')`, ngưỡng 0.0001) vào `trading-ops`; Task 4.4 xây dựng `ValueStatisticsService` & `CcpValueWorker` (ma trận tỷ giá 4 ngoại tệ USD/MYR/JPY/RMB, công thức JPY/100); Task 4.5 di dời `CcpEodService` (bóc tách từ `ccp-recon.service.ts` 1.189 dòng) vào `ccp-clearing`. | **Đã Triển Khai Hoàn Thành** |

### 2. Ngày 13/10/2026 (Chuyển đổi Modular Monolith V2, Cuốn chiếu Đối Soát & Tối ưu Ingress Crawler)
| STT | Tài liệu | Ngày tạo | Đầu việc & Trọng tâm nghiệp vụ | Trạng thái |
| :---: | :--- | :---: | :--- | :---: |
| 2 | [KE_HOACH_TONG_CHUYEN_DOI_MODULAR_MONOLITH_ATOMIC_TASKS.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/KE_HOACH_TONG_CHUYEN_DOI_MODULAR_MONOLITH_ATOMIC_TASKS.md) | 13/10/2026 | **Kế hoạch tổng thể 7 Pha & 22 Nhiệm vụ nguyên tử (Atomic Tasks)** chuyển đổi Monolith V1 sang Modular Monolith V2 (Strangler Fig, Twin-Run, Zero Logic Loss). | **Kế hoạch Cốt lõi Hiện hành** |
| 3 | [KE_HOACH_CHUYEN_DOI_TIEP_THEO_STAGE_2_ATOMIC_TASKS.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/KE_HOACH_CHUYEN_DOI_TIEP_THEO_STAGE_2_ATOMIC_TASKS.md) | 13/10/2026 | **Kế hoạch chuyển đổi Giai đoạn 2 (Pha 7 ➔ Pha 12)**: Tách Log độc lập (`trading_recon_logs`, `ccp_clearing_logs`), Phân vùng cấu hình theo khối, Đa Instance Concurrency & Khung REST API tắt Playwright. | **Kế hoạch Vận hành Stage 2** |
| 4 | [TAI_LIEU_THIET_KE_TOI_UU_INGRESS_SCRAPERS_VA_CQG_CRAWLER.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/TAI_LIEU_THIET_KE_TOI_UU_INGRESS_SCRAPERS_VA_CQG_CRAWLER.md) | 13/10/2026 | **Đặc tả thiết kế chi tiết & Tối ưu hóa Crawler Ingress**: Cơ chế tải nhanh 4 tabs CQG (`FR`, `PS`, `OP`, `OD`), tự động dọn widget, chiếm quyền phiên, song song 2 tài khoản CQG1/CQG2, M-System ALB session & CoreCCP 25 files. | **Quy chuẩn Crawler Ingress** |
| 5 | [KE_HOACH_CUON_CHIEU_HOAN_THIEN_TRADING_OPS_RECONCILIATION.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/KE_HOACH_CUON_CHIEU_HOAN_THIEN_TRADING_OPS_RECONCILIATION.md) | 13/10/2026 | Kế hoạch cuốn chiếu hoàn thiện lõi V2 Trading-Ops, khắc phục triệt để sự cố Job rỗng `6ace13d41fe790bc64330c8d`, tích hợp CoreCCP và đường dẫn động. | **Đã hoàn thành Phase 1 & 2** |
| 6 | [BAN_THIET_KE_CHI_TIET_CHUAN_HOA_BACKEND_MODULAR_MONOLITH.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/BAN_THIET_KE_CHI_TIET_CHUAN_HOA_BACKEND_MODULAR_MONOLITH.md) | 13/10/2026 | Bản thiết kế chi tiết các phân hệ `ingress`, `trading-ops`, `ccp-clearing`, `checklist-hub`. | Đang triển khai cuốn chiếu |
| 7 | [HUONG_DAN_CHUYEN_DOI_LEGACY_KHI_ON_DINH.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/HUONG_DAN_CHUYEN_DOI_LEGACY_KHI_ON_DINH.md) | 13/10/2026 | Hướng dẫn 3 cổng kiểm tra (Exit Gates) và quy trình tháo gỡ code cũ V1 chuyển sang `legacy/` sau khi Twin-Run đạt 0 lệch. | Sổ tay vận hành |

### 2. Ngày 10/10/2026 (Vận hành Tự động 24/7 & Hướng dẫn Vận hành)
| STT | Tài liệu | Ngày tạo | Đầu việc & Trọng tâm nghiệp vụ | Trạng thái |
| :---: | :--- | :---: | :--- | :---: |
| 5 | [HUONG_DAN_VAN_HANH_CHI_TIET_TRADING_MANAGER_VA_CHECKLIST_24H.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/HUONG_DAN_VAN_HANH_CHI_TIET_TRADING_MANAGER_VA_CHECKLIST_24H.md) | 10/10/2026 | Sổ tay hướng dẫn chi tiết quy trình trực vận hành 24/7 của Quản lý giao dịch và Checklist ca trực. | Đang áp dụng |
| 6 | [THIET_KE_KIEN_TRUC_VAN_HANH_TU_DONG_TRADING_MANAGER_VA_CHECKLIST_24H.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/THIET_KE_KIEN_TRUC_VAN_HANH_TU_DONG_TRADING_MANAGER_VA_CHECKLIST_24H.md) | 10/10/2026 | Đặc tả kiến trúc tự động hóa kết nối giữa Job chạy ngầm và Tác vụ Checklist ca trực. | Đang áp dụng |
| 7 | [TONG_HOP_TOAN_DIEN_LUONG_VAN_HANH_TU_DONG_TRADING_MANAGER.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/TONG_HOP_TOAN_DIEN_LUONG_VAN_HANH_TU_DONG_TRADING_MANAGER.md) | 10/10/2026 | Tổng hợp toàn diện luồng tự động tải file, ghép file thô CQG, đối soát và sinh báo cáo. | Đang áp dụng |

### 3. Ngày 07/10/2026 (Trọng tâm Ca trực & Giao diện mới)
| STT | Tài liệu | Ngày tạo | Đầu việc & Trọng tâm nghiệp vụ | Trạng thái |
| :---: | :--- | :---: | :--- | :---: |
| 8 | [QUY_TRINH_VA_CHECKLIST_TRUC_VAN_HANH_CCP_EXCHANGE.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/QUY_TRINH_VA_CHECKLIST_TRUC_VAN_HANH_CCP_EXCHANGE.md) | 07/10/2026 | Bóc tách chi tiết toàn bộ 4 ca trực (Mở cửa, Ngày, Chiều, Đêm) theo file gốc `Checklist trực vận hành.docx`, gán SLA và bot phụ trách. | Đang áp dụng |
| 9 | [TAI_LIEU_DANH_GIA_VA_THIET_KE_LAI_UI_CHECKLIST.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/TAI_LIEU_DANH_GIA_VA_THIET_KE_LAI_UI_CHECKLIST.md) | 07/10/2026 | Đánh giá bất cập UI Checklist hiện tại và đặc tả thiết kế UI mới theo Timeline trực quan. | Đang triển khai |

### 4. Ngày 01/10/2026 (Tách 2 màn hình Trading Manager)
| STT | Tài liệu | Ngày tạo | Đầu việc & Trọng tâm nghiệp vụ | Trạng thái |
| :---: | :--- | :---: | :--- | :---: |
| 10 | [TONG_HOP_RA_SOAT_LUONG_TU_DONG_2_TRANG_MS_CQG_VA_CCP_CE.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/TONG_HOP_RA_SOAT_LUONG_TU_DONG_2_TRANG_MS_CQG_VA_CCP_CE.md) | 01/10/2026 | Rà soát toàn bộ luồng tự động (tải file, ghép file, chạy macro, đối soát) cho 2 trang độc lập sau khi tách. | Đang áp dụng |
| 11 | [KE_HOACH_TACH_MAN_HINH_DOC_LAP_TRADING_MANAGER_UX_UI.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/KE_HOACH_TACH_MAN_HINH_DOC_LAP_TRADING_MANAGER_UX_UI.md) | 01/10/2026 | Kế hoạch chia tách URL `/trading-manager/ms-cqg` và `/trading-manager/ccp-ce`. | Đã hoàn thành FE |
| 12 | [KE_HOACH_CHUYEN_DOI_SONG_SONG_TRADING_MANAGER_UX_UI.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/KE_HOACH_CHUYEN_DOI_SONG_SONG_TRADING_MANAGER_UX_UI.md) | 01/10/2026 | Thiết kế kiến trúc chuyển đổi song song (chạy cả trang cũ và trang mới không xung đột state). | Đã hoàn thành |

### 5. Ngày 28/09/2026 (Vận hành thực tế & Tương quan ca trực)
| STT | Tài liệu | Ngày tạo | Đầu việc & Trọng tâm nghiệp vụ | Trạng thái |
| :---: | :--- | :---: | :--- | :---: |
| 13 | [DANH_GIA_LUONG_TU_DONG_TRADING_MANAGER_VA_TUONG_QUAN_CA_TRUC.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/DANH_GIA_LUONG_TU_DONG_TRADING_MANAGER_VA_TUONG_QUAN_CA_TRUC.md) | 28/09/2026 | Đánh giá mối quan hệ giữa Job chạy trên Trading Manager và cập nhật trạng thái tác vụ ca trực (`ShiftLog`). | Quan trọng |
| 14 | [28thang9thucte.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/28thang9thucte.md) | 28/09/2026 | Nhật ký ghi nhận log chạy thực tế ca trực ngày 28/09 (lỗi missing file, thời gian phản hồi). | Tham khảo thực tế |

### 6. Ngày 25/09/2026 (Đối chiếu EOD & Sổ tay Test Scripts)
| STT | Tài liệu | Ngày tạo | Đầu việc & Trọng tâm nghiệp vụ | Trạng thái |
| :---: | :--- | :---: | :--- | :---: |
| 15 | [DANH_MUC_TEST_SCRIPTS_CHUAN_HOA.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/DANH_MUC_TEST_SCRIPTS_CHUAN_HOA.md) | 25/09/2026 | Sổ tay tổng hợp toàn bộ script kiểm thử độc lập (crawler MS, CQG, CCP, CE, SFTP, EOD đối soát). | Quy chuẩn bắt buộc |
| 16 | [TAI_LIEU_THIET_KE_CAP_NHAT_LUU_VA_DOI_CHIEU_EOD_CHUAN_CSHARP.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/TAI_LIEU_THIET_KE_CAP_NHAT_LUU_VA_DOI_CHIEU_EOD_CHUAN_CSHARP.md) | 25/09/2026 | Cập nhật logic đối chiếu EOD 3 bên theo chuẩn C# (`TransactionCheckingService.cs`). | Đang áp dụng |

### 7. Ngày 24/09/2026 (Thống kê CoreCCP & Tỷ giá chuẩn)
| STT | Tài liệu | Ngày tạo | Đầu việc & Trọng tâm nghiệp vụ | Trạng thái |
| :---: | :--- | :---: | :--- | :---: |
| 17 | [TAI_LIEU_THIET_KE_TACH_THONG_KE_LOT_VA_GIA_TRI_CORECCP.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/TAI_LIEU_THIET_KE_TACH_THONG_KE_LOT_VA_GIA_TRI_CORECCP.md) | 24/09/2026 | Tách độc lập job tính Lot và job tính Giá trị giao dịch CoreCCP để tránh nghẽn thread. | Đã áp dụng |
| 18 | [TAI_LIEU_THIET_KE_HOAN_THIEN_DONG_BO_TY_GIA_MSYSTEM_VA_CORECCP.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/TAI_LIEU_THIET_KE_HOAN_THIEN_DONG_BO_TY_GIA_MSYSTEM_VA_CORECCP.md) | 24/09/2026 | Thiết kế hoàn thiện đồng bộ tỷ giá MS và CoreCCP theo quy định nghiệp vụ chuẩn. | Đã áp dụng |

### 8. Ngày 23/09/2026 (Đồng bộ bàn giao, Tách tỷ giá MS vs CCP & Chế độ kép)
| STT | Tài liệu | Ngày tạo | Đầu việc & Trọng tâm nghiệp vụ | Trạng thái |
| :---: | :--- | :---: | :--- | :---: |
| 19 | [BAO_CAO_RA_SOAT_BAN_GIAO_TOAN_DIEN_TRADING_MANAGER_FE_BE.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/BAO_CAO_RA_SOAT_BAN_GIAO_TOAN_DIEN_TRADING_MANAGER_FE_BE.md) | 23/09/2026 | Rà soát toàn diện tương thích API FE ➔ BE cho Trading Manager. | Hoàn thành |
| 20 | [TAI_LIEU_THIET_KE_BO_SUNG_HE_THONG_TY_GIA_DA_TIEN_TE_MS_CCP.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/TAI_LIEU_THIET_KE_BO_SUNG_HE_THONG_TY_GIA_DA_TIEN_TE_MS_CCP.md) | 23/09/2026 | Thiết kế bổ sung bảng tỷ giá đa tiền tệ (USD, EUR, GBP, JPY...). | Đã áp dụng |
| 21 | [THIET_KE_TACH_BIET_HOAN_TOAN_TY_GIA_MSYSTEM_VA_CORECCP.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/THIET_KE_TACH_BIET_HOAN_TOAN_TY_GIA_MSYSTEM_VA_CORECCP.md) | 23/09/2026 | Tách nguồn tỷ giá riêng biệt giữa M-System và CoreCCP để không bị ảnh hưởng chéo. | Đã áp dụng |
| 22 | [TAI_LIEU_TONG_HOP_MA_NGUON_LOGIC_VA_KE_HOACH_TACH_TY_GIA_MS_CCP.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/TAI_LIEU_TONG_HOP_MA_NGUON_LOGIC_VA_KE_HOACH_TACH_TY_GIA_MS_CCP.md) | 23/09/2026 | Tổng hợp mã nguồn và kế hoạch cập nhật tách tỷ giá. | Đã áp dụng |
| 23 | [TAI_LIEU_THIET_KE_TRIEN_KHAI_TY_GIA_DA_TIEN_TE_DONG_MS_CCP.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/TAI_LIEU_THIET_KE_TRIEN_KHAI_TY_GIA_DA_TIEN_TE_DONG_MS_CCP.md) | 23/09/2026 | Thiết kế Data-Driven cho tỷ giá đa tiền tệ. | Đã áp dụng |
| 24 | [THIET_KE_NANG_CAP_CHE_DO_KEP_USER_VS_EXPERT_CORECCP.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/moi/THIET_KE_NANG_CAP_CHE_DO_KEP_USER_VS_EXPERT_CORECCP.md) | 23/09/2026 | Thiết kế giao diện chế độ kép: User Mode và Expert Mode cho CoreCCP. | Đã áp dụng |

---

# PHẦN II: TÀI LIỆU CŨ (NỀN TẢNG & ĐÃ HOÀN THÀNH / LƯU TRỮ)
*Nhóm tài liệu thuộc giai đoạn phát triển ban đầu (14/09 – 22/09/2026), chủ yếu gồm phân hệ TKGD (đối soát hồ sơ mở tài khoản đã chuyển sang `legacy/`) và các bản thiết kế sơ khai trước khi tái cấu trúc.*

### 1. Ngày 22/09 – 23/09/2026
| STT | Tài liệu | Ngày tạo | Nội dung & Lý do xếp vào nhóm Cũ |
| :---: | :--- | :---: | :--- |
| 25 | [TAI_LIEU_DANH_MUC_MENU_VA_BAO_CAO_CORE_EXCHANGE_CE.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/TAI_LIEU_DANH_MUC_MENU_VA_BAO_CAO_CORE_EXCHANGE_CE.md) | 22/09/2026 | Khảo sát menu CE thô ban đầu (đã được tổng hợp vào tài liệu `01/10` và test script chuẩn). |
| 26 | [TAI_LIEU_BAN_GIAO_DONG_GOI_HE_THONG_USER.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/TAI_LIEU_BAN_GIAO_DONG_GOI_HE_THONG_USER.md) | 23/09/2026 | Bản hướng dẫn vận hành cho giao diện cũ (trước khi tách 2 màn hình). |

### 2. Ngày 18/09/2026
| STT | Tài liệu | Ngày tạo | Nội dung & Lý do xếp vào nhóm Cũ |
| :---: | :--- | :---: | :--- |
| 27 | [BAN_THIET_KE_GO_LIVE_THONG_KE_CORECCP.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/BAN_THIET_KE_GO_LIVE_THONG_KE_CORECCP.md) | 18/09/2026 | Thiết kế Go-Live thống kê CoreCCP ban đầu (đã hoàn thành). |
| 28 | [THIET_KE_MO_RONG_TVKD_VA_MA_HD_MOI_CORECCP.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/THIET_KE_MO_RONG_TVKD_VA_MA_HD_MOI_CORECCP.md) | 18/09/2026 | Mở rộng danh mục TVKD và mã hàng hóa (đã đưa vào DB cấu hình). |
| 29 | [BAN_THIET_KE_MASTER_SWITCH_TAT_BAT_TU_DONG_TRADING_MANAGER.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/BAN_THIET_KE_MASTER_SWITCH_TAT_BAT_TU_DONG_TRADING_MANAGER.md) | 18/09/2026 | Thiết kế Master Switch bật/tắt bot (đã hoàn thành code và giao diện). |

### 3. Ngày 15/09/2026
| STT | Tài liệu | Ngày tạo | Nội dung & Lý do xếp vào nhóm Cũ |
| :---: | :--- | :---: | :--- |
| 30 | [TAI_LIEU_THONG_KE_LOT_VA_GTGD_CORECCP.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/TAI_LIEU_THONG_KE_LOT_VA_GTGD_CORECCP.md) | 15/09/2026 | Báo cáo fix lỗi tính lot CoreCCP đợt 1 (đã được nâng cấp bằng tài liệu ngày `24/09`). |

### 4. Ngày 14/09/2026 (Nhóm Phân hệ Mở TKGD & Thiết kế Sơ khai)
| STT | Tài liệu | Ngày tạo | Nội dung & Lý do xếp vào nhóm Cũ |
| :---: | :--- | :---: | :--- |
| 31 | [BAO_CAO_DANH_GIA_LOGIC_TKGD_VA_KHUYEN_NGHI.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/BAO_CAO_DANH_GIA_LOGIC_TKGD_VA_KHUYEN_NGHI.md) | 14/09/2026 | Đánh giá logic TKGD ban đầu (đã chuyển vào `legacy/tkgd/`). |
| 32 | [CHAM_DIEM_LOGIC_TKGD.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/CHAM_DIEM_LOGIC_TKGD.md) | 14/09/2026 | Bảng chấm điểm bóc tách TKGD (đã chuyển vào `legacy/tkgd/`). |
| 33 | [DE_XUAT_GIAI_PHAP_TU_DONG_HOA_MO_TKGD_OUTLOOK_OCR_MS.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/DE_XUAT_GIAI_PHAP_TU_DONG_HOA_MO_TKGD_OUTLOOK_OCR_MS.md) | 14/09/2026 | Đề xuất kiến trúc crawler Outlook + OCR. |
| 34 | [KE_HOACH_NANG_CAP_TOAN_VEN_DU_LIEU_TKGD.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/KE_HOACH_NANG_CAP_TOAN_VEN_DU_LIEU_TKGD.md) | 14/09/2026 | Kế hoạch nâng cấp bóc tách TKGD. |
| 35 | [THIET_KE_KIEN_TRUC_MODULE_SCAN_TKGD.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/THIET_KE_KIEN_TRUC_MODULE_SCAN_TKGD.md) | 14/09/2026 | Thiết kế Worker scan hồ sơ TKGD. |
| 36 | [THIET_KE_TAI_KIEN_TRUC_MODULAR_TKGD.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/THIET_KE_TAI_KIEN_TRUC_MODULAR_TKGD.md) | 14/09/2026 | Tái kiến trúc modular cho TKGD. |
| 37 | [THIET_KE_VA_TRIEN_KHAI_NANG_CAP_TOAN_VEN_DU_LIEU_TKGD.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/THIET_KE_VA_TRIEN_KHAI_NANG_CAP_TOAN_VEN_DU_LIEU_TKGD.md) | 14/09/2026 | Triển khai nâng cấp toàn vẹn dữ liệu TKGD. |
| 38 | [THIET_KE_DOI_CHIEU_EOD_MS_VA_CCP.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/THIET_KE_DOI_CHIEU_EOD_MS_VA_CCP.md) | 14/09/2026 | Thiết kế đối chiếu EOD MS vs CCP bản 1 (đã được thay bằng bản C# ngày `25/09`). |
| 39 | [THIET_KE_DONG_BO_TY_GIA_VA_DOI_CHIEU_EOD_DA_TIEN_TE.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/THIET_KE_DONG_BO_TY_GIA_VA_DOI_CHIEU_EOD_DA_TIEN_TE.md) | 14/09/2026 | Bản sơ khai về đồng bộ tỷ giá (đã thay bằng bộ tài liệu ngày `23/09`). |
| 40 | [THIET_KE_HOAN_THIEN_MAN_HINH_BOT_CONFIG_RPA.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/THIET_KE_HOAN_THIEN_MAN_HINH_BOT_CONFIG_RPA.md) | 14/09/2026 | Màn hình cấu hình Bot RPA ban đầu. |
| 41 | [THIET_KE_MAN_HINH_TRADING_MANAGER_VA_CORECCP.md](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/mxv-cqg-download-investigation/docs/cu/THIET_KE_MAN_HINH_TRADING_MANAGER_VA_CORECCP.md) | 14/09/2026 | Bản thiết kế màn hình Trading Manager cũ gộp chung (đã được thay thế hoàn toàn bởi bản `01/10` tách 2 trang). |
