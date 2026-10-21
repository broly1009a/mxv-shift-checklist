'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  X,
  Play,
  Calendar,
  Clock,
  Sparkles,
  Sliders,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { tradingOpsApi } from '../services/trading-ops.api';

interface CheckDsgdBeforeEodModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
  system?: 'MS' | 'CCP';
  onSuccess?: (result: any) => void;
}

export default function CheckDsgdBeforeEodModal({
  isOpen,
  onClose,
  defaultDate,
  system,
  onSuccess,
}: CheckDsgdBeforeEodModalProps) {
  const { token } = useAuth();
  const [mounted, setMounted] = useState<boolean>(false);
  const [tradingDate, setTradingDate] = useState<string>(
    defaultDate || new Date().toISOString().split('T')[0],
  );
  const [snapshotMode, setSnapshotMode] = useState<'AUTO' | 'CUSTOM'>('AUTO');
  const [timeSuffix, setTimeSuffix] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

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
          system,
          tradingDate,
          timeSuffix: effectiveTimeSuffix,
          exactDate: true,
          triggerDownload: true,
        },
        token,
      );

      if (res && res.result) {
        if (onSuccess) {
          onSuccess(res.result);
        }
        if (res.result.passed) {
          toast.success('Đối chiếu DSGD trước EOD: KHỚP 100%!');
        } else if (res.result.isSnapshotMissing) {
          toast.error('CẢNH BÁO: Không tìm thấy file snapshot DSGD trước EOD!');
        } else {
          toast.error(`Phát hiện chênh lệch: ${res.result.differTotal} lot!`);
        }
        onClose();
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
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
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
          maxWidth: '540px',
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
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={20} color="#3b82f6" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Tùy Chọn Kiểm Tra DSGD Trước EOD
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Cấu hình phiên và chỉ định file snapshot khớp lệnh chiều
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {/* Row 1: Session Date */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
              <Calendar size={14} color="#3b82f6" />
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
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '0.84rem',
                fontWeight: 600,
                outline: 'none',
              }}
            />
          </div>

          {/* Row 2: Snapshot File Mechanism */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
              <Clock size={14} color="#10b981" />
              <span>File Snapshot Khớp Lệnh Chiều:</span>
            </label>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
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
                  border: `1px solid ${snapshotMode === 'AUTO' ? '#3b82f6' : 'var(--border-color)'}`,
                  backgroundColor: snapshotMode === 'AUTO' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-input)',
                  color: snapshotMode === 'AUTO' ? '#3b82f6' : 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Sparkles size={13} />
                <span>Tự động file mới nhất</span>
              </button>

              <button
                type="button"
                onClick={() => setSnapshotMode('CUSTOM')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: `1px solid ${snapshotMode === 'CUSTOM' ? '#3b82f6' : 'var(--border-color)'}`,
                  backgroundColor: snapshotMode === 'CUSTOM' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-input)',
                  color: snapshotMode === 'CUSTOM' ? '#3b82f6' : 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Sliders size={13} />
                <span>Chỉ định hậu tố cụ thể</span>
              </button>
            </div>

            {snapshotMode === 'CUSTOM' && (
              <div>
                <input
                  type="text"
                  placeholder="Ví dụ: 172842 hoặc 17h00 (nếu tên file là DSGD172842.xlsx)..."
                  value={timeSuffix}
                  onChange={(e) => setTimeSuffix(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
              </div>
            )}
          </div>

          {/* Row 3: Standard Input Files & Formula Summary (Concise & Clear) */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              fontSize: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              lineHeight: 1.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-primary)' }}>
              <FileSpreadsheet size={14} color="#3b82f6" />
              <span>Các tệp tin đầu vào bắt buộc:</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)' }}>
              <li>
                <strong>DSGD.xlsx</strong>: Bản gốc đầu ngày lưu tại Backup MS\Futures hoặc TradingCheck.
              </li>
              <li>
                <strong>DSGD&#123;timeSuffix&#125;.xlsx</strong>: Bản snapshot chốt phiên chiều (ví dụ: <code>DSGD172842.xlsx</code>).
              </li>
              <li>
                <strong>Straits CSV</strong>: File giao dịch từ SFTP Straits (<code>EOD FO trades_PT Straits...csv</code>).
              </li>
            </ul>
            <div style={{ paddingTop: '6px', borderTop: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
              <strong>Công thức nghiệm thu:</strong> |TotalOriginal - TotalTemp| &le; 0.0001 &amp; |TotalACM_MS - TotalACM_Straits| &le; 0.0001 lot.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '8px 18px', fontWeight: 600 }}
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleRunCheck}
            disabled={loading}
            className="btn btn-primary"
            style={{
              fontSize: '0.8rem',
              padding: '8px 20px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            <span>{loading ? 'Đang quét...' : 'Thực Hiện Kiểm Tra'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
