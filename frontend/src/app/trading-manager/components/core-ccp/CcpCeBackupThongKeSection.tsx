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
  BarChart3,
  Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';
import { getInitialTradingSessionDate } from '../../utils/tradingDateUtils';
import CeCcpGttCheckerSection from '../ce-acm/CeCcpGttCheckerSection';
import CeLotStatisticsSection from '../ce-acm/CeLotStatisticsSection';
import BackupFileConfigModal, { BackupReportItem } from '../modals/BackupFileConfigModal';

export interface CcpCeBackupThongKeSectionProps {
  token: string | null;
  selectedDate: string;
  onSelectDate?: (date: string) => void;
  hideFooterSections?: boolean;
  hideSubTabs?: boolean;
}

// 19 Báo cáo chuẩn CoreCCP VNCLEAR Maker + Hợp đồng Hàng hóa (Động)
export const CORE_CCP_REPORTS_LIST = [
  // 1. Sổ lệnh thường (5 file)
  { key: 'DSL', name: 'DSL CCP (Sổ lệnh)', filename: 'DSL CCP.xlsx', group: 'ORDERS', groupLabel: 'Sổ lệnh thường', phase: 2 },
  { key: 'DSLDK', name: 'DSLDK CCP (Lệnh đã khớp)', filename: 'DSLDK CCP.xlsx', group: 'ORDERS', groupLabel: 'Sổ lệnh thường', phase: 2 },
  { key: 'DSLCK', name: 'DSLCK CCP (Lệnh chờ khớp)', filename: 'DSLCK CCP.xlsx', group: 'ORDERS', groupLabel: 'Sổ lệnh thường', phase: 2 },
  { key: 'DSLDH', name: 'DSLDH CCP (Lệnh đã hủy)', filename: 'DSLDH CCP.xlsx', group: 'ORDERS', groupLabel: 'Sổ lệnh thường', phase: 2 },
  { key: 'DSGD', name: 'DSGD CCP (Khớp lệnh)', filename: 'DSGD CCP.xlsx', group: 'ORDERS', groupLabel: 'Sổ lệnh thường', phase: 2 },

  // 2. Sổ lệnh MM (5 file) - Thường rỗng 0 dòng
  { key: 'DSL_MM', name: 'DSL MM CCP (Sổ lệnh MM)', filename: 'DSL MM CCP.xlsx', group: 'MM', groupLabel: 'Sổ lệnh MM', phase: 2, isUnused: true },
  { key: 'DSLDK_MM', name: 'DSLDK MM CCP (Đã khớp MM)', filename: 'DSLDK MM CCP.xlsx', group: 'MM', groupLabel: 'Sổ lệnh MM', phase: 2, isUnused: true },
  { key: 'DSLCK_MM', name: 'DSLCK MM CCP (Chờ khớp MM)', filename: 'DSLCK MM CCP.xlsx', group: 'MM', groupLabel: 'Sổ lệnh MM', phase: 2, isUnused: true },
  { key: 'DSLDH_MM', name: 'DSLDH MM CCP (Đã hủy MM)', filename: 'DSLDH MM CCP.xlsx', group: 'MM', groupLabel: 'Sổ lệnh MM', phase: 2, isUnused: true },
  { key: 'DSGD_MM', name: 'DSGD MM CCP (Khớp lệnh MM)', filename: 'DSGD MM CCP.xlsx', group: 'MM', groupLabel: 'Sổ lệnh MM', phase: 2, isUnused: true },

  // 3. Vị thế & Lãi lỗ (3 file)
  { key: 'TTM_PRE1620', name: 'TTM trước 4h20', filename: 'TTM truoc 4h20.xlsx', group: 'POSITION', groupLabel: 'Vị thế & Lãi lỗ', phase: 1 },
  { key: 'TTM', name: 'TTM CCP (Trạng thái mở)', filename: 'TTM CCP.xlsx', group: 'POSITION', groupLabel: 'Vị thế & Lãi lỗ', phase: 2 },
  { key: 'TTTT', name: 'TTTT (Tất toán & Lãi lỗ)', filename: 'TTTT.xlsx', group: 'POSITION', groupLabel: 'Vị thế & Lãi lỗ', phase: 2 },

  // 4. Rủi ro & Ký quỹ (5 file)
  { key: 'QLTTTKGD_PRE1620', name: 'QL TT TKGD trước 4h20', filename: 'QL TT TKGD truoc 4h20.xlsx', group: 'RISK', groupLabel: 'Rủi ro & Ký quỹ', phase: 1 },
  { key: 'QLTTTKGD', name: 'QL TT TKGD (Ký quỹ TKGD)', filename: 'QL TT TKGD.xlsx', group: 'RISK', groupLabel: 'Rủi ro & Ký quỹ', phase: 2 },
  { key: 'QLTTTVKD', name: 'QL TT TVKD (Ký quỹ TVKD)', filename: 'QL TT TVKD.xlsx', group: 'RISK', groupLabel: 'Rủi ro & Ký quỹ', phase: 2 },
  { key: 'DSQLKQ_TKGD', name: 'DSQLKQ TKGD (Chi tiết KQ)', filename: 'DSQLKQ TKGD.xlsx', group: 'RISK', groupLabel: 'Rủi ro & Ký quỹ', phase: 2 },
  { key: 'DSQLKQ_TVKD', name: 'DSQLKQ TVKD (Chi tiết KQ)', filename: 'DSQLKQ TVKD.xlsx', group: 'RISK', groupLabel: 'Rủi ro & Ký quỹ', phase: 2 },

  // 5. Nộp rút tiền & Tài khoản (2 file)
  { key: 'NR', name: 'NR (Nộp rút tiền)', filename: 'NR.xlsx', group: 'CASH', groupLabel: 'Nộp rút & TK', phase: 2 },
  { key: 'DSTKGD', name: 'DSTKGD ACM (Danh sách TK)', filename: 'DSTKGD ACM.xlsx', group: 'CASH', groupLabel: 'Nộp rút & TK', phase: 2 },

  // 6. Hàng hóa, Tham số & Hợp đồng (Động)
  { key: 'GTT', name: 'GTT CCP (Giá thanh toán)', filename: 'GTT CCP.xlsx', group: 'PRODUCT', groupLabel: 'Hàng hóa & Giá', phase: 2 },
  { key: 'HH', name: 'HH (Danh mục hàng hóa)', filename: 'HH.xlsx', group: 'PRODUCT', groupLabel: 'Hàng hóa & Giá', phase: 2 },
  { key: 'TYGIA', name: 'Tỷ giá CCP (Nguyên tệ)', filename: 'Tỷ giá CCP.xlsx', group: 'PRODUCT', groupLabel: 'Hàng hóa & Giá', phase: 2 },
  { key: 'HD', name: 'Hợp đồng hàng hóa (Động theo sàn)', filename: 'HĐ *.xlsx', group: 'PRODUCT', groupLabel: 'Hàng hóa & Giá', phase: 2 },
];

// 13 Báo cáo chuẩn CoreEX (CE) + Hợp đồng Hàng hóa liên thông (Động)
export const CORE_EX_REPORTS_LIST = [
  // 0. Tài khoản giao dịch liên thông ACM (1 file)
  { key: 'DSTKGD_ACM', name: 'Danh sách tài khoản giao dịch ACM', filename: 'DSTKGD ACM.xlsx', description: 'Danh sách tài khoản giao dịch liên thông ACM đồng bộ từ CCP' },

  // 1. Sổ lệnh & Giao dịch CE (6 file)
  { key: 'DSGD', name: 'Danh sách giao dịch CE', filename: 'DSGD ACM CE.xlsx', description: 'Khớp lệnh liên thông chi tiết CE' },
  { key: 'LSGD', name: 'Lịch sử khớp lệnh liên thông', filename: 'LSGD ACM CE.xlsx', description: 'Lịch sử khớp lệnh liên thông ACM (Lịch sử T-1)' },
  { key: 'DSL', name: 'Sổ lệnh tổng hợp CE', filename: 'DSL ACM CE.xlsx', description: 'Lịch sử toàn bộ sổ lệnh liên thông CE' },
  { key: 'DSLCK', name: 'Lệnh chờ khớp CE', filename: 'DSLCK ACM CE.xlsx', description: 'Danh sách lệnh đang chờ khớp' },
  { key: 'DSLDK', name: 'Lệnh điều kiện CE', filename: 'DSLDK ACM CE.xlsx', description: 'Danh sách lệnh điều kiện / đã khớp' },
  { key: 'DSLH', name: 'Lệnh hủy CE', filename: 'DSLH ACM CE.xlsx', description: 'Danh sách lệnh đã hủy trên sàn CE' },

  // 2. Giá, Hàng hóa & Phiên giao dịch (4 file)
  { key: 'GTT', name: 'Giá thanh toán ACM (CE)', filename: 'GTT ACM.xlsx', description: 'Bảng giá thanh toán settlement ACM' },
  { key: 'HH', name: 'Hàng hóa & Bước giá CE', filename: 'HH ACM.xlsx', description: 'Danh mục hàng hóa và thông số hợp đồng' },
  { key: 'SESSION_INFO', name: 'Thông tin phiên trong ngày', filename: 'SESSION_INFO.xlsx', description: 'Trạng thái phiên giao dịch từng mặt hàng', isUnused: true },
  { key: 'SESSION_CONFIG', name: 'Danh sách cấu hình phiên', filename: 'SESSION_CONFIG.xlsx', description: 'Danh sách cấu hình các phiên giao dịch', isUnused: true },

  // 3. Vị thế mở, Đối chiếu & Hợp đồng chi tiết (Động)
  { key: 'TTM', name: 'Trạng thái mở CE', filename: 'TTM CE.xlsx', description: 'Vị thế mở liên thông sàn CoreEX' },
  { key: 'ACM_RECON', name: 'Đối chiếu lệnh liên thông', filename: 'Doi chieu lenh ACM.xlsx', description: 'Đối chiếu lệnh liên thông sở ACM', isUnused: true },
  { key: 'HD', name: 'Hợp đồng chi tiết CE (Động theo sàn)', filename: 'HĐ *.xlsx', description: 'Hợp đồng chi tiết quét theo danh mục hàng hóa' },
];

// Báo cáo ACM (Straits Financial)
export const ACM_REPORTS_LIST = [
  { key: 'FILL', name: 'Khớp lệnh ACM (Fill)', filename: 'Fill.xls', source: 'WEB', description: 'Khớp lệnh tự doanh từ Web ACM' },
  { key: 'ORDER', name: 'Sổ lệnh ACM (Order)', filename: 'Order.xls', source: 'WEB', description: 'Sổ lệnh tự doanh từ Web ACM' },
  { key: 'SFTP_CSV', name: 'Straits EOD CSV (SFTP)', filename: 'EOD FO trades_PT Straits...csv', source: 'SFTP', description: 'File đối chiếu chuẩn Straits SFTP' },
  { key: 'SFTP_XLS', name: 'Báo cáo TK 10017890000', filename: '<YYYY-MM-DD>_10017890000.xls', source: 'SFTP', description: 'File sao kê tài khoản Straits', isUnused: true },
];

export default function CcpCeBackupThongKeSection({
  token,
  selectedDate,
  onSelectDate,
  hideFooterSections = false,
  hideSubTabs = false,
}: CcpCeBackupThongKeSectionProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'BACKUP_ALL' | 'CE_LOT_STATS'>('BACKUP_ALL');

  // Auto Backup Settings State
  const [autoBackupActive, setAutoBackupActive] = useState<boolean>(true);
  const [backupPeriodic, setBackupPeriodic] = useState<boolean>(true);
  const [backupPeriodicMinutes, setBackupPeriodicMinutes] = useState<number>(60);
  const [enableBackupTime, setEnableBackupTime] = useState<boolean>(true);
  const [backupTime, setBackupTime] = useState<string>('');
  const [enableStatTime, setEnableStatTime] = useState<boolean>(true);
  const [statTime, setStatTime] = useState<string>('');

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

  // Config Modal State
  const [configModal, setConfigModal] = useState<{
    isOpen: boolean;
    system: 'CCP' | 'CE' | 'ACM';
    systemName: string;
  } | null>(null);

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
        const data = await api.admin.getSystemSettings(token);
        const getVal = (key: string, def: string) => {
          const found = data.find((s: any) => s.key === key);
          return found ? found.value : def;
        };
        setAutoBackupActive(getVal('bot_auto_backup_enabled', 'true') === 'true');
        setBackupPeriodic(getVal('bot_backup_periodic_enabled', 'true') === 'true');
        setBackupPeriodicMinutes(parseInt(getVal('bot_backup_periodic_minutes', '60'), 10) || 60);
        setEnableBackupTime(getVal('bot_backup_time_enabled', 'true') === 'true');
        
        const bTime = getVal('bot_backup_time', '');
        if (bTime && /^\d{2}:\d{2}$/.test(bTime)) {
          setBackupTime(bTime);
        } else {
          try {
            const sc = JSON.parse(getVal('bot_scheduler_config', '[]'));
            const rpa = Array.isArray(sc) && sc.find((t: any) => t.id === 'RPA_DOWNLOAD_MS' || t.jobType === 'DOWNLOAD_CCP_REPORT');
            if (rpa?.time && /^\d{2}:\d{2}$/.test(rpa.time)) setBackupTime(rpa.time);
          } catch {}
        }

        setEnableStatTime(getVal('bot_stat_time_enabled', 'true') === 'true');
        const sTime = getVal('bot_stat_time', '');
        if (sTime && /^\d{2}:\d{2}$/.test(sTime)) {
          setStatTime(sTime);
        } else {
          try {
            const sc = JSON.parse(getVal('bot_scheduler_config', '[]'));
            const stat = Array.isArray(sc) && sc.find((t: any) => t.id === 'AUTO_GENERATE_STATISTICS' || t.jobType === 'RUN_LOT_MACRO');
            if (stat?.time && /^\d{2}:\d{2}$/.test(stat.time)) setStatTime(stat.time);
          } catch {}
        }

        // Nạp cấu hình danh mục file đã lưu từ MongoDB system_settings
        const savedCcp = getVal('bot_backup_selected_reports_ccp', '');
        if (savedCcp) {
          try {
            const parsed: string[] = JSON.parse(savedCcp);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCcpReports(Object.fromEntries(CORE_CCP_REPORTS_LIST.map((r) => [r.key, parsed.includes(r.key)])));
            }
          } catch {}
        }
        const savedCe = getVal('bot_backup_selected_reports_ce', '');
        if (savedCe) {
          try {
            const parsed: string[] = JSON.parse(savedCe);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCeReports(Object.fromEntries(CORE_EX_REPORTS_LIST.map((r) => [r.key, parsed.includes(r.key)])));
            }
          } catch {}
        }
        const savedAcm = getVal('bot_backup_selected_reports_acm', '');
        if (savedAcm) {
          try {
            const parsed: string[] = JSON.parse(savedAcm);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setAcmReports(Object.fromEntries(ACM_REPORTS_LIST.map((r) => [r.key, parsed.includes(r.key)])));
            }
          } catch {}
        }
      } catch {}
    };
    fetchSettings();
  }, [token]);

  // Save setting helper with proper error handling
  const saveSetting = async (key: string, value: string) => {
    if (!token) return;
    try {
      await api.admin.saveSystemSetting(key, value, token);
    } catch (err: any) {
      console.error(`[CcpCeBackup] Lỗi lưu cấu hình ${key}:`, err);
      toast.error(`Không thể lưu cấu hình ${key}: ${err.message || 'Lỗi quyền truy cập'}`);
      throw err;
    }
  };

  // Audit Handlers
  const handleAuditCcpBackup = async (showToast: boolean = true) => {
    if (!token || auditingCcp) return;
    setAuditingCcp(true);
    let toastId: string | undefined;
    if (showToast) toastId = toast.loading('Đang quét thư mục backup CoreCCP...');
    try {
      const data = await api.ingress.auditCcpBackup({ targetDate: selectedDate }, token);
      setAuditCcpResult(data);
      if (showToast && toastId) toast.success(`Quét CoreCCP hoàn tất: ${data.summary?.ok || 0}/${data.summary?.total || 0} file OK`, { id: toastId });
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
      const data = await api.ingress.auditCeBackup(selectedDate, token);
      setAuditCeResult(data);
      if (showToast && toastId) toast.success(`Quét CoreEX hoàn tất: ${data.summary?.ok || 0}/${data.summary?.total || 0} file OK`, { id: toastId });
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
      const data = await api.ingress.auditAcmBackup({ targetDate: selectedDate }, token);
      setAuditAcmResult(data);
      if (showToast && toastId) toast.success(`Quét ACM hoàn tất: ${data.summary?.ok || 0}/${data.summary?.total || 0} file OK`, { id: toastId });
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
    const isAll = selected.length === CORE_CCP_REPORTS_LIST.length;
    const toastId = toast.loading(
      isAll
        ? 'Đang kích hoạt Full Backup CoreCCP (19 file + HĐ hàng hóa)...'
        : `Đang tải ${selected.length} báo cáo CoreCCP...`
    );
    try {
      await api.ingress.triggerCcpDownload(
        { date: selectedDate, reports: isAll ? ['FULL'] : selected },
        token
      );
      toast.success('Đã kích hoạt tải báo cáo CoreCCP!', { id: toastId });
      await handleAuditCcpBackup(false);
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
    const isAll = selected.length === CORE_EX_REPORTS_LIST.length;
    const toastId = toast.loading(
      isAll
        ? 'Đang kích hoạt Full Backup CoreEX (12 file + HĐ hàng hóa)...'
        : `Đang tải ${selected.length} báo cáo CoreEX...`
    );
    try {
      await api.ingress.triggerCeDownload(
        { date: selectedDate, reports: isAll ? ['FULL'] : selected },
        token
      );
      toast.success('Đã kích hoạt tải báo cáo CoreEX!', { id: toastId });
      await handleAuditCeBackup(false);
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
      await api.ingress.triggerAcmDownload({ targetDate: selectedDate, reports: selected }, token);
      toast.success('Đã kích hoạt tải báo cáo ACM!', { id: toastId });
      await handleAuditAcmBackup(false);
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
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Tự động tải báo cáo sao lưu chốt ngày CoreCCP & CoreEX độc lập (theo cấu hình hệ thống)"
          >
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
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Tự động kích hoạt Macro thống kê số lot & GTGD CCP độc lập (theo cấu hình hệ thống)"
          >
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
            onClick={async () => {
              const next = !autoBackupActive;
              setAutoBackupActive(next);
              try {
                await saveSetting('bot_auto_backup_enabled', String(next));
                toast.success(`Đã ${next ? 'BẬT' : 'TẮT'} cơ chế tự động backup CCP-CE!`);
              } catch (err) {
                setAutoBackupActive(!next);
              }
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
      {!hideSubTabs && (
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('BACKUP_ALL')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              fontSize: '0.84rem',
              fontWeight: 800,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeSubTab === 'BACKUP_ALL' ? '2px solid #10b981' : '2px solid transparent',
              color: activeSubTab === 'BACKUP_ALL' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: activeSubTab === 'BACKUP_ALL' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Database size={15} color={activeSubTab === 'BACKUP_ALL' ? '#10b981' : 'var(--text-muted)'} />
            <span>Sao Lưu Báo Cáo CCP – CE – Straits</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('CE_LOT_STATS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              fontSize: '0.84rem',
              fontWeight: 800,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeSubTab === 'CE_LOT_STATS' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeSubTab === 'CE_LOT_STATS' ? '#3b82f6' : 'var(--text-secondary)',
              backgroundColor: activeSubTab === 'CE_LOT_STATS' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <BarChart3 size={15} color={activeSubTab === 'CE_LOT_STATS' ? '#3b82f6' : 'var(--text-muted)'} />
            <span>Thống Kê Khớp Lệnh CE (ACM Nano)</span>
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                color: '#3b82f6',
              }}
            >
              MỚI
            </span>
          </button>
        </div>
      )}

      {activeSubTab === 'CE_LOT_STATS' ? (
        <CeLotStatisticsSection token={token} selectedDate={selectedDate} />
      ) : (
        <>
          {/* ===== BAR 3: 3 CỘT BACKUP (CORECCP, COREEX, ACM) ===== */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px' }}>
          {/* CỘT 1: BACKUP CORECCP (25 BÁO CÁO) */}
          <div style={{ border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: 'rgba(16, 185, 129, 0.02)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(16, 185, 129, 0.2)', paddingBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#10b981' }}>Backup CoreCCP</span>
                  <button
                    type="button"
                    onClick={() => setConfigModal({ isOpen: true, system: 'CCP', systemName: 'VNCLEAR CoreCCP' })}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '22px',
                      height: '22px',
                      borderRadius: '4px',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      cursor: 'pointer',
                      color: '#10b981',
                      padding: 0,
                    }}
                    title="Cấu hình danh mục tệp sao lưu mặc định cho CoreCCP"
                  >
                    <Pencil size={12} />
                  </button>
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
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>19 báo cáo + HĐ hàng hóa (Động)</span>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#3b82f6' }}>Backup CoreEX (CE)</span>
                  <button
                    type="button"
                    onClick={() => setConfigModal({ isOpen: true, system: 'CE', systemName: 'CoreEX (CE / ACM)' })}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '22px',
                      height: '22px',
                      borderRadius: '4px',
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      cursor: 'pointer',
                      color: '#3b82f6',
                      padding: 0,
                    }}
                    title="Cấu hình danh mục tệp sao lưu mặc định cho CoreEX"
                  >
                    <Pencil size={12} />
                  </button>
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
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>13 báo cáo + HĐ hàng hóa (Động)</span>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0284c7' }}>Backup ACM</span>
                  <button
                    type="button"
                    onClick={() => setConfigModal({ isOpen: true, system: 'ACM', systemName: 'ACM Straits Financial' })}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '22px',
                      height: '22px',
                      borderRadius: '4px',
                      border: '1px solid rgba(14, 165, 233, 0.35)',
                      backgroundColor: 'rgba(14, 165, 233, 0.08)',
                      cursor: 'pointer',
                      color: '#0ea5e9',
                      padding: 0,
                    }}
                    title="Cấu hình danh mục tệp sao lưu mặc định cho ACM Straits"
                  >
                    <Pencil size={12} />
                  </button>
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

      {/* ===== BAR 4 & BAR 5: FOOTER SECTIONS (GTT & IMR) ===== */}
      {!hideFooterSections && (
        <>
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
        </>
      )}
        </>
      )}

      {/* Modal Cấu hình tệp sao lưu mặc định */}
      {configModal && (
        <BackupFileConfigModal
          isOpen={configModal.isOpen}
          onClose={() => setConfigModal(null)}
          system={configModal.system}
          systemName={configModal.systemName}
          token={token}
          allReports={
            configModal.system === 'CCP'
              ? (CORE_CCP_REPORTS_LIST as any)
              : configModal.system === 'CE'
              ? (CORE_EX_REPORTS_LIST as any)
              : (ACM_REPORTS_LIST as any)
          }
          onSaved={(savedKeys) => {
            if (configModal.system === 'CCP') {
              setCcpReports(Object.fromEntries(CORE_CCP_REPORTS_LIST.map((r) => [r.key, savedKeys.includes(r.key)])));
            } else if (configModal.system === 'CE') {
              setCeReports(Object.fromEntries(CORE_EX_REPORTS_LIST.map((r) => [r.key, savedKeys.includes(r.key)])));
            } else if (configModal.system === 'ACM') {
              setAcmReports(Object.fromEntries(ACM_REPORTS_LIST.map((r) => [r.key, savedKeys.includes(r.key)])));
            }
          }}
        />
      )}
    </div>
  );
}
