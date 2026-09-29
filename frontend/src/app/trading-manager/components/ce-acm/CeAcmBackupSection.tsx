'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Folder,
  Layers,
  Sliders,
  Loader2,
  XCircle,
  Clock,
  Check,
  FileSpreadsheet,
  ExternalLink,
  ChevronRight,
  Server,
  Database,
  Search,
  Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/context/AuthContext';

// Danh mục 10 báo cáo chuẩn sàn CoreEX (CE)
export const CE_REPORTS_LIST: Array<{
  key: string;
  name: string;
  filename: string;
  category: 'ORDERS' | 'PRICE' | 'PRODUCT';
  categoryLabel: string;
  description: string;
}> = [
  // 1. Sổ lệnh & Giao dịch
  {
    key: 'DSGD',
    name: 'Danh sách giao dịch CE',
    filename: 'DSGD ACM CE.xlsx',
    category: 'ORDERS',
    categoryLabel: 'Sổ lệnh & Giao dịch',
    description: 'Báo cáo chi tiết khớp lệnh trong phiên sàn CoreEX',
  },
  {
    key: 'DSL',
    name: 'Sổ lệnh tổng hợp CE',
    filename: 'DSL ACM CE.xlsx',
    category: 'ORDERS',
    categoryLabel: 'Sổ lệnh & Giao dịch',
    description: 'Sổ lệnh toàn bộ phiên giao dịch trên sàn CoreEX',
  },
  {
    key: 'DSLCK',
    name: 'Lệnh chờ khớp CE',
    filename: 'DSLCK ACM CE.xlsx',
    category: 'ORDERS',
    categoryLabel: 'Sổ lệnh & Giao dịch',
    description: 'Danh sách các lệnh đang chờ khớp trong phiên',
  },
  {
    key: 'DSLDK',
    name: 'Lệnh điều kiện CE',
    filename: 'DSLDK ACM CE.xlsx',
    category: 'ORDERS',
    categoryLabel: 'Sổ lệnh & Giao dịch',
    description: 'Sổ lệnh điều kiện (Stop, Stop Limit, OCO...)',
  },
  {
    key: 'DSLH',
    name: 'Lệnh hủy CE',
    filename: 'DSLH ACM CE.xlsx',
    category: 'ORDERS',
    categoryLabel: 'Sổ lệnh & Giao dịch',
    description: 'Danh sách các lệnh đã được hủy bởi khách hàng/hệ thống',
  },

  // 2. Giá thanh toán & Hàng hóa
  {
    key: 'GTT',
    name: 'Giá thanh toán ACM',
    filename: 'GTT ACM.xlsx',
    category: 'PRICE',
    categoryLabel: 'Giá thanh toán & Hàng hóa',
    description: 'Giá thanh toán bù trừ cuối ngày sàn ACM',
  },
  {
    key: 'HH',
    name: 'Hàng hóa ACM',
    filename: 'HH ACM.xlsx',
    category: 'PRODUCT',
    categoryLabel: 'Giá thanh toán & Hàng hóa',
    description: 'Danh mục các mặt hàng phái sinh giao dịch ACM',
  },

  // 3. Hợp đồng Nano ACM
  {
    key: 'HD_CP2CO',
    name: 'Hợp đồng Đồng Nano (CP2CO)',
    filename: 'HĐ CP2CO.xlsx',
    category: 'PRODUCT',
    categoryLabel: 'Hợp đồng Nano ACM',
    description: 'Hợp đồng Đồng siêu nhỏ (Copper Nano - CP2CO)',
  },
  {
    key: 'HD_PL1NY',
    name: 'Hợp đồng Bạch kim Nano (PL1NY)',
    filename: 'HĐ PL1NY.xlsx',
    category: 'PRODUCT',
    categoryLabel: 'Hợp đồng Nano ACM',
    description: 'Hợp đồng Bạch kim siêu nhỏ (Platinum Nano - PL1NY)',
  },
  {
    key: 'HD_SI5CO',
    name: 'Hợp đồng Bạc Nano (SI5CO)',
    filename: 'HĐ SI5CO.xlsx',
    category: 'PRODUCT',
    categoryLabel: 'Hợp đồng Nano ACM',
    description: 'Hợp đồng Bạc siêu nhỏ (Silver Nano - SI5CO)',
  },
];

// Danh mục 4 báo cáo chuẩn hệ thống đối tác ACM
export const ACM_REPORTS_LIST: Array<{
  key: string;
  name: string;
  filename: string;
  source: 'WEB' | 'SFTP';
  description: string;
}> = [
  {
    key: 'FILL',
    name: 'Báo cáo Khớp lệnh ACM (Trade Fill)',
    filename: 'Fill.xlsx / Fill.xls',
    source: 'WEB',
    description: 'Dữ liệu khớp lệnh tự doanh trích xuất từ giao diện Web ACM',
  },
  {
    key: 'ORDER',
    name: 'Sổ lệnh ACM (Order Book)',
    filename: 'Order.xlsx / Order.xls',
    source: 'WEB',
    description: 'Sổ lệnh giao dịch tự doanh trích xuất từ giao diện Web ACM',
  },
  {
    key: 'SFTP_CSV',
    name: 'Straits EOD CSV (SFTP)',
    filename: 'EOD FO trades_PT Straits Financial Indonesia - 10017890000_*.csv',
    source: 'SFTP',
    description: 'File đối chiếu chuẩn Straits Financial qua giao thức SFTP Server',
  },
  {
    key: 'SFTP_XLS',
    name: 'Báo cáo TK 10017890000 (SFTP XLS)',
    filename: '<YYYY-MM-DD>_10017890000.xls',
    source: 'SFTP',
    description: 'File sao kê tài khoản Straits 10017890000 định dạng bảng tính XLS',
  },
];

export interface CeAcmBackupSectionProps {
  token: string | null;
  selectedDate: string;
  onSelectDate?: (date: string) => void;
}

export default function CeAcmBackupSection({
  token,
  selectedDate,
  onSelectDate,
}: CeAcmBackupSectionProps) {
  // Checkbox state for CE (10 reports)
  const [ceSelected, setCeSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CE_REPORTS_LIST.map((r) => [r.key, true]))
  );

  // Checkbox state for ACM (4 reports)
  const [acmSelected, setAcmSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ACM_REPORTS_LIST.map((r) => [r.key, true]))
  );

  // Loading & execution states
  const [downloadingCe, setDownloadingCe] = useState<boolean>(false);
  const [downloadingAcm, setDownloadingAcm] = useState<boolean>(false);
  const [auditingCe, setAuditingCe] = useState<boolean>(false);
  const [auditingAcm, setAuditingAcm] = useState<boolean>(false);

  // Audit results
  const [auditCeResult, setAuditCeResult] = useState<{
    backupPath?: string;
    summary?: { total: number; ok: number; missing: number; empty: number };
    files?: Array<{
      key: string;
      name: string;
      filename: string;
      actualFile?: string;
      status: 'OK' | 'MISSING' | 'EMPTY';
      size?: number;
      lastModified?: string;
    }>;
  } | null>(null);

  const [auditAcmResult, setAuditAcmResult] = useState<{
    backupPath?: string;
    summary?: { total: number; ok: number; missing: number; outdated?: number };
    files?: Array<{
      key: string;
      filename: string;
      status: 'OK' | 'MISSING' | 'OUTDATED';
      lastModified?: string;
    }>;
  } | null>(null);

  // Log modal state
  const [logModalOpen, setLogModalOpen] = useState<boolean>(false);
  const [logModalTitle, setLogModalTitle] = useState<string>('');
  const [currentJobLogs, setCurrentJobLogs] = useState<string[]>([]);
  const [currentJobStatus, setCurrentJobStatus] = useState<string>('');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Tự động kiểm tra file khi ngày phiên thay đổi
  useEffect(() => {
    if (token && selectedDate) {
      handleAuditCeBackup(false);
      handleAuditAcmBackup(false);
    }
  }, [token, selectedDate]);

  // Kiểm tra thư mục Backup CE
  const handleAuditCeBackup = async (showToast: boolean = true) => {
    if (!token) return;
    setAuditingCe(true);
    let toastId: string | undefined;
    if (showToast) {
      toastId = toast.loading('Đang quét thư mục backup CoreEX (CE)...');
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/audit-ce-backup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetDate: selectedDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAuditCeResult(data);
      if (showToast && toastId) {
        toast.success(
          `Quét CE hoàn tất: ${data.summary?.ok || 0}/${data.summary?.total || 0} file hợp lệ.`,
          { id: toastId }
        );
      }
    } catch (err: any) {
      if (showToast && toastId) {
        toast.error(`Lỗi kiểm tra backup CE: ${err.message}`, { id: toastId });
      }
    } finally {
      setAuditingCe(false);
    }
  };

  // Kiểm tra thư mục Backup ACM
  const handleAuditAcmBackup = async (showToast: boolean = true) => {
    if (!token) return;
    setAuditingAcm(true);
    let toastId: string | undefined;
    if (showToast) {
      toastId = toast.loading('Đang quét thư mục backup ACM (Web & SFTP)...');
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/audit-acm-backup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetDate: selectedDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAuditAcmResult(data);
      if (showToast && toastId) {
        toast.success(
          `Quét ACM hoàn tất: ${data.summary?.ok || 0}/${data.summary?.total || 0} file hợp lệ.`,
          { id: toastId }
        );
      }
    } catch (err: any) {
      if (showToast && toastId) {
        toast.error(`Lỗi kiểm tra backup ACM: ${err.message}`, { id: toastId });
      }
    } finally {
      setAuditingAcm(false);
    }
  };

  // Tải báo cáo CE đã chọn
  const handleDownloadCeBackup = async () => {
    if (!token || downloadingCe) return;
    const selectedKeys = Object.keys(ceSelected).filter((k) => ceSelected[k]);
    if (selectedKeys.length === 0) {
      toast.error('Vui lòng tích chọn ít nhất 1 báo cáo CoreEX để tải!');
      return;
    }

    setDownloadingCe(true);
    const toastId = toast.loading('Đang khởi tạo tác vụ robot tải báo cáo CE...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-ce-download`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          startDate: selectedDate,
          endDate: selectedDate,
          reports: selectedKeys,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const jobId = data.jobId;

      if (!jobId) {
        toast.success(data.message || 'Đã kích hoạt tải báo cáo CE!', { id: toastId });
        await handleAuditCeBackup(false);
        return;
      }

      setCurrentJobId(jobId);
      toast.loading('Robot đang đăng nhập và tải báo cáo CoreEX...', { id: toastId });

      // Polling background job
      const startTime = Date.now();
      const MAX_WAIT_MS = 300000;
      const POLL_INTERVAL_MS = 3000;

      while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        try {
          const jr = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!jr.ok) continue;
          const job = await jr.json();
          setCurrentJobLogs(job.logs || []);
          setCurrentJobStatus(job.status);

          if (job.status === 'COMPLETED') {
            toast.success('Đã tải xong toàn bộ báo cáo CoreEX về thư mục backup!', {
              id: toastId,
              duration: 5000,
            });
            await handleAuditCeBackup(false);
            return;
          }
          if (job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'ABORTED') {
            toast.error(`Tải báo cáo CE kết thúc (${job.status}): ${job.error || ''}`, {
              id: toastId,
              duration: 6000,
            });
            await handleAuditCeBackup(false);
            return;
          }
        } catch {
          // Poll network error ignore
        }
      }

      toast.success('Tác vụ tải CoreEX đang tiếp tục chạy ngầm trong hệ thống.', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi kích hoạt tải CE: ${err.message}`, { id: toastId });
    } finally {
      setDownloadingCe(false);
    }
  };

  // Tải báo cáo ACM đã chọn
  const handleDownloadAcmBackup = async () => {
    if (!token || downloadingAcm) return;
    const selectedKeys = Object.keys(acmSelected).filter((k) => acmSelected[k]);
    if (selectedKeys.length === 0) {
      toast.error('Vui lòng tích chọn ít nhất 1 báo cáo ACM để tải!');
      return;
    }

    setDownloadingAcm(true);
    const toastId = toast.loading('Đang khởi tạo tác vụ robot tải báo cáo ACM...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-acm-download`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetDate: selectedDate,
          reports: selectedKeys,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const jobId = data.jobId;

      if (!jobId) {
        toast.success(data.message || 'Đã kích hoạt tác vụ ACM!', { id: toastId });
        await handleAuditAcmBackup(false);
        return;
      }

      setCurrentJobId(jobId);
      toast.loading('Robot đang đồng bộ file ACM (Web Order/Fill & SFTP Straits)...', { id: toastId });

      // Polling background job
      const startTime = Date.now();
      const MAX_WAIT_MS = 300000;
      const POLL_INTERVAL_MS = 3000;

      while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        try {
          const jr = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!jr.ok) continue;
          const job = await jr.json();
          setCurrentJobLogs(job.logs || []);
          setCurrentJobStatus(job.status);

          if (job.status === 'COMPLETED') {
            toast.success('Đã hoàn tất đồng bộ file báo cáo ACM!', {
              id: toastId,
              duration: 5000,
            });
            await handleAuditAcmBackup(false);
            return;
          }
          if (job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'ABORTED') {
            toast.error(`Đồng bộ ACM kết thúc (${job.status}): ${job.error || ''}`, {
              id: toastId,
              duration: 6000,
            });
            await handleAuditAcmBackup(false);
            return;
          }
        } catch {
          // Poll network error ignore
        }
      }

      toast.success('Tác vụ đồng bộ ACM đang tiếp tục chạy ngầm trong hệ thống.', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi kích hoạt tải ACM: ${err.message}`, { id: toastId });
    } finally {
      setDownloadingAcm(false);
    }
  };

  // Mở modal xem logs
  const openLogsViewer = (type: 'CE' | 'ACM') => {
    setLogModalTitle(
      type === 'CE' ? 'Nhật Ký Robot Tải Báo Cáo CoreEX (CE)' : 'Nhật Ký Robot Đồng Bộ Báo Cáo ACM'
    );
    setLogModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ===== INFO HEADER BAR ===== */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
              }}
            >
              <Server size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Phân Hệ Tải & Lưu Trữ Báo Cáo: CoreEX (CE) & Đối Tác ACM
                </h3>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  Phân Hệ Độc Lập
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Tải và kiểm tra 10 file báo cáo sàn CoreEX (VNCLEAR CE) & 4 file đối chiếu hệ thống đối tác Straits ACM.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                handleAuditCeBackup(true);
                handleAuditAcmBackup(true);
              }}
              disabled={auditingCe || auditingAcm}
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {auditingCe || auditingAcm ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span>Quét Lại Thư Mục Cả 2 Sàn</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== 2 CỘT CHÍNH: BACKUP CE & BACKUP ACM ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '20px' }}>
        {/* ============================================================== */}
        {/* CỘT 1: BACKUP SÀN COREEX (CE) - 10 FILE CHUẨN */}
        {/* ============================================================== */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderTop: '3px solid #3b82f6',
          }}
        >
          <div>
            {/* Header cột CE */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '14px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#3b82f6' }}>
                  Backup Sàn CoreEX (CE)
                </span>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Object.values(ceSelected).every(Boolean)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setCeSelected(Object.fromEntries(CE_REPORTS_LIST.map((r) => [r.key, checked])));
                    }}
                    style={{ accentColor: '#3b82f6', width: '14px', height: '14px' }}
                  />
                  <span>Tất cả</span>
                </label>
              </div>

              {/* Lọc nhanh theo nhóm */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const next = Object.fromEntries(
                      CE_REPORTS_LIST.map((r) => [r.key, r.category === 'ORDERS'])
                    );
                    setCeSelected(next);
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                  title="Chỉ chọn 5 báo cáo sổ lệnh"
                >
                  Sổ Lệnh (5)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = Object.fromEntries(
                      CE_REPORTS_LIST.map((r) => [r.key, r.category === 'PRICE' || r.category === 'PRODUCT'])
                    );
                    setCeSelected(next);
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                  title="Chọn GTT, HH và 3 Hợp đồng Nano"
                >
                  Giá & HĐ (5)
                </button>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                  }}
                >
                  10 File Chuẩn
                </span>
              </div>
            </div>

            {/* Checkbox grid 10 file */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '8px 12px',
                marginBottom: '16px',
              }}
            >
              {CE_REPORTS_LIST.map((rep) => {
                const isChecked = !!ceSelected[rep.key];
                return (
                  <label
                    key={rep.key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      cursor: 'pointer',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.06)' : 'var(--bg-input)',
                      border: isChecked
                        ? '1px solid rgba(59, 130, 246, 0.3)'
                        : '1px solid var(--border-color)',
                      transition: 'all 0.15s ease',
                    }}
                    title={rep.description}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() =>
                        setCeSelected((prev) => ({ ...prev, [rep.key]: !prev[rep.key] }))
                      }
                      style={{ accentColor: '#3b82f6', width: '14px', height: '14px', marginTop: '2px' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: isChecked ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}
                      >
                        {rep.name}
                      </span>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.7rem',
                          color: isChecked ? '#3b82f6' : 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {rep.filename}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Thư mục lưu trữ CE */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                marginBottom: '16px',
              }}
            >
              <Folder size={14} color="#3b82f6" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Thư mục lưu trữ CE ca trực:</span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.74rem',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={auditCeResult?.backupPath || 'Đang xác định...'}
                >
                  {auditCeResult?.backupPath || 'M:\\...\\Backup CE\\Futures\\<Năm>\\T<Tháng>.<Năm>\\<Ngày>.<Tháng>'}
                </span>
              </div>
            </div>

            {/* Bảng kết quả Audit CE */}
            {auditCeResult?.files && (
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Tình Trạng File Trong Thư Mục Backup:
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {auditCeResult.summary?.ok || 0}/{auditCeResult.summary?.total || 0} file hợp lệ
                  </span>
                </div>

                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Tên File</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>Kích thước</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditCeResult.files.map((f) => (
                        <tr key={f.key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace' }}>
                            {f.actualFile || f.filename}
                          </td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {f.size ? `${(f.size / 1024).toFixed(1)} KB` : '0 KB'}
                          </td>
                          <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                            {f.status === 'OK' ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10b981',
                                  fontWeight: 700,
                                  fontSize: '0.68rem',
                                }}
                              >
                                <Check size={10} /> Đầy đủ
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                  color: '#ef4444',
                                  fontWeight: 700,
                                  fontSize: '0.68rem',
                                }}
                              >
                                <XCircle size={10} /> Thiếu
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Nút hành động CE */}
          <div style={{ display: 'flex', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={handleDownloadCeBackup}
              disabled={downloadingCe || auditingCe}
              className="btn btn-primary"
              style={{
                flex: 1,
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '9px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#3b82f6',
                borderColor: '#3b82f6',
              }}
            >
              {downloadingCe ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span>{downloadingCe ? 'Robot Đang Tải CE...' : 'Tải Báo Cáo CE Đã Chọn'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleAuditCeBackup(true)}
              disabled={downloadingCe || auditingCe}
              className="btn btn-secondary"
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Kiểm tra trạng thái file trong thư mục backup CE"
            >
              {auditingCe ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span>Kiểm tra</span>
            </button>

            <button
              type="button"
              onClick={() => openLogsViewer('CE')}
              className="btn btn-secondary"
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Xem nhật ký tải báo cáo CoreEX"
            >
              <FileText size={14} />
              <span>Nhật ký</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* CỘT 2: BACKUP HỆ THỐNG ĐỐI TÁC ACM - 4 FILE CHUẨN */}
        {/* ============================================================== */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderTop: '3px solid #10b981',
          }}
        >
          <div>
            {/* Header cột ACM */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '14px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#10b981' }}>
                  Backup Đối Tác ACM (Web & SFTP)
                </span>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Object.values(acmSelected).every(Boolean)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAcmSelected(Object.fromEntries(ACM_REPORTS_LIST.map((r) => [r.key, checked])));
                    }}
                    style={{ accentColor: '#10b981', width: '14px', height: '14px' }}
                  />
                  <span>Tất cả</span>
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                  }}
                >
                  4 File Chuẩn
                </span>
              </div>
            </div>

            {/* Checkbox grid 4 file ACM */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {ACM_REPORTS_LIST.map((rep) => {
                const isChecked = !!acmSelected[rep.key];
                return (
                  <label
                    key={rep.key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor: 'pointer',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: isChecked ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-input)',
                      border: isChecked
                        ? '1px solid rgba(16, 185, 129, 0.35)'
                        : '1px solid var(--border-color)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() =>
                        setAcmSelected((prev) => ({ ...prev, [rep.key]: !prev[rep.key] }))
                      }
                      style={{ accentColor: '#10b981', width: '15px', height: '15px', marginTop: '2px' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: isChecked ? 'var(--text-primary)' : 'var(--text-muted)',
                          }}
                        >
                          {rep.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor:
                              rep.source === 'SFTP'
                                ? 'rgba(14, 165, 233, 0.15)'
                                : 'rgba(16, 185, 129, 0.15)',
                            color: rep.source === 'SFTP' ? '#0ea5e9' : '#10b981',
                          }}
                        >
                          {rep.source}
                        </span>
                      </div>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.72rem',
                          color: isChecked ? '#10b981' : 'var(--text-muted)',
                        }}
                      >
                        {rep.filename}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {rep.description}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Thư mục lưu trữ ACM */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                marginBottom: '16px',
              }}
            >
              <Folder size={14} color="#10b981" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Thư mục lưu trữ ACM ca trực:</span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.74rem',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={auditAcmResult?.backupPath || 'Đang xác định...'}
                >
                  {auditAcmResult?.backupPath || 'M:\\...\\Backup ACM\\Futures\\<Năm>\\T<Tháng>.<Năm>\\<Ngày>.<Tháng>'}
                </span>
              </div>
            </div>

            {/* Bảng kết quả Audit ACM */}
            {auditAcmResult?.files && (
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Tình Trạng File Trong Thư Mục Backup:
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {auditAcmResult.summary?.ok || 0}/{auditAcmResult.summary?.total || 0} file hợp lệ
                  </span>
                </div>

                <div
                  style={{
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Tên File</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditAcmResult.files.map((f) => (
                        <tr key={f.key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>
                            {f.filename}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            {f.status === 'OK' ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10b981',
                                  fontWeight: 700,
                                  fontSize: '0.68rem',
                                }}
                              >
                                <Check size={10} /> Đầy đủ
                              </span>
                            ) : f.status === 'OUTDATED' ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                  color: '#f59e0b',
                                  fontWeight: 700,
                                  fontSize: '0.68rem',
                                }}
                              >
                                <AlertTriangle size={10} /> File cũ
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                  color: '#ef4444',
                                  fontWeight: 700,
                                  fontSize: '0.68rem',
                                }}
                              >
                                <XCircle size={10} /> Thiếu
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Nút hành động ACM */}
          <div style={{ display: 'flex', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={handleDownloadAcmBackup}
              disabled={downloadingAcm || auditingAcm}
              className="btn btn-primary"
              style={{
                flex: 1,
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '9px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#10b981',
                borderColor: '#10b981',
              }}
            >
              {downloadingAcm ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span>{downloadingAcm ? 'Robot Đang Tải ACM...' : 'Tải Báo Cáo ACM Đã Chọn'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleAuditAcmBackup(true)}
              disabled={downloadingAcm || auditingAcm}
              className="btn btn-secondary"
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Kiểm tra trạng thái file trong thư mục backup ACM"
            >
              {auditingAcm ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span>Kiểm tra</span>
            </button>

            <button
              type="button"
              onClick={() => openLogsViewer('ACM')}
              className="btn btn-secondary"
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Xem nhật ký tải báo cáo ACM"
            >
              <FileText size={14} />
              <span>Nhật ký</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== MODAL NHẬT KÝ ROBOT ===== */}
      {logModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '800px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
            }}
          >
            {/* Header Modal */}
            <div
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={18} color="#3b82f6" />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {logModalTitle}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setLogModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              >
                Đóng
              </button>
            </div>

            {/* Nội dung Logs */}
            <div
              style={{
                padding: '16px 20px',
                flex: 1,
                overflowY: 'auto',
                backgroundColor: '#0a0f1d',
                fontFamily: 'monospace',
                fontSize: '0.76rem',
                color: '#e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {currentJobLogs.length > 0 ? (
                currentJobLogs.map((line, idx) => (
                  <div key={idx} style={{ wordBreak: 'break-all', lineHeight: '1.4' }}>
                    {line}
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
                  Chưa có nhật ký ghi nhận cho tác vụ gần nhất. Hãy bấm "Tải Báo Cáo" để theo dõi tiến trình thực tế.
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.76rem',
                color: 'var(--text-muted)',
              }}
            >
              <span>Trạng thái: {currentJobStatus || 'IDLE'}</span>
              <button
                type="button"
                onClick={() => setLogModalOpen(false)}
                className="btn btn-primary"
                style={{ fontSize: '0.78rem', padding: '6px 14px' }}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
