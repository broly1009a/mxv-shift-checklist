import React, { useState } from 'react';
import {
  Zap,
  Download,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Mail,
  Globe,
  RefreshCw,
  Loader2,
  Bot,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  PlayCircle,
} from 'lucide-react';
import { SprintMode, TkgdAutoPipelineStatus, RunPipelineOptions } from '../types/tkgd.types';

interface TkgdActionToolbarProps {
  sprintMode: SprintMode;
  setSprintMode: (mode: SprintMode) => void;
  isProcessing: boolean;
  processingStage: string;
  pendingMsCount?: number;
  showStats: boolean;
  toggleStats: () => void;
  onRunPipelineAll: (options?: Partial<RunPipelineOptions>) => void;
  onDownloadExcel: () => void;
  onSyncMail: () => void;
  onSyncMSystem: () => void;
  onRunReconcile: () => void;
  autoStatus?: TkgdAutoPipelineStatus | null;
}

export const TkgdActionToolbar: React.FC<TkgdActionToolbarProps> = ({
  sprintMode,
  setSprintMode,
  isProcessing,
  processingStage,
  pendingMsCount = 0,
  showStats,
  toggleStats,
  onRunPipelineAll,
  onDownloadExcel,
  onSyncMail,
  onSyncMSystem,
  onRunReconcile,
  autoStatus,
}) => {
  const [showAdvancedActions, setShowAdvancedActions] = useState<boolean>(false);
  const [showRunConfigModal, setShowRunConfigModal] = useState<boolean>(false);
  const [timeRangeMode, setTimeRangeMode] = useState<'TODAY' | 'CUSTOM'>('TODAY');
  const [customFromDateTime, setCustomFromDateTime] = useState<string>('');
  const [customToDateTime, setCustomToDateTime] = useState<string>('');
  const [smartSkipEnabled, setSmartSkipEnabled] = useState<boolean>(true);

  // Tính toán khoảng thời gian thực tế dựa trên chế độ người dùng chọn
  const getCalculatedTimeRange = () => {
    const now = new Date();

    if (timeRangeMode === 'TODAY') {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      return {
        fromDateTime: from.toISOString(),
        toDateTime: now.toISOString(),
        label: `Hôm nay (00:00 - ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`,
      };
    }

    if (timeRangeMode === 'CUSTOM') {
      return {
        fromDateTime: customFromDateTime ? new Date(customFromDateTime).toISOString() : undefined,
        toDateTime: customToDateTime ? new Date(customToDateTime).toISOString() : undefined,
        label: 'Khoảng thời gian tùy chỉnh',
      };
    }

    return { label: 'Toàn bộ' };
  };

  const handleExecuteRun = () => {
    const { fromDateTime, toDateTime } = getCalculatedTimeRange();
    setShowRunConfigModal(false);
    onRunPipelineAll({
      fromDateTime,
      toDateTime,
      forceReparse: !smartSkipEnabled,
    });
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Chỉ báo trạng thái Tự Động 24/7 (Badge tinh tế) */}
        {autoStatus?.enabled && (
          <div
            title={`Bot đang chạy ngầm định kỳ mỗi ${autoStatus.intervalMinutes || 5} phút (quét mail, bóc tách và đối soát). Cấu hình tại tab Cài Đặt & Cấu Hình Bot.`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#10b981',
              fontSize: '0.74rem',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 6px #10b981',
                display: 'inline-block',
              }}
              className="animate-pulse"
            />
            <span>Tự Động 24/7</span>
            {autoStatus?.lastRunTime ? (
              <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>
                ({new Date(autoStatus.lastRunTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
              </span>
            ) : null}
          </div>
        )}

        {/* 1. HERO BUTTON: CHẠY QUY TRÌNH TOÀN BỘ (All-in-One Pipeline) */}
        <button
          id="tutorial-tkgd-auto-btn"
          onClick={() => setShowRunConfigModal(true)}
          disabled={isProcessing}
          title="Thiết lập và chạy toàn bộ quy trình: Quét Mail -> Cào M-System -> Đối Soát Chéo -> Xuất Excel"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.8rem',
            border: 'none',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
            transition: 'all 0.2s ease',
          }}
          className="hover:scale-105 active:scale-95"
        >
          {isProcessing ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Zap size={14} fill="#fef08a" color="#fef08a" />
          )}
          <span>{isProcessing ? 'Đang chạy...' : 'Chạy Tự Động Toàn Bộ'}</span>
        </button>

        {/* 2. TIỆN ÍCH: TẢI FILE EXCEL */}
        <button
          id="tutorial-tkgd-export-btn"
          onClick={onDownloadExcel}
          disabled={isProcessing}
          title="Tải file Excel kết quả đối soát mới nhất về máy"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '10px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#10b981',
            fontWeight: 700,
            fontSize: '0.76rem',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
          }}
          className="hover:bg-emerald-500 hover:text-white"
        >
          <Download size={14} />
          <span>Tải File Excel</span>
        </button>

        {/* 3. THAO TÁC NÂNG CAO (Dropdown / Menu Popover) */}
        <div style={{ position: 'relative' }}>
          <button
            id="tutorial-tkgd-advanced-btn"
            onClick={() => setShowAdvancedActions((prev) => !prev)}
            title="Mở các thao tác bổ trợ: Quét mail riêng, Cào MS riêng, Đổi chế độ Nhanh/Đầy đủ"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 12px',
              borderRadius: '10px',
              backgroundColor: showAdvancedActions ? 'var(--bg-input)' : 'var(--bg-card)',
              border: showAdvancedActions ? '1px solid #3b82f6' : '1px solid var(--border-color)',
              color: showAdvancedActions ? '#3b82f6' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            className="hover:text-blue-500 hover:border-blue-400"
          >
            <SlidersHorizontal size={13} />
            <span>Nâng Cao</span>
            <ChevronDown
              size={13}
              style={{
                transform: showAdvancedActions ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease',
              }}
            />
          </button>

          {/* Dropdown Menu Nội Dung Nâng Cao */}
          {showAdvancedActions && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                zIndex: 50,
                minWidth: '280px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '12px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
              className="animate-fade-in"
            >
              {/* Section 1: Chế độ chạy */}
              <div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                    letterSpacing: '0.04em',
                  }}
                >
                  Chế Độ Bóc Tách
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '3px',
                    gap: '3px',
                  }}
                >
                  <button
                    onClick={() => setSprintMode('FAST')}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: sprintMode === 'FAST' ? '#3b82f6' : 'transparent',
                      color: sprintMode === 'FAST' ? '#ffffff' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Nhanh (Text)
                  </button>
                  <button
                    onClick={() => setSprintMode('FULL')}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: sprintMode === 'FULL' ? '#8b5cf6' : 'transparent',
                      color: sprintMode === 'FULL' ? '#ffffff' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Đầy Đủ (Tệp/Ảnh)
                  </button>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', margin: '2px 0' }} />

              {/* Section 2: Chạy Thủ Công Từng Bước */}
              <div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                    letterSpacing: '0.04em',
                  }}
                >
                  Chạy Thủ Công Từng Bước
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {/* Nút 1: Quét Mail */}
                  <button
                    onClick={() => {
                      setShowAdvancedActions(false);
                      onSyncMail();
                    }}
                    disabled={isProcessing}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                    }}
                    className="hover:border-blue-400 hover:text-blue-500"
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={13} color="#3b82f6" />
                      <span>1. Quét Mail Riêng</span>
                    </span>
                  </button>

                  {/* Nút 2: Cào M-System */}
                  <button
                    onClick={() => {
                      setShowAdvancedActions(false);
                      onSyncMSystem();
                    }}
                    disabled={isProcessing}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                    }}
                    className="hover:border-purple-400 hover:text-purple-500"
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Globe size={13} color="#8b5cf6" />
                      <span>2. Cào M-System Riêng</span>
                    </span>
                    {pendingMsCount > 0 && (
                      <span
                        style={{
                          fontSize: '0.66rem',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          backgroundColor: '#f59e0b',
                          color: '#ffffff',
                          fontWeight: 800,
                        }}
                      >
                        {pendingMsCount}
                      </span>
                    )}
                  </button>

                  {/* Nút 3: Đối Soát Chéo */}
                  <button
                    onClick={() => {
                      setShowAdvancedActions(false);
                      onRunReconcile();
                    }}
                    disabled={isProcessing}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                    }}
                    className="hover:border-emerald-400 hover:text-emerald-500"
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <RefreshCw size={13} color="#10b981" />
                      <span>3. Chạy Đối Soát Riêng</span>
                    </span>
                  </button>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', margin: '2px 0' }} />

              {/* Section 3: Tùy biến hiển thị KPI */}
              <button
                onClick={toggleStats}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
                className="hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span>{showStats ? 'Thu gọn thẻ Thống kê (KPI)' : 'Hiện thẻ Thống kê (KPI)'}</span>
                {showStats ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
       * MODAL CẤU HÌNH KHOẢNG THỜI GIAN & CHẾ ĐỘ BÓC TÁCH (SMART SKIP)
       * ========================================================================= */}
      {showRunConfigModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              maxWidth: '560px',
              width: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                  }}
                >
                  <Zap size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Cấu Hình Chu Trình Chạy Tự Động
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Tối ưu phạm vi quét email và chế độ bóc tách thông minh
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRunConfigModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '4px',
                  borderRadius: '6px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Mục 1: Chọn Khoảng Thời Gian */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '10px',
                  }}
                >
                  <Calendar size={14} color="#3b82f6" />
                  <span>1. Khoảng Thời Gian Quét Email Outlook:</span>
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Preset 1: Hôm nay */}
                  <div
                    onClick={() => setTimeRangeMode('TODAY')}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: timeRangeMode === 'TODAY' ? '2px solid #10b981' : '1px solid var(--border-color)',
                      backgroundColor: timeRangeMode === 'TODAY' ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-input)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Hôm Nay (Từ 00:00 đến nay)
                        </span>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            color: '#10b981',
                            fontWeight: 700,
                          }}
                        >
                          Khuyến nghị
                        </span>
                      </div>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Chỉ quét các email yêu cầu mở TKGD được nhận trong ngày hôm nay
                      </p>
                    </div>
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        border: timeRangeMode === 'TODAY' ? '5px solid #10b981' : '2px solid var(--border-color)',
                        backgroundColor: '#ffffff',
                      }}
                    />
                  </div>

                  {/* Preset 2: Tùy chỉnh */}
                  <div
                    onClick={() => setTimeRangeMode('CUSTOM')}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: timeRangeMode === 'CUSTOM' ? '2px solid #8b5cf6' : '1px solid var(--border-color)',
                      backgroundColor: timeRangeMode === 'CUSTOM' ? 'rgba(139, 92, 246, 0.06)' : 'var(--bg-input)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Tùy Chỉnh Khoảng Ngày & Giờ
                      </span>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Chủ động chọn mốc từ giờ nào đến giờ nào cụ thể
                      </p>
                    </div>
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        border: timeRangeMode === 'CUSTOM' ? '5px solid #8b5cf6' : '2px solid var(--border-color)',
                        backgroundColor: '#ffffff',
                      }}
                    />
                  </div>

                  {/* Form input khi chọn CUSTOM */}
                  {timeRangeMode === 'CUSTOM' && (
                    <div
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px dashed var(--border-color)',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        marginTop: '4px',
                      }}
                    >
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Từ ngày & giờ:
                        </label>
                        <input
                          type="datetime-local"
                          value={customFromDateTime}
                          onChange={(e) => setCustomFromDateTime(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.75rem',
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Đến ngày & giờ:
                        </label>
                        <input
                          type="datetime-local"
                          value={customToDateTime}
                          onChange={(e) => setCustomToDateTime(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.75rem',
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mục 2: Cơ Chế Bóc Tách Smart Skip */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                  }}
                >
                  <CheckCircle2 size={14} color="#10b981" />
                  <span>2. Cơ Chế Bóc Tách OCR (Smart Skip):</span>
                </label>

                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={smartSkipEnabled}
                      onChange={(e) => setSmartSkipEnabled(e.target.checked)}
                      style={{ marginTop: '3px', accentColor: '#10b981', width: '16px', height: '16px' }}
                    />
                    <div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Chỉ bóc tách hồ sơ mới (Tự động bỏ qua hồ sơ đã có HĐ & CCCD)
                      </span>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Tự động kiểm tra cơ sở dữ liệu để bỏ qua các hồ sơ đã OCR thành công trước đó. Giúp chu trình chạy siêu tốc trong vài giây thay vì 5 phút.
                      </p>
                    </div>
                  </label>

                  {!smartSkipEnabled && (
                    <div
                      style={{
                        marginTop: '4px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.72rem',
                        color: '#d97706',
                      }}
                    >
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      <span>
                        Bạn đang chọn <strong>Bóc tách lại từ đầu</strong>: Hệ thống sẽ gọi lại Python OCR cho toàn bộ hồ sơ trong khoảng thời gian này (mất từ 3 đến 5 phút).
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} />
                <span>{getCalculatedTimeRange().label}</span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowRunConfigModal(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  onClick={handleExecuteRun}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 18px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <PlayCircle size={14} />
                  <span>Bắt Đầu Chạy Ngay</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
