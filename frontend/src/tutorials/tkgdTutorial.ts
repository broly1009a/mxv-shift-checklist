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
    target: '#tutorial-tkgd-export-btn',
    title: 'Tải File Excel Báo Cáo',
    icon: Download,
    description:
      'Tải file Excel kết quả đối soát chuẩn (Auto_Data_mail_YYYYMMDD.xlsx) đã được tự động tô màu xanh lá (Khớp), vàng cam (Cần kiểm tra lại) và đỏ (Sai lệch) để báo cáo ca trực.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-advanced-btn',
    title: 'Thao Tác Nâng Cao',
    icon: SlidersHorizontal,
    description:
      'Chỉ dùng khi xử lý sự cố hoặc can thiệp thủ công: Quét lại email riêng lẻ, cào lại M-System cho hồ sơ còn thiếu, hoặc chuyển đổi chế độ Nhanh (Text) / Đầy đủ (Tệp & Ảnh).',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-stats-cards',
    title: 'Thống Kê Số Liệu Ca Trực',
    icon: TrendingUp,
    description:
      'Tổng quan nhanh số lượng hồ sơ: Khớp hoàn toàn 100%, Cần kiểm tra lại (thẻ Căn Cước mẫu mới 2024 hoặc HĐ khuyết trường), và Có sai lệch dữ liệu định danh.',
    placement: 'bottom',
    padding: 10,
  },
  {
    target: '#tutorial-tkgd-tabs',
    title: 'Bộ Lọc Trạng Thái & Phân Hệ',
    icon: Sliders,
    description:
      'Bấm vào các tab để lọc tức thì: Xem nhanh nhóm hồ sơ "Cần Ktra" để kiểm tra mắt, hoặc xem theo phân hệ tài khoản Futures, ACM (-A), LME (-L), Spread (-S).',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-table',
    title: 'Bảng Dữ Liệu Đối Soát',
    icon: Table,
    description:
      'Danh sách khách hàng mở tài khoản. Chú ý các nhãn trạng thái: Xanh lá (Khớp), Vàng cam (Cần kiểm tra lại do là Căn cước mới 2024 / CMND cũ), Đỏ (Sai lệch).',
    placement: 'top',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-inspect-btn, [data-tutorial="inspect-btn"], #tutorial-tkgd-inspect-col',
    title: 'So Sánh Trực Quan & Xem Ảnh CCCD',
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
      'Nơi thiết lập toàn bộ tài khoản đăng nhập M-System, hòm thư Outlook, thư mục mạng và các quy tắc bóc tách tự động. Nhớ nhấn "Lưu Cấu Hình" sau khi thay đổi.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-config-profile',
    title: '1. Thông Tin Chuyên Viên',
    icon: BookOpen,
    description:
      'Khai báo họ và tên chuyên viên cùng phòng ban vận hành ca trực để hệ thống ghi nhận nhật ký thao tác và thẩm định hồ sơ.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-tkgd-config-ms',
    title: '2. Tài Khoản M-System & Thử Nghiệm Bot',
    icon: Zap,
    description:
      'Nhập tài khoản, mật khẩu và mã PIN M-System. Bạn có thể bấm nút "Kiểm Tra Đăng Nhập MS" để bot tự động thử kết nối ngay lập tức.',
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
      'Đường dẫn mạng chia sẻ thư mục lưu file Excel kết quả đối soát trên máy Windows và server Linux để toàn bộ phòng nghiệp vụ có thể mở ngay.',
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
];

