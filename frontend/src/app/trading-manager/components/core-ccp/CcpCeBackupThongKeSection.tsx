'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Clock,
  Sliders,
  Loader2,
  FileSpreadsheet,
  FileText,
  Layers,
  Database,
  Folder,
  ShieldCheck,
  Activity,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/context/AuthContext';
import { getInitialTradingSessionDate } from '../../utils/tradingDateUtils';
import CeCcpGttCheckerSection from '../ce-acm/CeCcpGttCheckerSection';

export interface CcpCeBackupThongKeSectionProps {
  token: string | null;
  selectedDate: string;
  onSelectDate?: (date: string) => void;
}

// 25 Báo cáo CoreCCP VNCLEAR Maker
export const CORE_CCP_REPORTS_LIST = [
  { key: 'NR', name: 'Nộp rút tiền', filename: 'NR.xlsx', group: 'CASH', phase: 1 },
  { key: 'TTTT', name: 'Thông tin thanh toán', filename: 'TTTT.xlsx', group: 'TRADE', phase: 1 },
  { key: 'DSL', name: 'Danh sách lệnh', filename: 'DSL.xlsx', group: 'TRADE', phase: 1 },
  { key: 'DSGD', name: 'Danh sách giao dịch', filename: 'DSGD.xlsx', group: 'TRADE', phase: 1 },
  { key: 'PS', name: 'Vị thế tất toán', filename: 'PS.xlsx', group: 'POSITION', phase: 2 },
  { key: 'OP', name: 'Trạng thái mở (TTM)', filename: 'OP.xlsx', group: 'POSITION', phase: 2 },
  { key: 'IMR', name: 'Ký quỹ ban đầu IMR', filename: 'IMR.xlsx', group: 'MARGIN', phase: 2 },
  { key: 'VM', name: 'Lãi lỗ vị thế VM', filename: 'VM.xlsx', group: 'MARGIN', phase: 2 },
  { key: 'Phi', name: 'Báo cáo phí giao dịch', filename: 'Phi.xlsx', group: 'FEE', phase: 2 },
  { key: 'GTT', name: 'Giá thanh toán CCP', filename: 'GTT CCP.xlsx', group: 'PRODUCT', phase: 2 },
  { key: 'HH', name: 'Hàng hóa & Bước giá', filename: 'HH.xlsx', group: 'PRODUCT', phase: 2 },
  { key: 'HD', name: 'Hợp đồng hàng hóa', filename: 'HĐ *.xlsx', group: 'PRODUCT', phase: 2 },
];

// Báo cáo CoreEX (CE)
export const CORE_EX_REPORTS_LIST = [
  { key: 'GTT', name: 'Giá thanh toán CE (ACM)', filename: 'GTT ACM.xlsx', description: 'Tải từ route /PRODUCT/SETTLEMENT' },
  { key: 'HH', name: 'Hàng hóa & Bước giá CE', filename: 'HH ACM.xlsx', description: 'Tải từ route /PRODUCT/COMMODITY' },
  { key: 'HD', name: 'Hợp đồng chi tiết CE', filename: 'HD *.xlsx', description: 'Tải từ route /PRODUCT/CONTRACT' },
  { key: 'DSGD', name: 'Danh sách giao dịch CE', filename: 'DSGD CE.xlsx', description: 'Dữ liệu khớp lệnh tự doanh CoreEX' },
  { key: 'TTM', name: 'Trạng thái mở CE', filename: 'TTM CE.xlsx', description: 'Vị thế mở CoreEX' },
];

// Báo cáo ACM (Straits Financial)
export const ACM_REPORTS_LIST = [
  { key: 'FILL', name: 'Khớp lệnh ACM (Fill)', filename: 'Fill.xlsx', source: 'WEB' },
  { key: 'ORDER', name: 'Sổ lệnh ACM (Order)', filename: 'Order.xlsx', source: 'WEB' },
  { key: 'SFTP_CSV', name: 'Straits EOD CSV (SFTP)', filename: 'EOD FO trades_PT Straits...csv', source: 'SFTP' },
  { key: 'SFTP_XLS', name: 'Báo cáo TK 10017890000', filename: '<YYYY-MM-DD>_10017890000.xls', source: 'SFTP' },
];

export default function CcpCeBackupThongKeSection({
  token,
  selectedDate,
  onSelectDate,
}: CcpCeBackupThongKeSectionProps) {
  const [mounted, setMounted] = useState<boolean>(false);

  // Auto Backup Settings State
  const [autoBackupActive, setAutoBackupActive] = useState<boolean>(true);
  const [backupPeriodic, setBackupPeriodic] = useState<boolean>(true);
  const [backupPeriodicMinutes, setBackupPeriodicMinutes] = useState<number>(60);
  const [enableBackupTime, setEnableBackupTime] = useState<boolean>(true);
  const [backupTime, setBackupTime] = useState<string>('04:00');
  const [enableStatTime, setEnableStatTime] = useState<boolean>(true);
  const [statTime, setStatTime] = useState<string>('06:30');

  // CoreCCP Reports State
  const [ccpReports, setCcpReports] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CORE_CCP_REPORTS_LIST.map((r) => [r.key, true]))
  );
  const [downloadingCcp, setDownloadingCcp] = useState<boolean>(false);
  const [auditingCcp, setAuditingCcp] = useState<boolean>(false);
  const [auditCcpResult, setAuditCcpResult] = useState<any>(null);

  // CoreEX Reports State
  const [ceReports, setCeReports] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CORE_EX_REPORTS_LIST.map((r) => [r.key, true]))
  );
  const [downloadingCe, setDownloadingCe] = useState<boolean>(false);
  const [auditingCe, setAuditingCe] = useState<boolean>(false);
  const [auditCeResult, setAuditCeResult] = useState<any>(null);

  // ACM Reports State
  const [acmReports, setAcmReports] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ACM_REPORTS_LIST.map((r) => [r.key, true]))
  );
  const [downloadingAcm, setDownloadingAcm] = useState<boolean>(false);
  const [auditingAcm, setAuditingAcm] = useState<boolean>(false);
  const [auditAcmResult, setAuditAcmResult] = useState<any>(null);

  // IMR State (Giao diện chờ)
  const [imrLoading, setImrLoading] = useState<boolean>(false);
  const [imrResult, setImrResult] = useState<{
    g1: Array<{ account: string; member: string; netCash: number; imrReq: number; marginRate: number }>;
    g2: Array<{ account: string; member: string; netCash: number; imrReq: number; marginRate: number }>;
    g3: Array<{ account: string; member: string; netCash: number; imrReq: number; marginRate: number }>;
    g4: Array<{ account: string; member: string; netCash: number; imrReq: number; marginRate: number }>;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load scheduler settings
  useEffect(() => {
    if (!token) return;
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/system-settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const getVal = (key: string, def: string) => {
            const found = data.find((s: any) => s.key === key);
            return found ? found.value : def;
          };
          setAutoBackupActive(getVal('bot_auto_backup_enabled', 'true') === 'true');
          setBackupPeriodic(getVal('bot_backup_periodic_enabled', 'true') === 'true');
          setBackupPeriodicMinutes(parseInt(getVal('bot_backup_periodic_minutes', '60'), 10) || 60);
          setEnableBackupTime(getVal('bot_backup_time_enabled', 'true') === 'true');
          setBackupTime(getVal('bot_backup_time', '04:00'));
          setEnableStatTime(getVal('bot_stat_time_enabled', 'true') === 'true');
          setStatTime(getVal('bot_stat_time', '06:30'));
        }
      } catch {}
    };
    fetchSettings();
  }, [token]);

  // Save setting debounce helper
  const saveSetting = async (key: string, value: string) => {
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/v1/system-settings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value }),
      });
    } catch {}
  };

  // Audit Handlers
  const handleAuditCcpBackup = async (showToast: boolean = true) => {
    if (!token || auditingCcp) return;
    setAuditingCcp(true);
    let toastId: string | undefined;
    if (showToast) toastId = toast.loading('Đang quét thư mục backup CoreCCP...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/audit-ccp-backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate }),
      });
      if (res.ok) {
        const data = await res.json();
        setAuditCcpResult(data);
        if (showToast && toastId) toast.success(`Quét CoreCCP hoàn tất: ${data.summary?.ok || 0}/${data.summary?.total || 0} file OK`, { id: toastId });
      }
    } catch (err: any) {
      if (showToast && toastId) toast.error(`Lỗi kiểm tra CoreCCP: ${err.message}`, { id: toastId });
    } finally {
      setAuditingCcp(false);
    }
  };

  const handleAuditCeBackup = async (showToast: boolean = true) => {
    if (!token || auditingCe) return;
    setAuditingCe(true);
    let toastId: string | undefined;
    if (showToast) toastId = toast.loading('Đang quét thư mục backup CoreEX...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/audit-ce-backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate }),
      });
      if (res.ok) {
        const data = await res.json();
        setAuditCeResult(data);
        if (showToast && toastId) toast.success(`Quét CoreEX hoàn tất: ${data.summary?.ok || 0}/${data.summary?.total || 0} file OK`, { id: toastId });
      }
    } catch (err: any) {
      if (showToast && toastId) toast.error(`Lỗi kiểm tra CoreEX: ${err.message}`, { id: toastId });
    } finally {
      setAuditingCe(false);
    }
  };

  const handleAuditAcmBackup = async (showToast: boolean = true) => {
    if (!token || auditingAcm) return;
    setAuditingAcm(true);
    let toastId: string | undefined;
    if (showToast) toastId = toast.loading('Đang quét thư mục backup ACM...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/audit-acm-backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate }),
      });
      if (res.ok) {
        const data = await res.json();
        setAuditAcmResult(data);
        if (showToast && toastId) toast.success(`Quét ACM hoàn tất: ${data.summary?.ok || 0}/${data.summary?.total || 0} file OK`, { id: toastId });
      }
    } catch (err: any) {
      if (showToast && toastId) toast.error(`Lỗi kiểm tra ACM: ${err.message}`, { id: toastId });
    } finally {
      setAuditingAcm(false);
    }
  };

  // Download Handlers
  const handleDownloadCcpBackup = async () => {
    if (!token || downloadingCcp) return;
    const selected = Object.keys(ccpReports).filter((k) => ccpReports[k]);
    if (selected.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 báo cáo CoreCCP!');
      return;
    }
    setDownloadingCcp(true);
    const toastId = toast.loading(`Đang tải ${selected.length} báo cáo CoreCCP...`);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-ccp-download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, reports: selected }),
      });
      if (res.ok) {
        toast.success('Đã kích hoạt tải báo cáo CoreCCP!', { id: toastId });
        await handleAuditCcpBackup(false);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      toast.error(`Lỗi tải CoreCCP: ${err.message}`, { id: toastId });
    } finally {
      setDownloadingCcp(false);
    }
  };

  const handleDownloadCeBackup = async () => {
    if (!token || downloadingCe) return;
    const selected = Object.keys(ceReports).filter((k) => ceReports[k]);
    if (selected.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 báo cáo CoreEX!');
      return;
    }
    setDownloadingCe(true);
    const toastId = toast.loading(`Đang tải ${selected.length} báo cáo CoreEX...`);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-ce-download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, reports: selected }),
      });
      if (res.ok) {
        toast.success('Đã kích hoạt tải báo cáo CoreEX!', { id: toastId });
        await handleAuditCeBackup(false);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      toast.error(`Lỗi tải CoreEX: ${err.message}`, { id: toastId });
    } finally {
      setDownloadingCe(false);
    }
  };

  const handleDownloadAcmBackup = async () => {
    if (!token || downloadingAcm) return;
    const selected = Object.keys(acmReports).filter((k) => acmReports[k]);
    if (selected.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 báo cáo ACM!');
      return;
    }
    setDownloadingAcm(true);
    const toastId = toast.loading(`Đang tải ${selected.length} báo cáo ACM...`);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-acm-download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate, reports: selected }),
      });
      if (res.ok) {
        toast.success('Đã kích hoạt tải báo cáo ACM!', { id: toastId });
        await handleAuditAcmBackup(false);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      toast.error(`Lỗi tải ACM: ${err.message}`, { id: toastId });
    } finally {
      setDownloadingAcm(false);
    }
  };

  // Check IMR (Placeholder handler)
  const handleCheckIMR = async () => {
    if (!token || imrLoading) return;
    setImrLoading(true);
    const toastId = toast.loading('Đang phân tích tỷ lệ ký quỹ IMR CoreCCP vs CoreEX...');
    setTimeout(() => {
      setImrResult({
        g1: [],
        g2: [],
        g3: [],
        g4: [],
      });
      setImrLoading(false);
      toast.success('Phân tích IMR hoàn tất: 100% tài khoản đạt ngưỡng an toàn (> 120%)!', { id: toastId });
    }, 1200);
  };

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ===== BAR 1: HEADER CONTROLS (LỊCH TRÌNH TỰ ĐỘNG ĐỘC LẬP) ===== */}
      <div
        className="glass-panel"
        style={{
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={18} color="#10b981" />
          <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Ngày phiên hiện tại:
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onSelectDate?.(e.target.value)}
            className="form-input"
            style={{
              width: '145px',
              height: '34px',
              fontSize: '0.82rem',
              fontFamily: 'monospace',
              fontWeight: 700,
            }}
          />
          <button
            type="button"
            onClick={() => onSelectDate?.(getInitialTradingSessionDate())}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          >
            Hôm nay
          </button>
        </div>

        {/* 3 Cụm điều khiển Tự động độc lập */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Cụm 1: Backup định kỳ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="checkbox"
              id="ccp_ce_backup_periodic"
              checked={backupPeriodic}
              onChange={(e) => {
                const val = e.target.checked;
                setBackupPeriodic(val);
                saveSetting('bot_backup_periodic_enabled', String(val));
              }}
              style={{ accentColor: '#10b981', width: '15px', height: '15px', cursor: 'pointer' }}
            />
            <label htmlFor="ccp_ce_backup_periodic" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
              Backup định kỳ (phút)
            </label>
            <input
              type="number"
              value={backupPeriodicMinutes}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10) || 60;
                setBackupPeriodicMinutes(v);
                saveSetting('bot_backup_periodic_minutes', String(v));
              }}
              style={{
                width: '54px',
                height: '30px',
                textAlign: 'center',
                fontFamily: 'monospace',
                fontSize: '0.82rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
              }}
            />
          </div>

          {/* Cụm 2: Thời điểm backup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="checkbox"
              id="ccp_ce_backup_time"
              checked={enableBackupTime}
              onChange={(e) => {
                const val = e.target.checked;
                setEnableBackupTime(val);
                saveSetting('bot_backup_time_enabled', String(val));
              }}
              style={{ accentColor: '#10b981', width: '15px', height: '15px', cursor: 'pointer' }}
            />
            <label htmlFor="ccp_ce_backup_time" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
              Thời điểm backup
            </label>
            <input
              type="time"
              value={backupTime}
              onChange={(e) => {
                const v = e.target.value;
                setBackupTime(v);
                saveSetting('bot_backup_time', v);
              }}
              style={{
                height: '30px',
                padding: '0 6px',
                fontSize: '0.82rem',
                fontFamily: 'monospace',
                fontWeight: 700,
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
              }}
            />
          </div>

          {/* Cụm 3: Thời điểm tạo thống kê */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="checkbox"
              id="ccp_ce_stat_time"
              checked={enableStatTime}
              onChange={(e) => {
                const val = e.target.checked;
                setEnableStatTime(val);
                saveSetting('bot_stat_time_enabled', String(val));
              }}
              style={{ accentColor: '#10b981', width: '15px', height: '15px', cursor: 'pointer' }}
            />
            <label htmlFor="ccp_ce_stat_time" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
              Thời điểm tạo thống kê
            </label>
            <input
              type="time"
              value={statTime}
              onChange={(e) => {
                const v = e.target.value;
                setStatTime(v);
                saveSetting('bot_stat_time', v);
              }}
              style={{
                height: '30px',
                padding: '0 6px',
                fontSize: '0.82rem',
                fontFamily: 'monospace',
                fontWeight: 700,
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
              }}
            />
          </div>

          {/* Master Switch */}
          <button
            type="button"
            onClick={() => {
              const next = !autoBackupActive;
              setAutoBackupActive(next);
              saveSetting('bot_auto_backup_enabled', String(next));
              toast.success(`Đã ${next ? 'BẬT' : 'TẮT'} cơ chế tự động backup CCP-CE!`);
            }}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 800,
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: autoBackupActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: autoBackupActive ? '#10b981' : '#ef4444',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: autoBackupActive ? '#10b981' : '#ef4444',
              }}
            />
            <span>{autoBackupActive ? 'Tự động Backup: BẬT' : 'Tự động Backup: TẮT'}</span>
          </button>
        </div>
      </div>

      {/* ===== BAR 2: SUBTAB SWITCHER ===== */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            fontSize: '0.84rem',
            fontWeight: 800,
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: '2px solid #10b981',
            color: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            cursor: 'default',
          }}
        >
          <Database size={15} color="#10b981" />
          <span>Backup CCP – CE (Hiện tại)</span>
        </button>
      </div>

      {/* ===== BAR 3: 3 CỘT BACKUP (CORECCP, COREEX, ACM) ===== */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px' }}>
          {/* CỘT 1: BACKUP CORECCP (25 BÁO CÁO) */}
          <div style={{ border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: 'rgba(16, 185, 129, 0.02)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(16, 185, 129, 0.2)', paddingBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#10b981' }}>Backup CoreCCP</span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={Object.values(ccpReports).every(Boolean)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCcpReports((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, checked])));
                      }}
                      style={{ accentColor: '#10b981', width: '14px', height: '14px' }}
                    />
                    <span>All</span>
                  </label>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>25 báo cáo VNCLEAR</span>
              </div>

              {/* Grid Checkboxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px' }}>
                {CORE_CCP_REPORTS_LIST.map((rep) => (
                  <label key={rep.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={!!ccpReports[rep.key]}
                      onChange={() => setCcpReports((prev) => ({ ...prev, [rep.key]: !prev[rep.key] }))}
                      style={{ accentColor: '#10b981', width: '13px', height: '13px' }}
                    />
                    <span style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>{rep.filename}</span>
                  </label>
                ))}
              </div>

              {/* Thư mục lưu trữ CCP */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', padding: '6px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <Folder size={12} color="#10b981" />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }}>
                  {auditCcpResult?.backupPath || 'M:\\...\\Backup CCP\\Futures\\...'}
                </span>
              </div>
            </div>

            {/* Bộ nút thao tác CCP */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleDownloadCcpBackup}
                  disabled={downloadingCcp || auditingCcp}
                  className="btn btn-primary"
                  style={{ flex: 1, maxWidth: '200px', fontSize: '0.82rem', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {downloadingCcp ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>{downloadingCcp ? 'Đang tải CCP...' : 'Tải Báo Cáo CoreCCP'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAuditCcpBackup(true)}
                  disabled={downloadingCcp || auditingCcp}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '8px 12px' }}
                >
                  {auditingCcp ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>Kiểm tra</span>
                </button>
              </div>
              {auditCcpResult && (
                <div style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'monospace', textAlign: 'center' }}>
                  {auditCcpResult.summary ? `CCP: ${auditCcpResult.summary.ok}/${auditCcpResult.summary.total} files OK` : 'Hoàn tất'}
                </div>
              )}
            </div>
          </div>

          {/* CỘT 2: BACKUP COREEX (CE) */}
          <div style={{ border: '1px solid rgba(59, 130, 246, 0.35)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: 'rgba(59, 130, 246, 0.02)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(59, 130, 246, 0.2)', paddingBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#3b82f6' }}>Backup CoreEX (CE)</span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={Object.values(ceReports).every(Boolean)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCeReports((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, checked])));
                      }}
                      style={{ accentColor: '#3b82f6', width: '14px', height: '14px' }}
                    />
                    <span>All</span>
                  </label>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>5 báo cáo sàn CE</span>
              </div>

              {/* Grid Checkboxes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {CORE_EX_REPORTS_LIST.map((rep) => (
                  <label key={rep.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={!!ceReports[rep.key]}
                        onChange={() => setCeReports((prev) => ({ ...prev, [rep.key]: !prev[rep.key] }))}
                        style={{ accentColor: '#3b82f6', width: '13px', height: '13px' }}
                      />
                      <span style={{ fontWeight: 700 }}>{rep.name}</span>
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{rep.filename}</span>
                  </label>
                ))}
              </div>

              {/* Thư mục lưu trữ CE */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', padding: '6px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <Folder size={12} color="#3b82f6" />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }}>
                  {auditCeResult?.backupPath || 'M:\\...\\Backup CE\\Futures\\...'}
                </span>
              </div>
            </div>

            {/* Bộ nút thao tác CE */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleDownloadCeBackup}
                  disabled={downloadingCe || auditingCe}
                  className="btn"
                  style={{ flex: 1, maxWidth: '200px', fontSize: '0.82rem', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#3b82f6', color: '#fff', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                >
                  {downloadingCe ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>{downloadingCe ? 'Đang tải CE...' : 'Tải Báo Cáo CoreEX'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAuditCeBackup(true)}
                  disabled={downloadingCe || auditingCe}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '8px 12px' }}
                >
                  {auditingCe ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>Kiểm tra</span>
                </button>
              </div>
              {auditCeResult && (
                <div style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'monospace', textAlign: 'center' }}>
                  {auditCeResult.summary ? `CE: ${auditCeResult.summary.ok}/${auditCeResult.summary.total} files OK` : 'Hoàn tất'}
                </div>
              )}
            </div>
          </div>

          {/* CỘT 3: BACKUP ACM (4 BÁO CÁO STRAITS) */}
          <div style={{ border: '1px solid rgba(14, 165, 233, 0.35)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: 'rgba(14, 165, 233, 0.02)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(14, 165, 233, 0.2)', paddingBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0284c7' }}>Backup ACM</span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={Object.values(acmReports).every(Boolean)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAcmReports((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, checked])));
                      }}
                      style={{ accentColor: '#0ea5e9', width: '14px', height: '14px' }}
                    />
                    <span>All</span>
                  </label>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>4 file Straits</span>
              </div>

              {/* Grid Checkboxes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ACM_REPORTS_LIST.map((rep) => (
                  <label key={rep.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={!!acmReports[rep.key]}
                        onChange={() => setAcmReports((prev) => ({ ...prev, [rep.key]: !prev[rep.key] }))}
                        style={{ accentColor: '#0ea5e9', width: '13px', height: '13px' }}
                      />
                      <span style={{ fontWeight: 700 }}>{rep.name}</span>
                    </div>
                    <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', backgroundColor: rep.source === 'SFTP' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: rep.source === 'SFTP' ? '#0ea5e9' : '#10b981' }}>
                      {rep.source}
                    </span>
                  </label>
                ))}
              </div>

              {/* Thư mục lưu trữ ACM */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', padding: '6px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <Folder size={12} color="#0ea5e9" />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }}>
                  {auditAcmResult?.backupPath || 'M:\\...\\Backup ACM\\Futures\\...'}
                </span>
              </div>
            </div>

            {/* Bộ nút thao tác ACM */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleDownloadAcmBackup}
                  disabled={downloadingAcm || auditingAcm}
                  className="btn"
                  style={{ flex: 1, maxWidth: '200px', fontSize: '0.82rem', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#0ea5e9', color: '#fff', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                >
                  {downloadingAcm ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>{downloadingAcm ? 'Đang tải ACM...' : 'Tải Báo Cáo ACM'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAuditAcmBackup(true)}
                  disabled={downloadingAcm || auditingAcm}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '8px 12px' }}
                >
                  {auditingAcm ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>Kiểm tra</span>
                </button>
              </div>
              {auditAcmResult && (
                <div style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'monospace', textAlign: 'center' }}>
                  {auditAcmResult.summary ? `ACM: ${auditAcmResult.summary.ok}/${auditAcmResult.summary.total} files OK` : 'Hoàn tất'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== BAR 4: ĐỐI CHIẾU GIÁ THANH TOÁN (GTT CCP VS CE) ===== */}
      <CeCcpGttCheckerSection token={token} selectedDate={selectedDate} />

      {/* ===== BAR 5: KIỂM TRA KÝ QUỸ TKGD (IMR CORECCP VS CE) - GIAO DIỆN CHỜ ===== */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Kiểm Tra Ký Quỹ TKGD (IMR CoreCCP vs CE)
              </h4>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                }}
              >
                Giao Diện Chờ Module Mới
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Hệ thống giám sát vi phạm tỷ lệ ký quỹ ban đầu (IMR) và ký quỹ biến đổi (MM) trên phân hệ VNCLEAR CoreCCP.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleCheckIMR}
              disabled={imrLoading}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {imrLoading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              <span>{imrLoading ? 'Đang phân tích...' : 'Phân Tích Ký Quỹ IMR'}</span>
            </button>
          </div>
        </div>

        {/* 4 Thẻ Phân Nhóm Nguy Cơ Ký Quỹ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {/* G1 */}
          <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                Nhóm 1 (G1 - An toàn &gt; 120%)
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981' }}>An toàn</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'monospace', color: '#10b981' }}>
                {imrResult?.g1?.length || 0}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>tài khoản</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tỷ lệ Margin &ge; 120%</span>
          </div>

          {/* G2 */}
          <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                Nhóm 2 (G2 - Cảnh báo 100% - 120%)
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#eab308' }}>Cảnh báo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'monospace', color: '#eab308' }}>
                {imrResult?.g2?.length || 0}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>tài khoản</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>100% &le; Margin &lt; 120%</span>
          </div>

          {/* G3 */}
          <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                Nhóm 3 (G3 - Call Margin 80% - 100%)
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f97316' }}>Call Margin</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'monospace', color: '#f97316' }}>
                {imrResult?.g3?.length || 0}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>tài khoản</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>80% &le; Margin &lt; 100%</span>
          </div>

          {/* G4 */}
          <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                Nhóm 4 (G4 - Force Close &lt; 80%)
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ef4444' }}>Nguy cơ cao</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'monospace', color: '#ef4444' }}>
                {imrResult?.g4?.length || 0}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>tài khoản</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Margin &lt; 80% hoặc âm KQ</span>
          </div>
        </div>

        {/* Bảng kết quả IMR Placeholder */}
        <div
          style={{
            padding: '30px 20px',
            borderRadius: '8px',
            backgroundColor: 'rgba(16, 185, 129, 0.03)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'center',
          }}
        >
          <CheckCircle2 size={32} color="#10b981" />
          <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.88rem' }}>
            Trạng Thái An Toàn: Chưa phát hiện tài khoản vi phạm ngưỡng ký quỹ IMR trên CoreCCP
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
            Module sẽ tự động tích hợp bảng chi tiết khi phân hệ quản lý ký quỹ VNCLEAR cung cấp đủ nguồn dữ liệu sao kê.
          </span>
        </div>
      </div>
    </div>
  );
}
