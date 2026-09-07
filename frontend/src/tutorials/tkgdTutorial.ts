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
    title: 'Nút Chạy Tự Động (All-in-One)',
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
