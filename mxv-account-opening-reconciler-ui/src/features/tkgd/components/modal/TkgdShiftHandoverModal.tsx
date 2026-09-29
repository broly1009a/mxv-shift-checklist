'use client';

import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Printer,
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  Server,
  Sparkles,
} from 'lucide-react';
import { TkgdAnalyticsSummary, TkgdShiftType } from '../../types/tkgd.types';

interface TkgdShiftHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  analyticsData: TkgdAnalyticsSummary;
  currentUser?: { name?: string; email?: string };
}

const shiftNameMap: Record<TkgdShiftType, string> = {
  ALL: 'CẢ NGÀY (00:00 - 24:00)',
  MORNING: 'PHIÊN SÁNG (08:00 - 12:00)',
  AFTERNOON: 'PHIÊN CHIỀU (13:00 - 17:30)',
  OVERTIME: 'NGOÀI GIỜ HÀNH CHÍNH (SAU 17:30)',
  NIGHT: 'NGOÀI GIỜ HÀNH CHÍNH (SAU 17:30)',
};

export const TkgdShiftHandoverModal: React.FC<TkgdShiftHandoverModalProps> = ({
  isOpen,
  onClose,
  analyticsData,
  currentUser,
}) => {
  const [copied, setCopied] = useState(false);
  const [recipientName, setRecipientName] = useState('Lãnh đạo Phòng QLGD / TTBT');
  const [handoverNotes, setHandoverNotes] = useState('');

  if (!isOpen) return null;

  const currentShiftTitle = shiftNameMap[analyticsData.shift] || analyticsData.shift;
  const now = new Date();
  const exportTimeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const exportDateStr = analyticsData.dateRangeLabel || analyticsData.batchDate || now.toLocaleDateString('vi-VN');
  const staffName = currentUser?.name || currentUser?.email?.split('@')[0] || 'Trương Hoàng Hiệp (TTBT)';

  const { kpi, pendingHandoverList, latency } = analyticsData;

  // Xây dựng nội dung văn bản báo cáo đối soát mở TKGD
  const generatePlainTextReport = () => {
    let text = `========================================================================================\n`;
    text += `                        SỞ GIAO DỊCH HÀNG HÓA VIỆT NAM (MXV)\n`;
    text += `              BÁO CÁO THẨM ĐỊNH & ĐỐI SOÁT HỒ SƠ MỞ TÀI KHOẢN GIAO DỊCH\n`;
    text += `========================================================================================\n\n`;

    text += `1. THÔNG TIN BÁO CÁO:\n`;
    text += `   - Thời gian đối soát : ${exportDateStr}\n`;
    text += `   - Khung giờ tiếp nhận: ${currentShiftTitle}\n`;
    text += `   - Cán bộ lập báo cáo : ${staffName}\n`;
    text += `   - Kính gửi           : ${recipientName || 'Lãnh đạo Phòng QLGD / TTBT'}\n`;
    text += `   - Thời gian xuất     : ${exportTimeStr}\n\n`;

    text += `2. TỔNG KẾT KHỐI LƯỢNG TIẾP NHẬN & ĐỐI SOÁT:\n`;
    text += `   - Tổng hồ sơ tiếp nhận      : ${kpi.totalEmails} hồ sơ\n`;
    text += `   - Đã xử lý & Khớp 100%      : ${kpi.matchedCount} hồ sơ (${kpi.matchRate}%) -> Đủ điều kiện kích hoạt\n`;
    text += `   - Cần kiểm tra lại / Lệch   : ${kpi.canKiemTraCount + kpi.mismatchedCount} hồ sơ\n`;
    text += `   - Hồ sơ Vi phạm quy chuẩn   : ${kpi.invalidFormatCount} hồ sơ (Đã yêu cầu TVKD chuẩn hóa)\n`;
    text += `   - Hồ sơ tồn đọng cần xử lý  : ${pendingHandoverList.length} hồ sơ (Chi tiết mục 3)\n\n`;

    text += `3. DANH SÁCH CHI TIẾT HỒ SƠ TỒN ĐỌNG CẦN XỬ LÝ (${pendingHandoverList.length} hồ sơ):\n`;
    if (pendingHandoverList.length === 0) {
      text += `   (Không có tài khoản tồn đọng, toàn bộ hồ sơ đã hoàn tất đối soát 100%)\n`;
    } else {
      text += `┌────┬──────────────┬──────────────────┬──────┬────────────────────────────────┬───────────────────────────┐\n`;
      text += `│STT │   MÃ TKGD    │ HỌ VÀ TÊN KH     │ TVKD │       LÝ DO CẦN XỬ LÝ          │     BIỆN PHÁP XỬ LÝ       │\n`;
      text += `├────┼──────────────┼──────────────────┼──────┼────────────────────────────────┼───────────────────────────┤\n`;
      pendingHandoverList.forEach((item, idx) => {
        const stt = String(idx + 1).padEnd(4, ' ');
        const ma = item.maTKGD.padEnd(12, ' ');
        const ten = (item.hoVaTen || '---').padEnd(16, ' ').slice(0, 16);
        const tvkd = (item.maTVKD || '---').padEnd(4, ' ');
        const lyDo = (item.lyDoLech || '---').padEnd(30, ' ').slice(0, 30);
        const hd = (item.hanhDongCaSau || 'Đôn đốc TVKD bổ sung').padEnd(25, ' ').slice(0, 25);
        text += `│${stt}│ ${ma} │ ${ten} │ ${tvkd} │ ${lyDo} │ ${hd} │\n`;
      });
      text += `└────┴──────────────┴──────────────────┴──────┴────────────────────────────────┴───────────────────────────┘\n`;
    }

    if (handoverNotes.trim()) {
      text += `\n* Ghi chú bổ sung của cán bộ thẩm định:\n  ${handoverNotes.trim()}\n`;
    }

    text += `\n4. ĐÁNH GIÁ HIỆU NĂNG HỆ THỐNG ĐỐI SOÁT:\n`;
    text += `   - Tốc độ xử lý bình quân : ${latency.avgTotalSeconds} giây/hồ sơ (Mục tiêu: < 20s)\n`;
    text += `   - Năng lực xử lý ước tính: ~${latency.throughputPerHour} hồ sơ/giờ\n`;
    text += `   - Đánh giá hạ tầng       : ${latency.healthStatus === 'HEALTHY' ? '🟢 Hạ tầng ổn định, luồng xử lý thông suốt' : '🟡 Cần lưu ý'}\n`;
    text += `========================================================================================\n`;

    return text;
  };

  const handleCopy = () => {
    const text = generatePlainTextReport();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadTxt = () => {
    const text = generatePlainTextReport();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BaoCao_DoiSoat_MoTKGD_${analyticsData.batchDate}_${analyticsData.range}_${analyticsData.shift}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-card, #1e293b)',
          borderRadius: '18px',
          border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.1))',
            background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Báo Cáo Thẩm Định & Đối Soát Hồ Sơ Mở TKGD
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Hệ thống tự động tổng hợp số liệu tiếp nhận, kết quả đối soát và danh sách hồ sơ cần xử lý
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Input Bar: Kính gửi & Ghi chú */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 24px',
            backgroundColor: 'rgba(0,0,0,0.15)',
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.05))',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
            <UserCheck size={16} color="#3b82f6" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Kính gửi:
            </span>
            <input
              type="text"
              placeholder="Lãnh đạo Phòng QLGD / TTBT..."
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                backgroundColor: 'var(--bg-input, rgba(255,255,255,0.05))',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1.5, minWidth: '300px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Ghi chú:
            </span>
            <input
              type="text"
              placeholder="Ví dụ: Đã gửi email yêu cầu TVKD 003 bổ sung bản quét CCCD..."
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                backgroundColor: 'var(--bg-input, rgba(255,255,255,0.05))',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
              }}
            />
          </div>
        </div>

        {/* Report Content Body (Scrollable & Monospace preview) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            backgroundColor: 'var(--bg-app, #0f172a)',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '0.82rem',
            lineHeight: 1.6,
            color: 'var(--text-primary, #e2e8f0)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {generatePlainTextReport()}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color, rgba(255,255,255,0.1))',
            backgroundColor: 'var(--bg-card, #1e293b)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={15} color="#10b981" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Dữ liệu tự động đồng bộ từ Máy chủ Đối soát MXV
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleCopy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid var(--border-color, rgba(255,255,255,0.2))',
                backgroundColor: copied ? '#10b981' : 'rgba(255,255,255,0.05)',
                color: copied ? '#ffffff' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
              <span>{copied ? 'Đã Sao Chép!' : 'Sao Chép Báo Cáo'}</span>
            </button>

            <button
              onClick={handleDownloadTxt}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid var(--border-color, rgba(255,255,255,0.2))',
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <Download size={15} />
              <span>Tải File .txt</span>
            </button>

            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid var(--border-color, rgba(255,255,255,0.2))',
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <Printer size={15} />
              <span>In Báo Cáo</span>
            </button>

            <button
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
