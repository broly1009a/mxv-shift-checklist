import React from 'react';
import { Clock } from 'lucide-react';

interface BotStatusBadgeProps {
  status: string;
  isWaitingFiles?: boolean;
  isFailed?: boolean;
}

export const getBotStatusText = (status: string, isWaitingFiles?: boolean): string => {
  if (isWaitingFiles) return 'Chờ file';
  switch (status) {
    case 'PENDING':
      return 'Chờ xử lý';
    case 'PROCESSING':
      return 'Đang chạy';
    case 'AWAITING_CAPTCHA':
      return 'Chờ gõ Captcha';
    case 'COMPLETED':
      return 'Thành công';
    case 'FAILED':
      return 'Thất bại';
    default:
      return 'Không xác định';
  }
};

export const BotStatusBadge: React.FC<BotStatusBadgeProps> = ({
  status,
  isWaitingFiles,
  isFailed,
}) => {
  if (status === 'PROCESSING') {
    return (
      <span
        style={{
          fontSize: '0.68rem',
          padding: '3px 10px',
          borderRadius: '20px',
          fontWeight: 700,
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          color: '#60a5fa',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <Clock size={12} /> ĐANG XỬ LÝ
      </span>
    );
  }

  if (status === 'PENDING') {
    return (
      <span
        style={{
          fontSize: '0.68rem',
          padding: '3px 10px',
          borderRadius: '20px',
          fontWeight: 700,
          backgroundColor: 'rgba(156, 163, 175, 0.15)',
          color: '#9ca3af',
          border: '1px solid rgba(156, 163, 175, 0.3)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <Clock size={12} /> ĐANG XẾP HÀNG (CHỜ CHẠY)
      </span>
    );
  }

  if (status === 'AWAITING_CAPTCHA') {
    return (
      <span
        style={{
          fontSize: '0.68rem',
          padding: '3px 10px',
          borderRadius: '20px',
          fontWeight: 700,
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <Clock size={12} /> CHỜ NHẬP CAPTCHA
      </span>
    );
  }

  if (status === 'WAITING' || isWaitingFiles) {
    return (
      <span
        style={{
          fontSize: '0.68rem',
          padding: '3px 10px',
          borderRadius: '20px',
          fontWeight: 700,
          backgroundColor: 'rgba(251, 191, 36, 0.15)',
          color: '#fbbf24',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <Clock size={12} /> ĐANG CHỜ FILE
      </span>
    );
  }

  if (isFailed || status === 'FAILED') {
    return (
      <span
        style={{
          fontSize: '0.68rem',
          padding: '3px 10px',
          borderRadius: '20px',
          fontWeight: 700,
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        }}
      >
        ✕ CHƯA ĐẠT
      </span>
    );
  }

  return (
    <span
      style={{
        fontSize: '0.68rem',
        padding: '3px 10px',
        borderRadius: '20px',
        fontWeight: 700,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        color: '#34d399',
        border: '1px solid rgba(16, 185, 129, 0.3)',
      }}
    >
      ✓ ĐẠT YÊU CẦU
    </span>
  );
};
