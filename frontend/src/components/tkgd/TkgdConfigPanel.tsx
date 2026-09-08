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
} from 'lucide-react';

export default function TkgdConfigPanel() {
  const { user, token } = useAuth();

  // State cấu hình
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('Thanh toán bù trừ');
  const [msUsername, setMsUsername] = useState('');
  const [msPassword, setMsPassword] = useState('');
  const [msPin, setMsPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Has existing password/pin
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

  // Load config from Backend (Tự động nhận diện Auto-Auth)
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

  // Modal xác nhận chuyển đổi chế độ vận hành (null: đóng; true: muốn bật Auto; false: muốn chuyển Thủ công)
  const [pendingModeChange, setPendingModeChange] = useState<boolean | null>(null);

  // Yêu cầu chuyển chế độ -> Mở Modal xác nhận
  const requestModeChange = (targetState: boolean) => {
    if (targetState === autoPipelineEnabled || togglingAuto) return;
    setPendingModeChange(targetState);
  };

  // Thực thi chuyển đổi sau khi người dùng xác nhận
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
        toast.success(data.message || (nextState ? 'Đã kích hoạt chế độ Vận Hành Tự Động 24/7' : 'Đã chuyển sang chế độ Vận Hành Thủ Công'));
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
    setTestingMs(true);
    setMsTestResult(null);
    try {
      const payload: any = {};
      if (msUsername) payload.username = msUsername;
      if (msPassword) payload.password = msPassword;
      if (msPin) payload.pin = msPin;

      const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/test-ms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setMsTestResult(data);
      if (data.success) {
        toast.success('Kết nối M-System thành công!');
      } else {
        toast.error(data.message || 'Đăng nhập M-System thất bại');
      }
    } catch (err: any) {
      setMsTestResult({ success: false, message: err.message });
      toast.error('Lỗi khi kiểm tra: ' + err.message);
    } finally {
      setTestingMs(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    fontSize: '0.875rem',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="animate-spin text-emerald-500" style={{ margin: '0 auto 12px auto' }} />
        <p style={{ margin: 0, fontSize: '0.875rem' }}>Đang nạp cấu hình đối soát TKGD...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Action bar */}
      <div
        id="tutorial-tkgd-config-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            ⚙️ Cấu Hình Thông Số Bot & Quy Trình Bóc Tách
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Thiết lập tài khoản M-System, hòm thư Outlook, thư mục ổ M:\ và cơ chế đối soát 3 chiều.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            borderRadius: '10px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
          }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span>{saving ? 'Đang lưu...' : 'Lưu Cấu Hình'}</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Card 0: CHẾ ĐỘ VẬN HÀNH HỆ THỐNG (ENTERPRISE CLEAN REDESIGN) */}
        <div
          id="tutorial-tkgd-config-operation-mode"
          style={{
            ...cardStyle,
            gridColumn: '1 / -1',
            border: autoPipelineEnabled
              ? '1px solid rgba(16, 185, 129, 0.35)'
              : '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            position: 'relative',
            overflow: 'hidden',
          }}
          className="glass-panel"
        >
          {/* Header thống nhất, loại bỏ switch trùng lặp */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '14px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: autoPipelineEnabled ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-input)',
                  border: autoPipelineEnabled ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: autoPipelineEnabled ? '#10b981' : 'var(--text-secondary)',
                }}
              >
                <Bot size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Chế Độ Vận Hành Hệ Thống (Operation Mode)
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Lựa chọn cơ chế quét hòm thư M365, bóc tách hồ sơ và đồng bộ dữ liệu đối soát.
                </p>
              </div>
            </div>

            {/* Status Pill Badge trực quan */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: autoPipelineEnabled ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-input)',
                color: autoPipelineEnabled ? '#059669' : 'var(--text-muted)',
                border: autoPipelineEnabled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: autoPipelineEnabled ? '#10b981' : '#94a3b8',
                }}
                className={autoPipelineEnabled ? 'animate-pulse' : ''}
              />
              <span>{autoPipelineEnabled ? 'Đang Vận Hành Tự Động 24/7' : 'Đang Ở Chế Độ Thủ Công'}</span>
            </div>
          </div>

          {/* 2 Chế Độ Lựa Chọn Dạng Segmented Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Thẻ 1: Tự Động 24/7 */}
            <div
              onClick={() => requestModeChange(true)}
              style={{
                padding: '18px',
                borderRadius: '12px',
                border: autoPipelineEnabled ? '2px solid #10b981' : '1px solid var(--border-color)',
                backgroundColor: autoPipelineEnabled ? 'rgba(16, 185, 129, 0.04)' : 'var(--bg-input)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
              className="hover:border-emerald-400"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <PlayCircle size={20} color={autoPipelineEnabled ? '#10b981' : 'var(--text-secondary)'} />
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                    Tự Động Hóa 24/7
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      color: '#059669',
                    }}
                  >
                    Khuyến nghị
                  </span>
                </div>
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: autoPipelineEnabled ? '5px solid #10b981' : '2px solid var(--border-color)',
                    backgroundColor: '#ffffff',
                    transition: 'all 0.2s ease',
                  }}
                />
              </div>

              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Hệ thống tự động chạy ngầm theo chu kỳ định kỳ. Chuyên viên chỉ cần theo dõi và kiểm tra kết quả đối soát trên bàn làm việc.
              </p>

              {/* Stepper Quy Trình Mini Thanh Lịch */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap',
                  paddingTop: '6px',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', fontWeight: 500 }}>
                  Hòm thư M365
                </span>
                <ChevronRight size={13} color="var(--text-muted)" />
                <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', fontWeight: 500 }}>
                  Bóc tách OCR
                </span>
                <ChevronRight size={13} color="var(--text-muted)" />
                <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', fontWeight: 500 }}>
                  Đối chiếu M-System
                </span>
                <ChevronRight size={13} color="var(--text-muted)" />
                <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', fontWeight: 500 }}>
                  Cập nhật Excel
                </span>
              </div>
            </div>

            {/* Thẻ 2: Thủ Công On-Demand */}
            <div
              onClick={() => requestModeChange(false)}
              style={{
                padding: '18px',
                borderRadius: '12px',
                border: !autoPipelineEnabled ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                backgroundColor: !autoPipelineEnabled ? 'rgba(59, 130, 246, 0.04)' : 'var(--bg-input)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
              className="hover:border-blue-400"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <SlidersHorizontal size={20} color={!autoPipelineEnabled ? '#3b82f6' : 'var(--text-secondary)'} />
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                    Vận Hành Thủ Công (Theo yêu cầu)
                  </span>
                </div>
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: !autoPipelineEnabled ? '5px solid #3b82f6' : '2px solid var(--border-color)',
                    backgroundColor: '#ffffff',
                    transition: 'all 0.2s ease',
                  }}
                />
              </div>

              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Bot ở trạng thái nghỉ hoàn toàn. Các tác vụ quét hòm thư, cào M-System và đối soát chỉ thực thi khi chuyên viên bấm nút kích hoạt trên thanh công cụ.
              </p>

              <div style={{ paddingTop: '6px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Phù hợp khi bảo trì hòm thư hoặc chạy kiểm thử từng đợt riêng biệt
                </span>
              </div>
            </div>
          </div>

          {/* Chi tiết cài đặt nâng cao khi ở chế độ Tự Động */}
          {autoPipelineEnabled && (
            <div
              style={{
                padding: '16px 18px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={15} color="#10b981" />
                <span>Tham Số Vận Hành Định Kỳ:</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Chu kỳ quét mail tự động</label>
                  <select
                    style={inputStyle}
                    value={autoIntervalMinutes}
                    onChange={(e) => setAutoIntervalMinutes(Number(e.target.value))}
                  >
                    <option value={3}>3 phút / lần (Siêu nhanh)</option>
                    <option value={5}>5 phút / lần (Khuyến nghị chuẩn)</option>
                    <option value={10}>10 phút / lần</option>
                    <option value={15}>15 phút / lần</option>
                    <option value={30}>30 phút / lần</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Số lượng hồ sơ xử lý mỗi lượt</label>
                  <select
                    style={inputStyle}
                    value={autoBatchSize}
                    onChange={(e) => setAutoBatchSize(Number(e.target.value))}
                  >
                    <option value={20}>20 hồ sơ / lượt</option>
                    <option value={50}>50 hồ sơ / lượt (Khuyến nghị chuẩn)</option>
                    <option value={100}>100 hồ sơ / lượt</option>
                  </select>
                </div>
              </div>

              {/* Checkboxes tuỳ chọn */}
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', paddingTop: '2px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={autoSyncMSystem}
                    onChange={(e) => setAutoSyncMSystem(e.target.checked)}
                    style={{ accentColor: '#10b981' }}
                  />
                  <span>Tự động đồng bộ cổng M-System sau khi bóc tách mail</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={autoExportExcel}
                    onChange={(e) => setAutoExportExcel(e.target.checked)}
                    style={{ accentColor: '#10b981' }}
                  />
                  <span>Tự động cập nhật file Excel đối soát mới nhất</span>
                </label>
              </div>

              {/* Thông tin mốc thời gian lần quét cuối */}
              {autoLastRunTime > 0 && (
                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    fontSize: '0.75rem',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }} className="animate-pulse" />
                    <span>Lần quét gần nhất: <strong>{new Date(autoLastRunTime).toLocaleString('vi-VN')}</strong></span>
                  </div>
                  <div>
                    Số hồ sơ xử lý đợt gần nhất: <strong>{autoLastProcessedCount} hồ sơ</strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card 1: Thông tin nhân sự */}
        <div id="tutorial-tkgd-config-profile" style={cardStyle} className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Sliders color="#3b82f6" size={20} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              1. Thông Tin Chuyên Viên
            </h3>
          </div>

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

        {/* Card 2: Tài khoản M-System */}
        <div id="tutorial-tkgd-config-ms" style={cardStyle} className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <KeyRound color="#10b981" size={20} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                2. Tài Khoản M-System Cá Nhân
              </h3>
            </div>
            {hasExistingPassword && (
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 600 }}>
                ✓ Đã có mật khẩu mã hóa
              </span>
            )}
          </div>

          <div>
            <label style={labelStyle}>Tên đăng nhập (Username M-System)</label>
            <input
              type="text"
              style={inputStyle}
              value={msUsername}
              onChange={(e) => setMsUsername(e.target.value)}
              placeholder="VD: hiepth"
            />
          </div>

          <div>
            <label style={labelStyle}>Mật khẩu M-System</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                style={{ ...inputStyle, paddingRight: '40px' }}
                value={msPassword}
                onChange={(e) => setMsPassword(e.target.value)}
                placeholder={hasExistingPassword ? '•••••••• (Để trống nếu giữ nguyên)' : 'Nhập mật khẩu M-System'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Mã PIN giao dịch (nếu có)</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPin ? 'text' : 'password'}
                style={{ ...inputStyle, paddingRight: '40px' }}
                value={msPin}
                onChange={(e) => setMsPin(e.target.value)}
                placeholder={hasExistingPin ? '•••• (Để trống nếu giữ nguyên)' : 'Nhập mã PIN nếu có'}
                maxLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px' }}>
            <button
              type="button"
              onClick={handleTestMs}
              disabled={testingMs || !msUsername}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: testingMs || !msUsername ? 'not-allowed' : 'pointer',
              }}
            >
              {testingMs ? <Loader2 size={14} className="animate-spin text-blue-500" /> : <Send size={14} color="#3b82f6" />}
              <span>{testingMs ? 'Đang kiểm tra đăng nhập...' : 'Kiểm Tra Đăng Nhập MS'}</span>
            </button>
            {msTestResult && (
              <span style={{ fontSize: '0.75rem', color: msTestResult.success ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                {msTestResult.success ? '✓ Thành công' : '✕ Thất bại'}
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Hộp thư Outlook Độc Lập */}
        <div id="tutorial-tkgd-config-outlook" style={cardStyle} className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Mail color="#8b5cf6" size={20} />
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  3. Tài Khoản Outlook Nhận Mail (Độc Lập)
                </h3>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Tách biệt 100% — Không chia sẻ token với Checklist bot
                </span>
              </div>
            </div>
            {hasRefreshToken ? (
              <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={13} />
                Đã kết nối
              </span>
            ) : (
              <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={13} />
                Chưa cấp quyền
              </span>
            )}
          </div>

          {/* Trạng thái kết nối chi tiết */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '8px',
            backgroundColor: hasRefreshToken ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
            border: `1px solid ${hasRefreshToken ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {hasRefreshToken ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={15} />
                    Tài khoản Microsoft: <strong>{authorizedEmail || targetMailbox}</strong>
                  </span>
                  {tokenRenewedAt && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      Cấp lúc: {new Date(tokenRenewedAt).toLocaleString('vi-VN')}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={handleConnectOutlook}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: 'rgba(59, 130, 246, 0.12)',
                      border: '1px solid #3b82f6',
                      color: '#3b82f6',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <RefreshCw size={12} />
                    Đổi / Cấp lại tài khoản
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectOutlook}
                    disabled={disconnectingOutlook}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid #ef4444',
                      color: '#ef4444',
                      borderRadius: '6px',
                      cursor: disconnectingOutlook ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    {disconnectingOutlook ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
                    Ngắt kết nối
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '0.75rem', color: '#f59e0b', lineHeight: 1.4 }}>
                  ⚠️ Hệ thống chưa có Token để truy cập hộp thư. Vui lòng bấm nút bên dưới để đăng nhập tài khoản Microsoft Office 365 của phòng TTBT (hỗ trợ đọc email, quét file hợp đồng/CCCD).
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleConnectOutlook}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                    }}
                  >
                    <Link2 size={14} />
                    Đăng Nhập & Cấp Quyền Hòm Thư Outlook
                  </button>
                </div>
              </>
            )}
          </div>

          <div>
            <label style={labelStyle}>Hòm thư theo dõi (Target Mailbox)</label>
            <input
              type="email"
              style={inputStyle}
              value={targetMailbox}
              onChange={(e) => setTargetMailbox(e.target.value)}
              placeholder="clearing.acc@mxv.vn"
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Địa chỉ email phòng ban nhận thư đăng ký mở TKGD từ các TVKD.
            </span>
          </div>

          {/* Collapsible: Cấu hình Azure App nâng cao */}
          <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => setShowAdvancedAzure(!showAdvancedAzure)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={13} color="#8b5cf6" />
                Cấu hình Azure App ID riêng (Tùy chọn nâng cao)
              </span>
              {showAdvancedAzure ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showAdvancedAzure && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', padding: '12px', backgroundColor: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  💡 Mặc định hệ thống tự động sử dụng Azure App của MXV. Bạn chỉ cần điền nếu phòng TTBT có App Registration riêng trên portal.azure.com.
                </span>
                <div>
                  <label style={labelStyle}>Client ID (App ID)</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Mặc định: Sử dụng từ hệ thống"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Tenant ID (Directory ID)</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="Mặc định: Sử dụng từ hệ thống"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Client Secret</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showClientSecret ? 'text' : 'password'}
                      style={{ ...inputStyle, paddingRight: '40px' }}
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder={hasClientSecret ? '•••••••• (Đã có Secret, để trống nếu giữ nguyên)' : 'Nhập Client Secret'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowClientSecret(!showClientSecret)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {showClientSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Thư mục lưu trữ & Tùy chọn xử lý Excel */}
        <div id="tutorial-tkgd-config-storage" style={cardStyle} className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <FolderSync color="#f59e0b" size={20} />
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                4. Thư Mục Lưu File Đối Soát & Xử Lý Excel (Ổ M:\)
              </h3>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Đường dẫn xuất file Auto Data mail_YYYYMMDD.xlsx và quy tắc định dạng
              </span>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Đường dẫn mạng trên Windows (Ổ M:\)</label>
            <input
              type="text"
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.78rem' }}
              value={windowsPath}
              onChange={(e) => setWindowsPath(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Đường dẫn trên Server Linux (PM2 Mount)</label>
            <input
              type="text"
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.78rem' }}
              value={linuxPath}
              onChange={(e) => setLinuxPath(e.target.value)}
            />
          </div>

          {/* Tùy chọn xử lý kết quả Excel */}
          <div
            id="tutorial-tkgd-config-excel"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              marginTop: '4px',
            }}
          >
            <div style={{ paddingRight: '14px' }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px 0' }}>
                Tự động tô màu kết quả đối soát trong file Excel
              </p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                Tô màu <strong style={{ color: '#10b981' }}>Xanh lá</strong> cho các ô dữ liệu khớp hoàn toàn, và màu <strong style={{ color: '#f59e0b' }}>Cam</strong> / <strong style={{ color: '#ef4444' }}>Đỏ</strong> cho các ô sai lệch hoặc thiếu thông tin.
              </p>
            </div>

            <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={autoHighlightExcel}
                onChange={(e) => setAutoHighlightExcel(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <div
                style={{
                  width: '44px',
                  height: '22px',
                  backgroundColor: autoHighlightExcel ? '#10b981' : 'var(--border-color)',
                  borderRadius: '22px',
                  position: 'relative',
                  transition: 'background-color 0.2s',
                }}
              >
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: '#ffffff',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '3px',
                    left: autoHighlightExcel ? '24px' : '3px',
                    transition: 'left 0.2s',
                  }}
                />
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Card 5: Cấu hình tải tệp đính kèm, ảnh CCCD M-System, OCR & Đối chiếu 3 chiều (Full width) */}
      <div id="tutorial-tkgd-config-processing" style={cardStyle} className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderDown color="#0ea5e9" size={22} />
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                5. Cấu Hình Tải Tệp Đính Kèm, Lưu File Ảnh CCCD & Đối Chiếu 3 Chiều
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Tự động hóa toàn diện từ tải file email, trích xuất ảnh CCCD/chữ ký M-System đến bóc tách PDF và OCR.
              </span>
            </div>
          </div>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '3px 10px',
              borderRadius: '20px',
              backgroundColor: 'rgba(14, 165, 233, 0.12)',
              color: '#0ea5e9',
              border: '1px solid rgba(14, 165, 233, 0.3)',
              fontWeight: 700,
            }}
          >
            Tự động hóa toàn diện
          </span>
        </div>

        {/* Khối A: Quản lý tải về & Thư mục lưu trữ hồ sơ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0ea5e9', fontWeight: 700, fontSize: '0.85rem' }}>
            <FolderSync size={16} />
            <span>A. Quản Lý Tải Về & Lưu Trữ Hồ Sơ (Ổ M:\ hoặc Thư Mục Riêng)</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            {/* Toggle: Tải từ mail */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ paddingRight: '14px' }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px 0' }}>
                  Tự động tải tệp đính kèm & ảnh từ Mail Outlook về máy
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Tải toàn bộ file Hợp đồng (*-mxv.pdf), Phụ lục 01 (*-PL01.pdf) và ảnh CCCD từ email vào thư mục hồ sơ.
                </p>
              </div>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={autoDownloadMailAttachments}
                  onChange={(e) => setAutoDownloadMailAttachments(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <div
                  style={{
                    width: '44px',
                    height: '22px',
                    backgroundColor: autoDownloadMailAttachments ? '#0ea5e9' : 'var(--border-color)',
                    borderRadius: '22px',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '3px',
                      left: autoDownloadMailAttachments ? '24px' : '3px',
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
              </label>
            </div>

            {/* Toggle: Tải ảnh từ M-System */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ paddingRight: '14px' }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px 0' }}>
                  Tự động trích xuất & lưu ảnh CCCD / Chữ ký từ M-System về máy
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Tải ảnh CCCD mặt trước, mặt sau và ảnh chữ ký mẫu đang lưu trên M-System về cùng thư mục để đối chiếu.
                </p>
              </div>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={autoSaveMSystemImages}
                  onChange={(e) => setAutoSaveMSystemImages(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <div
                  style={{
                    width: '44px',
                    height: '22px',
                    backgroundColor: autoSaveMSystemImages ? '#0ea5e9' : 'var(--border-color)',
                    borderRadius: '22px',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '3px',
                      left: autoSaveMSystemImages ? '24px' : '3px',
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
              </label>
            </div>
          </div>

          {/* Đường dẫn thư mục lưu trữ hồ sơ tải về */}
          <div style={{ marginTop: '4px' }}>
            <label style={labelStyle}>Đường dẫn thư mục lưu trữ tệp đính kèm & file ảnh CCCD (Tùy chọn):</label>
            <input
              type="text"
              value={attachmentSavePath}
              onChange={(e) => setAttachmentSavePath(e.target.value)}
              placeholder="Để trống = Mặc định gom vào thư mục HoSo_DinhKem trên ổ M:\ theo ngày và mã TKGD (Khuyến nghị)"
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.78rem' }}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Ví dụ: <code>M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Mo TKGD\HoSo_DinhKem\</code>
            </span>
          </div>
        </div>

        {/* Khối B: Động cơ bóc tách dữ liệu PDF & OCR */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b5cf6', fontWeight: 700, fontSize: '0.85rem' }}>
            <Scan size={16} />
            <span>B. Động Cơ Bóc Tách Dữ Liệu (PDF & OCR Nhận Diện CCCD)</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            {/* Toggle: Bóc tách PDF */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ paddingRight: '14px' }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px 0' }}>
                  Tự động đọc & bóc tách PDF Hợp đồng & Phụ lục PL01
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Bóc tách siêu tốc (~0.04s) lấy Số HĐ, Ngày ký, CCCD, Ngày sinh, Nơi cấp từ PDF scan.
                </p>
              </div>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={autoExtractPdf}
                  onChange={(e) => setAutoExtractPdf(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <div
                  style={{
                    width: '44px',
                    height: '22px',
                    backgroundColor: autoExtractPdf ? '#8b5cf6' : 'var(--border-color)',
                    borderRadius: '22px',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '3px',
                      left: autoExtractPdf ? '24px' : '3px',
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
              </label>
            </div>

            {/* Toggle: Quét OCR ảnh CCCD */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ paddingRight: '14px' }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px 0' }}>
                  Tự động nhận diện OCR ảnh CCCD (Mặt trước / Mặt sau)
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Trích xuất số CMND/CCCD, họ tên, ngày cấp từ ảnh. Tự động so khớp với M-System.
                </p>
              </div>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={enableOcrCccd}
                  onChange={(e) => setEnableOcrCccd(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <div
                  style={{
                    width: '44px',
                    height: '22px',
                    backgroundColor: enableOcrCccd ? '#8b5cf6' : 'var(--border-color)',
                    borderRadius: '22px',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '3px',
                      left: enableOcrCccd ? '24px' : '3px',
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Khối C: Quy tắc đối chiếu chéo */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>
            <ShieldCheck size={16} />
            <span>C. Quy Tắc Đối Chiếu Chéo (Triple Cross-Validation)</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            {/* Toggle: Đối chiếu 3 chiều */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ paddingRight: '14px' }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px 0' }}>
                  Đối chiếu chéo 3 chiều (Mail CCCD vs MS CCCD vs MS Form)
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Kiểm tra số CCCD trên hồ sơ gửi qua mail, ảnh CCCD cào từ M-System và biểu mẫu M-System có trùng khớp 100%.
                </p>
              </div>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={enableTripleCheckCccd}
                  onChange={(e) => setEnableTripleCheckCccd(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <div
                  style={{
                    width: '44px',
                    height: '22px',
                    backgroundColor: enableTripleCheckCccd ? '#10b981' : 'var(--border-color)',
                    borderRadius: '22px',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '3px',
                      left: enableTripleCheckCccd ? '24px' : '3px',
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
              </label>
            </div>

            {/* Toggle: Kiểm tra chữ ký */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ paddingRight: '14px' }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px 0' }}>
                  Bắt buộc kiểm tra chữ ký mẫu trên M-System
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Yêu cầu phải có chữ ký mẫu hợp lệ trên M-System mới đánh dấu hồ sơ đạt trạng thái Khớp.
                </p>
              </div>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={checkSignatureRequired}
                  onChange={(e) => setCheckSignatureRequired(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <div
                  style={{
                    width: '44px',
                    height: '22px',
                    backgroundColor: checkSignatureRequired ? '#10b981' : 'var(--border-color)',
                    borderRadius: '22px',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '3px',
                      left: checkSignatureRequired ? '24px' : '3px',
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL XÁC NHẬN CHUYỂN ĐỔI CHẾ ĐỘ VẬN HÀNH (ENTERPRISE CONFIRMATION DIALOG) */}
      {pendingModeChange !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingModeChange(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
            className="animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header Modal */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: pendingModeChange ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                    color: pendingModeChange ? '#059669' : '#d97706',
                    border: pendingModeChange ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
                    flexShrink: 0,
                  }}
                >
                  {pendingModeChange ? <PlayCircle size={24} /> : <AlertTriangle size={24} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {pendingModeChange ? 'Kích Hoạt Chế Độ Tự Động 24/7?' : 'Tạm Dừng Chế Độ Tự Động 24/7?'}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {pendingModeChange ? 'Xác nhận chuyển sang tiến trình quét ngầm liên tục' : 'Xác nhận chuyển về vận hành thủ công'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingModeChange(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Nội dung diễn giải tác động */}
            <div
              style={{
                backgroundColor: 'var(--bg-input)',
                borderRadius: '10px',
                padding: '14px 16px',
                border: '1px solid var(--border-color)',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.55,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {pendingModeChange ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>•</span>
                    <span>Hệ thống sẽ chạy ngầm và quét hòm thư M365 định kỳ <strong>mỗi {autoIntervalMinutes} phút</strong>.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>•</span>
                    <span>Tự động bóc tách OCR, đối chiếu M-System và cập nhật dữ liệu sẵn sàng cho ca trực.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>•</span>
                    <span>Chuyên viên không cần kích hoạt thủ công từng lần trên Dashboard.</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>•</span>
                    <span>Hệ thống sẽ <strong>tạm ngừng hoàn toàn</strong> việc tự động quét ngầm hòm thư M365 và M-System.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>•</span>
                    <span>Các hồ sơ mở tài khoản mới gửi đến sẽ <strong>chờ chuyên viên bấm nút quét thủ công</strong> tại bàn làm việc.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>•</span>
                    <span>Bạn có thể kích hoạt lại chế độ tự động 24/7 bất cứ lúc nào.</span>
                  </div>
                </>
              )}
            </div>

            {/* Actions Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setPendingModeChange(null)}
                disabled={togglingAuto}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                }}
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={() => executeToggleAutoMode(pendingModeChange)}
                disabled={togglingAuto}
                style={{
                  padding: '9px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: pendingModeChange ? '#10b981' : '#f59e0b',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: togglingAuto ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: pendingModeChange
                    ? '0 4px 12px rgba(16, 185, 129, 0.25)'
                    : '0 4px 12px rgba(245, 158, 11, 0.25)',
                  transition: 'transform 0.1s, opacity 0.15s',
                }}
              >
                {togglingAuto && <Loader2 size={15} className="animate-spin" />}
                <span>
                  {pendingModeChange ? 'Xác Nhận Kích Hoạt 24/7' : 'Xác Nhận Tạm Dừng'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
