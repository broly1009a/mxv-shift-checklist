'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sliders,
  RefreshCw,
  FileText,
  Copy,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { tradingOpsApi } from '@/features/trading/services/trading-ops.api';
import CheckDsgdBeforeEodModal from '@/features/trading/components/CheckDsgdBeforeEodModal';

export interface DsgdBeforeEodSectionProps {
  token?: string | null;
  selectedDate: string;
  onStatusChange?: (status: { passed: boolean; differTotal: number }) => void;
}

export interface CheckDsgdResult {
  passed: boolean;
  totalOriginal: number;
  totalTemp: number;
  totalACMMS: number;
  totalACMSFTP: number;
  differTotal: number;
  differACM: number;
  messages: string[];
  sessionDate: string;
  timeSuffix?: string;
  isSnapshotMissing?: boolean;
  warning?: string;
  filesFound?: {
    dsgdOriginal?: string;
    dsgdTemp?: string;
    acmTrades?: string;
  };
}

export default function DsgdBeforeEodSection({
  token,
  selectedDate,
  onStatusChange,
}: DsgdBeforeEodSectionProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CheckDsgdResult | null>(null);
  const [hasChecked, setHasChecked] = useState<boolean>(false);
  const [executedAt, setExecutedAt] = useState<string | null>(null);
  const [showAdvancedModal, setShowAdvancedModal] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Khi selectedDate thay đổi, reset trạng thái đã chạy trừ khi có lượt chạy mới
  useEffect(() => {
    setResult(null);
    setHasChecked(false);
    setExecutedAt(null);
  }, [selectedDate]);

  // Hàm chạy nhanh kiểm tra DSGD trước EOD cho phiên đang chọn
  const handleRunQuickCheck = async () => {
    if (!token || loading) return;
    setLoading(true);
    const toastId = toast.loading('Đang quét và đối chiếu DSGD trước EOD...');

    try {
      const res = await tradingOpsApi.checkDsgdBeforeEod(
        {
          tradingDate: selectedDate,
          exactDate: true,
        },
        token,
      );

      if (res && res.result) {
        const data: CheckDsgdResult = res.result;
        setResult(data);
        setHasChecked(true);
        setExecutedAt(new Date().toLocaleTimeString('vi-VN'));

        if (onStatusChange) {
          onStatusChange({
            passed: data.passed,
            differTotal: data.differTotal || 0,
          });
        }

        if (data.passed) {
          toast.success('Đối chiếu DSGD trước EOD: KHỚP 100%!', { id: toastId });
        } else if (data.isSnapshotMissing) {
          toast.error('CẢNH BÁO AN TOÀN: Thiếu file snapshot DSGD trước EOD!', { id: toastId });
        } else {
          toast.error(`Phát hiện chênh lệch: ${data.differTotal} lot!`, { id: toastId });
        }
      } else {
        toast.error(res?.message || 'Không nhận được kết quả từ máy chủ', { id: toastId });
      }
    } catch (err: any) {
      console.error('Lỗi khi gọi checkDsgdBeforeEod:', err);
      toast.error(err.message || 'Lỗi khi gọi API kiểm tra DSGD trước EOD', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Đồng bộ kết quả nếu chạy từ Advanced Modal
  const handleModalSuccess = (modalResult: any) => {
    if (modalResult) {
      setResult(modalResult);
      setHasChecked(true);
      setExecutedAt(new Date().toLocaleTimeString('vi-VN'));
      if (onStatusChange) {
        onStatusChange({
          passed: modalResult.passed,
          differTotal: modalResult.differTotal || 0,
        });
      }
    }
  };

  // Sao chép báo cáo kết quả ra clipboard
  const handleCopyReport = () => {
    if (!result) return;
    const reportText = `[KIỂM TRA DSGD TRƯỚC EOD (CheckDSGDBeforeEOD)]
Phiên đối chiếu: ${result.sessionDate || selectedDate}
Thời gian kiểm tra: ${executedAt || 'N/A'}
- DSGD gốc (MS): ${result.totalOriginal?.toLocaleString('en-US')} lot
- DSGD snapshot chiều: ${result.totalTemp?.toLocaleString('en-US')} lot
- Chênh lệch tổng: ${result.differTotal} lot
- ACM MS: ${result.totalACMMS?.toLocaleString('en-US')} lot
- ACM Straits SFTP: ${result.totalACMSFTP?.toLocaleString('en-US')} lot
- Chênh lệch tự doanh ACM: ${result.differACM} lot
Trạng thái: ${result.passed ? 'KHỚP 100%' : result.isSnapshotMissing ? 'THIẾU FILE SNAPSHOT' : 'CHÊNH LỆCH'}`;

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    toast.success('Đã sao chép báo cáo DSGD trước EOD vào clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
      }}
    >
      {/* HEADER SECTION */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: hasChecked && result?.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={22} color={hasChecked && result?.passed ? '#10b981' : '#38bdf8'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Kiểm Tra DSGD Trước EOD (CheckDSGDBeforeEOD)
              </h4>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  letterSpacing: '0.04em',
                }}
              >
                SNAPSHOT VẬN HÀNH
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              So sánh DSGD gốc vs Snapshot chốt phiên chiều & khớp lệnh tự doanh ACM (MS vs Straits CSV).
            </p>
          </div>
        </div>

        {/* STATUS BADGE & ACTION BUTTONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Status Badge */}
          {!hasChecked ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: 'rgba(148, 163, 184, 0.12)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
              }}
            >
              <Clock size={13} />
              <span>Chưa kiểm tra phiên này</span>
            </span>
          ) : result?.passed ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <CheckCircle2 size={13} />
              <span>Khớp hoàn toàn ({executedAt})</span>
            </span>
          ) : result?.isSnapshotMissing ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <AlertTriangle size={13} />
              <span>Thiếu snapshot ({executedAt})</span>
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <AlertTriangle size={13} />
              <span>Lệch {result?.differTotal} lot ({executedAt})</span>
            </span>
          )}

          {/* Copy Report Button */}
          {hasChecked && (
            <button
              type="button"
              onClick={handleCopyReport}
              className="btn btn-secondary"
              title="Sao chép báo cáo kiểm tra DSGD trước EOD"
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          )}

          {/* Advanced Modal Settings Button */}
          <button
            type="button"
            onClick={() => setShowAdvancedModal(true)}
            className="btn btn-secondary"
            title="Mở hộp thoại cấu hình chi tiết (timeSuffix, tải file)"
            style={{
              fontSize: '0.75rem',
              padding: '6px 12px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Sliders size={13} />
            <span>Tùy chọn...</span>
          </button>

          {/* Quick Check Button */}
          <button
            type="button"
            onClick={handleRunQuickCheck}
            disabled={loading}
            className="btn btn-primary"
            style={{
              fontSize: '0.75rem',
              padding: '6px 16px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Đang quét...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={14} />
                <span>Check DSGD Trước EOD</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* CONTENT BODY */}
      {!hasChecked ? (
        /* EMPTY STATE BANNER */
        <div
          style={{
            padding: '24px 20px',
            borderRadius: '10px',
            backgroundColor: 'rgba(56, 189, 248, 0.04)',
            border: '1px dashed rgba(56, 189, 248, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', maxWidth: '680px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileSpreadsheet size={22} color="#38bdf8" />
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                Bảo đảm an toàn dữ liệu khớp lệnh trước giờ chốt sổ EOD
              </span>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: '1.4', display: 'block', marginTop: '2px' }}>
                Hệ thống sẽ đối chiếu file <strong>DSGD gốc</strong> với snapshot <strong>DSGD chốt chiều</strong> trong thư mục Backup MS và so sánh khối lượng tự doanh ACM (kết thúc bằng đuôi &ldquo;A&rdquo;) với file Straits CSV. Bấm nút <strong>Check DSGD Trước EOD</strong> để bắt đầu.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRunQuickCheck}
            disabled={loading}
            className="btn btn-primary"
            style={{
              fontSize: '0.78rem',
              padding: '8px 18px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <ShieldCheck size={14} />}
            <span>Chạy Kiểm Tra Ngay</span>
          </button>
        </div>
      ) : (
        /* RESULT VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Missing Snapshot Alert */}
          {result?.isSnapshotMissing && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f59e0b', display: 'block' }}>
                  CẢNH BÁO AN TOÀN DỮ LIỆU: THIẾU FILE SNAPSHOT TRƯỚC EOD!
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                  Hệ thống không tìm thấy file snapshot <code>DSGD*.xlsx</code> chụp trong khung giờ chiều tại thư mục <code>TradingCheck</code> hoặc <code>Backup MS</code>. Cơ chế an toàn đã tự động chặn việc đối chiếu file gốc với chính nó để ngăn chặn báo thành công ảo. Vui lòng kiểm tra lại thư mục backup hoặc dùng nút <strong>Tùy chọn...</strong> để nhập hậu tố <code>timeSuffix</code>.
                </span>
              </div>
            </div>
          )}

          {/* 4 KPI METRICS CARDS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '12px',
            }}
          >
            {/* Card 1: DSGD Gốc */}
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block' }}>
                DSGD GỐC (M-SYSTEM)
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '6px 0 2px' }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, fontFamily: 'monospace', color: '#38bdf8' }}>
                  {result?.totalOriginal?.toLocaleString('en-US') ?? 0}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>lot</span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Tổng khối lượng file DSGD gốc
              </span>
            </div>

            {/* Card 2: DSGD Snapshot Chiều */}
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block' }}>
                DSGD SNAPSHOT (CHIỀU)
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '6px 0 2px' }}>
                <span
                  style={{
                    fontSize: '1.35rem',
                    fontWeight: 900,
                    fontFamily: 'monospace',
                    color: result?.isSnapshotMissing ? 'var(--text-muted)' : '#10b981',
                  }}
                >
                  {result?.isSnapshotMissing ? 'N/A' : (result?.totalTemp?.toLocaleString('en-US') ?? 0)}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>lot</span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Khối lượng file chụp trước EOD
              </span>
            </div>

            {/* Card 3: Chênh Lệch Tổng */}
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  CHÊNH LỆCH TỔNG
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: result?.differTotal === 0 && !result?.isSnapshotMissing ? '#10b981' : '#ef4444',
                  }}
                >
                  {result?.differTotal === 0 && !result?.isSnapshotMissing ? 'Khớp 100%' : 'Chênh lệch'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '6px 0 2px' }}>
                <span
                  style={{
                    fontSize: '1.35rem',
                    fontWeight: 900,
                    fontFamily: 'monospace',
                    color: result?.differTotal === 0 && !result?.isSnapshotMissing ? '#10b981' : '#ef4444',
                  }}
                >
                  {result?.differTotal?.toLocaleString('en-US') ?? 0}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>lot</span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Lệch giữa file gốc và snapshot
              </span>
            </div>

            {/* Card 4: Tự Doanh ACM (MS vs Straits) */}
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  ACM (MS vs STRAITS)
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: result?.differACM === 0 ? '#10b981' : '#ef4444',
                  }}
                >
                  Lệch: {result?.differACM ?? 0} lot
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '6px 0 2px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {result?.totalACMMS?.toLocaleString('en-US') ?? 0}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MS</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>/</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'monospace', color: '#10b981' }}>
                  {result?.totalACMSFTP?.toLocaleString('en-US') ?? 0}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Straits</span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Tài khoản tự doanh ACM (*A)
              </span>
            </div>
          </div>

          {/* TOGGLE DETAILS BUTTON */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '0.76rem',
              fontWeight: 700,
              padding: '4px 0',
            }}
          >
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{showDetails ? 'Thu gọn chi tiết file & log phân tích' : 'Xem chi tiết file đã đọc & phân tích nghiệp vụ'}</span>
          </button>

          {/* EXPANDABLE DETAILS */}
          {showDetails && (
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {/* Files Found */}
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Danh sách tệp tin đã nạp:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.74rem', fontFamily: 'monospace' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={13} color="#38bdf8" />
                    <span style={{ color: 'var(--text-muted)' }}>DSGD Gốc:</span>
                    <span style={{ color: result?.filesFound?.dsgdOriginal ? '#10b981' : '#ef4444' }}>
                      {result?.filesFound?.dsgdOriginal || 'Chưa tìm thấy'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={13} color="#38bdf8" />
                    <span style={{ color: 'var(--text-muted)' }}>DSGD Snapshot:</span>
                    <span style={{ color: result?.filesFound?.dsgdTemp ? '#10b981' : '#f59e0b' }}>
                      {result?.filesFound?.dsgdTemp || 'Không tìm thấy snapshot'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={13} color="#38bdf8" />
                    <span style={{ color: 'var(--text-muted)' }}>Straits CSV:</span>
                    <span style={{ color: result?.filesFound?.acmTrades ? '#10b981' : '#ef4444' }}>
                      {result?.filesFound?.acmTrades || 'Chưa tìm thấy'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Messages from Service */}
              {result?.messages && result.messages.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Thông báo phân tích nghiệp vụ:
                  </span>
                  <div
                    style={{
                      maxHeight: '140px',
                      overflowY: 'auto',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      fontSize: '0.74rem',
                      fontFamily: 'monospace',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    {result.messages.map((msg, idx) => (
                      <div key={idx} style={{ color: msg.includes('FAIL') || msg.includes('CẢNH BÁO') ? '#ef4444' : 'var(--text-primary)' }}>
                        {msg}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ADVANCED MODAL SETTINGS */}
      <CheckDsgdBeforeEodModal
        isOpen={showAdvancedModal}
        onClose={() => setShowAdvancedModal(false)}
        defaultDate={selectedDate}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
