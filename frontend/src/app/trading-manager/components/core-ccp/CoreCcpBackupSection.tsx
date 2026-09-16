'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Play,
  Terminal,
  ShieldCheck,
  FileSpreadsheet,
  TrendingUp,
  Database,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/context/AuthContext';
import CcpLotStatisticsSection from './CcpLotStatisticsSection';
import TradingManagerLogModal from '../shared/TradingManagerLogModal';

export interface CoreCcpBackupSectionProps {
  token: string | null;
  selectedDate: string;
  onOpenGuide?: () => void;
}

export default function CoreCcpBackupSection({
  token,
  selectedDate,
  onOpenGuide,
}: CoreCcpBackupSectionProps) {
  // 2 Sub-tabs nguyên bản của CoreCCP: 1. ĐỐI SOÁT KÝ QUỸ & EOD | 2. THỐNG KÊ LOT & GTGD
  const [activeSubTab, setActiveSubTab] = useState<'EOD_RECON' | 'LOT_STATS'>('EOD_RECON');

  // State
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggeringSection, setTriggeringSection] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [showLogModal, setShowLogModal] = useState(false);

  const fmt = (n: any) => {
    if (n === undefined || n === null) return '0';
    return Number(n).toLocaleString('en-US');
  };

  // Fetch console summary (ccpSummary)
  const fetchSummary = useCallback(async () => {
    if (!token || !selectedDate) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reconciliation/console-summary?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (e) {
      console.error('Error fetching CCP summary:', e);
    }
  }, [token, selectedDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Trigger Playwright Download 4 CoreCCP files
  const handleTriggerCcpDownload = async () => {
    if (!token || triggering) return;
    setTriggering(true);
    setTriggeringSection('ccp-download');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-ccp-download`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          reports: ['QLTTTKGD', 'EOD', 'NR', 'TTTT'],
        }),
      });

      if (!res.ok) {
        throw new Error(`Lỗi khởi chạy tải CoreCCP: HTTP ${res.status}`);
      }

      const result = await res.json();
      const jobId = result.jobId;

      if (!jobId) {
        toast.success(result.message || 'Đã kích hoạt tải báo cáo CoreCCP!');
        await fetchSummary();
        return;
      }

      toast.loading('Robot Playwright đang tải 4 báo cáo CoreCCP, vui lòng chờ...', { id: 'ccp-job-progress' });

      const startTime = Date.now();
      const MAX_WAIT_MS = 180000;
      const POLL_INTERVAL_MS = 2500;
      let isDone = false;

      while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        try {
          const jobRes = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!jobRes.ok) continue;
          const job = await jobRes.json();

          if (job.status === 'COMPLETED') {
            isDone = true;
            toast.dismiss('ccp-job-progress');
            toast.success('Đã tải xong toàn bộ 4 báo cáo CoreCCP về thư mục backup!', { duration: 5000 });
            await fetchSummary();
            break;
          } else if (job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'ABORTED') {
            isDone = true;
            toast.dismiss('ccp-job-progress');
            toast.error(`Tải báo cáo CoreCCP kết thúc (${job.status}): ${job.error || 'Xem log để biết thêm'}`, { duration: 6000 });
            await fetchSummary();
            break;
          }
        } catch {
          // Ignore transient errors
        }
      }

      if (!isDone) {
        toast.dismiss('ccp-job-progress');
        toast.success('Quá trình tải báo cáo CoreCCP đang tiếp tục chạy ngầm.');
      }
    } catch (err: any) {
      toast.dismiss('ccp-job-progress');
      toast.error(err.message || 'Lỗi khi kích hoạt tải báo cáo CoreCCP');
    } finally {
      setTriggering(false);
      setTriggeringSection(null);
    }
  };

  // Trigger Kiểm tra đối chiếu EOD CCP
  const handleTriggerCcpCheck = async () => {
    if (!token || triggering) return;
    setTriggering(true);
    setTriggeringSection('ccp-check');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reconciliation/trigger-console-run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          jobType: 'CHECK_EOD_CCP',
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const result = await res.json();
      const jobId = result.jobId;

      if (!jobId) {
        toast.success('Đã kích hoạt kiểm tra đối chiếu EOD CoreCCP!');
        await fetchSummary();
        return;
      }

      toast.loading('Đang đối chiếu số dư 4 thành phần EOD CoreCCP...', { id: 'ccp-check-progress' });

      const startTime = Date.now();
      const MAX_WAIT_MS = 120000;
      const POLL_INTERVAL_MS = 2500;
      let isDone = false;

      while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        try {
          const jobRes = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!jobRes.ok) continue;
          const job = await jobRes.json();

          if (job.status === 'COMPLETED') {
            isDone = true;
            toast.dismiss('ccp-check-progress');
            toast.success('Đối chiếu EOD CoreCCP hoàn tất!', { duration: 5000 });
            await fetchSummary();
            break;
          } else if (job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'ABORTED') {
            isDone = true;
            toast.dismiss('ccp-check-progress');
            toast.error(`Đối chiếu kết thúc (${job.status}): ${job.error || 'Xem log'}`, { duration: 6000 });
            await fetchSummary();
            break;
          }
        } catch {}
      }

      if (!isDone) {
        toast.dismiss('ccp-check-progress');
        toast.success('Quá trình đối chiếu đang chạy ngầm.');
      }
    } catch (err: any) {
      toast.dismiss('ccp-check-progress');
      toast.error(err.message || 'Lỗi khi kiểm tra đối chiếu CoreCCP');
    } finally {
      setTriggering(false);
      setTriggeringSection(null);
    }
  };

  const ccp = summaryData?.ccpSummary;
  const filesPresent = ccp?.filesPresent;
  const filesCount = [
    filesPresent?.qltkgd,
    filesPresent?.eod,
    filesPresent?.nr,
    filesPresent?.tttt,
  ].filter(Boolean).length;
  const totalAccounts = ccp?.totals?.totalAccounts || 0;
  const totalNegative = ccp?.totals?.totalNegative || 0;
  const totalMismatched = ccp?.totals?.totalMismatched || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* SUB-TABS NAVIGATION: 1. ĐỐI SOÁT & TẢI 4 FILE | 2. THỐNG KÊ LOT & GTGD */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap' }}>
        {[
          { key: 'EOD_RECON', label: '1. Đối Soát Ký Quỹ & EOD (Tải 4 File & Kiểm Tra)', icon: ShieldCheck, color: '#3b82f6' },
          { key: 'LOT_STATS', label: '2. Thống Kê Số Lot & GTGD CoreCCP (Thay Thế Macro)', icon: TrendingUp, color: '#10b981' },
        ].map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSubTab(key as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              fontSize: '0.84rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeSubTab === key ? `2px solid ${color}` : '2px solid transparent',
              color: activeSubTab === key ? color : 'var(--text-secondary)',
              backgroundColor: activeSubTab === key ? `${color}15` : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Icon size={16} color={activeSubTab === key ? color : 'var(--text-muted)'} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* SUBTAB 1: ĐỐI SOÁT KÝ QUỸ & EOD (MÀN HÌNH TẢI 4 FILE VÀ KIỂM TRA CHUẨN) */}
      {activeSubTab === 'EOD_RECON' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* CORECCP CONTROL & ACTION HEADER */}
          <div
            className="glass-panel"
            style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#60a5fa',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  VNCLEAR Automation
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Đối Soát & Báo Cáo CoreCCP (VNCLEAR)
                </h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                Thu thập tự động 4 báo cáo QLTTTKGD, EOD, NR, TTTT qua Playwright và đối chiếu số dư EOD công thức 4 thành phần.
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleTriggerCcpDownload}
                disabled={triggering}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '8px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                  color: '#60a5fa',
                  cursor: triggering ? 'not-allowed' : 'pointer',
                }}
              >
                {triggering && triggeringSection === 'ccp-download' ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang tải 4 file...</span>
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    <span>Tải Báo Cáo CoreCCP</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleTriggerCcpCheck}
                disabled={triggering}
                className="btn btn-primary"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '8px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: triggering ? 'not-allowed' : 'pointer',
                }}
              >
                {triggering && triggeringSection === 'ccp-check' ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang đối chiếu...</span>
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    <span>Kiểm Tra Đối Chiếu CCP</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowLogModal(true)}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Mở toàn màn hình xem nhật ký bot"
              >
                <Terminal size={15} />
                <span>Log Modal</span>
              </button>
            </div>
          </div>

          {/* 4 KPI STATS CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {/* Card 1 */}
            <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Tổng Tài Khoản CCP
                </span>
                <Database size={18} color="#3b82f6" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {fmt(totalAccounts)} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>TK</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Ghi nhận trong file EOD
              </span>
            </div>

            {/* Card 2 */}
            <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  File Báo Cáo Sẵn Sàng
                </span>
                <FileSpreadsheet size={18} color={filesCount === 4 ? '#10b981' : '#f59e0b'} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: filesCount === 4 ? '#10b981' : '#f59e0b' }}>
                {filesCount}/4 <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Tệp</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                QLTTTKGD, EOD, NR, TTTT
              </span>
            </div>

            {/* Card 3 */}
            <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Tài Khoản Âm Ký Quỹ
                </span>
                <AlertTriangle size={18} color={totalNegative > 0 ? '#ef4444' : '#10b981'} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: totalNegative > 0 ? '#ef4444' : '#10b981' }}>
                {totalNegative} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>TK</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {totalNegative > 0 ? 'Cần xử lý nộp ký quỹ gấp' : 'An toàn: Không có TK âm'}
              </span>
            </div>

            {/* Card 4 */}
            <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Lệch Công Thức EOD
                </span>
                <ShieldCheck size={18} color={totalMismatched > 0 ? '#ef4444' : '#10b981'} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: totalMismatched > 0 ? '#ef4444' : '#10b981' }}>
                {totalMismatched} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>TK</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {totalMismatched > 0 ? 'Phát hiện chênh lệch số dư' : 'Khớp 100% công thức chuẩn'}
              </span>
            </div>
          </div>

          {/* 2-COLUMN MAIN VIEW */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 45%) 1fr', gap: '20px' }}>
            {/* CỘT TRÁI: DANH SÁCH FILE NGUỒN (4 FILE) & TERMINAL LOGS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* File Status Box (4 File) */}
              <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    File Báo Cáo Tại Thư Mục Backup (4 File)
                  </h5>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {ccp?.folderPath ? ccp.folderPath.split(/[\\/]/).pop() : 'CoreCCP'}
                  </span>
                </div>

                <div style={{ padding: '16px' }}>
                  {(() => {
                    const files = ccp?.filesPresent;
                    const fileItems = [
                      {
                        code: 'QLTTTKGD',
                        name: 'Báo cáo Quản lý Thông tin TKGD & Số dư',
                        present: !!files?.qltkgd,
                        filename: files?.qltkgdName || 'QLTTTKGD*.csv',
                        size: files?.qltkgdSize || 0,
                      },
                      {
                        code: 'EOD',
                        name: 'Báo cáo Ký quỹ & Số dư cuối ngày',
                        present: !!files?.eod,
                        filename: files?.eodName || 'EOD*.csv',
                        size: files?.eodSize || 0,
                      },
                      {
                        code: 'NR',
                        name: 'Báo cáo Nộp / Rút tiền ký quỹ trong phiên',
                        present: !!files?.nr,
                        filename: files?.nrName || 'NR*.csv',
                        size: files?.nrSize || 0,
                      },
                      {
                        code: 'TTTT',
                        name: 'Báo cáo Thông tin Tiền Thanh toán',
                        present: !!files?.tttt,
                        filename: files?.ttttName || 'TTTT*.csv',
                        size: files?.ttttSize || 0,
                      },
                    ];

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {fileItems.map((f, i) => (
                          <div
                            key={i}
                            style={{
                              padding: '12px 16px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: f.present ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                  {f.code}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {f.name}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                {f.present ? `${f.filename} (${(f.size / 1024).toFixed(1)} KB)` : 'Chưa tải file'}
                              </span>
                            </div>

                            <span
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                backgroundColor: f.present ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: f.present ? '#10b981' : '#ef4444',
                              }}
                            >
                              {f.present ? 'ĐÃ CÓ' : 'CHƯA CÓ'}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Live Terminal Log Box */}
              <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    padding: '12px 18px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Terminal size={14} color="#10b981" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Nhật Ký Tải & Đối Chiếu Robot CoreCCP
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    Live Output
                  </span>
                </div>

                <div
                  style={{
                    padding: '14px 16px',
                    backgroundColor: '#050b14',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    height: '240px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {(() => {
                    const downloadLogs = ccp?.downloadJob?.logs || [];
                    const checkLogs = ccp?.checkJob?.logs || [];
                    const combinedLogs = [...downloadLogs, ...checkLogs];

                    if (combinedLogs.length === 0) {
                      return (
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>
                          Chưa có nhật ký ghi nhận. Bấm "Tải Báo Cáo CoreCCP" hoặc "Kiểm Tra Đối Chiếu CCP" để chạy.
                        </div>
                      );
                    }

                    return combinedLogs.map((log: string, idx: number) => {
                      const isErr = log.includes('LỖI') || log.includes('Error') || log.includes('bất thường') || log.includes('failed');
                      const isSuccess = log.includes('THÀNH CÔNG') || log.includes('Hoàn thành');
                      return (
                        <div
                          key={idx}
                          style={{
                            color: isErr ? '#f87171' : isSuccess ? '#34d399' : '#94a3b8',
                            lineHeight: 1.5,
                            wordBreak: 'break-all',
                          }}
                        >
                          {log}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* CỘT PHẢI: BẢNG CHI TIẾT KẾT QUẢ ĐỐI CHIẾU EOD CORECCP */}
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Chi Tiết Chênh Lệch Công Thức EOD CoreCCP
                  </h5>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      backgroundColor: (ccp?.totals?.totalMismatched || 0) > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: (ccp?.totals?.totalMismatched || 0) > 0 ? '#ef4444' : '#10b981',
                    }}
                  >
                    {ccp?.totals?.totalMismatched || 0} Tài Khoản
                  </span>
                </div>
              </div>

              <div style={{ minHeight: '320px', maxHeight: '580px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(255,255,255,0.02)', zIndex: 5 }}>
                    <tr
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                      }}
                    >
                      <th style={{ padding: '10px 16px', fontWeight: 700, borderRight: '1px solid var(--border-color)', width: '150px' }}>
                        Mã TKGD
                      </th>
                      <th style={{ padding: '10px 16px', fontWeight: 700, borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>
                        Số Dư Tính Toán (VND)
                      </th>
                      <th style={{ padding: '10px 16px', fontWeight: 700, borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>
                        Số Dư Báo Cáo EOD (VND)
                      </th>
                      <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right', width: '180px' }}>
                        Chênh Lệch (VND)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const mismatched = ccp?.mismatchedAccounts || [];
                      if (mismatched.length === 0) {
                        return (
                          <tr>
                            <td colSpan={4} style={{ padding: '60px 20px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                <ShieldCheck size={36} color="#10b981" />
                                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981' }}>
                                  Số Dư Khớp Hoàn Toàn 100%
                                </span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  Không phát hiện bất kỳ sai lệch nào giữa công thức tính toán và số dư EOD CoreCCP
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return mismatched.map((item: any, idx: number) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: 'rgba(239, 68, 68, 0.04)',
                            fontFamily: 'monospace',
                            fontSize: '0.82rem',
                          }}
                        >
                          <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-color)', fontWeight: 800, color: '#f87171' }}>
                            {item.maTKGD}
                          </td>
                          <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>
                            {fmt(item.calculatedBalance)}
                          </td>
                          <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>
                            {fmt(item.eodBalance)}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>
                            {fmt(item.differ)}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: THỐNG KÊ SỐ LOT & GTGD (THAY THẾ MACRO) */}
      {activeSubTab === 'LOT_STATS' && (
        <CcpLotStatisticsSection
          token={token}
          selectedDate={selectedDate}
          onOpenGuide={onOpenGuide}
        />
      )}

      {/* LOG MODAL */}
      <TradingManagerLogModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        jobId={ccp?.checkJob?.jobId || ccp?.downloadJob?.jobId}
        status={ccp?.checkJob?.status || ccp?.downloadJob?.status}
        logs={[...(ccp?.downloadJob?.logs || []), ...(ccp?.checkJob?.logs || [])]}
        onRetry={handleTriggerCcpCheck}
        isRetrying={triggering}
      />
    </div>
  );
}
