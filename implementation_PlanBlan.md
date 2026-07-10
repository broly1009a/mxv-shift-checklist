Kết quả kiểm tra IT Tool
✅ IT Tool (C# - TransactionCheckingService.cs) ĐÃ có logic dùng Accounts_Balances
Hàm CheckEODCQG() (line 617) — đây chính là logic đồng bộ SOD:

Đọc qltkgdData (file QLTKGD từ M-System) và accountBalanceData (từ Accounts_Balances của CQG)
So sánh balance tính theo MS vs balance trong CQG: (soDuTKKQHienTai + choDaoHan - laiLoVND) / exRate
Gửi email alert nếu chênh lệch > 100
✅ Backend NestJS cũng đã có (reconciliation.service.ts + reconciliation.controller.ts)
Tuy nhiên backend này nhận file qua upload thủ công từ UI.

Tổng kết khoảng cách cần lấp
Thứ	Hiện trạng	Thiếu
IT Tool C#	✅ Có CheckEODCQG() đọc Accounts_Balances	❌ Cần tải file thủ công từ CAST
Backend NestJS	✅ Có checkEODCQG()	❌ Nhận file qua upload UI, không tự tải
Script CAST	🔄 Đang viết (script vừa xong)	Cần test với credentials thực
Kết luận: Script test-cast-download.ts vừa viết chính là phần còn thiếu — tự động tải file từ CAST thay vì thủ công. Khi bạn sẵn sàng test với credentials thực, chạy:
$env:CAST_USER="mxvhoangvan"; $env:CAST_PASS="mat_khau_thuc"; npm.cmd run test:cast-download
Script sẽ bypass cảnh báo IE bằng cách inject mock localeinfoproviderObj + dùng IE11 User-Agent, sau đó gọi doLogon() trực tiếp không qua onclick handler.