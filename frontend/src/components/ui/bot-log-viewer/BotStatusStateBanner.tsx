import React from 'react';
import { Clock, AlertCircle } from 'lucide-react';

interface BotStatusStateBannerProps {
  status: string;
  hasJsonResult?: boolean;
}

export const BotStatusStateBanner: React.FC<BotStatusStateBannerProps> = ({
  status,
  hasJsonResult,
}) => {
  if (status === 'PENDING' || status === 'PROCESSING' || status === 'AWAITING_CAPTCHA') {
    return (
      <div
        style={{
          padding: '30px',
          textAlign: 'center',
          background: 'var(--bg-input)',
          border: '1px dashed var(--border-color)',
          borderRadius: '12px',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          margin: '20px 0',
        }}
      >
        <Clock
          size={28}
          className="animate-pulse"
          style={{
            color:
              status === 'PROCESSING'
                ? '#60a5fa'
                : status === 'AWAITING_CAPTCHA'
                ? '#f59e0b'
                : '#9ca3af',
          }}
        />
        <h4
          style={{
            fontSize: '0.9rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {status === 'PROCESSING'
            ? 'Tác vụ đang chạy đối chiếu...'
            : status === 'AWAITING_CAPTCHA'
            ? 'Tác vụ đang chờ nhập mã Captcha...'
            : 'Tác vụ đang xếp hàng chờ chạy...'}
        </h4>
        <p
          style={{
            fontSize: '0.78rem',
            maxWidth: '400px',
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {status === 'PROCESSING'
            ? 'Bot đang thực hiện tải file và tính toán đối chiếu dữ liệu. Báo cáo trực quan sẽ hiển thị đầy đủ ngay sau khi tác vụ hoàn tất.'
            : status === 'AWAITING_CAPTCHA'
            ? 'Vui lòng gõ mã Captcha trong thông báo phía trên để Bot có thể tiếp tục tự động đăng nhập và tải dữ liệu báo cáo.'
            : 'Hàng đợi đang bận xử lý tác vụ khác. Bot sẽ tự động thực hiện đối chiếu này ngay khi đến lượt.'}
        </p>
      </div>
    );
  }

  if (status === 'FAILED' && !hasJsonResult) {
    return (
      <div
        style={{
          padding: '30px',
          textAlign: 'center',
          background: 'rgba(239, 68, 68, 0.02)',
          border: '1px dashed rgba(239, 68, 68, 0.25)',
          borderRadius: '12px',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          margin: '20px 0',
        }}
      >
        <AlertCircle size={28} style={{ color: '#ef4444' }} />
        <h4
          style={{
            fontSize: '0.9rem',
            fontWeight: 700,
            color: '#f87171',
            margin: 0,
          }}
        >
          Tác vụ thất bại do lỗi kỹ thuật
        </h4>
        <p
          style={{
            fontSize: '0.78rem',
            maxWidth: '450px',
            margin: 0,
            lineHeight: 1.4,
            color: 'var(--text-secondary)',
          }}
        >
          Hệ thống gặp sự cố khi đang tải file hoặc đăng nhập (ví dụ: lỗi Captcha,
          hết hạn quota Gemini, thiếu file nguồn...). Vui lòng bấm vào tab{' '}
          <strong>"Log chi tiết (Raw Logs)"</strong> ở phía trên để kiểm tra
          nguyên nhân cụ thể.
        </p>
      </div>
    );
  }

  return null;
};
