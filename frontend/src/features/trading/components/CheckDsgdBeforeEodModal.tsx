'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  X,
  Play,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Folder,
  RefreshCw,
  Info,
  Sparkles,
  Sliders,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { tradingOpsApi } from '../services/trading-ops.api';

interface CheckDsgdBeforeEodModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
  onSuccess?: (result: any) => void;
}

export default function CheckDsgdBeforeEodModal({
  isOpen,
  onClose,
  defaultDate,
  onSuccess,
}: CheckDsgdBeforeEodModalProps) {
  const { token } = useAuth();
  const [mounted, setMounted] = useState<boolean>(false);
  const [tradingDate, setTradingDate] = useState<string>(
    defaultDate || new Date().toISOString().split('T')[0],
  );
  const [snapshotMode, setSnapshotMode] = useState<'AUTO' | 'CUSTOM'>('AUTO');
  const [timeSuffix, setTimeSuffix] = useState<string>('');
  const [exactDate, setExactDate] = useState<boolean>(true);
  const [triggerDownload, setTriggerDownload] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (defaultDate) {
      setTradingDate(defaultDate);
    }
  }, [defaultDate]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const handleRunCheck = async () => {
    try {
      setLoading(true);
      const effectiveTimeSuffix =
        snapshotMode === 'CUSTOM' && timeSuffix.trim() ? timeSuffix.trim() : undefined;

      const res = await tradingOpsApi.checkDsgdBeforeEod(
        {
          tradingDate,
          timeSuffix: effectiveTimeSuffix,
          triggerDownload,
          ...(exactDate ? { exactDate: true } : {}),
        } as any,
        token,
      );

      if (res && res.result) {
        setResult(res.result);
        if (onSuccess) {
          onSuccess(res.result);
        }
        if (res.result.passed) {
          toast.success('Đối chiếu DSGD trước EOD: KHỚP 100%!');
        } else if (res.result.isSnapshotMissing) {
          toast.error('LỖI: Không tìm thấy file snapshot DSGD trước EOD!');
        } else {
          toast.error('Phát hiện chênh lệch khối lượng trước EOD!');
        }
      } else {
        toast.error(res?.message || 'Không nhận được kết quả từ máy chủ');
      }
    } catch (err: any) {
      console.error('Lỗi kiểm tra DSGD trước EOD:', err);
      toast.error(err.message || 'Lỗi khi gọi API kiểm tra DSGD trước EOD');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={22} color="#10b981" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Kiểm Tra DSGD Trước EOD (CheckDSGDBeforeEOD)
                </h3>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    color: '#0284c7',
                    letterSpacing: '0.04em',
                  }}
                >
                  CHUẨN C# TOOL
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                So sánh DSGD gốc vs Snapshot chốt phiên chiều & Khớp lệnh tự doanh ACM (MS vs Straits)
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="btn btn-secondary"
              style={{
                fontSize: '0.76rem',
                padding: '6px 12px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: showGuide ? 'var(--color-accent)' : undefined,
                color: showGuide ? 'var(--color-accent)' : undefined,
              }}
              title="Xem chú thích nghiệp vụ, thời điểm T / T-1 và các file cần thiết"
            >
              <Info size={14} color={showGuide ? 'var(--color-accent)' : 'currentColor'} />
              <span>{showGuide ? 'Ẩn Hướng Dẫn' : 'Hướng Dẫn Nghiệp Vụ'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Đóng hộp thoại"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Collapsible Guidance Panel */}
          {showGuide && (
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(56, 189, 248, 0.06)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0284c7', fontWeight: 800, fontSize: '0.85rem' }}>
                <Info size={16} />
                <span>CHÚ THÍCH NGUYÊN LÝ HOẠT ĐỘNG & NGHIỆP VỤ (CheckDSGDBeforeEOD)</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '12px',
                  fontSize: '0.78rem',
                }}
              >
                {/* 1. Nghiệp Vụ */}
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 800, color: '#0284c7', marginBottom: '4px' }}>
                    1. Nghiệp vụ cốt lõi
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Chạy vào cuối ca chiều (khoảng 16h20 – 17h00) trước khi chốt sổ EOD:
                    <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                      <li>So sánh <b>DSGD gốc</b> đầu ngày vs <b>Snapshot chiều</b> để phát hiện lệch số.</li>
                      <li>Khớp lệnh tự doanh <b>ACM M-System</b> (tài khoản đuôi <code>A</code>) so với <b>Straits CSV</b> đối tác.</li>
                    </ul>
                  </div>
                </div>

                {/* 2. Thời Điểm T hay T-1 */}
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 800, color: '#d97706', marginBottom: '4px' }}>
                    2. Thời điểm phiên: T hay T-1?
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      <li><b>Mặc định trong C# Tool (PreviousSessionDate)</b>: Đối soát cho phiên <b>T-1</b> (phiên vừa đóng cửa gần nhất, tự động bỏ qua T7, CN và ngày lễ).</li>
                      <li><b>Khi tích &ldquo;Khớp chính xác ngày (exactDate)&rdquo;</b>: Đối soát đúng ngày <b>T</b> chỉ định trên ô lịch.</li>
                    </ul>
                  </div>
                </div>

                {/* 3. Tệp tin đầu vào */}
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 800, color: '#10b981', marginBottom: '4px' }}>
                    3. Các tệp tin đầu vào bắt buộc
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      <li><code>DSGD.xlsx</code>: Bản gốc đầu ngày tại <code>Backup MS\Futures</code> hoặc <code>TradingCheck</code>.</li>
                      <li><code>DSGD&#123;snapshot&#125;.xlsx</code>: Bản snapshot chốt chiều (ví dụ <code>DSGD172842.xlsx</code>).</li>
                      <li><code>Straits CSV</code>: File giao dịch từ SFTP Straits (<code>EOD FO trades_PT Straits...csv</code>).</li>
                    </ul>
                  </div>
                </div>

                {/* 4. Tiêu chuẩn Pass */}
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 800, color: '#8b5cf6', marginBottom: '4px' }}>
                    4. Tiêu chuẩn nghiệm thu (Pass)
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      <li><b>Tổng KLGD khớp</b>: <code>|TotalOriginal - TotalTemp| &le; 0.0001</code>.</li>
                      <li><b>Khớp ACM tự doanh</b>: <code>|TotalACM_MS - TotalACM_Straits| &le; 0.0001</code>.</li>
                      <li>Nếu thiếu file snapshot, hệ thống tự động chặn so sánh để bảo vệ dữ liệu.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              padding: '18px 20px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
            }}
          >
            {/* Row 1: Date & Snapshot Mode */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px',
              }}
            >
              {/* Session Date */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  <Calendar size={14} color="#10b981" />
                  <span>Ngày Phiên Đối Soát:</span>
                </label>
                <input
                  type="date"
                  value={tradingDate}
                  onChange={(e) => setTradingDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                />
              </div>

              {/* Snapshot File Selection Mode */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  <Clock size={14} color="#0284c7" />
                  <span>Cơ chế chọn file Snapshot chiều:</span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSnapshotMode('AUTO');
                      setTimeSuffix('');
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${snapshotMode === 'AUTO' ? 'var(--color-primary, #10b981)' : 'var(--border-color)'}`,
                      backgroundColor: snapshotMode === 'AUTO' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
                      color: snapshotMode === 'AUTO' ? '#10b981' : 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    <Sparkles size={13} />
                    <span>Tự động mới nhất (C#)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSnapshotMode('CUSTOM')}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${snapshotMode === 'CUSTOM' ? 'var(--color-accent, #3b82f6)' : 'var(--border-color)'}`,
                      backgroundColor: snapshotMode === 'CUSTOM' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                      color: snapshotMode === 'CUSTOM' ? 'var(--color-accent, #3b82f6)' : 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    <Sliders size={13} />
                    <span>Chỉ định cụ thể</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-row: Helper or Custom Suffix input */}
            {snapshotMode === 'AUTO' ? (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Chế độ chuẩn C#:</strong> Hệ thống tự động quét và lấy file snapshot chụp chiều mới nhất (ví dụ: <code>DSGD172842.xlsx</code>, <code>DSGD17h00.xlsx</code>) có trong thư mục <code>TradingCheck</code> hoặc <code>Backup MS</code> mà bạn không cần gõ tên file.
                </span>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Nhập hậu tố tên file snapshot (ví dụ: nhập <code>172842</code> nếu tên file là <code>DSGD172842.xlsx</code>):
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 172842 hoặc 16h30..."
                  value={timeSuffix}
                  onChange={(e) => setTimeSuffix(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                />
              </div>
            )}

            {/* Row 2: Checkbox Options */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '10px',
                paddingTop: '6px',
                borderTop: '1px dashed var(--border-color)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={exactDate}
                  onChange={(e) => setExactDate(e.target.checked)}
                  style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
                />
                <div>
                  <span style={{ fontWeight: 700 }}>Khớp chính xác ngày đã chọn (exactDate)</span>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Bỏ chọn = lùi về phiên trước (T-1) giống C# Tool; Tích chọn = ngày T hiện tại.
                  </span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={triggerDownload}
                  onChange={(e) => setTriggerDownload(e.target.checked)}
                  style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
                />
                <div>
                  <span style={{ fontWeight: 700 }}>Kích hoạt Bot tải file mới nhất</span>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Tự động kéo file snapshot mới nhất từ M-System về trước khi đối chiếu.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '8px 18px', fontWeight: 600 }}
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleRunCheck}
              disabled={loading}
              className="btn btn-success"
              style={{
                fontSize: '0.82rem',
                padding: '8px 22px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
              <span>{loading ? 'Đang quét & đối chiếu...' : 'Thực Hiện Kiểm Tra Ngay'}</span>
            </button>
          </div>

          {/* Result Section */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' }}>
              {/* Status Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  backgroundColor: result.passed
                    ? 'rgba(16, 185, 129, 0.1)'
                    : result.isSnapshotMissing
                    ? 'rgba(245, 158, 11, 0.1)'
                    : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${
                    result.passed
                      ? 'rgba(16, 185, 129, 0.3)'
                      : result.isSnapshotMissing
                      ? 'rgba(245, 158, 11, 0.3)'
                      : 'rgba(239, 68, 68, 0.3)'
                  }`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {result.passed ? (
                    <CheckCircle2 size={22} color="#10b981" />
                  ) : (
                    <AlertTriangle
                      size={22}
                      color={result.isSnapshotMissing ? '#d97706' : '#ef4444'}
                    />
                  )}
                  <div>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        color: result.passed
                          ? '#10b981'
                          : result.isSnapshotMissing
                          ? '#d97706'
                          : '#ef4444',
                      }}
                    >
                      {result.passed
                        ? 'KẾT QUẢ ĐỐI SOÁT: KHỚP HOÀN TOÀN (PASSED)'
                        : result.isSnapshotMissing
                        ? 'CẢNH BÁO: THIẾU FILE SNAPSHOT TRƯỚC EOD'
                        : 'KẾT QUẢ ĐỐI SOÁT: PHÁT HIỆN CHÊNH LỆCH'}
                    </h4>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Phiên giao dịch: <strong>{result.sessionDate || tradingDate}</strong>
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    backgroundColor: result.passed
                      ? '#10b981'
                      : result.isSnapshotMissing
                      ? '#d97706'
                      : '#ef4444',
                    color: '#ffffff',
                  }}
                >
                  {result.passed ? 'PASSED' : result.isSnapshotMissing ? 'MISSING SNAPSHOT' : 'DISCREPANCY'}
                </div>
              </div>

              {/* Snapshot Missing Data Integrity Alert */}
              {result.isSnapshotMissing && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>
                    <strong style={{ color: '#d97706', fontSize: '0.86rem', display: 'block', marginBottom: '4px' }}>
                      Cảnh Báo An Toàn Dữ Liệu (Data Integrity Guard):
                    </strong>
                    Không tìm thấy file snapshot khớp lệnh chiều (như <code>DSGD17h00.xlsx</code> hoặc <code>DSGD172842.xlsx</code>) trong thư mục đối soát.
                    Hệ thống đã chặn hành vi so sánh file gốc với chính nó để ngăn chặn báo thành công ảo (0 lot chênh lệch giả). Vui lòng tải file snapshot phiên chiều hoặc kiểm tra lại đường dẫn lưu trữ.
                  </div>
                </div>
              )}

              {/* 2 Comparison Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '14px' }}>
                {/* Block 1: DSGD Gốc vs Snapshot */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <FileText size={16} color="#0284c7" />
                    <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Khớp Lệnh Tổng Hợp (MS Gốc vs Snapshot)
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>DSGD gốc (đầu ngày):</span>
                      <strong style={{ fontFamily: 'monospace', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {result.totalOriginal?.toLocaleString('vi-VN')} lot
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>DSGD snapshot ({result.timeSuffix || 'Mới nhất'}):</span>
                      <strong
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.92rem',
                          color: result.isSnapshotMissing ? '#ef4444' : 'var(--text-primary)',
                        }}
                      >
                        {result.isSnapshotMissing
                          ? 'Chưa có file snapshot'
                          : `${result.totalTemp?.toLocaleString('vi-VN')} lot`}
                      </strong>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        paddingTop: '8px',
                        borderTop: '1px dashed var(--border-color)',
                      }}
                    >
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Độ lệch (Delta):</span>
                      <strong
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.96rem',
                          color: result.isSnapshotMissing
                            ? '#ef4444'
                            : result.differTotal <= 0.0001
                            ? '#10b981'
                            : '#ef4444',
                        }}
                      >
                        {result.isSnapshotMissing
                          ? 'Chưa xác định (Thiếu file)'
                          : `${result.differTotal?.toLocaleString('vi-VN')} lot`}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Block 2: ACM MS vs Straits */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <ShieldCheck size={16} color="#f59e0b" />
                    <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Khớp Lệnh Tự Doanh ACM (MS vs Straits SFTP)
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>ACM MS (TK đuôi 'A'):</span>
                      <strong style={{ fontFamily: 'monospace', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {result.totalACMMS?.toLocaleString('vi-VN')} lot
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Straits CSV (SFTP):</span>
                      <strong style={{ fontFamily: 'monospace', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {result.totalACMSFTP?.toLocaleString('vi-VN')} lot
                      </strong>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        paddingTop: '8px',
                        borderTop: '1px dashed var(--border-color)',
                      }}
                    >
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Độ lệch (Delta ACM):</span>
                      <strong
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.96rem',
                          color: result.differACM <= 0.0001 ? '#10b981' : '#ef4444',
                        }}
                      >
                        {result.differACM?.toLocaleString('vi-VN')} lot
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages Details */}
              {result.messages && result.messages.length > 0 && (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    <Info size={14} color="#0284c7" />
                    <span>Thông Báo Chi Tiết Nghiệp Vụ:</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {result.messages.map((m: string, idx: number) => (
                      <li key={idx} style={{ color: result.passed ? '#10b981' : '#ef4444' }}>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Files Used Paths */}
              {result.filesFound && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    color: 'var(--text-muted)',
                    fontFamily: 'monospace',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <Folder size={13} color="var(--text-secondary)" />
                    <span>Hồ Sơ Tệp Tin Được Sử Dụng Đối Chiếu:</span>
                  </div>
                  <div>• DSGD Gốc: <span style={{ color: 'var(--text-primary)' }}>{result.filesFound.dsgdOriginal || 'Chưa tìm thấy'}</span></div>
                  <div>• DSGD Snapshot: <span style={{ color: 'var(--text-primary)' }}>{result.filesFound.dsgdTemp || 'Chưa tìm thấy'}</span></div>
                  <div>• Straits ACM: <span style={{ color: 'var(--text-primary)' }}>{result.filesFound.acmTrades || 'Không có file (hoặc không phát sinh giao dịch)'}</span></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
