import { TutorialStep } from '@/context/TutorialContext';

export const checklistTutorialSteps: TutorialStep[] = [
  {
    target: '#tutorial-checklist-breadcrumb',
    title: '📁 Điều hướng Breadcrumb',
    description:
      'Thanh điều hướng cho biết bạn đang ở đâu trong hệ thống. Nhấn "Bảng điều khiển" để quay về Dashboard, hoặc "Danh sách ca trực" để xem danh sách tất cả ca đang chạy.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-checklist-shift-switcher',
    title: '⚡ Chuyển nhanh giữa các ca',
    description:
      'Nếu có nhiều ca đang chạy đồng thời, dropdown này cho phép bạn chuyển nhanh sang worksheet của ca khác mà không cần quay lại trang danh sách.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-checklist-tech-btn',
    title: '🔧 Xem mã kỹ thuật',
    description:
      'Bật chế độ hiển thị thêm thông tin kỹ thuật (Task ID, trạng thái bot, thời điểm kiểm tra…) bên cạnh các tác vụ. Hữu ích cho vận hành viên cần debug hoặc tra cứu chi tiết hệ thống.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-checklist-trading-report-btn',
    title: '📊 Báo cáo Giao dịch',
    description:
      'Mở cửa sổ Báo cáo Giao dịch — cho phép tải xuống và xem báo cáo RPA từ M-System và CQG. Dùng cho tác vụ kiểm tra khối lượng giao dịch trong phiên và cuối ngày.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-checklist-export-btn',
    title: '📥 Xuất file Excel',
    description:
      'Tải toàn bộ dữ liệu ca trực hiện tại ra file Excel (.xlsx). File bao gồm: thông tin ca, danh sách tác vụ kèm trạng thái, ghi chú và thời gian kiểm tra của từng hạng mục.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-checklist-print-btn',
    title: '🖨️ In Biên Bản (PDF)',
    description:
      'In hoặc xuất PDF biên bản bàn giao ca trực theo đúng mẫu của MXV, bao gồm bảng ký tên người bàn giao và người tiếp nhận. Trang in được tối ưu với font Times New Roman chuẩn văn phòng.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-checklist-shift-banner',
    title: '📋 Thông tin ca trực',
    description:
      'Khung này hiển thị tên ca, loại phiên (Mở Cửa / Trong Phiên / Đóng Cửa), ngày trực, người trực chính và trạng thái. Chỉ báo LIVE màu xanh xác nhận dữ liệu đang được cập nhật realtime.',
    placement: 'bottom',
    padding: 12,
  },
  {
    target: '#tutorial-checklist-progress',
    title: '📈 Thanh tiến độ ca trực',
    description:
      'Hiển thị phần trăm tác vụ đã hoàn thành trong ca. Thanh màu xanh lá = đang chạy, màu xanh dương = đã chốt hoàn toàn. Tỷ lệ được tính tự động khi bạn tick xong các tác vụ.',
    placement: 'left',
    padding: 8,
  },
  {
    target: '#tutorial-checklist-close-shift-btn',
    title: '🔒 Nút Chốt Ca Trực',
    description:
      'Nhấn để bắt đầu quy trình chốt ca: nhập ghi chú bàn giao, xác nhận và khóa worksheet. Sau khi chốt, tất cả tác vụ sẽ chuyển về chế độ xem chỉ đọc (read-only).',
    placement: 'left',
    padding: 8,
  },
  {
    target: '#tutorial-checklist-task-table',
    title: '📝 Bảng danh sách tác vụ',
    description:
      'Toàn bộ checklist ca trực được hiển thị ở đây. Mỗi hàng là một tác vụ với: checkbox hoàn thành, tên tác vụ, mức ưu tiên (Thấp/Trung/Cao/Khẩn), deadline, trạng thái chi tiết và ô ghi chú.',
    placement: 'top',
    padding: 8,
  },
  {
    target: '#tutorial-checklist-filter-bar',
    title: '🔍 Lọc và tìm kiếm tác vụ',
    description:
      'Gõ từ khóa để tìm nhanh tên tác vụ. Dùng dropdown "Ưu tiên" và "Trạng thái" để lọc theo mức độ quan trọng hoặc tình trạng hoàn thành. Rất hữu ích khi worksheet có nhiều hạng mục.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-checklist-adhoc-btn',
    title: '➕ Thêm tác vụ phát sinh (Adhoc)',
    description:
      'Tạo nhanh một tác vụ ngoài kế hoạch trong ca trực hiện tại. Nhập tên tác vụ, chọn mức ưu tiên và deadline. Tác vụ adhoc sẽ xuất hiện ngay trong bảng và được ghi vào nhật ký.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-checklist-incidents',
    title: '🚨 Panel Quản lý Sự cố',
    description:
      'Liệt kê các sự cố được ghi nhận trong ca. Nhấn vào một sự cố để mở form xử lý: điền nguyên nhân gốc rễ, biện pháp khắc phục và danh sách tài khoản bị ảnh hưởng để đóng sự cố.',
    placement: 'top',
    padding: 8,
  },
  {
    target: '#tutorial-checklist-audit',
    title: '📜 Nhật ký kiểm toán (Audit Trail)',
    description:
      'Ghi lại toàn bộ hành động trong ca theo thứ tự thời gian: ai tick tác vụ nào, lúc mấy giờ, thay đổi trạng thái gì. Đây là bằng chứng đầy đủ cho việc kiểm tra và bàn giao ca.',
    placement: 'top',
    padding: 8,
  },
];
