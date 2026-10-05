'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Mail,
  FileText,
  ScanLine,
  Globe,
  Scale,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  ChevronDown,
  ChevronRight,
  Database,
  RefreshCw,
  Sparkles,
  Cpu,
  ShieldCheck,
  History,
  ArrowRight,
  GitCommit,
  Layers,
  Calendar,
  User,
  Code,
} from 'lucide-react';
import { CleanRecord, ExtractionLogItem } from '../../types/tkgd.types';
import { formatDateStr, formatDateTimeStr } from '../../utils/tkgd.helpers';
import { tkgdApi } from '../../services/tkgd.api';

interface TabRawJsonLogProps {
  inspectRecord: CleanRecord;
}

type StageFilter = 'ALL' | 'MAIL_INGEST' | 'EXTRACT_CONTRACT' | 'EXTRACT_CCCD' | 'SCRAPE_MSYSTEM' | 'RECONCILE' | 'MANUAL_OVERRIDE';

function getStageIcon(stage: string) {
  switch (stage) {
    case 'MAIL_INGEST':
      return <Mail size={15} className="text-sky-400" />;
    case 'EXTRACT_CONTRACT':
      return <FileText size={15} className="text-purple-400" />;
    case 'EXTRACT_CCCD':
      return <ScanLine size={15} className="text-cyan-400" />;
    case 'SCRAPE_MSYSTEM':
      return <Globe size={15} className="text-indigo-400" />;
    case 'RECONCILE':
      return <Scale size={15} className="text-amber-400" />;
    case 'MANUAL_OVERRIDE':
      return <UserCheck size={15} className="text-emerald-400" />;
    default:
      return <Database size={15} className="text-slate-400" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'SUCCESS':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '0.65rem',
            fontWeight: 600,
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            color: '#10b981',
            border: '1px solid rgba(16, 185, 129, 0.25)',
          }}
        >
          <CheckCircle2 size={11} />
          THÀNH CÔNG
        </span>
      );
    case 'WARNING':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '0.65rem',
            fontWeight: 600,
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            color: '#f59e0b',
            border: '1px solid rgba(245, 158, 11, 0.25)',
          }}
        >
          <AlertTriangle size={11} />
          CẢNH BÁO
        </span>
      );
    case 'ERROR':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '0.65rem',
            fontWeight: 600,
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.25)',
          }}
        >
          <AlertCircle size={11} />
          LỖI
        </span>
      );
    default:
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '0.65rem',
            fontWeight: 600,
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            color: '#3b82f6',
            border: '1px solid rgba(59, 130, 246, 0.25)',
          }}
        >
          <Info size={11} />
          THÔNG TIN
        </span>
      );
  }
}

function getEngineBadge(log: ExtractionLogItem) {
  const engine = log.extractedData?.engine || '';
  const details = log.details || '';
  const performer = log.performer || '';

  // 1. Google Gemini AI Rescue / Vision
  if (
    engine === 'GEMINI_PDF_RESCUE' ||
    engine === 'GEMINI_VISION' ||
    engine === 'GEMINI_HEALED' ||
    details.toLowerCase().includes('gemini') ||
    log.title.toLowerCase().includes('gemini')
  ) {
    const model = log.extractedData?.modelUsed || 'Multimodal';
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '0.65rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(99, 102, 241, 0.2))',
          color: '#c084fc',
          border: '1px solid rgba(168, 85, 247, 0.35)',
        }}
        title={`Sử dụng Google Gemini AI API (${model})`}
      >
        <Sparkles size={11} className="text-purple-400" />
        Google Gemini AI ({model})
      </span>
    );
  }

  // 2. AcroForm Widgets
  if (engine === 'TS_ACROFORM' || details.toLowerCase().includes('acroform')) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '0.65rem',
          fontWeight: 600,
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          color: '#10b981',
          border: '1px solid rgba(16, 185, 129, 0.25)',
        }}
        title="Trích xuất trực tiếp từ AcroForm Widgets điện tử"
      >
        <FileText size={11} />
        Module Hệ Thống: AcroForm Điện Tử
      </span>
    );
  }

  // 3. Bảo chứng chéo Hash MD5
  if (engine === 'VERIFIED_MS_HASH' || details.toLowerCase().includes('hash')) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '0.65rem',
          fontWeight: 600,
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          color: '#34d399',
          border: '1px solid rgba(52, 211, 153, 0.25)',
        }}
        title="Bảo chứng khớp 100% mã hash MD5 ảnh upload trên M-System"
      >
        <ShieldCheck size={11} />
        Bảo Chứng Chéo: Hash MD5 (M-System)
      </span>
    );
  }

  // 4. Mã vạch MRZ hoặc QR
  if (engine === 'MRZ_CODE' || engine === 'QR_CODE' || details.toLowerCase().includes('mrz') || details.toLowerCase().includes('qr')) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '0.65rem',
          fontWeight: 600,
          backgroundColor: 'rgba(6, 182, 212, 0.12)',
          color: '#22d3ee',
          border: '1px solid rgba(34, 211, 238, 0.25)',
        }}
        title="Đọc mã vạch MRZ ICAO / Mã QR căn cước công dân"
      >
        <ScanLine size={11} />
        Module Hệ Thống: {engine === 'QR_CODE' ? 'Mã QR Căn Cước' : 'Mã Vạch MRZ ICAO'}
      </span>
    );
  }

  // 5. Python OCR Engine
  if (engine === 'PYTHON_OCR' || engine === 'OFFLINE_OCR' || details.toLowerCase().includes('python ocr')) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '0.65rem',
          fontWeight: 600,
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          color: '#f59e0b',
          border: '1px solid rgba(245, 158, 11, 0.25)',
        }}
        title="Bộ nhận diện ký tự quang học Python OCR"
      >
        <Cpu size={11} />
        Module Hệ Thống: Python OCR Engine
      </span>
    );
  }

  // 6. Native Regex & Text Anchor
  if (log.stage === 'EXTRACT_CONTRACT' || engine === 'NATIVE_REGEX') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '0.65rem',
          fontWeight: 600,
          backgroundColor: 'rgba(59, 130, 246, 0.12)',
          color: '#60a5fa',
          border: '1px solid rgba(96, 165, 250, 0.25)',
        }}
        title="Bóc tách bằng cú pháp Regex và Anchor phân khối dữ liệu"
      >
        <Cpu size={11} />
        Module Hệ Thống: Regex & Form Anchor
      </span>
    );
  }

  // 7. RPA Crawler (Playwright)
  if (log.stage === 'SCRAPE_MSYSTEM' || performer === 'MS_CRAWLER') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '0.65rem',
          fontWeight: 600,
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          color: '#818cf8',
          border: '1px solid rgba(129, 140, 248, 0.25)',
        }}
      >
        <Globe size={11} />
        RPA Crawler: Playwright DOM Scraper
      </span>
    );
  }

  // 8. Microsoft Graph API
  if (log.stage === 'MAIL_INGEST' || performer === 'OUTLOOK_GRAPH') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '0.65rem',
          fontWeight: 600,
          backgroundColor: 'rgba(14, 165, 233, 0.12)',
          color: '#38bdf8',
          border: '1px solid rgba(56, 189, 248, 0.25)',
        }}
      >
        <Mail size={11} />
        Microsoft Graph API: Hòm Thư Nghiệp Vụ
      </span>
    );
  }

  // 9. Reconcile Engine
  if (log.stage === 'RECONCILE') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '0.65rem',
          fontWeight: 600,
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          color: '#fbbf24',
          border: '1px solid rgba(251, 191, 36, 0.25)',
        }}
      >
        <Scale size={11} />
        Thuật Toán Đối Soát Đa Chiều
      </span>
    );
  }

  return null;
}

interface GroupedLogItem {
  key: string;
  representative: ExtractionLogItem;
  count: number;
  allLogs: ExtractionLogItem[];
  firstTime: string;
  lastTime: string;
}

export const TabRawJsonLog: React.FC<TabRawJsonLogProps> = ({ inspectRecord }) => {
  const accountCode = inspectRecord.maTKGD || inspectRecord.maTKGDBase || '';
  const [logs, setLogs] = useState<ExtractionLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [stageFilter, setStageFilter] = useState<StageFilter>('ALL');
  const [selectedSnapshotIndex, setSelectedSnapshotIndex] = useState<number | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  const fetchLogs = async () => {
    if (!accountCode) return;
    setIsLoading(true);
    try {
      const data = await tkgdApi.getExtractionLogs(accountCode, inspectRecord.batchDate);
      setLogs(data || []);
      // Mặc định không tự mở rộng bất kỳ log nào để giao diện sạch sẽ, chống rối mắt
      setExpandedLogIds({});
    } catch {
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [
    accountCode,
    inspectRecord.batchDate,
    inspectRecord.updatedAt,
    inspectRecord.ketLuan?.reconciledAt,
    inspectRecord.snapshots?.length,
  ]);

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const snapshots = inspectRecord.snapshots || [];

  // Lọc logs theo Snapshot được chọn (nếu có)
  const logsFilteredBySnapshot = useMemo(() => {
    if (selectedSnapshotIndex === null || !snapshots[selectedSnapshotIndex]) {
      return logs;
    }
    const targetSnap = snapshots[selectedSnapshotIndex];
    const snapTime = new Date(targetSnap.snapshotAt).getTime();
    if (isNaN(snapTime)) return logs;

    const prevSnap = selectedSnapshotIndex > 0 ? snapshots[selectedSnapshotIndex - 1] : null;
    const prevTime = prevSnap ? new Date(prevSnap.snapshotAt).getTime() : 0;

    const nextSnap = selectedSnapshotIndex < snapshots.length - 1 ? snapshots[selectedSnapshotIndex + 1] : null;
    const nextTime = nextSnap ? new Date(nextSnap.snapshotAt).getTime() : Infinity;

    // Các log sinh ra trong chu kỳ của Snapshot này (từ sau snapshot trước đến trước snapshot sau)
    const windowLogs = logs.filter((log) => {
      const t = new Date(log.createdAt).getTime();
      if (isNaN(t)) return false;
      return t >= prevTime - 1000 && t <= nextTime + 1000;
    });

    if (windowLogs.length > 0) return windowLogs;

    // Fallback nếu sai lệch mốc: Lấy các log cách mốc snapshot không quá 5 phút
    return logs.filter((log) => {
      const t = new Date(log.createdAt).getTime();
      return Math.abs(t - snapTime) <= 5 * 60 * 1000;
    });
  }, [logs, selectedSnapshotIndex, snapshots]);

  // Gom nhóm thông minh: Nếu có nhiều log cùng stage và cùng title liên tiếp, gom lại thành 1 đại diện
  const groupedLogs = useMemo(() => {
    const groups: GroupedLogItem[] = [];
    for (const log of logsFilteredBySnapshot) {
      const key = `${log.stage}_${log.title}`;
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.key === key) {
        lastGroup.count += 1;
        lastGroup.allLogs.push(log);
        lastGroup.lastTime = log.createdAt;
        // Cập nhật đại diện bằng bản ghi mới nhất
        lastGroup.representative = log;
      } else {
        groups.push({
          key,
          representative: log,
          count: 1,
          allLogs: [log],
          firstTime: log.createdAt,
          lastTime: log.createdAt,
        });
      }
    }
    return groups;
  }, [logsFilteredBySnapshot]);

  // Lọc theo chặng xử lý
  const filteredGroups = useMemo(() => {
    if (stageFilter === 'ALL') return groupedLogs;
    return groupedLogs.filter((g) => g.representative.stage === stageFilter);
  }, [groupedLogs, stageFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.75rem' }}>
      {/* ─── 1. HEADER TỔNG QUAN HỒ SƠ & TRẠNG THÁI ─── */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '10px',
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 700, color: '#3b82f6', fontSize: '0.82rem' }}>
              Vòng Đời Xử Lý & Lịch Sử Kiểm Toán (End-to-End Audit Trail)
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{accountCode}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
            <span>
              Kết luận cuối:{' '}
              <strong
                style={{
                  color:
                    inspectRecord.ketLuan?.trangThai === 'KHOP'
                      ? '#10b981'
                      : inspectRecord.ketLuan?.trangThai === 'CAN_KIEM_TRA'
                      ? '#d97706'
                      : '#ef4444',
                }}
              >
                {inspectRecord.ketLuan?.trangThai || 'CHUA_XU_LY'}
              </strong>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span>
              Đối soát lúc:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {inspectRecord.ketLuan?.reconciledAt ? formatDateTimeStr(inspectRecord.ketLuan.reconciledAt) : '---'}
              </strong>
            </span>
            {inspectRecord.manualReview?.isOverridden && (
              <>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>Đã duyệt tay bởi {inspectRecord.manualReview.approvedBy}</span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={isLoading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Tải lại nhật ký kiểm toán và snapshot mới nhất"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* ─── 2. PHẦN SNAPSHOT LỊCH SỬ THAY ĐỔI TRẠNG THÁI (CLICK ĐỂ LỌC CHẶNG XỬ LÝ) ─── */}
      <div
        style={{
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={15} className="text-blue-400" />
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Lịch Sử Biến Động Trạng Thái & Snapshot ({snapshots.length} mốc kiểm toán)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {selectedSnapshotIndex !== null && (
              <button
                onClick={() => setSelectedSnapshotIndex(null)}
                style={{
                  fontSize: '0.68rem',
                  color: '#3b82f6',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                Hủy chọn mốc (Xem tất cả)
              </button>
            )}
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Nhấn vào từng lần để lọc Nhật Ký Chặng Xử Lý tương ứng
            </span>
          </div>
        </div>

        {snapshots.length === 0 ? (
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-input)',
              border: '1px dashed var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <GitCommit size={20} className="text-slate-400" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ margin: '0 0 3px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Hồ sơ đang ở trạng thái ban đầu: <strong style={{ color: '#d97706' }}>{inspectRecord.ketLuan?.trangThai || 'CHUA_XU_LY'}</strong>
              </p>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                Khi bạn bấm nút <strong style={{ color: '#3b82f6' }}>[Check lại]</strong> ở góc dưới hoặc <strong style={{ color: '#10b981' }}>[Phê duyệt]</strong>, hệ thống sẽ tự động chụp snapshot lưu vết toàn bộ dữ liệu trước và sau biến động tại đây.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {snapshots.map((snap, sIdx) => {
              const snapTime = formatDateTimeStr(snap.snapshotAt);
              const actionLabel =
                snap.action === 'REPARSE_ACCOUNT'
                  ? 'Check Lại Hồ Sơ'
                  : snap.action === 'MANUAL_APPROVE'
                  ? 'Phê Duyệt Thủ Công'
                  : snap.action === 'REVERT_MANUAL_APPROVE'
                  ? 'Hủy Phê Duyệt'
                  : snap.action === 'AUTO_HEAL_CRON'
                  ? 'Cron Tự Động Chữa Lành'
                  : snap.action;

              const statusBefore = snap.statusBefore || snap.previousData?.ketLuan?.trangThai || 'CHUA_XU_LY';
              // Tự động đồng bộ chuẩn xác: Nếu là snapshot cuối cùng và kết luận record là CAN_KIEM_TRA/LECH/KHOP, luôn đồng bộ theo kết luận chuẩn
              const statusAfter =
                sIdx === snapshots.length - 1 && inspectRecord.ketLuan?.trangThai
                  ? inspectRecord.ketLuan.trangThai
                  : snap.statusAfter || '---';

              const isSelected = selectedSnapshotIndex === sIdx;

              return (
                <div
                  key={sIdx}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedSnapshotIndex(null);
                    } else {
                      setSelectedSnapshotIndex(sIdx);
                      setIsTimelineOpen(true);
                    }
                  }}
                  style={{
                    padding: '11px 14px',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-input)',
                    border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isSelected ? '0 0 0 1px rgba(59, 130, 246, 0.25)' : 'none',
                  }}
                  title={isSelected ? 'Bấm để hủy lọc và xem tất cả chặng' : 'Bấm để xem nhật ký chặng xử lý của lần này'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          backgroundColor:
                            snap.action === 'MANUAL_APPROVE'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : snap.action === 'REPARSE_ACCOUNT'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : snap.action === 'AUTO_HEAL_CRON'
                              ? 'rgba(139, 92, 246, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                          color:
                            snap.action === 'MANUAL_APPROVE'
                              ? '#10b981'
                              : snap.action === 'REPARSE_ACCOUNT'
                              ? '#3b82f6'
                              : snap.action === 'AUTO_HEAL_CRON'
                              ? '#8b5cf6'
                              : '#f59e0b',
                          border: '1px solid currentColor',
                        }}
                      >
                        Lần {sIdx + 1}: {actionLabel}
                      </span>

                      {/* Before / After status transition */}
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{statusBefore}</span>
                        <ArrowRight size={12} className="text-slate-400" />
                        <span
                          style={{
                            fontWeight: 700,
                            color: statusAfter === 'KHOP' ? '#10b981' : statusAfter === 'CAN_KIEM_TRA' ? '#d97706' : '#ef4444',
                          }}
                        >
                          {statusAfter}
                        </span>
                      </div>

                      {isSelected && (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            backgroundColor: '#3b82f6',
                            color: '#ffffff',
                          }}
                        >
                          Đang xem chặng xử lý lần này
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                      {snap.performer && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <User size={11} />
                          {snap.performer}
                        </span>
                      )}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        <Clock size={11} />
                        {snapTime}
                      </span>
                    </div>
                  </div>

                  {snap.note && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontStyle: 'italic' }}>
                      Ghi chú: {snap.note}
                    </div>
                  )}

                  {/* Chi tiết dữ liệu lưu lại trong snapshot */}
                  {snap.previousData && (
                    <div
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        fontSize: '0.68rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {snap.previousData.hopDong?.soCanCuoc && (
                        <span>
                          Số CCCD HĐ trước đó: <strong style={{ color: 'var(--text-primary)' }}>{snap.previousData.hopDong.soCanCuoc}</strong>
                        </span>
                      )}
                      {snap.previousData.hopDong?.hoVaTen && (
                        <span>
                          Họ tên HĐ: <strong style={{ color: 'var(--text-primary)' }}>{snap.previousData.hopDong.hoVaTen}</strong>
                        </span>
                      )}
                      {snap.previousData.hopDong?.rawNgaySinh && (
                        <span>
                          Ngày sinh HĐ: <strong style={{ color: 'var(--text-primary)' }}>{snap.previousData.hopDong.rawNgaySinh}</strong>
                        </span>
                      )}
                      {snap.previousData.ketLuan?.danhSachLoi && snap.previousData.ketLuan.danhSachLoi.length > 0 && (
                        <span style={{ color: '#f59e0b' }}>
                          Lỗi trước đó ({snap.previousData.ketLuan.danhSachLoi.length}): {snap.previousData.ketLuan.danhSachLoi.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── 3. NHẬT KÝ TỪNG CHẶNG XỬ LÝ (MẶC ĐỊNH THU GỌN CHỐNG RỐI MẮT, BẤM MỚI MỞ HOẶC KHI CHỌN SNAPSHOT) ─── */}
      <div
        style={{
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div
            onClick={() => setIsTimelineOpen(!isTimelineOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            title={isTimelineOpen ? 'Bấm để thu gọn nhật ký chặng' : 'Bấm để mở rộng xem các sự kiện bóc tách'}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: isTimelineOpen ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isTimelineOpen ? '#3b82f6' : 'var(--text-muted)',
              }}
            >
              <Layers size={15} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.78rem' }}>
                  Nhật Ký Từng Chặng Xử Lý ({filteredGroups.length} sự kiện {groupedLogs.length < logsFilteredBySnapshot.length ? `• Đã gộp từ ${logsFilteredBySnapshot.length} bản ghi` : ''})
                </span>
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontSize: '0.62rem',
                    fontWeight: 600,
                    backgroundColor: isTimelineOpen ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-input)',
                    color: isTimelineOpen ? '#3b82f6' : 'var(--text-muted)',
                    border: '1px solid ' + (isTimelineOpen ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-color)'),
                  }}
                >
                  {isTimelineOpen ? 'Đang mở' : 'Đang thu gọn'}
                </span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {isTimelineOpen ? 'Bấm để ẩn nhật ký chi tiết' : 'Bấm để mở rộng chi tiết các bước bóc tách OCR, Crawler & Đối soát'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsTimelineOpen(!isTimelineOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: isTimelineOpen ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-input)',
                border: '1px solid ' + (isTimelineOpen ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-color)'),
                color: isTimelineOpen ? '#3b82f6' : 'var(--text-secondary)',
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isTimelineOpen ? (
                <>
                  <span>Thu gọn</span>
                  <ChevronDown size={13} />
                </>
              ) : (
                <>
                  <span>Mở rộng ({filteredGroups.length} sự kiện)</span>
                  <ChevronRight size={13} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* NỘI DUNG CHẶNG XỬ LÝ (CHỈ HIỂN THỊ KHI ĐƯỢC MỞ HOẶC KHI CLICK CHỌN SNAPSHOT) */}
        {isTimelineOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
            {selectedSnapshotIndex !== null && snapshots[selectedSnapshotIndex] && (
              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.09)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.72rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={14} className="text-blue-400" />
                  <span>
                    Đang lọc các chặng xử lý của{' '}
                    <strong style={{ color: '#3b82f6' }}>
                      Lần {selectedSnapshotIndex + 1} ({snapshots[selectedSnapshotIndex].action === 'REPARSE_ACCOUNT' ? 'Check Lại Hồ Sơ' : snapshots[selectedSnapshotIndex].action})
                    </strong>{' '}
                    vào lúc <strong style={{ color: 'var(--text-primary)' }}>{formatDateTimeStr(snapshots[selectedSnapshotIndex].snapshotAt)}</strong>
                  </span>
                </div>
                <button
                  onClick={() => setSelectedSnapshotIndex(null)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hiển thị toàn bộ ({logs.length} sự kiện)
                </button>
              </div>
            )}

            {/* Quick filter pills */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'MAIL_INGEST', label: 'Email Outlook' },
                { id: 'EXTRACT_CONTRACT', label: 'Hợp đồng' },
                { id: 'EXTRACT_CCCD', label: 'CCCD' },
                { id: 'SCRAPE_MSYSTEM', label: 'M-System' },
                { id: 'RECONCILE', label: 'Đối soát' },
                { id: 'MANUAL_OVERRIDE', label: 'Duyệt tay' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStageFilter(tab.id as StageFilter)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    fontWeight: stageFilter === tab.id ? 700 : 500,
                    backgroundColor: stageFilter === tab.id ? '#3b82f6' : 'var(--bg-input)',
                    color: stageFilter === tab.id ? '#ffffff' : 'var(--text-muted)',
                    border: '1px solid ' + (stageFilter === tab.id ? '#3b82f6' : 'var(--border-color)'),
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 8px', color: '#3b82f6' }} />
                <span>Đang tải lịch sử kiểm toán chi tiết...</span>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-color)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-input)',
                }}
              >
                Chưa có log bóc tách nào được ghi nhận cho mốc này.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredGroups.map((group, idx) => {
                  const log = group.representative;
                  const logId = log.id || log._id || String(idx);
                  const isExpanded = !!expandedLogIds[logId];
                  const dateStr = log.createdAt ? formatDateTimeStr(log.createdAt) : '---';
                  const engineBadge = getEngineBadge(log);

                  return (
                    <div
                      key={logId}
                      style={{
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Header sự kiện */}
                      <div
                        onClick={() => toggleExpand(logId)}
                        style={{
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          userSelect: 'none',
                          backgroundColor: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--bg-surface)',
                              border: '1px solid var(--border-color)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {getStageIcon(log.stage)}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.75rem' }}>
                                {log.title}
                              </span>
                              {getStatusBadge(log.status)}
                              {engineBadge}
                              {group.count > 1 && (
                                <span
                                  style={{
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    backgroundColor: 'rgba(100, 116, 139, 0.2)',
                                    color: '#94a3b8',
                                    border: '1px solid rgba(100, 116, 139, 0.3)',
                                  }}
                                  title={`Lặp lại ${group.count} lần do quét định kỳ`}
                                >
                                  x{group.count} lần
                                </span>
                              )}
                            </div>

                            {log.details && (
                              <p
                                style={{
                                  margin: '3px 0 0',
                                  color: 'var(--text-muted)',
                                  fontSize: '0.7rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {log.details}
                              </p>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, marginLeft: '12px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                              <Clock size={11} />
                              <span>{dateStr}</span>
                            </div>
                            {log.performer && (
                              <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                                Bởi: {log.performer}
                              </span>
                            )}
                          </div>
                          {isExpanded ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
                        </div>
                      </div>

                      {/* Chi tiết nội dung mở rộng khi click vào item */}
                      {isExpanded && (
                        <div
                          style={{
                            padding: '12px 14px',
                            borderTop: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-surface)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                          }}
                        >
                          {/* Thẻ tóm tắt thông tin công nghệ bóc tách */}
                          {log.extractedData && (log.extractedData.engineLabel || log.extractedData.modelUsed) && (
                            <div
                              style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                                Cơ chế xử lý: <strong style={{ color: '#3b82f6' }}>{log.extractedData.engineLabel || log.extractedData.engine}</strong>
                              </span>
                              {log.extractedData.modelUsed && (
                                <span style={{ color: '#c084fc', fontWeight: 600 }}>
                                  Mô hình AI: {log.extractedData.modelUsed}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Hiển thị raw DOM inputs nếu là M-System */}
                          {log.rawInputsLog && log.rawInputsLog.length > 0 && (
                            <div>
                              <span style={{ fontWeight: 600, color: '#38bdf8', display: 'block', marginBottom: '6px' }}>
                                Các trường DOM thực tế đọc từ màn hình M-System ({log.rawInputsLog.length} trường):
                              </span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {log.rawInputsLog.map((inp, iIdx) => (
                                  <div
                                    key={iIdx}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: 'rgba(56, 189, 248, 0.08)',
                                      border: '1px solid rgba(56, 189, 248, 0.2)',
                                      color: 'var(--text-secondary)',
                                      fontFamily: 'monospace',
                                      fontSize: '0.68rem',
                                    }}
                                  >
                                    {inp}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Hiển thị dữ liệu có cấu trúc (Thu gọn mặc định trong thẻ details để chống rối mắt) */}
                          {log.extractedData && Object.keys(log.extractedData).length > 0 && (
                            <details
                              style={{
                                borderRadius: '6px',
                                backgroundColor: 'var(--bg-input)',
                                border: '1px solid var(--border-color)',
                                padding: '6px 10px',
                              }}
                            >
                              <summary
                                style={{
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  color: '#3b82f6',
                                  fontSize: '0.68rem',
                                  userSelect: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <Code size={12} />
                                <span>Xem Dữ Liệu Trích Xuất Có Cấu Trúc (JSON thô)</span>
                              </summary>
                              <pre
                                style={{
                                  margin: '8px 0 0',
                                  padding: '8px',
                                  borderRadius: '4px',
                                  backgroundColor: 'var(--bg-surface)',
                                  border: '1px solid var(--border-color)',
                                  fontSize: '0.67rem',
                                  color: 'var(--text-secondary)',
                                  overflowX: 'auto',
                                  maxHeight: '220px',
                                }}
                              >
                                {JSON.stringify(log.extractedData, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 4. DỮ LIỆU THÔ RECORD JSON ─── */}
      <details style={{ marginTop: '4px' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600, userSelect: 'none' }}>
          Xem Toàn Bộ Bản Ghi MongoDB (Raw Record JSON)
        </summary>
        <pre
          style={{
            marginTop: '8px',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            overflowX: 'auto',
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            maxHeight: '260px',
          }}
        >
          {JSON.stringify(inspectRecord, null, 2)}
        </pre>
      </details>
    </div>
  );
};
