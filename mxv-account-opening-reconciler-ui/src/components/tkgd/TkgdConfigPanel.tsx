'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import {
  Sliders,
  Mail,
  FolderSync,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  Send,
  RefreshCw,
  FileSpreadsheet,
  Check,
  FileText,
  Scan,
  Layers,
  FolderDown,
  ShieldCheck,
  Link2,
  Unlink,
  ChevronDown,
  ChevronUp,
  Clock,
  Key,
  Cpu,
  Zap,
  SlidersHorizontal,
  Bot,
  PlayCircle,
  PauseCircle,
  ChevronRight,
  X,
  HelpCircle,
  RotateCcw,
  HardDrive,
  UserCheck,
  Settings,
  Sparkles,
  Info,
} from 'lucide-react';
import { useTutorial } from '@/context/TutorialContext';
import { tkgdConfigTutorialSteps } from '@/tutorials/tkgdTutorial';

export default function TkgdConfigPanel() {
  const { user, token } = useAuth();
  const { startTutorial } = useTutorial();

  // Tab State: Vận hành ca trực (mặc định) vs Kỹ thuật & IT (hỗ trợ URL param ?subtab=...)
  const [activeTab, setActiveTab] = useState<'OPERATIONS' | 'ADVANCED'>('OPERATIONS');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const p = new URLSearchParams(window.location.search);
      const sub = p.get('subtab')?.toLowerCase();
      if (sub === 'advanced' || sub === 'kythuat' || sub === 'it') {
        setActiveTab('ADVANCED');
      } else if (sub === 'operations' || sub === 'vanhanh') {
        setActiveTab('OPERATIONS');
      }
    } catch {}

    const handlePop = () => {
      try {
        const p = new URLSearchParams(window.location.search);
        const sub = p.get('subtab')?.toLowerCase();
        if (sub === 'advanced' || sub === 'kythuat' || sub === 'it') {
          setActiveTab('ADVANCED');
        } else {
          setActiveTab('OPERATIONS');
        }
      } catch {}
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const handleSubTabChange = (newSubTab: 'OPERATIONS' | 'ADVANCED') => {
    setActiveTab(newSubTab);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('subtab', newSubTab.toLowerCase());
        window.history.replaceState(null, '', url.toString());
      } catch {}
    }
  };

  // State cấu hình
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');

  // M-System credentials
  const [msUrl, setMsUrl] = useState('https://msadmin.mxv.com.vn/');
  const [msUsername, setMsUsername] = useState('');
  const [msPassword, setMsPassword] = useState('');
  const [msPin, setMsPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [hasExistingPassword, setHasExistingPassword] = useState(false);
  const [hasExistingPin, setHasExistingPin] = useState(false);

  // Independent Outlook States
  const [targetMailbox, setTargetMailbox] = useState('clearing.acc@mxv.vn');
  const [hasRefreshToken, setHasRefreshToken] = useState(false);
  const [authorizedEmail, setAuthorizedEmail] = useState('');
  const [tokenRenewedAt, setTokenRenewedAt] = useState('');
  const [clientId, setClientId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showAdvancedAzure, setShowAdvancedAzure] = useState(false);
  const [disconnectingOutlook, setDisconnectingOutlook] = useState(false);

  // Storage Fields
  const [windowsPath, setWindowsPath] = useState(
    'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD',
  );
  const [linuxPath, setLinuxPath] = useState(
    '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD',
  );

  // Preferences
  const [autoHighlightExcel, setAutoHighlightExcel] = useState(true);

  // Document Processing & OCR States
  const [autoDownloadMailAttachments, setAutoDownloadMailAttachments] = useState(true);
  const [autoSaveMSystemImages, setAutoSaveMSystemImages] = useState(true);
  const [attachmentSavePath, setAttachmentSavePath] = useState('');
  const [autoExtractPdf, setAutoExtractPdf] = useState(true);
  const [enableOcrCccd, setEnableOcrCccd] = useState(true);
  const [enableTripleCheckCccd, setEnableTripleCheckCccd] = useState(true);
  const [checkSignatureRequired, setCheckSignatureRequired] = useState(true);

  // Operation Mode: Auto Pipeline 24/7 States
  const [autoPipelineEnabled, setAutoPipelineEnabled] = useState(false);
  const [executionMode, setExecutionMode] = useState<'BATCH' | 'INSTANT_STREAM'>('BATCH');
  const [autoIntervalMinutes, setAutoIntervalMinutes] = useState(5);
  const [autoBatchSize, setAutoBatchSize] = useState(50);
  const [autoSyncMSystem, setAutoSyncMSystem] = useState(true);
  const [autoExportExcel, setAutoExportExcel] = useState(true);
  const [autoLastRunTime, setAutoLastRunTime] = useState(0);
  const [autoLastProcessedCount, setAutoLastProcessedCount] = useState(0);
  const [togglingAuto, setTogglingAuto] = useState(false);

  // Test status
  const [testingMs, setTestingMs] = useState(false);
  const [msTestResult, setMsTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load config from Backend
  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/config`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setFullName(data.fullName || user?.fullName || 'Trương Hoàng Hiệp');
        setDepartment(data.department || 'Thanh toán bù trừ');
        setMsUsername(data.msystem?.username || '');
        setHasExistingPassword(data.msystem?.hasPassword || false);
        setHasExistingPin(data.msystem?.hasPin || false);

        // Outlook independent fields
        setTargetMailbox(data.outlook?.targetMailbox || 'clearing.acc@mxv.vn');
        setHasRefreshToken(data.outlook?.hasRefreshToken || false);
        setAuthorizedEmail(data.outlook?.authorizedEmail || '');
        setTokenRenewedAt(data.outlook?.tokenRenewedAt || '');
        setClientId(data.outlook?.clientId || '');
        setTenantId(data.outlook?.tenantId || '');
        setHasClientSecret(data.outlook?.hasClientSecret || false);

        if (data.storage?.windowsPath) setWindowsPath(data.storage.windowsPath);
        if (data.storage?.linuxPath) setLinuxPath(data.storage.linuxPath);
        if (data.preferences?.autoHighlightExcel !== undefined) {
          setAutoHighlightExcel(data.preferences.autoHighlightExcel);
        }
        if (data.documentProcessing) {
          const dp = data.documentProcessing;
          if (dp.autoDownloadMailAttachments !== undefined) setAutoDownloadMailAttachments(dp.autoDownloadMailAttachments);
          if (dp.autoSaveMSystemImages !== undefined) setAutoSaveMSystemImages(dp.autoSaveMSystemImages);
          if (dp.attachmentSavePath !== undefined) setAttachmentSavePath(dp.attachmentSavePath);
          if (dp.autoExtractPdf !== undefined) setAutoExtractPdf(dp.autoExtractPdf);
          if (dp.enableOcrCccd !== undefined) setEnableOcrCccd(dp.enableOcrCccd);
          if (dp.enableTripleCheckCccd !== undefined) setEnableTripleCheckCccd(dp.enableTripleCheckCccd);
          if (dp.checkSignatureRequired !== undefined) setCheckSignatureRequired(dp.checkSignatureRequired);
        }
        if (data.autoPipeline) {
          if (data.autoPipeline.enabled !== undefined) setAutoPipelineEnabled(data.autoPipeline.enabled);
          if (data.autoPipeline.executionMode) setExecutionMode(data.autoPipeline.executionMode);
          if (data.autoPipeline.intervalMinutes !== undefined) setAutoIntervalMinutes(data.autoPipeline.intervalMinutes);
          if (data.autoPipeline.batchSize !== undefined) setAutoBatchSize(data.autoPipeline.batchSize);
          if (data.autoPipeline.autoSyncMSystem !== undefined) setAutoSyncMSystem(data.autoPipeline.autoSyncMSystem);
          if (data.autoPipeline.autoExportExcel !== undefined) setAutoExportExcel(data.autoPipeline.autoExportExcel);
          if (data.autoPipeline.lastRunTime !== undefined) setAutoLastRunTime(data.autoPipeline.lastRunTime);
          if (data.autoPipeline.lastProcessedCount !== undefined) setAutoLastProcessedCount(data.autoPipeline.lastProcessedCount);
        }
      }
    } catch (err: any) {
      toast.error('Không thể tải cấu hình TKGD: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Modal xác nhận chuyển đổi chế độ vận hành
  const [pendingModeChange, setPendingModeChange] = useState<boolean | null>(null);

  const requestModeChange = (targetState: boolean) => {
    if (targetState === autoPipelineEnabled || togglingAuto) return;
    setPendingModeChange(targetState);
  };

  const executeToggleAutoMode = async (nextState: boolean) => {
    setPendingModeChange(null);
    setTogglingAuto(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/auto-pipeline/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
        body: JSON.stringify({ enabled: nextState }),
      });
      const data = await res.json();
      if (res.ok) {
        setAutoPipelineEnabled(data.enabled);
        toast.success(data.message || (nextState ? 'Đã kích hoạt chế độ Vận Hành Tự Động 24/7' : 'Đã chuyển sang chế độ Vận Hành Theo Yêu Cầu'));
      } else {
        toast.error(data.message || 'Không thể thay đổi chế độ vận hành');
      }
    } catch (err: any) {
      toast.error('Lỗi khi đổi chế độ vận hành: ' + err.message);
    } finally {
      setTogglingAuto(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [token, user]);

  // Listen for Microsoft OAuth redirect callback status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const outlookAuth = params.get('outlook_auth');
      const error = params.get('error');

      if (outlookAuth === 'success') {
        toast.success('Đăng nhập và cấp quyền hòm thư Outlook độc lập thành công!');
        window.history.replaceState({}, '', window.location.pathname);
        fetchConfig();
      } else if (outlookAuth === 'failed') {
        toast.error(`Cấp quyền Outlook thất bại: ${error || 'Lỗi không xác định'}`);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Connect Outlook OAuth
  const handleConnectOutlook = () => {
    const userEmail = user?.email || 'hieptruong@mxv.vn';
    const authUrl = `${API_BASE_URL}/api/v1/tkgd/auth/microsoft?userEmail=${encodeURIComponent(userEmail)}`;
    window.location.href = authUrl;
  };

  // Disconnect Outlook OAuth
  const handleDisconnectOutlook = async () => {
    if (!confirm('Bạn có chắc chắn muốn ngắt kết nối tài khoản Outlook độc lập này không?')) return;
    setDisconnectingOutlook(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/auth/microsoft/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
        body: JSON.stringify({ userEmail: user?.email || 'hieptruong@mxv.vn' }),
      });
      if (res.ok) {
        toast.success('Đã hủy kết nối tài khoản Outlook độc lập');
        setHasRefreshToken(false);
        setAuthorizedEmail('');
        setTokenRenewedAt('');
      } else {
        toast.error('Hủy kết nối thất bại');
      }
    } catch (e: any) {
      toast.error('Lỗi khi hủy kết nối: ' + e.message);
    } finally {
      setDisconnectingOutlook(false);
    }
  };

  // Khôi phục mặc định chuẩn của Sở
  const handleResetToDefault = () => {
    if (!confirm('Khôi phục toàn bộ tham số về giá trị mặc định chuẩn của Sở MXV?')) return;
    setWindowsPath('M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD');
    setLinuxPath('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD');
    setTargetMailbox('clearing.acc@mxv.vn');
    setAutoHighlightExcel(true);
    setAutoDownloadMailAttachments(true);
    setAutoSaveMSystemImages(true);
    setAttachmentSavePath('');
    setAutoExtractPdf(true);
    setEnableOcrCccd(true);
    setEnableTripleCheckCccd(true);
    setCheckSignatureRequired(true);
    setAutoIntervalMinutes(5);
    setAutoBatchSize(50);
    setAutoSyncMSystem(true);
    setAutoExportExcel(true);
    setExecutionMode('BATCH');
    toast.success('Đã nạp lại cấu hình mặc định chuẩn Sở. Vui lòng bấm "Lưu Cấu Hình" để áp dụng!');
  };

  // Handle Save
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        fullName,
        department,
        msystem: {
          username: msUsername.trim(),
        },
        outlook: {
          targetMailbox: targetMailbox.trim(),
          clientId: clientId.trim(),
          tenantId: tenantId.trim(),
          ...(clientSecret ? { clientSecret: clientSecret.trim() } : {}),
        },
        storage: {
          windowsPath: windowsPath.trim(),
          linuxPath: linuxPath.trim(),
        },
        preferences: {
          autoHighlightExcel,
        },
        documentProcessing: {
          autoDownloadMailAttachments,
          autoSaveMSystemImages,
          attachmentSavePath: attachmentSavePath.trim(),
          autoExtractPdf,
          enableOcrCccd,
          enableTripleCheckCccd,
          checkSignatureRequired,
        },
        autoPipeline: {
          enabled: autoPipelineEnabled,
          executionMode,
          intervalMinutes: Number(autoIntervalMinutes) || 5,
          batchSize: Number(autoBatchSize) || 50,
          autoSyncMSystem,
          autoExportExcel,
        },
      };

      if (msPassword) {
        payload.msystem.password = msPassword;
      }
      if (msPin) {
        payload.msystem.pin = msPin;
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success('Lưu cấu hình đối soát TKGD thành công!');
        if (msPassword) setHasExistingPassword(true);
        if (msPin) setHasExistingPin(true);
        if (clientSecret) setHasClientSecret(true);
        setMsPassword('');
        setMsPin('');
        setClientSecret('');
        await fetchConfig();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Lưu cấu hình thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối máy chủ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Test M-System login
  const handleTestMs = async () => {
    if (!msUsername) {
      toast.error('Vui lòng nhập Username M-System');
      return;
    }
    if (!msPassword && !hasExistingPassword) {
      toast.error('Vui lòng nhập Mật khẩu M-System');
      return;
    }
    if (!msPin && !hasExistingPin) {
      toast.error('Vui lòng nhập Mã PIN');
      return;
    }

    setTestingMs(true);
    setMsTestResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/test-ms-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
        body: JSON.stringify({
          url: msUrl,
          username: msUsername,
          password: msPassword || undefined,
          pin: msPin || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMsTestResult({ success: true, message: data.message || 'Đăng nhập M-System thành công!' });
        toast.success('Thử nghiệm: Đăng nhập M-System thành công!');
      } else {
        setMsTestResult({ success: false, message: data.message || 'Đăng nhập thất bại. Kiểm tra lại thông tin.' });
        toast.error(data.message || 'Đăng nhập M-System thất bại');
      }
    } catch (err: any) {
      setMsTestResult({ success: false, message: 'Lỗi kết nối: ' + err.message });
      toast.error('Không thể kiểm tra đăng nhập M-System');
    } finally {
      setTestingMs(false);
    }
  };

  // Test Outlook connection
  const [testingOutlook, setTestingOutlook] = useState(false);
  const handleTestOutlook = async () => {
    setTestingOutlook(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/test-outlook-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Kết nối hòm thư Outlook thành công!');
      } else {
        toast.error(data.message || 'Không thể kết nối Outlook');
      }
    } catch (err: any) {
      toast.error('Lỗi kiểm tra Outlook: ' + err.message);
    } finally {
      setTestingOutlook(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px', gap: '16px' }}>
        <Loader2 className="animate-spin" size={36} color="#10b981" />
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Đang nạp cấu hình đối soát TKGD...</span>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  };

  const cardStyle: React.CSSProperties = {
    padding: '20px',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header thanh công cụ & Tác vụ */}
      <div
        id="tutorial-tkgd-config-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <Settings size={22} color="#10b981" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Cấu Hình Phân Hệ Đối Soát Mở TKGD
            </h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Quản lý tài khoản bot M-System, kết nối hòm thư, thư mục lưu trữ báo cáo & hồ sơ và chế độ vận hành
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Nút xem tour hướng dẫn */}
          <button
            type="button"
            onClick={() => startTutorial('tkgd-config', tkgdConfigTutorialSteps)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <HelpCircle size={15} />
            <span>Hướng dẫn</span>
          </button>

          {/* Nút Lưu cấu hình */}
          <button
            id="tutorial-tkgd-config-save-btn"
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 700,
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>Lưu Cấu Hình</span>
          </button>
        </div>
      </div>

      {/* THANH CHUYỂN TAB: Vận Hành Ca Trực vs Cấu Hình Kỹ Thuật IT */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px',
          borderRadius: '10px',
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
        }}
      >
        <button
          type="button"
          onClick={() => handleSubTabChange('OPERATIONS')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            backgroundColor: activeTab === 'OPERATIONS' ? '#10b981' : 'transparent',
            color: activeTab === 'OPERATIONS' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.2s ease',
          }}
        >
          <UserCheck size={18} />
          <span>VẬN HÀNH CA TRỰC (TTBT)</span>
        </button>

        <button
          type="button"
          onClick={() => handleSubTabChange('ADVANCED')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            backgroundColor: activeTab === 'ADVANCED' ? '#3b82f6' : 'transparent',
            color: activeTab === 'ADVANCED' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.2s ease',
          }}
        >
          <Cpu size={18} />
          <span>CẤU HÌNH KỸ THUẬT & IT</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: VẬN HÀNH CA TRỰC (DÀNH CHO CHUYÊN VIÊN NGHIỆP VỤ TTBT) */}
      {/* ========================================================================= */}
      {activeTab === 'OPERATIONS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* 1. CHẾ ĐỘ VẬN HÀNH HỆ THỐNG */}
          <div id="tutorial-tkgd-config-operation-mode" style={cardStyle} className="glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock color="#10b981" size={20} />
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    1. Chế Độ Vận Hành Hệ Thống
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Kiểm soát tự động hóa quét mail và đồng bộ dữ liệu M-System
                  </span>
                </div>
              </div>

              {/* Huy hiệu trạng thái */}
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  backgroundColor: autoPipelineEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                  color: autoPipelineEnabled ? '#10b981' : 'var(--text-secondary)',
                  border: autoPipelineEnabled ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: autoPipelineEnabled ? '#10b981' : '#94a3b8',
                  }}
                  className={autoPipelineEnabled ? 'animate-pulse' : ''}
                />
                <span>{autoPipelineEnabled ? 'Đang Tự Động 24/7' : 'Đang Theo Yêu Cầu'}</span>
              </span>
            </div>

            {/* 2 Lựa chọn vận hành lớn */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {/* Lựa chọn 1: Tự động 24/7 */}
              <div
                onClick={() => requestModeChange(true)}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  border: autoPipelineEnabled ? '2px solid #10b981' : '1px solid var(--border-color)',
                  backgroundColor: autoPipelineEnabled ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-input)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: autoPipelineEnabled ? '#10b981' : 'var(--text-primary)', fontWeight: 700 }}>
                    <PlayCircle size={18} />
                    <span>Vận Hành Tự Động 24/7</span>
                  </div>
                  <input
                    type="radio"
                    name="mode_radio"
                    checked={autoPipelineEnabled}
                    onChange={() => requestModeChange(true)}
                  />
                </div>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Hệ thống tự động kiểm tra hòm thư, tải hợp đồng, đồng bộ dữ liệu M-System và cập nhật file Excel định kỳ.
                </p>
              </div>

              {/* Lựa chọn 2: Theo yêu cầu (Thủ công) */}
              <div
                onClick={() => requestModeChange(false)}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  border: !autoPipelineEnabled ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                  backgroundColor: !autoPipelineEnabled ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-input)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: !autoPipelineEnabled ? '#3b82f6' : 'var(--text-primary)', fontWeight: 700 }}>
                    <PauseCircle size={18} />
                    <span>Vận Hành Theo Yêu Cầu (Khuyến nghị khi test)</span>
                  </div>
                  <input
                    type="radio"
                    name="mode_radio"
                    checked={!autoPipelineEnabled}
                    onChange={() => requestModeChange(false)}
                  />
                </div>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Hệ thống chỉ chạy khi chuyên viên ca trực bấm nút <strong>[Check]</strong> hoặc chọn tài khoản rồi bấm <strong>[Check lại]</strong>.
                </p>
              </div>
            </div>

            {/* Tham số chi tiết khi bật tự động */}
            {autoPipelineEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', paddingTop: '8px' }}>
                <div>
                  <label style={labelStyle}>Tần suất quét tự động</label>
                  <select
                    style={inputStyle}
                    value={autoIntervalMinutes}
                    onChange={(e) => setAutoIntervalMinutes(Number(e.target.value))}
                  >
                    <option value={3}>Mỗi 3 phút</option>
                    <option value={5}>Mỗi 5 phút (Chuẩn)</option>
                    <option value={10}>Mỗi 10 phút</option>
                    <option value={15}>Mỗi 15 phút</option>
                    <option value={30}>Mỗi 30 phút</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', paddingTop: '20px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={autoExportExcel}
                      onChange={(e) => setAutoExportExcel(e.target.checked)}
                    />
                    <span>Tự động xuất file Excel vào thư mục lưu trữ sau mỗi chu kỳ</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 2. TÀI KHOẢN M-SYSTEM CÁ NHÂN */}
          <div id="tutorial-tkgd-config-ms" style={cardStyle} className="glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <KeyRound color="#10b981" size={20} />
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    2. Tài Khoản M-System Cá Nhân
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Dùng để đăng nhập M-System đồng bộ dữ liệu Nhà đầu tư và ảnh đối chiếu
                  </span>
                </div>
              </div>

              {hasExistingPassword && (
                <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 600 }}>
                  ✓ Đã lưu mật khẩu mã hóa
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Tên đăng nhập (Username M-System)</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={msUsername}
                  onChange={(e) => setMsUsername(e.target.value)}
                  placeholder="VD: mxvsupport"
                />
              </div>

              <div>
                <label style={labelStyle}>Mật khẩu đăng nhập</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    style={{ ...inputStyle, paddingRight: '36px' }}
                    value={msPassword}
                    onChange={(e) => setMsPassword(e.target.value)}
                    placeholder={hasExistingPassword ? '••••••••••• (Để trống nếu giữ nguyên)' : 'Nhập mật khẩu M-System'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Mã PIN giao dịch (6 số)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPin ? 'text' : 'password'}
                    maxLength={6}
                    style={{ ...inputStyle, paddingRight: '36px', letterSpacing: showPin ? 'normal' : '2px' }}
                    value={msPin}
                    onChange={(e) => setMsPin(e.target.value)}
                    placeholder={hasExistingPin ? '•••••• (Đã lưu)' : 'Nhập 6 số PIN'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Nút Test M-System Login */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '4px' }}>
              <button
                type="button"
                onClick={handleTestMs}
                disabled={testingMs}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: testingMs ? 'not-allowed' : 'pointer',
                }}
              >
                {testingMs ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                <span>{testingMs ? 'Đang thử đăng nhập M-System...' : 'Kiểm Tra Đăng Nhập M-System'}</span>
              </button>

              {msTestResult && (
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: msTestResult.success ? '#10b981' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {msTestResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span>{msTestResult.message}</span>
                </span>
              )}
            </div>
          </div>

          {/* 3. HỘP THƯ OUTLOOK NGHIỆP VỤ */}
          <div id="tutorial-tkgd-config-outlook" style={cardStyle} className="glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail color="#3b82f6" size={20} />
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    3. Hộp Thư Nghiệp Vụ Nhận Hồ Sơ
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Hòm thư tiếp nhận email mở tài khoản từ các Thành viên Kinh doanh (TVKD)
                  </span>
                </div>
              </div>

              {/* Trạng thái kết nối */}
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '16px',
                  backgroundColor: hasRefreshToken ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: hasRefreshToken ? '#10b981' : '#ef4444',
                  border: hasRefreshToken ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {hasRefreshToken ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                <span>{hasRefreshToken ? 'Đã Kết Nối Microsoft 365' : 'Chưa Kết Nối'}</span>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Địa chỉ hòm thư tiếp nhận hồ sơ</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={targetMailbox}
                  onChange={(e) => setTargetMailbox(e.target.value)}
                  placeholder="clearing.acc@mxv.vn"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleTestOutlook}
                  disabled={testingOutlook}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: testingOutlook ? 'not-allowed' : 'pointer',
                  }}
                >
                  {testingOutlook ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>Kiểm Tra Kết Nối Hòm Thư</span>
                </button>

                {!hasRefreshToken && (
                  <button
                    type="button"
                    onClick={handleConnectOutlook}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '9px 16px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Link2 size={14} />
                    <span>Ủy Quyền Outlook 365</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 4. THƯ MỤC LƯU TRỮ BÁO CÁO & HỒ SƠ */}
          <div id="tutorial-tkgd-config-storage" style={cardStyle} className="glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <HardDrive color="#f59e0b" size={20} />
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  4. Thư Mục Lưu Trữ Báo Cáo & Hồ Sơ Mạng
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  Đường dẫn thư mục dùng chung (ổ đĩa mạng hoặc phân vùng lưu trữ) để xuất file Excel và lưu trữ hồ sơ
                </span>
              </div>
            </div>

            {/* Ô nhập thân thiện, không gán cứng tên ổ đĩa */}
            <div>
              <label style={labelStyle}>Đường dẫn thư mục lưu trữ (Windows / Ổ đĩa mạng)</label>
              <input
                type="text"
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.82rem' }}
                value={windowsPath}
                onChange={(e) => setWindowsPath(e.target.value)}
                placeholder="VD: Z:\ThanhToanBuTru\Mo TKGD hoặc M:\Tailieuchung\..."
              />
            </div>

            {/* Bảng ghi chú quy tắc lưu trữ rõ ràng */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontWeight: 700, fontSize: '0.78rem' }}>
                <Info size={14} />
                <span>Quy tắc lưu trữ tự động của hệ thống:</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                • <strong>Báo cáo Excel</strong>: Lưu trực tiếp file <code>Auto Data mail_YYYYMMDD.xlsx</code> tại thư mục trên.<br />
                • <strong>Tệp scan Hợp đồng & Ảnh CCCD</strong>: Hệ thống tự động gom vào thư mục con <code>HoSo_DinhKem\&lt;Ngày&gt;\&lt;Mã_TKGD&gt;\</code> một cách ngăn nắp.
              </p>
            </div>

            {/* Tùy chọn tô màu Excel */}
            <div
              id="tutorial-tkgd-config-excel"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>
                  Tự động tô màu kết quả đối soát trong file Excel
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Tô <strong style={{ color: '#10b981' }}>Xanh lá</strong> cho các ô khớp 100%, và màu <strong style={{ color: '#ef4444' }}>Cam / Đỏ</strong> cho các ô sai lệch hoặc thiếu thông tin.
                </p>
              </div>

              <input
                type="checkbox"
                checked={autoHighlightExcel}
                onChange={(e) => setAutoHighlightExcel(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CẤU HÌNH KỸ THUẬT & IT (DÀNH CHO QUẢN TRỊ VIÊN HẠ TẦNG) */}
      {/* ========================================================================= */}
      {activeTab === 'ADVANCED' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* IT Card 1: Thông tin nhân sự */}
          <div id="tutorial-tkgd-config-profile" style={cardStyle} className="glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <Sliders color="#3b82f6" size={20} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                1. Thông Tin Chuyên Viên Vận Hành
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Họ và tên chuyên viên</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="VD: Trương Hoàng Hiệp"
                />
              </div>

              <div>
                <label style={labelStyle}>Phòng ban / Bộ phận</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="VD: Thanh toán bù trừ"
                />
              </div>
            </div>
          </div>

          {/* IT Card 2: Microsoft 365 Azure OAuth */}
          <div style={cardStyle} className="glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Key color="#8b5cf6" size={20} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  2. Cấu Hình Microsoft Azure App (OAuth2 Client)
                </h3>
              </div>

              {hasRefreshToken && (
                <button
                  type="button"
                  onClick={handleDisconnectOutlook}
                  disabled={disconnectingOutlook}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Unlink size={13} />
                  <span>Hủy liên kết Token</span>
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Client ID (Application ID)</label>
                <input
                  type="text"
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Azure App Client ID"
                />
              </div>

              <div>
                <label style={labelStyle}>Tenant ID (Directory ID)</label>
                <input
                  type="text"
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="common hoặc Tenant ID"
                />
              </div>

              <div>
                <label style={labelStyle}>Client Secret (Mã bí mật)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showClientSecret ? 'text' : 'password'}
                    style={{ ...inputStyle, paddingRight: '36px', fontFamily: 'monospace' }}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={hasClientSecret ? '••••••••••• (Đã lưu Secret)' : 'Nhập Azure Client Secret'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowClientSecret(!showClientSecret)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    {showClientSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* IT Card 3: Hạ tầng Server Linux Mount & Tệp đính kèm tùy chọn */}
          <div style={cardStyle} className="glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <HardDrive color="#0ea5e9" size={20} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                3. Hạ Tầng Server Linux Mount & Đường Dẫn Nâng Cao
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Đường dẫn Server Linux (PM2 Mount)</label>
                <input
                  type="text"
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                  value={linuxPath}
                  onChange={(e) => setLinuxPath(e.target.value)}
                  placeholder="/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD"
                />
              </div>

              <div>
                <label style={labelStyle}>Đường dẫn thư mục lưu trữ tệp đính kèm riêng (Tùy chọn)</label>
                <input
                  type="text"
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                  value={attachmentSavePath}
                  onChange={(e) => setAttachmentSavePath(e.target.value)}
                  placeholder="Để trống = Mặc định gom vào thư mục con HoSo_DinhKem trong thư mục lưu trữ"
                />
              </div>
            </div>
          </div>

          {/* IT Card 4: Động cơ OCR & Bóc tách PDF */}
          <div id="tutorial-tkgd-config-processing" style={cardStyle} className="glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <Scan color="#8b5cf6" size={20} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                4. Động Cơ Bóc Tách PDF & Nhận Diện OCR CCCD
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoExtractPdf}
                  onChange={(e) => setAutoExtractPdf(e.target.checked)}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>Tự động đọc & bóc tách PDF Hợp đồng & PL01 (~0.04s)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableOcrCccd}
                  onChange={(e) => setEnableOcrCccd(e.target.checked)}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>Kích hoạt công nghệ OCR bóc tách ảnh thẻ CCCD</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableTripleCheckCccd}
                  onChange={(e) => setEnableTripleCheckCccd(e.target.checked)}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>Thẩm định CCCD 3 chiều (Dải MRZ vs Mặt trước vs HĐ)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checkSignatureRequired}
                  onChange={(e) => setCheckSignatureRequired(e.target.checked)}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>Kiểm tra sự tồn tại của chữ ký khách hàng</span>
              </label>
            </div>
          </div>

          {/* IT Card 5: Nút khôi phục chuẩn Sở */}
          <div style={{ ...cardStyle, border: '1px dashed #f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Khôi Phục Cấu Hình Chuẩn Của Sở MXV
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Nếu các tham số bị sửa sai lệch, bấm nút này để đưa toàn bộ đường dẫn và cờ kỹ thuật về trạng thái chuẩn vận hành.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetToDefault}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={15} />
                <span>Khôi Phục Chuẩn Sở</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Đổi Chế Độ Vận Hành */}
      {pendingModeChange !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: pendingModeChange ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {pendingModeChange ? <PlayCircle size={20} color="#10b981" /> : <PauseCircle size={20} color="#3b82f6" />}
              </div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {pendingModeChange ? 'Kích Hoạt Vận Hành Tự Động 24/7?' : 'Chuyển Sang Vận Hành Theo Yêu Cầu?'}
              </h4>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {pendingModeChange
                ? `Hệ thống sẽ bắt đầu tự động quét hòm thư clearing.acc@mxv.vn và đồng bộ dữ liệu M-System định kỳ mỗi ${autoIntervalMinutes} phút. Bạn có muốn kích hoạt ngay?`
                : 'Hệ thống sẽ tạm dừng các chu trình quét ngầm. Từ bây giờ bạn sẽ bấm nút [Check] trên bảng điều khiển mỗi khi muốn đối soát. Bạn có chắc chắn muốn chuyển?'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setPendingModeChange(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={() => executeToggleAutoMode(pendingModeChange)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  backgroundColor: pendingModeChange ? '#10b981' : '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Xác Nhận Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
