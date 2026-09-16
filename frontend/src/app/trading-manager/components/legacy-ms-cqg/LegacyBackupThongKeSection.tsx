'use client';

import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Play,
  Server,
  Clock,
  Sliders,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { API_BASE_URL } from '@/context/AuthContext';
import LegacyGttCheckerSection from './LegacyGttCheckerSection';

export interface LegacyBackupThongKeSectionProps {
  token: string | null;
  selectedDate: string;
  onSelectDate?: (date: string) => void;
}

export default function LegacyBackupThongKeSection({
  token,
  selectedDate,
  onSelectDate,
}: LegacyBackupThongKeSectionProps) {
  // Checkbox settings
  const [backupPeriodic, setBackupPeriodic] = useState<boolean>(true);
  const [backupPeriodicMinutes, setBackupPeriodicMinutes] = useState<number>(60);
  const [enableBackupTime, setEnableBackupTime] = useState<boolean>(true);
  const [backupTime, setBackupTime] = useState<string>('06:00');
  const [enableStatTime, setEnableStatTime] = useState<boolean>(true);
  const [statTime, setStatTime] = useState<string>('06:30');

  // MS Reports (20 checkboxes)
  const [msReports, setMsReports] = useState<Record<string, boolean>>({
    NKTTHT: true,
    'DSTKGD-Futures': true,
    'DSTKGD-Spread': true,
    'DSTKGD-LME': true,
    'DSTKGD-ACM': true,
    TLQHSKQ: true,
    NR: true,
    DSTrader: true,
    'market truoc 6h': true,
    DSLDK: true,
    DSLCK: true,
    DSLH: true,
    DSLK: true,
    DSGD: true,
    TTM: true,
    TTTT: true,
    TTCDH: true,
    DSQLKQ: true,
    QLTKGD: true,
    'QLTKGD âm KQ': true,
  });

  // CQG Reports (9 checkboxes)
  const [cqgReports, setCqgReports] = useState<Record<string, boolean>>({
    FR1: true,
    FR2: true,
    PS1: true,
    PS2: true,
    OP1: true,
    OP2: true,
    OD1: true,
    OD2: true,
    AS: true,
  });

  // Execution states
  const [auditingMs, setAuditingMs] = useState<boolean>(false);
  const [auditingCqg, setAuditingCqg] = useState<boolean>(false);
  const [auditMsResult, setAuditMsResult] = useState<any>(null);
  const [auditCqgResult, setAuditCqgResult] = useState<any>(null);



  // IMR State
  const [imrLoading, setImrLoading] = useState<boolean>(false);
  const [imrResult, setImrResult] = useState<{
    g1: string[];
    g2: string[];
    g3: string[];
    g4: string[];
  } | null>(null);

  // Macro State
  const [lotMacroLoading, setLotMacroLoading] = useState<boolean>(false);
  const [valueMacroLoading, setValueMacroLoading] = useState<boolean>(false);

  // Audit MS Backup
  const handleAuditMsBackup = async () => {
    if (!token || auditingMs) return;
    setAuditingMs(true);
    const toastId = toast.loading('Đang kiểm tra thư mục Backup M-System...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/audit-ms-backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAuditMsResult(data);
      toast.success('Kiểm tra thư mục Backup M-System hoàn tất!', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi kiểm tra MS: ${err.message}`, { id: toastId });
    } finally {
      setAuditingMs(false);
    }
  };

  // Audit CQG Backup
  const handleAuditCqgBackup = async () => {
    if (!token || auditingCqg) return;
    setAuditingCqg(true);
    const toastId = toast.loading('Đang kiểm tra và đồng bộ thư mục Backup CQG...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/audit-cqg-backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAuditCqgResult(data);
      toast.success('Kiểm tra thư mục Backup CQG hoàn tất!', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi kiểm tra CQG: ${err.message}`, { id: toastId });
    } finally {
      setAuditingCqg(false);
    }
  };



  // Check IMR Negative Margin
  const handleCheckIMR = async () => {
    if (!token || imrLoading) return;
    setImrLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reconciliation/trigger-console-run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, bypassCooldown: true, jobType: 'SCAN_NEGATIVE_MARGIN' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const jobId = result.jobId;

      if (!jobId) {
        toast.success(result.message || 'Đã kích hoạt quét ký quỹ!');
        return;
      }

      toast.loading('Bot đang phân tích file QLTKGD & TTM M-System...', { id: 'imr-polling' });
      const start = Date.now();
      while (Date.now() - start < 120000) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const jr = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!jr.ok) continue;
          const job = await jr.json();
          if (job.status === 'COMPLETED') {
            toast.dismiss('imr-polling');
            const r = job.payload?.result || job;
            setImrResult({
              g1: r.imrGroup1 || r.laiLoCoTTM || [],
              g2: r.imrGroup2 || r.kyQuyKhongTTM || [],
              g3: r.imrGroup3 || r.kqycttNeKqyc || [],
              g4: r.imrGroup4 || r.kqkdttNeKqkd || [],
            });
            toast.success('Quét ký quỹ hoàn tất!', { duration: 5000 });
            return;
          }
          if (job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'ABORTED') {
            toast.dismiss('imr-polling');
            toast.error(`Quét ký quỹ kết thúc (${job.status}): ${job.error || ''}`, { duration: 6000 });
            return;
          }
        } catch { /* poll error */ }
      }
      toast.dismiss('imr-polling');
      toast.success('Tác vụ đang chạy ngầm, sẽ hoàn thành sau.');
    } catch (err: any) {
      toast.error(`Lỗi quét ký quỹ: ${err.message}`);
    } finally {
      setImrLoading(false);
    }
  };

  // Run Lot Macro
  const handleLotMacro = async () => {
    if (!token || lotMacroLoading) return;
    setLotMacroLoading(true);
    const toastId = toast.loading('Đang kích hoạt Excel Macro thống kê số lot...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-lot-macro`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      toast.success(data.message || 'Đã đưa yêu cầu chạy Macro số lot vào hàng đợi!', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi kích hoạt Macro số lot: ${err.message}`, { id: toastId });
    } finally {
      setLotMacroLoading(false);
    }
  };

  // Run Value Macro
  const handleValueMacro = async () => {
    if (!token || valueMacroLoading) return;
    setValueMacroLoading(true);
    const toastId = toast.loading('Đang kích hoạt Excel Macro thống kê giá trị giao dịch...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-value-macro`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      toast.success(data.message || 'Đã đưa yêu cầu chạy Macro giá trị vào hàng đợi!', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi kích hoạt Macro giá trị: ${err.message}`, { id: toastId });
    } finally {
      setValueMacroLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ===== HEADER BAR: NGÀY PHIÊN & THỜI ĐIỂM BACKUP ===== */}
      <div className="glass-panel" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          {/* Ngày phiên hiện tại */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={16} color="#10b981" />
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Ngày phiên hiện tại:
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectDate?.(e.target.value)}
              className="form-input"
              style={{ width: '150px', height: '34px', fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 700 }}
            />
          </div>

          {/* Backup định kỳ (phút) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={backupPeriodic}
                onChange={(e) => setBackupPeriodic(e.target.checked)}
                style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
              />
              <span>Backup định kỳ (phút)</span>
            </label>
            <input
              type="number"
              value={backupPeriodicMinutes}
              onChange={(e) => setBackupPeriodicMinutes(Number(e.target.value))}
              disabled={!backupPeriodic}
              className="form-input"
              style={{ width: '70px', height: '32px', fontSize: '0.82rem', fontFamily: 'monospace', textAlign: 'center', fontWeight: 700 }}
            />
          </div>

          {/* Thời điểm backup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={enableBackupTime}
                onChange={(e) => setEnableBackupTime(e.target.checked)}
                style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
              />
              <span>Thời điểm backup</span>
            </label>
            <input
              type="time"
              value={backupTime}
              onChange={(e) => setBackupTime(e.target.value)}
              disabled={!enableBackupTime}
              className="form-input"
              style={{ width: '90px', height: '32px', fontSize: '0.82rem', fontFamily: 'monospace', textAlign: 'center' }}
            />
          </div>

          {/* Thời điểm tạo thống kê */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={enableStatTime}
                onChange={(e) => setEnableStatTime(e.target.checked)}
                style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
              />
              <span>Thời điểm tạo thống kê</span>
            </label>
            <input
              type="time"
              value={statTime}
              onChange={(e) => setStatTime(e.target.value)}
              disabled={!enableStatTime}
              className="form-input"
              style={{ width: '90px', height: '32px', fontSize: '0.82rem', fontFamily: 'monospace', textAlign: 'center' }}
            />
          </div>
        </div>
      </div>

      {/* ===== SECTION 1: BACKUP MS & BACKUP CQG ===== */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          {/* CỘT TRÁI: BACKUP MS (20 BÁO CÁO) */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>Backup MS</span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={Object.values(msReports).every(Boolean)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setMsReports((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, checked])));
                      }}
                      style={{ accentColor: '#10b981', width: '14px', height: '14px' }}
                    />
                    <span>All</span>
                  </label>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>20 báo cáo</span>
              </div>

              {/* 20 Checkboxes trong Grid 2 Cột */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 16px' }}>
                {Object.keys(msReports).map((reportKey) => (
                  <label key={reportKey} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={!!msReports[reportKey]}
                      onChange={() => setMsReports((prev) => ({ ...prev, [reportKey]: !prev[reportKey] }))}
                      style={{ accentColor: '#10b981', width: '13px', height: '13px' }}
                    />
                    <span style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>{reportKey}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Nút Backup MS */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleAuditMsBackup}
                disabled={auditingMs}
                className="btn btn-primary"
                style={{ width: '180px', fontSize: '0.82rem', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {auditingMs ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                <span>{auditingMs ? 'Đang kiểm tra...' : 'Backup MS'}</span>
              </button>
              {auditMsResult && (
                <div style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'monospace', textAlign: 'center' }}>
                  {auditMsResult.summary ? `MS: ${auditMsResult.summary.ok}/${auditMsResult.summary.total} files OK` : 'Hoàn tất'}
                </div>
              )}
            </div>
          </div>

          {/* CỘT PHẢI: BACKUP CQG (9 FILE) */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>Backup CQG</span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={Object.values(cqgReports).every(Boolean)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCqgReports((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, checked])));
                      }}
                      style={{ accentColor: '#10b981', width: '14px', height: '14px' }}
                    />
                    <span>All</span>
                  </label>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>9 file</span>
              </div>

              {/* 9 Checkboxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px' }}>
                {Object.keys(cqgReports).map((fileKey) => (
                  <label key={fileKey} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={!!cqgReports[fileKey]}
                      onChange={() => setCqgReports((prev) => ({ ...prev, [fileKey]: !prev[fileKey] }))}
                      style={{ accentColor: '#10b981', width: '13px', height: '13px' }}
                    />
                    <span style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>{fileKey}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Nút Backup CQG */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleAuditCqgBackup}
                disabled={auditingCqg}
                className="btn btn-primary"
                style={{ width: '180px', fontSize: '0.82rem', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {auditingCqg ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                <span>{auditingCqg ? 'Đang kiểm tra...' : 'Backup CQG'}</span>
              </button>
              {auditCqgResult && (
                <div style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'monospace', textAlign: 'center' }}>
                  {auditCqgResult.summary ? `CQG: ${auditCqgResult.summary.ok}/${auditCqgResult.summary.total} files OK` : 'Hoàn tất'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== SECTION 2: GIÁ THANH TOÁN (GTT) ===== */}
      <LegacyGttCheckerSection token={token} selectedDate={selectedDate} />

      {/* ===== SECTION 3: KIỂM TRA KÝ QUỸ TKGD (4 BOXES C#) ===== */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Kiểm tra ký quỹ TKGD
          </span>
          <button
            type="button"
            onClick={handleCheckIMR}
            disabled={imrLoading}
            className="btn btn-primary"
            style={{ fontSize: '0.78rem', padding: '5px 16px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            {imrLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            <span>{imrLoading ? 'Đang check IMR...' : 'Check IMR'}</span>
          </button>
        </div>

        {/* 4 Boxes theo đúng layout C# FormMain */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {[
            {
              key: 'g1',
              title: 'TK có lãi lỗ dự kiến nhưng không có TTM',
              color: '#f59e0b',
            },
            {
              key: 'g2',
              title: 'TK không có TTM nhưng có KQYC',
              color: '#ef4444',
            },
            {
              key: 'g3',
              title: 'TK có KQYCTT <> KQYC',
              color: '#8b5cf6',
            },
            {
              key: 'g4',
              title: 'TK có KQKDTT <> KQKD',
              color: '#3b82f6',
            },
          ].map(({ key, title, color }) => {
            const group = imrResult?.[key as keyof typeof imrResult] || [];
            return (
              <div
                key={key}
                style={{
                  border: `1px solid ${color}40`,
                  borderRadius: '6px',
                  padding: '10px',
                  backgroundColor: 'var(--bg-input)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color, marginBottom: '6px', minHeight: '32px', lineHeight: 1.3, textAlign: 'center' }}>
                  {title}
                </div>
                <div
                  style={{
                    borderTop: `1px solid ${color}30`,
                    paddingTop: '6px',
                    minHeight: '60px',
                    maxHeight: '100px',
                    overflowY: 'auto',
                    fontSize: '0.76rem',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                    lineHeight: 1.4,
                  }}
                >
                  {imrResult === null ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '12px' }}>— Chưa check —</div>
                  ) : group.length === 0 ? (
                    <div style={{ color: '#10b981', fontWeight: 700, textAlign: 'center', paddingTop: '12px' }}>Không có tài khoản</div>
                  ) : (
                    group.map((acc: string, i: number) => (
                      <div key={i} style={{ padding: '2px 0' }}>{acc}</div>
                    ))
                  )}
                </div>
                {group.length > 0 && (
                  <div style={{ marginTop: '6px', padding: '2px 6px', borderRadius: '4px', backgroundColor: `${color}20`, fontSize: '0.7rem', fontWeight: 800, color, textAlign: 'center' }}>
                    Phát hiện {group.length} tài khoản
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== SECTION 4: THỐNG KÊ (SỐ LOT & GIÁ TRỊ) ===== */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Thống kê
          </span>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleLotMacro}
            disabled={lotMacroLoading}
            className="btn btn-primary"
            style={{ minWidth: '180px', fontSize: '0.82rem', padding: '9px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {lotMacroLoading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            <span>{lotMacroLoading ? 'Đang chạy Macro...' : 'Thống kê số lot'}</span>
          </button>

          <button
            type="button"
            onClick={handleValueMacro}
            disabled={valueMacroLoading}
            className="btn btn-secondary"
            style={{ minWidth: '180px', fontSize: '0.82rem', padding: '9px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {valueMacroLoading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            <span>{valueMacroLoading ? 'Đang chạy Macro...' : 'Thống kê giá trị'}</span>
          </button>
        </div>
      </div>

      {/* ===== SECTION 5: SHORTCUT LINKS ===== */}
      <div className="glass-panel" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
        <Link
          href="/admin/upload-backup"
          className="btn btn-secondary"
          style={{ fontSize: '0.82rem', padding: '9px 18px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <Server size={15} />
          Mở Thư Mục Backup
        </Link>
        <Link
          href="/history"
          className="btn btn-secondary"
          style={{ fontSize: '0.82rem', padding: '9px 18px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <Clock size={15} />
          Lịch Sử Ca Trực
        </Link>
        <Link
          href="/admin/bot-config"
          className="btn btn-secondary"
          style={{ fontSize: '0.82rem', padding: '9px 18px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <Sliders size={15} />
          Cấu Hình Bot Toàn Diện
        </Link>
      </div>
    </div>
  );
}
