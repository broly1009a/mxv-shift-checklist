import { TutorialStep } from '@/context/TutorialContext';

export const settingsTutorialSteps: TutorialStep[] = [
  {
    target: '#tutorial-settings-header',
    title: '⚙️ Trang Cấu Hình & Hồ Sơ',
    description:
      'Đây là nơi bạn quản lý thông tin cá nhân, tuỳ chỉnh giao diện ứng dụng, cấu hình nhận cảnh báo Telegram và đổi mật khẩu bảo mật tài khoản.',
    placement: 'bottom',
    padding: 12,
  },
  {
    target: '#tutorial-settings-tab-profile',
    title: '👤 Tab Hồ sơ cá nhân',
    description:
      'Xem và cập nhật tên hiển thị của bạn. Một số thông tin như tên đăng nhập, vai trò phân quyền và bộ phận công tác chỉ có thể chỉnh sửa bởi Quản trị viên hệ thống.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-settings-fullname',
    title: '✏️ Chỉnh sửa họ và tên',
    description:
      'Đây là trường duy nhất bạn có thể tự chỉnh sửa trong tab Hồ sơ. Tên này sẽ xuất hiện trên biên bản bàn giao ca, nhật ký kiểm toán và trong danh sách người trực.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-settings-tab-notifications',
    title: '🔔 Tab Nhận cảnh báo & Ứng dụng',
    description:
      'Cấu hình giao diện hiển thị (sáng/tối), tần suất tự động làm mới dữ liệu, và kết nối nhận cảnh báo qua Telegram Bot cá nhân.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-settings-theme',
    title: '🌙 Giao diện Dark / Light Mode',
    description:
      'Chọn chế độ hiển thị phù hợp với môi trường làm việc của bạn. Chế độ tối (Dark Mode) được khuyến nghị cho ca đêm và môi trường phòng máy chủ ít ánh sáng.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-settings-refresh',
    title: '🔄 Tần suất tự động làm mới',
    description:
      'Hệ thống sẽ tự động tải lại dữ liệu checklist sau khoảng thời gian bạn chọn (10 giây đến 5 phút). Khoảng ngắn hơn = realtime hơn nhưng tốn tài nguyên mạng hơn.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-settings-sidebar-status',
    title: '📌 Thông tin giám sát Sidebar',
    description:
      'Bật/tắt hiển thị các thẻ thông tin trạng thái hệ thống và tiến độ ca trực trên thanh sidebar. Tắt nếu bạn muốn sidebar gọn hơn khi làm việc trên màn hình nhỏ.',
    placement: 'right',
    padding: 8,
  },
  {
    target: '#tutorial-settings-telegram-toggle',
    title: '📱 Kích hoạt nhận tin Telegram',
    description:
      'Bật tính năng này để nhận tin nhắn nhắc nhở trực tiếp từ Bot Telegram của hệ thống khi có tác vụ sắp đến deadline hoặc có sự cố mới phát sinh trong ca của bạn.',
    placement: 'right',
    padding: 8,
  },
  {
    target: '#tutorial-settings-telegram-id',
    title: '🆔 Telegram Chat ID cá nhân',
    description:
      'Điền Chat ID Telegram của bạn để nhận tin nhắn riêng từ Bot. Cách lấy ID: tìm bot @MXV_Checklist_Bot → /start → nhắn /my_id. Hoặc dùng @userinfobot để lấy ID số của bạn.',
    placement: 'top',
    padding: 8,
  },
  {
    target: '#tutorial-settings-alert-threshold',
    title: '⏰ Thời gian nhắc trước deadline',
    description:
      'Nhập số phút. Nếu một tác vụ chưa hoàn thành và deadline còn lại ≤ số phút này, Bot sẽ tự động gửi cảnh báo riêng cho bạn qua Telegram. Ví dụ: 15 phút = nhắc trước 15 phút.',
    placement: 'top',
    padding: 8,
  },
  {
    target: '#tutorial-settings-tab-security',
    title: '🔐 Tab Bảo mật & Đổi mật khẩu',
    description:
      'Chuyển sang tab này để đổi mật khẩu đăng nhập. Nhập mật khẩu mới và xác nhận lại — để trống nếu không muốn thay đổi. Khuyến nghị dùng mật khẩu dài, kết hợp chữ hoa, số và ký tự đặc biệt.',
    placement: 'bottom',
    padding: 8,
  },
  {
    target: '#tutorial-settings-save-btn',
    title: '💾 Lưu tất cả thay đổi',
    description:
      'Nhấn nút này sau khi chỉnh sửa bất kỳ thông tin nào để lưu. Tất cả thay đổi (hồ sơ, cài đặt ứng dụng, mật khẩu) được gửi lên server trong một lần duy nhất. Bạn sẽ thấy thông báo xác nhận khi lưu thành công.',
    placement: 'top',
    padding: 8,
  },
];
