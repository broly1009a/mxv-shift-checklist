'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSearch,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Folder,
  FolderCheck,
  FolderX,
  FileSpreadsheet,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  X,
  Clock,
  Layers,
  DollarSign,
  Loader2,
  Info,
  Database,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';

export interface PreFlightFileInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskKey?: string; // Tên tác vụ tập trung (ví dụ: 'CE_STATISTICS', 'CCP_STATISTICS', 'CHECK_KLGD', 'CHECK_DSGD_BEFORE_EOD'...)
  system?: 'CE' | 'CCP' | string; // Giữ để tương thích ngược 100%
  targetDate: string;
  initialType?: 'LOT' | 'VALUE' | 'ALL';
  token: string | null;
  onOpenConfig?: () => void;
}

export default function PreFlightFileInspectorModal({
  isOpen,
  onClose,
  taskKey,
  system,
  targetDate,
  initialType = 'ALL',
  token,
  onOpenConfig,
}: PreFlightFileInspectorModalProps) {
  const [activeType, setActiveType] = useState<'LOT' | 'VALUE' | 'ALL'>(initialType);
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<any | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  useEffect(() => {
    if (initialType) {
      setActiveType(initialType);
    }
  }, [initialType]);

  const fetchInspection = useCallback(async () => {
    if (!token || !targetDate || !isOpen) return;
    setLoading(true);
    const effectiveTaskKey = taskKey || (system === 'CE' ? 'CE_STATISTICS' : 'CCP_STATISTICS');
    try {
      const res = await api.tradingOps.inspectPreFlight(effectiveTaskKey, targetDate, activeType, token);
      setData(res?.data || res);
    } catch (err: any) {
      toast.error(`Không thể kiểm tra tệp: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [token, targetDate, activeType, system, taskKey, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchInspection();
    }
  }, [isOpen, fetchInspection]);

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedPath(text);
    toast.success('Đã sao chép đường dẫn');
    setTimeout(() => setCopiedPath(null), 2000);
  };

  if (!isOpen) return null;

  const isReady = data?.isReady ?? false;
  const canExecute = data?.canExecute ?? false;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.55)',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== MODAL HEADER ===== */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '16px',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: system === 'CE' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: system === 'CE' ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: system === 'CE' ? '#0ea5e9' : '#10b981',
              }}
            >
              <FileSearch size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Kiểm Tra Luồng Tệp & Đường Dẫn Thực Thi
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    backgroundColor: data?.enabled === false ? 'rgba(100, 116, 139, 0.2)' : system === 'CE' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: data?.enabled === false ? '#94a3b8' : system === 'CE' ? '#0ea5e9' : '#10b981',
                    border: `1px solid ${data?.enabled === false ? 'rgba(100, 116, 139, 0.4)' : system === 'CE' ? 'rgba(14, 165, 233, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                  }}
                >
                  {data?.displayName || (system === 'CE' ? 'CoreEX (ACM Nano)' : 'CoreCCP VNCLEAR')}
                </span>
                {data?.enabled === false && (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    ĐANG TẮT (OFF)
                  </span>
                )}
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  Phiên: {targetDate}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Kiểm tra tính sẵn sàng của tệp nguồn trong thư mục ngày và tính hợp lý của các đường dẫn sổ lũy kế Excel trước khi ghi dữ liệu.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={fetchInspection}
              disabled={loading}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', height: '32px' }}
              title="Làm mới kiểm tra"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Kiểm tra lại</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '6px 10px', height: '32px' }}
              title="Đóng"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ===== ACTION TYPE SWITCHER TABS ===== */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '4px' }}>
              Phạm vi tác vụ:
            </span>
            <button
              type="button"
              onClick={() => setActiveType('ALL')}
              style={{
                fontSize: '0.76rem',
                padding: '4px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: activeType === 'ALL' ? '#0ea5e9' : 'var(--border-color)',
                backgroundColor: activeType === 'ALL' ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                color: activeType === 'ALL' ? '#0ea5e9' : 'var(--text-secondary)',
                fontWeight: activeType === 'ALL' ? 800 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Layers size={13} />
              <span>Tất Cả Tác Vụ</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveType('LOT')}
              style={{
                fontSize: '0.76rem',
                padding: '4px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: activeType === 'LOT' ? '#3b82f6' : 'var(--border-color)',
                backgroundColor: activeType === 'LOT' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: activeType === 'LOT' ? '#3b82f6' : 'var(--text-secondary)',
                fontWeight: activeType === 'LOT' ? 800 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <FileSpreadsheet size={13} />
              <span>Thống Kê Số Lot</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveType('VALUE')}
              style={{
                fontSize: '0.76rem',
                padding: '4px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: activeType === 'VALUE' ? '#f59e0b' : 'var(--border-color)',
                backgroundColor: activeType === 'VALUE' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                color: activeType === 'VALUE' ? '#f59e0b' : 'var(--text-secondary)',
                fontWeight: activeType === 'VALUE' ? 800 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <DollarSign size={13} />
              <span>Thống Kê Giá Trị Giao Dịch</span>
            </button>
          </div>

          {onOpenConfig && (
            <button
              type="button"
              onClick={onOpenConfig}
              className="btn btn-secondary"
              style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Sliders size={13} />
              <span>Cấu Hình Đường Dẫn</span>
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: '0.85rem', margin: 0 }}>Đang kiểm tra hệ thống tệp và cấu hình lưu trữ...</p>
          </div>
        ) : !data ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Không lấy được thông tin kiểm tra. Vui lòng bấm &ldquo;Kiểm tra lại&rdquo;.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* ===== EXECUTIVE STATUS BANNER ===== */}
            {/* ===== BANNER KHI TÁC VỤ ĐANG TẮT (OFF) ===== */}
            {data?.enabled === false ? (
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '10px',
                  border: '1px solid rgba(148, 163, 184, 0.4)',
                  backgroundColor: 'rgba(148, 163, 184, 0.1)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <AlertTriangle size={22} color="#94a3b8" style={{ marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>
                      TÁC VỤ NÀY ĐANG ĐƯỢC CẤU HÌNH TẮT (OFF)
                    </strong>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {data.summaryBadge?.description || `Tác vụ "${data.displayName || 'này'}" đang được tắt trong danh mục tập trung TRADING_OPS_PREFLIGHT_REGISTRY. Các kiểm tra tệp đầu vào và đầu ra hiện không áp dụng.`}
                  </p>
                </div>
              </div>
            ) : (
              /* ===== EXECUTIVE STATUS BANNER KHI BẬT (ON) ===== */
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '10px',
                  border: `1px solid ${canExecute ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  backgroundColor: canExecute ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <div style={{ marginTop: '2px' }}>
                  {canExecute ? (
                    <CheckCircle2 size={20} color="#10b981" />
                  ) : (
                    <AlertTriangle size={20} color="#ef4444" />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '0.88rem', color: canExecute ? '#10b981' : '#ef4444' }}>
                      {canExecute
                        ? 'SẴN SÀNG THỰC THI (100% READY)'
                        : 'CHƯA ĐỦ ĐIỀU KIỆN THỰC THI'}
                    </strong>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                    {data.summaryBadge?.description || data.summary}
                  </p>
                </div>
              </div>
            )}

            {/* ===== PHẦN 1: CÁC FILE ĐẦU VÀO (SOURCE FILES) ===== */}
            <div
              className="glass-panel"
              style={{
                padding: '16px 20px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Folder size={16} color="var(--text-muted)" />
                  <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                    1. Tệp Nguồn Đầu Vào (Input Files)
                  </strong>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: data.source?.folderExists ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: data.source?.folderExists ? '#10b981' : '#ef4444',
                    fontWeight: 700,
                  }}
                >
                  {data.source?.folderExists ? 'Đã tìm thấy thư mục ngày' : 'Chưa có thư mục ngày'}
                </span>
              </div>

              {/* Thư mục quét ngày */}
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Thư mục:</span>
                  <code style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {data.source?.folderPath || 'Chưa xác định'}
                  </code>
                </div>
                {data.source?.folderPath && (
                  <button
                    type="button"
                    onClick={() => handleCopy(data.source.folderPath)}
                    className="btn btn-secondary"
                    style={{ padding: '2px 6px', fontSize: '0.68rem', height: '22px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Sao chép đường dẫn thư mục"
                  >
                    {copiedPath === data.source.folderPath ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                    <span>{copiedPath === data.source.folderPath ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                )}
              </div>

              {/* Bảng danh sách các file nguồn */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px' }}>
                {(data.source?.files || data.sourceFiles || []).map((file: any) => {
                  const isCorrupted = file.status === 'CORRUPTED';
                  const isReady = file.present && !isCorrupted;
                  const isMissingRequired = file.required && (!file.present || isCorrupted);
                  const borderColor = isReady
                    ? 'rgba(16, 185, 129, 0.3)'
                    : isCorrupted
                    ? 'rgba(245, 158, 11, 0.4)'
                    : isMissingRequired
                    ? 'rgba(239, 68, 68, 0.3)'
                    : 'var(--border-color)';
                  const bgColor = isReady
                    ? 'rgba(16, 185, 129, 0.05)'
                    : isCorrupted
                    ? 'rgba(245, 158, 11, 0.06)'
                    : isMissingRequired
                    ? 'rgba(239, 68, 68, 0.05)'
                    : 'transparent';

                  return (
                    <div
                      key={file.key}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: `1px solid ${borderColor}`,
                        backgroundColor: bgColor,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                          {file.name}
                        </strong>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            backgroundColor: isReady
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isCorrupted
                              ? 'rgba(245, 158, 11, 0.15)'
                              : isMissingRequired
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(148, 163, 184, 0.15)',
                            color: isReady ? '#10b981' : isCorrupted ? '#f59e0b' : isMissingRequired ? '#ef4444' : 'var(--text-muted)',
                          }}
                        >
                          {isReady
                            ? `Sẵn sàng (${file.formattedSize})`
                            : isCorrupted
                            ? 'Tệp rỗng (0 B)'
                            : file.required
                            ? 'Chưa có'
                            : 'Tùy chọn'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {file.role}
                      </div>

                      {file.filename && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontFamily: 'monospace',
                              color: '#0ea5e9',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={file.fullPath || file.filename}
                          >
                            {file.filename}
                          </span>
                          {file.lastModifiedFormatted && (
                            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {file.lastModifiedFormatted.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Thông tin tỷ giá */}
              {data.source?.exchangeRate && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.74rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <DollarSign size={14} color="#f59e0b" />
                    <span>
                      Tỷ giá áp dụng: <strong>1 {data.source.exchangeRate.currency} = {Number(data.source.exchangeRate.rate).toLocaleString('vi-VN')} VND</strong>
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Nguồn: {data.source.exchangeRate.source}
                  </span>
                </div>
              )}
            </div>

            {/* ===== PHẦN 2: CÁC FILE ĐÍCH & SỔ LŨY KẾ EXCEL (OUTPUT FILES) ===== */}
            {data.destinations && data.destinations.length > 0 && (
              <div
                className="glass-panel"
              style={{
                padding: '16px 20px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={16} color="var(--text-muted)" />
                  <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                    2. Tệp Đích Lưu Sổ Lũy Kế Excel (Target Accumulator Files)
                  </strong>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Tổng cộng: {data.destinations?.length || 0} tệp sổ
                </span>
              </div>

              {/* Danh sách các file sổ đích */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.destinations?.map((dest: any) => {
                  const isValid = dest.isValidPath ?? (dest.parentDirValid && dest.isWritable !== false);
                  const fileExists = dest.fileExists ?? dest.existsOnDisk;
                  const hasSessionData = dest.hasSessionData ?? dest.dateAlreadyRecorded;

                  const badgeBg = !isValid
                    ? 'rgba(239, 68, 68, 0.15)'
                    : hasSessionData
                    ? 'rgba(245, 158, 11, 0.15)'
                    : fileExists
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(14, 165, 233, 0.15)';

                  const badgeColor = !isValid
                    ? '#ef4444'
                    : hasSessionData
                    ? '#f59e0b'
                    : fileExists
                    ? '#10b981'
                    : '#0ea5e9';

                  return (
                    <div
                      key={dest.key}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {/* Tiêu đề file & badge trạng thái */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 800,
                              backgroundColor: dest.group === 'LOT' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: dest.group === 'LOT' ? '#3b82f6' : '#f59e0b',
                            }}
                          >
                            {dest.group}
                          </span>
                          <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                            {dest.label}
                          </strong>
                        </div>

                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            backgroundColor: badgeBg,
                            color: badgeColor,
                          }}
                        >
                          {dest.statusText}
                        </span>
                      </div>

                      {/* Đường dẫn file đã phân giải biến năm */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          fontSize: '0.73rem',
                          fontFamily: 'monospace',
                          backgroundColor: 'var(--bg-card)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dest.resolvedPath || dest.configuredPattern || 'Chưa cấu hình'}
                        </span>
                        {dest.resolvedPath && (
                          <button
                            type="button"
                            onClick={() => handleCopy(dest.resolvedPath)}
                            className="btn btn-secondary"
                            style={{ padding: '2px 6px', height: '20px', fontSize: '0.66rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                            title="Sao chép đường dẫn file"
                          >
                            {copiedPath === dest.resolvedPath ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                            <span>{copiedPath === dest.resolvedPath ? 'Đã chép' : 'Sao chép'}</span>
                          </button>
                        )}
                      </div>

                      {/* Chi tiết thẩm định 3 thuộc tính */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '0.72rem' }}>
                        {/* 1. Thư mục cha */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: dest.parentDirExists ? '#10b981' : '#ef4444' }}>
                          {dest.parentDirExists ? <FolderCheck size={14} /> : <FolderX size={14} />}
                          <span>
                            Thư mục lưu: {dest.parentDirExists ? 'Hợp lý' : 'Không tồn tại thư mục cha'}
                          </span>
                        </div>

                        {/* 2. File trên đĩa */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: fileExists ? '#10b981' : '#0ea5e9' }}>
                          <FileSpreadsheet size={14} />
                          <span>
                            File trên đĩa: {fileExists ? `Đã có (${dest.fileFormattedSize})` : 'Chưa có (sẽ tự tạo mới)'}
                          </span>
                        </div>

                        {/* 3. Dữ liệu ngày */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: hasSessionData ? '#f59e0b' : '#10b981' }}>
                          <Clock size={14} />
                          <span>
                            Số liệu ngày {targetDate}: {hasSessionData ? `Đã có (${dest.existingTotal ? dest.existingTotal.toLocaleString('vi-VN') + (dest.group === 'VALUE' ? ' đ' : ' lot') : (dest.existingRow ? 'dòng ' + dest.existingRow : 'đã ghi')})` : 'Chưa có (ghi mới)'}
                          </span>
                        </div>
                      </div>

                      {/* Khuyến nghị hành động */}
                      {dest.recommendation && (
                        <div
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontStyle: 'italic',
                          }}
                        >
                          <ArrowRight size={11} color="var(--text-muted)" />
                          <span>{dest.recommendation}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

            {/* Cảnh báo hệ thống nếu có */}
            {data.warnings && data.warnings.length > 0 && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontWeight: 700 }}>
                  <AlertCircle size={15} />
                  <span>Lưu Ý / Cảnh Báo Hệ Thống:</span>
                </div>
                {data.warnings.map((w: string, idx: number) => (
                  <div key={idx} style={{ color: 'var(--text-secondary)', paddingLeft: '21px' }}>
                    • {w}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== MODAL FOOTER ===== */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '14px',
            fontSize: '0.74rem',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={13} />
            <span>Thẩm định trực tiếp trên hệ thống tệp và cấu hình máy chủ theo thời gian thực.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 20px', fontWeight: 600 }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
