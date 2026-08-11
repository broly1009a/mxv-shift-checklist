import { TutorialStep } from '@/context/TutorialContext';
import {
  Home,
  Calendar,
  Settings,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
  PlusCircle,
  Cpu,
  DollarSign,
  Activity,
} from 'lucide-react';

export const dashboardTutorialSteps: TutorialStep[] = [
  {
    target: '#tutorial-dashboard-header',
    title: 'Bảng điều khiển tổng quan',
    icon: Home,
    description:
      'Đây là trang trung tâm của hệ thống MXV Shift Checklist. Bạn có thể theo dõi toàn bộ hoạt động ca trực, giám sát sự cố, và khởi tạo ca mới từ đây.',
    placement: 'bottom',
    padding: 12,
  },
  {
    target: '#tutorial-dashboard-date-picker',
    title: 'Bộ chọn ngày giám sát',
    icon: Calendar,
    description:
      'Chọn ngày muốn xem dữ liệu. Mặc định là ngày hôm nay theo giờ Việt Nam. Thay đổi ngày sẽ tải lại toàn bộ dữ liệu ca trực, biểu đồ và thống kê theo ngày đó.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-dashboard-layout-btn',
    title: 'Tùy chỉnh bố cục Dashboard',
    icon: Settings,
    description:
      'Nhấn nút này để mở bảng tuỳ chỉnh: chuyển đổi giữa chế độ 2 cột và toàn màn hình, bật/tắt biểu đồ hiệu suất và nhật ký hoạt động theo sở thích cá nhân.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-dashboard-performance',
    title: 'Tổng quan hiệu suất ca trực',
    icon: BarChart3,
    description:
      '4 thẻ thống kê nhanh hiển thị: tổng số ca trong ngày, số ca đang chạy, số ca đã chốt, và tỷ lệ hoàn thành trung bình. Dữ liệu cập nhật realtime qua WebSocket.',
    placement: 'bottom',
    padding: 12,
  },
  {
    target: '#tutorial-widget-chart',
    title: 'Biểu đồ hiệu suất theo giờ',
    icon: TrendingUp,
    description:
      'Biểu đồ trực quan hiển thị tiến độ hoàn thành công việc theo từng khung giờ trong ngày. Giúp giám sát viên nhận biết nhanh các khung giờ có tỷ lệ hoàn thành thấp cần chú ý.',
    placement: 'right',
    padding: 8,
  },
  {
    target: '#tutorial-widget-incidents',
    title: 'Sự cố đang xảy ra',
    icon: AlertTriangle,
    description:
      'Liệt kê tất cả sự cố (incident) chưa được xử lý trong hệ thống. Mỗi sự cố có mức độ nghiêm trọng, tên công việc liên quan và thời gian phát sinh. Nhấn vào để xem chi tiết.',
    placement: 'right',
    padding: 8,
  },
  {
    target: '#tutorial-widget-active-shifts',
    title: 'Ca trực đang diễn ra',
    icon: PlayCircle,
    description:
      'Danh sách các ca trực với trạng thái ĐANG CHẠY trong ngày được chọn. Hiển thị tên template, người trực chính và thanh tiến độ hoàn thành. Nhấn vào một ca để mở worksheet chi tiết.',
    placement: 'right',
    padding: 8,
  },
  {
    target: '#tutorial-widget-history',
    title: 'Lịch sử ca đã chốt',
    icon: CheckCircle2,
    description:
      'Danh sách các ca trực đã được chốt (COMPLETED) trong ngày. Nhấn vào từng ca để xem lại biên bản bàn giao và toàn bộ chi tiết tác vụ sau khi ca kết thúc.',
    placement: 'right',
    padding: 8,
  },
  {
    target: '#tutorial-widget-init-shift',
    title: 'Khởi tạo ca trực mới (thủ công)',
    icon: PlusCircle,
    description:
      'Chọn một mẫu checklist (template) từ danh sách và nhấn "Khởi tạo" để tạo ca trực mới cho ngày hiện tại. Chỉ dành cho người dùng có quyền quản lý.',
    placement: 'left',
    padding: 8,
  },
  {
    target: '#tutorial-widget-auto-shift',
    title: 'Sinh ca trực tự động',
    icon: Cpu,
    description:
      'Chạy lệnh sinh ca hàng loạt cho một ngày cụ thể dựa trên lịch đã cấu hình. Hệ thống sẽ bỏ qua các ngày nghỉ/không giao dịch và thông báo kết quả tạo ca.',
    placement: 'left',
    padding: 8,
  },
  {
    target: '#tutorial-widget-margin',
    title: 'Yêu cầu thay đổi Ký quỹ',
    icon: DollarSign,
    description:
      'Widget theo dõi các yêu cầu thay đổi tỷ lệ ký quỹ đang chờ xử lý. Hiển thị trạng thái duyệt, người yêu cầu và mức thay đổi. Chỉ hiển thị với tài khoản có quyền truy cập ký quỹ.',
    placement: 'left',
    padding: 8,
  },
  {
    target: '#tutorial-widget-health',
    title: 'Kiểm tra sức khỏe hệ thống',
    icon: Activity,
    description:
      'Hiển thị trạng thái các dịch vụ quan trọng (API server, Bot Telegram, kết nối WebSocket…). Màu xanh = hoạt động bình thường, màu đỏ = cần kiểm tra ngay.',
    placement: 'left',
    padding: 8,
  },
];
