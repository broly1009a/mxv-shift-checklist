import { TutorialStep } from '@/context/TutorialContext';
import {
  BookOpen,
  Zap,
  Download,
  TrendingUp,
  SlidersHorizontal,
  Table,
  Eye,
  Sliders,
  Bot,
  Save,
} from 'lucide-react';

export const tkgdTutorialSteps: TutorialStep[] = [
  {
    target: '#tutorial-tkgd-header',
    title: 'Phân Hệ Đối Soát & Mở TKGD',
    icon: BookOpen,
    description:
      'Hệ thống tự động hóa đối soát 3 chiều giữa yêu cầu mở tài khoản từ Email Outlook, dữ liệu trên web M-System và ảnh chụp Căn cước công dân / Hợp đồng đính kèm.',
    placement: 'bottom',
    padding: 10,
  },
  {
    target: '#tutorial-tkgd-auto-btn',
    title: 'Nút Chạy Tự Động Toàn Bộ',
    icon: Zap,
    description:
      'Nút bấm mặc định hàng ngày: Chỉ cần 1 lần click, bot sẽ tự động quét email mới, cào các tài khoản chưa có trên M-System, đối chiếu dữ liệu 3 chiều và chốt kết quả.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-sprint-mode',
    title: 'Chế Độ Bóc Tách: Nhanh vs Đầy Đủ',
    icon: SlidersHorizontal,
    description:
      'Chế độ Nhanh (Fast): Chỉ bóc tách thông tin text và OCR cơ bản để ra kết quả tức thì. Chế độ Đầy Đủ (Full): Tải toàn bộ ảnh CCCD gốc và chữ ký sống từ M-System về máy để đối chiếu sâu.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-excel-btn',
    title: 'Xuất Báo Cáo Excel Chuẩn TTBT',
    icon: Download,
    description:
      'Tải xuống bảng tính Excel Auto_Data_mail với đầy đủ màu sắc nhận diện: Xanh lá (Khớp 100%), Vàng (Cần kiểm tra lại), Đỏ (Sai lệch dữ liệu). File đồng thời được lưu trên ổ M:\\.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-stats-cards',
    title: 'Thống Kê Tổng Quan & Lọc Trực Quan',
    icon: TrendingUp,
    description:
      'Nhấp vào từng thẻ chỉ số (Tổng hồ sơ, Khớp 100%, Lệch dữ liệu, Chờ M-System, Phân hệ Futures/ACM/LME) để lọc nhanh bảng danh sách bên dưới.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-filter-bar',
    title: 'Thanh Tìm Kiếm & Bộ Lọc Nâng Cao',
    icon: SlidersHorizontal,
    description:
      'Tìm kiếm theo Mã TKGD, Tên khách hàng, Số CCCD hoặc lọc theo ngày nhận mail. Cho phép chuyển đổi chế độ xem Bảng Rộng hoặc Bảng Thu Gọn.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-table',
    title: 'Bảng Dữ Liệu Đối Soát Chi Tiết',
    icon: Table,
    description:
      'Hiển thị song song thông tin từ Email và M-System. Các ký hiệu biểu tượng giúp nhận biết ngay hồ sơ Khớp, Lệch hoặc Trường hợp đặc biệt (như số CMND cũ 9 số).',
    placement: 'top',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-inspect-col',
    title: 'Xem Đối Chiếu Chi Tiết Từng Hồ Sơ',
    icon: Eye,
    description:
      'Nhấn biểu tượng Con Mắt để mở cửa sổ đối chiếu chuyên sâu: Xem song song từng trường dữ liệu, phóng to ảnh chụp CCCD mặt trước/mặt sau và tài liệu đính kèm.',
    placement: 'left',
    padding: 8,
  },
];

export const tkgdConfigTutorialSteps: TutorialStep[] = [
  {
    target: '#tutorial-tkgd-config-header',
    title: 'Cấu Hình & Quản Trị Bot TKGD',
    icon: Sliders,
    description:
      'Nơi thiết lập toàn bộ tài khoản đăng nhập M-System, hòm thư Outlook, thư mục mạng và các quy tắc bóc tách tự động. Bạn có thể nhấn nút "Lưu Cấu Hình" sau khi hoàn tất thay đổi.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-config-operation-mode',
    title: '0. Chế Độ Vận Hành Hệ Thống (Operation Mode)',
    icon: Bot,
    description:
      'Lựa chọn cơ chế chạy: "Bot Tự Động 24/7" (bot chạy ngầm định kỳ mỗi 5-15 phút để quét mail và đối soát tự động) hoặc "Chạy Thủ Công / Lên Lịch Quét" (khi cán bộ chủ động bấm nút trên thanh công cụ).',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-config-profile',
    title: '1. Thông Tin Chuyên Viên',
    icon: BookOpen,
    description:
      'Khai báo họ và tên chuyên viên cùng phòng ban vận hành (Thanh toán bù trừ) để hệ thống ghi nhận nhật ký thao tác và thẩm định hồ sơ.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-config-ms',
    title: '2. Tài Khoản M-System & Thử Nghiệm Bot',
    icon: Zap,
    description:
      'Nhập tài khoản, mật khẩu và mã PIN M-System. Bạn có thể bấm nút "Kiểm Tra Đăng Nhập MS" để bot tự động thử kết nối và kiểm tra tính hợp lệ của tài khoản ngay lập tức.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-config-outlook',
    title: '3. Kết Nối Outlook Độc Lập (OAuth2)',
    icon: SlidersHorizontal,
    description:
      'Kết nối hòm thư nhận yêu cầu mở tài khoản (clearing.acc@mxv.vn). Cơ chế độc lập 100% giúp bảo mật và không bao giờ chia sẻ token với Checklist bot.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-config-storage',
    title: '4. Thư Mục Lưu Trữ Mạng (Ổ M:\\)',
    icon: Download,
    description:
      'Đường dẫn mạng chia sẻ thư mục lưu file Excel kết quả đối soát trên máy Windows và server Linux để toàn bộ phòng nghiệp vụ có thể mở và sử dụng ngay.',
    placement: 'top',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-config-excel',
    title: 'Tự Động Tô Màu File Excel',
    icon: Table,
    description:
      'Bật/tắt tự động tô màu xanh lá (Khớp hoàn toàn) hoặc vàng/đỏ (Cần kiểm tra/Sai lệch) cho các ô dữ liệu trong file Excel kết xuất.',
    placement: 'top',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-config-processing',
    title: '5. Động Cơ Bóc Tách, OCR & Đối Chiếu 3 Chiều',
    icon: Eye,
    description:
      'Cấu hình tự động tải tệp đính kèm email, lưu ảnh CCCD/chữ ký từ M-System về máy, tự động bóc tách PDF Hợp đồng/PL01, nhận diện OCR và kiểm tra chữ ký mẫu.',
    placement: 'top',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-config-save-btn',
    title: 'Lưu Cấu Hình & Áp Dụng Ngay',
    icon: Save,
    description:
      'Sau khi điều chỉnh các thông số, nhấn nút "Lưu Cấu Hình" để hệ thống đồng bộ ngay lập tức vào database và khởi tạo các tiến trình chạy ngầm nếu có.',
    placement: 'left',
    padding: 8,
  },
];

