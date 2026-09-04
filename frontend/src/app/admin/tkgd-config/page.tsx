'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
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
} from 'lucide-react';

export default function TkgdConfigPage() {
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

  // Outlook Fields
  const [targetMailbox, setTargetMailbox] = useState('clearing.acc@mxv.vn');
  const [hasRefreshToken, setHasRefreshToken] = useState(false);

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

  // Test status
  const [testingMs, setTestingMs] = useState(false);
  const [msTestResult, setMsTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load config from Backend
  useEffect(() => {
    if (!token) return;

    const fetchConfig = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/config`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-user-email': user?.email || '',
          },
        });
        if (res.ok) {
          const data = await res.json();
          setFullName(data.fullName || user?.fullName || '');
          setDepartment(data.department || 'Thanh toán bù trừ');
          setMsUsername(data.msystem?.username || '');
          setHasExistingPassword(data.msystem?.hasPassword || false);
          setHasExistingPin(data.msystem?.hasPin || false);
          setTargetMailbox(data.outlook?.targetMailbox || 'clearing.acc@mxv.vn');
          setHasRefreshToken(data.outlook?.hasRefreshToken || false);
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
        }
      } catch (err: any) {
        toast.error('Không thể tải cấu hình TKGD: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [token, user]);

  // Handle Save
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token) return;

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
          Authorization: `Bearer ${token}`,
          'x-user-email': user?.email || '',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success('Lưu cấu hình đối soát TKGD thành công!');
        if (msPassword) setHasExistingPassword(true);
        if (msPin) setHasExistingPin(true);
        setMsPassword('');
        setMsPin('');
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
          Authorization: `Bearer ${token}`,
          'x-user-email': user?.email || '',
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

  return (
    <ProtectedRoute>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          minHeight: '100vh',
          color: 'var(--text-primary)',
          padding: '24px 32px',
        }}
        className="animate-fade-in"
      >
        {/* Page Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '16px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Sliders color="#10b981" size={26} />
              Cấu hình đối soát mở TKGD (TTBT)
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Dành riêng cho chuyên viên phòng <strong>Thanh toán bù trừ</strong> thiết lập tài khoản M-System cá nhân, hộp thư Outlook và thư mục lưu trữ mạng.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleSave()}
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
              transition: 'all 0.2s ease',
            }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>Lưu Cấu Hình</span>
          </button>
        </div>

        {loading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 0',
              gap: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            <Loader2 size={32} className="animate-spin text-emerald-500" />
            <span style={{ fontSize: '0.875rem' }}>Đang nạp dữ liệu cấu hình...</span>
          </div>
        ) : (
          <form
            onSubmit={handleSave}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: '24px',
            }}
          >
            {/* CARD 1: TÀI KHOẢN M-SYSTEM CÁ NHÂN */}
            <div
              className="glass-panel"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#3b82f6', fontWeight: 700, fontSize: '0.95rem' }}>
                  <KeyRound size={20} />
                  <span>1. Tài Khoản M-System Cá Nhân</span>
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    fontWeight: 600,
                  }}
                >
                  Mã hóa AES-256
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Tên chuyên viên phụ trách:</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn A"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Tên đăng nhập M-System (Username):</label>
                  <input
                    type="text"
                    value={msUsername}
                    onChange={(e) => setMsUsername(e.target.value)}
                    placeholder="Ví dụ: vana_clearing"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Mật khẩu M-System:</label>
                    {hasExistingPassword && (
                      <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={13} /> Đã lưu mật khẩu
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={msPassword}
                      onChange={(e) => setMsPassword(e.target.value)}
                      placeholder={hasExistingPassword ? '•••••••••• (Nhập để đổi mới)' : 'Nhập mật khẩu M-System'}
                      style={{ ...inputStyle, paddingRight: '42px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Mã PIN bàn phím ảo (6 chữ số):</label>
                    {hasExistingPin && (
                      <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={13} /> Đã lưu mã PIN
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPin ? 'text' : 'password'}
                      maxLength={6}
                      value={msPin}
                      onChange={(e) => setMsPin(e.target.value)}
                      placeholder={hasExistingPin ? '•••••• (Nhập để đổi mới)' : 'Ví dụ: 123456'}
                      style={{
                        ...inputStyle,
                        paddingRight: '42px',
                        letterSpacing: '0.15em',
                        fontFamily: 'monospace',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestMs}
                  disabled={testingMs}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '11px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: testingMs ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {testingMs ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <Send size={15} />}
                  <span>{testingMs ? 'Đang kết nối thử nghiệm...' : 'Kiểm Tra Đăng Nhập M-System Ngay'}</span>
                </button>

                {msTestResult && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      backgroundColor: msTestResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: msTestResult.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                      color: msTestResult.success ? '#10b981' : '#ef4444',
                    }}
                  >
                    {msTestResult.success ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> : <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />}
                    <span>{msTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 2: HỘP THƯ OUTLOOK & ĐỒNG BỘ Ổ M:\ */}
            <div
              className="glass-panel"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Outlook Sub-section */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-color)',
                    paddingBottom: '14px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#8b5cf6', fontWeight: 700, fontSize: '0.95rem' }}>
                    <Mail size={20} />
                    <span>2. Hộp Thư Microsoft 365 Outlook</span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      backgroundColor: 'rgba(139, 92, 246, 0.1)',
                      color: '#8b5cf6',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      fontWeight: 600,
                    }}
                  >
                    OAuth 2.0 Graph API
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Hộp thư nhận yêu cầu mở TKGD:</label>
                    <input
                      type="email"
                      value={targetMailbox}
                      onChange={(e) => setTargetMailbox(e.target.value)}
                      placeholder="clearing.acc@mxv.vn"
                      style={inputStyle}
                    />
                  </div>

                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Trạng thái xác thực Microsoft:
                      </span>
                      {hasRefreshToken ? (
                        <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <CheckCircle2 size={14} /> Sẵn sàng hoạt động
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <AlertTriangle size={14} /> Dùng cấu hình hệ thống
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                      Hệ thống tự động sử dụng OAuth Refresh Token đã được ủy quyền để đọc các email có tiêu đề <strong>"Yêu cầu mở TKGD"</strong> và tải các file đính kèm hợp đồng PDF, ảnh CCCD.
                    </p>
                  </div>
                </div>
              </div>

              {/* Storage Sub-section */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#f59e0b',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    borderBottom: '1px solid var(--border-color)',
                    paddingBottom: '14px',
                    marginBottom: '16px',
                  }}
                >
                  <FolderSync size={20} />
                  <span>3. Thư Mục Mạng & Đồng Bộ Ổ M:\</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}>Đường dẫn ổ đĩa mạng trên máy Windows:</label>
                    <input
                      type="text"
                      value={windowsPath}
                      onChange={(e) => setWindowsPath(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Đường dẫn thư mục mount trên Server Linux:</label>
                    <input
                      type="text"
                      value={linuxPath}
                      onChange={(e) => setLinuxPath(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: TÙY CHỌN XUẤT FILE & ĐỐI SOÁT EXCEL */}
            <div
              className="glass-panel"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '24px',
                gridColumn: '1 / -1',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#10b981',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '14px',
                  marginBottom: '16px',
                }}
              >
                <FileSpreadsheet size={20} />
                <span>4. Tùy Chọn Xuất File & Đối Soát Excel</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                    Tự động tô màu kết quả đối soát trong file Excel
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Tô màu <strong style={{ color: '#10b981' }}>Xanh lá</strong> cho các ô dữ liệu khớp hoàn toàn, và màu <strong style={{ color: '#f59e0b' }}>Cam</strong> / <strong style={{ color: '#ef4444' }}>Đỏ</strong> cho các ô có sai lệch hoặc thiếu thông tin.
                  </p>
                </div>

                <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoHighlightExcel}
                    onChange={(e) => setAutoHighlightExcel(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <div
                    style={{
                      width: '46px',
                      height: '24px',
                      backgroundColor: autoHighlightExcel ? '#10b981' : 'var(--border-color)',
                      borderRadius: '24px',
                      position: 'relative',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#ffffff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '3px',
                        left: autoHighlightExcel ? '25px' : '3px',
                        transition: 'left 0.2s',
                      }}
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* CARD 5: CẤU HÌNH XỬ LÝ HỒ SƠ, BÓC TÁCH & ĐỐI CHIẾU 3 CHIỀU */}
            <div
              className="glass-panel"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '24px',
                gridColumn: '1 / -1',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}
            >
              {/* Header Card 5 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0ea5e9', fontWeight: 700, fontSize: '0.95rem' }}>
                  <Layers size={20} />
                  <span>5. Cấu Hình Xử Lý Hồ Sơ, Bóc Tách Tệp Đính Kèm & Đối Chiếu 3 Chiều</span>
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(14, 165, 233, 0.1)',
                    color: '#0ea5e9',
                    border: '1px solid rgba(14, 165, 233, 0.25)',
                    fontWeight: 600,
                  }}
                >
                  Tự động hóa toàn diện
                </span>
              </div>

              {/* Nhóm A: Quản Lý Tải Về & Lưu Trữ Hồ Sơ */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                  <FolderDown size={17} style={{ color: '#0ea5e9' }} />
                  <span>A. Quản Lý Tải Về & Lưu Trữ Hồ Sơ (Ổ M:\ hoặc Thư Mục Riêng)</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Toggle 1: Tải file từ mail */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ paddingRight: '16px' }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px 0' }}>
                        Tự động tải tệp đính kèm & ảnh từ Mail Outlook về máy
                      </p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Tải toàn bộ file scan Hợp đồng (*-mxv.pdf), Phụ lục 01 (*-PL01.pdf) và ảnh CCCD 2 mặt từ thư vào thư mục lưu trữ.
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

                  {/* Toggle 2: Lưu ảnh từ M-System */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ paddingRight: '16px' }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px 0' }}>
                        Tự động trích xuất & lưu ảnh CCCD / Chữ ký từ M-System về máy
                      </p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Tải ảnh CCCD mặt trước, mặt sau và ảnh chữ ký mẫu đang lưu trên M-System về cùng thư mục hồ sơ để kiểm tra đối chiếu.
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

                  {/* Custom save path */}
                  <div style={{ marginTop: '4px' }}>
                    <label style={labelStyle}>Đường dẫn thư mục lưu trữ hồ sơ (Tùy chọn):</label>
                    <input
                      type="text"
                      value={attachmentSavePath}
                      onChange={(e) => setAttachmentSavePath(e.target.value)}
                      placeholder="Để trống = Tự động gom vào thư mục HoSo_DinhKem trên ổ M:\ theo ngày và mã TKGD (Khuyến nghị)"
                      style={inputStyle}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Ví dụ: <code>M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Mo TKGD\HoSo_DinhKem\</code>
                    </span>
                  </div>
                </div>
              </div>

              {/* Nhóm B: Động Cơ Bóc Tách Dữ Liệu */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                  <Scan size={17} style={{ color: '#8b5cf6' }} />
                  <span>B. Động Cơ Bóc Tách Dữ Liệu (PDF & OCR Nhận Diện CCCD)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                  {/* Toggle 3: Bóc tách PDF */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ paddingRight: '16px' }}>
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

                  {/* Toggle 4: Quét OCR ảnh CCCD */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ paddingRight: '16px' }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px 0' }}>
                        Tự động nhận diện OCR ảnh CCCD (Mặt trước / Mặt sau)
                      </p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Trích xuất số CMND/CCCD, họ tên, ngày cấp từ ảnh. Có thể tắt khi ảnh quá mờ hoặc CPU bận.
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

              {/* Nhóm C: Quy Tắc Đối Chiếu Chéo */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                  <ShieldCheck size={17} style={{ color: '#10b981' }} />
                  <span>C. Quy Tắc Đối Chiếu Chéo (Triple Cross-Validation)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                  {/* Toggle 5: Đối chiếu 3 chiều */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ paddingRight: '16px' }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px 0' }}>
                        Bật đối chiếu chéo 3 chiều CCCD
                      </p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                        So khớp đa chiều: Ảnh CCCD Mail vs Ảnh CCCD M-System vs Form text M-System (phát hiện upload nhầm ảnh).
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

                  {/* Toggle 6: Kiểm tra chữ ký */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ paddingRight: '16px' }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px 0' }}>
                        Cảnh báo nếu chưa có ảnh Chữ ký mẫu trên M-System
                      </p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Đánh dấu cảnh báo trên file Excel đối soát nếu tài khoản trên M-System chưa được tải ảnh chữ ký mẫu.
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
          </form>
        )}
      </div>
    </ProtectedRoute>
  );
}
