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
  UserCheck,
  Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/context/AuthContext';
import CcpLotStatisticsSection from './CcpLotStatisticsSection';
import TradingManagerLogModal from '../shared/TradingManagerLogModal';
import { CORE_CCP_REPORTS_LIST } from '../legacy-ms-cqg/LegacyBackupThongKeSection';

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

  // 25 Reports selection state
  const [selectedReports, setSelectedReports] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CORE_CCP_REPORTS_LIST.map((r) => [r.key, true]))
  );
  const [showReportsPanel, setShowReportsPanel] = useState(true);

  // Chế độ hiển thị: USER (Mặc định tinh gọn cho Vận hành) vs EXPERT (Đầy đủ cho IT Kỹ thuật)
  const [viewMode, setViewMode] = useState<'USER' | 'EXPERT'>('USER');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('core_ccp_view_mode') as 'USER' | 'EXPERT';
      if (saved) setViewMode(saved);
    }
  }, []);

  const handleToggleViewMode = (mode: 'USER' | 'EXPERT') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('core_ccp_view_mode', mode);
    }
  };

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

  // Trigger Playwright Download CoreCCP files (hỗ trợ chọn báo cáo tùy ý)
  const handleTriggerCcpDownload = async (overrideReports?: string[]) => {
    if (!token || triggering) return;
    const chosen = overrideReports || Object.keys(selectedReports).filter((k) => selectedReports[k]);
    if (chosen.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 báo cáo CoreCCP để tải!');
      return;
    }

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
          reports: chosen,
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

      toast.loading(`Robot Playwright đang tải ${chosen.length} báo cáo CoreCCP, vui lòng chờ...`, { id: 'ccp-job-progress' });

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
        } catch { }
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { key: 'EOD_RECON', label: '1. Đối Soát Ký Quỹ & EOD', icon: ShieldCheck, color: '#3b82f6' },
            { key: 'LOT_STATS', label: '2. Thống Kê Số Lot & GTGD CoreCCP', icon: TrendingUp, color: '#10b981' },
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

        {/* VIEW MODE TOGGLE SWITCH: USER vs EXPERT */}
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-input)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => handleToggleViewMode('USER')}
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: viewMode === 'USER' ? '#10b981' : 'transparent',
              color: viewMode === 'USER' ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <UserCheck size={14} />
            <span>Vận Hành</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleViewMode('EXPERT')}
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: viewMode === 'EXPERT' ? '#3b82f6' : 'transparent',
              color: viewMode === 'EXPERT' ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <Wrench size={14} />
            <span>Kỹ Thuật (IT)</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: ĐỐI SOÁT KÝ QUỸ & EOD */}
      {activeSubTab === 'EOD_RECON' && (
        viewMode === 'USER' ? (
          /* USER MODE VIEW FOR SUB-TAB 1 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header & Main Action */}
            <div
              className="glass-panel"
              style={{
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                borderLeft: '4px solid #3b82f6',
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
                    VNCLEAR CoreCCP
                  </span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Đối Soát Số Dư & Ký Quỹ Cuối Ngày (EOD)
                  </h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Đối chiếu số dư tài khoản QLTTTKGD CoreCCP với báo cáo EOD Balance theo công thức chuẩn 4 thành phần.
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleTriggerCcpCheck}
                  disabled={triggering}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    padding: '10px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
                    cursor: triggering ? 'not-allowed' : 'pointer',
                  }}
                >
                  {triggering && triggeringSection === 'ccp-check' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang Chạy Đối Soát EOD...</span>
                    </>
                  ) : (
                    <>
                      <Play size={16} fill="currentColor" />
                      <span>Chạy Đối Soát EOD CoreCCP</span>
                    </>
                  )}
                </button>

                {filesCount < 4 && (
                  <button
                    type="button"
                    onClick={() => handleTriggerCcpDownload(['QLTTTKGD', 'EOD', 'NR', 'TTTT'])}
                    disabled={triggering}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '9px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: triggering ? 'not-allowed' : 'pointer',
                    }}
                    title="Tải lại 4 báo cáo CoreCCP cần thiết"
                  >
                    {triggering && triggeringSection === 'ccp-download' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    <span>Tải Lại 4 File</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4 KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {/* Card 1: Tình trạng số dư */}
              <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Tình Trạng Số Dư EOD
                  </span>
                  <ShieldCheck size={18} color={totalMismatched > 0 ? '#ef4444' : '#10b981'} />
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: totalMismatched > 0 ? '#ef4444' : '#10b981' }}>
                  {totalMismatched > 0 ? `LỆCH ${totalMismatched} TK` : 'KHỚP HOÀN TOÀN 100%'}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {totalMismatched > 0 ? 'Phát hiện chênh lệch cần kiểm tra' : 'Không có chênh lệch công thức EOD'}
                </span>
              </div>

              {/* Card 2: Tài khoản âm ký quỹ */}
              <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Tài Khoản Âm Ký Quỹ
                  </span>
                  <AlertTriangle size={18} color={totalNegative > 0 ? '#ef4444' : '#10b981'} />
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: totalNegative > 0 ? '#ef4444' : '#10b981' }}>
                  {totalNegative > 0 ? `${totalNegative} TK ÂM TIỀN` : 'AN TOÀN (0 TK)'}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {totalNegative > 0 ? 'Yêu cầu xử lý nộp ký quỹ bổ sung' : 'Tất cả tài khoản đều đủ ký quỹ'}
                </span>
              </div>

              {/* Card 3: Tiến trình tệp báo cáo */}
              <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Tệp Báo Cáo Sẵn Sàng
                  </span>
                  <FileSpreadsheet size={18} color={filesCount === 4 ? '#10b981' : '#f59e0b'} />
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: filesCount === 4 ? '#10b981' : '#f59e0b' }}>
                  {filesCount}/4 <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Tệp</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                  {[
                    { name: 'QLTTTKGD', ok: filesPresent?.qltkgd },
                    { name: 'EOD', ok: filesPresent?.eod },
                    { name: 'NR', ok: filesPresent?.nr },
                    { name: 'TTTT', ok: filesPresent?.tttt },
                  ].map((f) => (
                    <span
                      key={f.name}
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: f.ok ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: f.ok ? '#10b981' : '#ef4444',
                      }}
                    >
                      {f.name}: {f.ok ? 'OK' : 'Thiếu'}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card 4: Tổng tài khoản */}
              <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Tổng Tài Khoản Ghi Nhận
                  </span>
                  <Database size={18} color="#3b82f6" />
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                  {fmt(totalAccounts)} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>TK</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Dữ liệu đối chiếu phiên: {selectedDate}
                </span>
              </div>
            </div>

            {/* Result: Banner Khớp 100% HOẶC Bảng Lệch */}
            {totalMismatched === 0 ? (
              <div
                className="glass-panel"
                style={{
                  padding: '40px 24px',
                  textAlign: 'center',
                  backgroundColor: 'rgba(16, 185, 129, 0.04)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  borderRadius: '12px',
                }}
              >
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={32} color="#10b981" />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981', margin: '0 0 6px 0' }}>
                    TẤT CẢ SỐ DƯ ĐỀU KHỚP HOÀN TOÀN 100%
                  </h4>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '600px' }}>
                    Hệ thống đã tự động đối chiếu số dư giữa báo cáo QLTTTKGD CoreCCP và báo cáo EOD Balance của M-System. Không phát hiện bất kỳ sai lệch nào.
                  </p>
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={20} color="#ef4444" />
                    <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#ef4444', margin: 0 }}>
                      DANH SÁCH {totalMismatched} TÀI KHOẢN PHÁT SINH CHÊNH LỆCH SỐ DƯ
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Phiên đối chiếu: {selectedDate}
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '10px 16px', fontWeight: 700, width: '150px' }}>Mã TKGD</th>
                        <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Số Dư Tính Toán (VND)</th>
                        <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Số Dư Báo Cáo EOD (VND)</th>
                        <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right', width: '180px' }}>Chênh Lệch (VND)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ccp?.mismatchedAccounts || []).map((item: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(239, 68, 68, 0.04)', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                          <td style={{ padding: '10px 16px', fontWeight: 800, color: '#f87171' }}>{item.maTKGD}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{fmt(item.calculatedBalance)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{fmt(item.eodBalance)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>{fmt(item.differ)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* EXPERT MODE VIEW FOR SUB-TAB 1 (BẢO LƯU 100% CODE CŨ) */
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
                onClick={() => handleTriggerCcpDownload(['QLTTTKGD', 'EOD', 'NR', 'TTTT'])}
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

          {/* BẢNG CHỌN 25 BÁO CÁO BACKUP CORECCP (VNCLEAR MAKER) */}
          <div className="glass-panel" style={{ padding: '16px 20px', border: '1px solid rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(16, 185, 129, 0.2)', paddingBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileSpreadsheet size={18} color="#10b981" />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Bộ Báo Cáo Backup CoreCCP (25 File VNCLEAR Maker)
                </h4>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                  }}
                >
                  {Object.values(selectedReports).filter(Boolean).length}/25 báo cáo đã chọn
                </span>
              </div>

              {/* Nút lọc nhanh theo Đợt & Action */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '4px' }}>
                  <input
                    type="checkbox"
                    checked={Object.values(selectedReports).every(Boolean)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedReports(Object.fromEntries(CORE_CCP_REPORTS_LIST.map((r) => [r.key, checked])));
                    }}
                    style={{ accentColor: '#10b981', width: '14px', height: '14px' }}
                  />
                  <span>Tất cả</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    const next = Object.fromEntries(CORE_CCP_REPORTS_LIST.map((r) => [r.key, r.phase === 1]));
                    setSelectedReports(next);
                  }}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '5px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', cursor: 'pointer', color: '#f59e0b', fontWeight: 700 }}
                  title="Chỉ chọn 2 file trước 16h20: QL TT TKGD truoc 4h20, TTM truoc 4h20"
                >
                  Đợt 1 (16h20 - 2 file)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = Object.fromEntries(CORE_CCP_REPORTS_LIST.map((r) => [r.key, r.phase === 2]));
                    setSelectedReports(next);
                  }}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '5px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', cursor: 'pointer', color: '#3b82f6', fontWeight: 700 }}
                  title="Chọn 23 file EOD cuối ngày"
                >
                  Đợt 2 (EOD - 23 file)
                </button>

                <button
                  type="button"
                  onClick={() => handleTriggerCcpDownload()}
                  disabled={triggering}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    padding: '5px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#10b981',
                    borderColor: '#10b981',
                  }}
                >
                  {triggering && triggeringSection === 'ccp-download' ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Đang tải...</span>
                    </>
                  ) : (
                    <>
                      <Download size={13} />
                      <span>Tải Các Báo Cáo Đã Chọn</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Grid 25 Checkboxes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px 12px' }}>
              {CORE_CCP_REPORTS_LIST.map((rep) => (
                <label
                  key={rep.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '0.76rem',
                    color: selectedReports[rep.key] ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: selectedReports[rep.key] ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                    border: `1px solid ${selectedReports[rep.key] ? 'rgba(16, 185, 129, 0.25)' : 'transparent'}`,
                  }}
                  title={`${rep.filename} (${rep.groupLabel})`}
                >
                  <input
                    type="checkbox"
                    checked={!!selectedReports[rep.key]}
                    onChange={() => setSelectedReports((prev) => ({ ...prev, [rep.key]: !prev[rep.key] }))}
                    style={{ accentColor: '#10b981', width: '13px', height: '13px' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {rep.name}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                      {rep.groupLabel}
                    </span>
                  </div>
                </label>
              ))}
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
        )
      )}

      {/* SUBTAB 2: THỐNG KÊ SỐ LOT & GTGD (THAY THẾ MACRO) */}
      {activeSubTab === 'LOT_STATS' && (
        <CcpLotStatisticsSection
          token={token}
          selectedDate={selectedDate}
          onOpenGuide={onOpenGuide}
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewMode}
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
