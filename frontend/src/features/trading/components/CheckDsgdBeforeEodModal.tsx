'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { tradingOpsApi } from '../services/trading-ops.api';

interface CheckDsgdBeforeEodModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
}

export default function CheckDsgdBeforeEodModal({
  isOpen,
  onClose,
  defaultDate,
}: CheckDsgdBeforeEodModalProps) {
  const { token } = useAuth();
  const [tradingDate, setTradingDate] = useState<string>(defaultDate || new Date().toISOString().split('T')[0]);
  const [timeSuffix, setTimeSuffix] = useState<string>('');
  const [exactDate, setExactDate] = useState<boolean>(true);
  const [triggerDownload, setTriggerDownload] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleRunCheck = async () => {
    try {
      setLoading(true);
      const res = await tradingOpsApi.checkDsgdBeforeEod(
        {
          tradingDate,
          timeSuffix: timeSuffix.trim() || undefined,
          triggerDownload,
          ...(exactDate ? { exactDate: true } : {}),
        } as any,
        token,
      );

      if (res && res.result) {
        setResult(res.result);
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

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '840px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary, #f8fafc)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color, #334155)',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} color="#10b981" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                Kiểm Tra DSGD Trước EOD (CheckDSGDBeforeEOD)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>
                So sánh DSGD gốc vs Snapshot chiều và khớp lệnh tự doanh ACM MS vs Straits
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
              color: 'var(--text-secondary, #94a3b8)',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Controls Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              border: '1px solid var(--border-color, #334155)',
            }}
          >
            {/* Session Date */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
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
                  border: '1px solid var(--border-color, #334155)',
                  backgroundColor: 'var(--bg-input, #0f172a)',
                  color: 'var(--text-primary, #f8fafc)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              />
            </div>

            {/* Time Suffix */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>
                <Clock size={14} color="#60a5fa" />
                <span>Thời Điểm Snapshot (Tùy chọn):</span>
              </label>
              <input
                type="text"
                placeholder="Để trống = Mới nhất (hoặc 172842...)"
                value={timeSuffix}
                onChange={(e) => setTimeSuffix(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #334155)',
                  backgroundColor: 'var(--bg-input, #0f172a)',
                  color: 'var(--text-primary, #f8fafc)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              />
            </div>

            {/* Options Checkboxes */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={exactDate}
                  onChange={(e) => setExactDate(e.target.checked)}
                  style={{ accentColor: '#10b981' }}
                />
                <span>Khớp chính xác ngày đã chọn (exactDate)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={triggerDownload}
                  onChange={(e) => setTriggerDownload(e.target.checked)}
                  style={{ accentColor: '#10b981' }}
                />
                <span>Kích hoạt Bot tải file mới nhất</span>
              </label>
            </div>
          </div>

          {/* Action Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={handleRunCheck}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '8px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              }}
            >
              {loading ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
              <span>{loading ? 'Đang kiểm tra...' : 'Thực Hiện Kiểm Tra Ngay'}</span>
            </button>
          </div>

          {/* Result Section */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '6px' }}>
              {/* Status Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  backgroundColor: result.passed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${result.passed ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {result.passed ? (
                    <CheckCircle2 size={22} color="#10b981" />
                  ) : (
                    <AlertTriangle size={22} color="#ef4444" />
                  )}
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: result.passed ? '#10b981' : '#ef4444' }}>
                      {result.passed
                        ? 'KẾT QUẢ ĐỐI SOÁT: KHỚP HOÀN TOÀN (PASSED)'
                        : result.isSnapshotMissing
                        ? 'LỖI BẢO VỆ DỮ LIỆU: THIẾU FILE SNAPSHOT TRƯỚC EOD'
                        : 'KẾT QUẢ ĐỐI SOÁT: PHÁT HIỆN CHÊNH LỆCH'}
                    </h4>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>
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
                    backgroundColor: result.passed ? '#10b981' : '#ef4444',
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
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#fca5a5',
                  }}
                >
                  <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>
                    <strong style={{ color: '#ef4444', fontSize: '0.86rem', display: 'block', marginBottom: '4px' }}>
                      Cảnh Báo An Toàn Dữ Liệu (Data Integrity Guard):
                    </strong>
                    Không tìm thấy file snapshot khớp lệnh chiều (như <code style={{ color: '#f8fafc', background: '#334155', padding: '2px 6px', borderRadius: '4px' }}>DSGD17h00.xlsx</code> hoặc <code style={{ color: '#f8fafc', background: '#334155', padding: '2px 6px', borderRadius: '4px' }}>DSGD_bak_*.xlsx</code>) trong thư mục đối soát.
                    Hệ thống đã chặn hành vi so sánh file gốc với chính nó để ngăn chặn báo thành công ảo (0 lot chênh lệch giả). Vui lòng tải file snapshot phiên chiều hoặc kiểm tra lại đường dẫn lưu trữ.
                  </div>
                </div>
              )}

              {/* 2 Comparison Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
                {/* Block 1: DSGD Gốc vs Snapshot */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid var(--border-color, #334155)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color, #334155)', paddingBottom: '10px' }}>
                    <FileText size={16} color="#38bdf8" />
                    <span style={{ fontSize: '0.86rem', fontWeight: 800 }}>Khớp Lệnh Tổng Hợp (MS Gốc vs Snapshot)</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>DSGD gốc (đầu ngày):</span>
                      <strong style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{result.totalOriginal?.toLocaleString('vi-VN')} lot</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>DSGD snapshot ({result.timeSuffix || 'Mới nhất'}):</span>
                      <strong
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.9rem',
                          color: result.isSnapshotMissing ? '#ef4444' : 'inherit',
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
                        borderTop: '1px dashed var(--border-color, #334155)',
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>Độ lệch (Delta):</span>
                      <strong
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.95rem',
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
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid var(--border-color, #334155)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color, #334155)', paddingBottom: '10px' }}>
                    <ShieldCheck size={16} color="#fbbf24" />
                    <span style={{ fontSize: '0.86rem', fontWeight: 800 }}>Khớp Lệnh Tự Doanh ACM (MS vs Straits SFTP)</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>ACM MS (TK đuôi 'A'):</span>
                      <strong style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{result.totalACMMS?.toLocaleString('vi-VN')} lot</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Straits CSV (SFTP):</span>
                      <strong style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{result.totalACMSFTP?.toLocaleString('vi-VN')} lot</strong>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        paddingTop: '8px',
                        borderTop: '1px dashed var(--border-color, #334155)',
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>Độ lệch (Delta ACM):</span>
                      <strong
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.95rem',
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
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    border: '1px solid var(--border-color, #334155)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                    <Info size={14} color="#60a5fa" />
                    <span>Thông Báo Chi Tiết Nghiệp Vụ:</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {result.messages.map((m: string, idx: number) => (
                      <li key={idx} style={{ color: result.passed ? '#10b981' : '#f87171' }}>
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
                    backgroundColor: 'rgba(15, 23, 42, 0.3)',
                    border: '1px solid var(--border-color, #334155)',
                    fontSize: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    color: 'var(--text-muted, #64748b)',
                    fontFamily: 'monospace',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)' }}>
                    <Folder size={13} color="#94a3b8" />
                    <span>Hồ Sơ Tệp Tin Được Sử Dụng Đối Chiếu:</span>
                  </div>
                  <div>• DSGD Gốc: {result.filesFound.dsgdOriginal || 'Chưa tìm thấy'}</div>
                  <div>• DSGD Snapshot: {result.filesFound.dsgdTemp || 'Chưa tìm thấy'}</div>
                  <div>• Straits ACM: {result.filesFound.acmTrades || 'Không có file (hoặc không phát sinh giao dịch)'}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
