'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Server,
  Globe,
  Key,
  Eye,
  EyeOff,
  Save,
  Play,
  Cpu,
  Clock,
  Settings,
  Mail,
  Link2,
} from 'lucide-react';

interface ConnectionSettingsProps {
  token: string;
  apiBaseUrl: string;
  fetchJobs: () => Promise<void>;
}

export default function ConnectionSettings({
  token,
  apiBaseUrl,
  fetchJobs,
}: ConnectionSettingsProps) {
  const [loadingConfig, setLoadingConfig] = useState(true);
  // Credentials states
  const [msystemUrl, setMsystemUrl] = useState('https://msystem.mxv.vn/');
  const [msystemUsername, setMsystemUsername] = useState('');
  const [msystemPassword, setMsystemPassword] = useState('');
  const [msystemPin, setMsystemPin] = useState('');

  const [cqgUrl, setCqgUrl] = useState('https://m.cqg.com/cqg/desktop/logon?ref=forced');
  const [cqgUsername, setCqgUsername] = useState('');   // CQG Price (mxvprice)
  const [cqgPassword, setCqgPassword] = useState('');
  const [cqgUsername1, setCqgUsername1] = useState(''); // CQG1 Trade
  const [cqgPassword1, setCqgPassword1] = useState('');
  const [showCqgPassword1, setShowCqgPassword1] = useState(false);
  const [cqgUsername2, setCqgUsername2] = useState(''); // CQG3 Trade
  const [cqgPassword2, setCqgPassword2] = useState('');
  const [showCqgPassword2, setShowCqgPassword2] = useState(false);

  const [acmUrl, setAcmUrl] = useState('https://acm.member-url.vn/login');
  const [acmUsername, setAcmUsername] = useState('');
  const [acmPassword, setAcmPassword] = useState('');
  const [acmGeminiApiKey, setAcmGeminiApiKey] = useState('');
  const [acmDownloadUrl, setAcmDownloadUrl] = useState('');
  const [acmDownloadBtnSelector, setAcmDownloadBtnSelector] = useState('');
  const [acmSftpHost, setAcmSftpHost] = useState('sftp.mxv.com.vn');
  const [acmSftpPort, setAcmSftpPort] = useState('2231');
  const [acmSftpUsername, setAcmSftpUsername] = useState('');
  const [acmSftpPassword, setAcmSftpPassword] = useState('');
  const [acmSftpRemoteDir, setAcmSftpRemoteDir] = useState('/data/');

  const [castUrl, setCastUrl] = useState('https://www.cqgtrader.com/CAST/Logon/Logon.asp');
  const [castUsername, setCastUsername] = useState('');
  const [castPassword, setCastPassword] = useState('');

  const [cppUrl, setCppUrl] = useState('');
  const [cppUsername, setCppUsername] = useState('');
  const [cppPassword, setCppPassword] = useState('');

  const [ceUrl, setCeUrl] = useState('');
  const [ceUsername, setCeUsername] = useState('');
  const [cePassword, setCePassword] = useState('');

  // Scheduler state
  const [schedulerConfig, setSchedulerConfig] = useState<any[]>([]);

  // System parameters states
  const [sessionStartTime, setSessionStartTime] = useState('05:00');
  const [usdExchangeRate, setUsdExchangeRate] = useState(25220);

  // Password visibility states
  const [showMsystemPassword, setShowMsystemPassword] = useState(false);
  const [showMsystemPin, setShowMsystemPin] = useState(false);
  const [showCqgPassword, setShowCqgPassword] = useState(false);
  const [showAcmPassword, setShowAcmPassword] = useState(false);
  const [showAcmGeminiApiKey, setShowAcmGeminiApiKey] = useState(false);
  const [showAcmSftpPassword, setShowAcmSftpPassword] = useState(false);
  const [showCastPassword, setShowCastPassword] = useState(false);
  const [showCppPassword, setShowCppPassword] = useState(false);
  const [showCePassword, setShowCePassword] = useState(false);

  // M365 credentials states
  const [m365ClientId, setM365ClientId] = useState('');
  const [m365ClientSecret, setM365ClientSecret] = useState('');
  const [m365TenantId, setM365TenantId] = useState('');
  const [m365WatcherEmail, setM365WatcherEmail] = useState('');
  const [m365RefreshToken, setM365RefreshToken] = useState('');
  const [m365TokenRenewedAt, setM365TokenRenewedAt] = useState('');

  const [showM365ClientSecret, setShowM365ClientSecret] = useState(false);
  const [showM365RefreshToken, setShowM365RefreshToken] = useState(false);

  // Connection testing states
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingCqgConnection, setTestingCqgConnection] = useState(false);
  const [testingCqg1Connection, setTestingCqg1Connection] = useState(false);
  const [testingCqg3Connection, setTestingCqg3Connection] = useState(false);
  const [testingAcmConnection, setTestingAcmConnection] = useState(false);
  const [testingCppConnection, setTestingCppConnection] = useState(false);
  const [testingCeConnection, setTestingCeConnection] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const handleM365Reauthorize = () => {
    if (!token) return;
    const authUrl = `${apiBaseUrl}/api/v1/auth/microsoft-bot?token=${encodeURIComponent(token)}`;
    window.location.href = authUrl;
  };

  // Fetch configs
  const fetchConfig = async () => {
    if (!token) return;
    setLoadingConfig(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.msystem) {
          setMsystemUrl(data.msystem.url || 'https://msystem.mxv.vn/');
          setMsystemUsername(data.msystem.username || '');
          setMsystemPassword(data.msystem.password || '');
          setMsystemPin(data.msystem.pin || '');
        }
        if (data.cqg) {
          setCqgUrl(data.cqg.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced');
          setCqgUsername(data.cqg.username || '');
          setCqgPassword(data.cqg.password || '');
          setCqgUsername1(data.cqg.username1 || '');
          setCqgPassword1(data.cqg.password1 || '');
          setCqgUsername2(data.cqg.username2 || '');
          setCqgPassword2(data.cqg.password2 || '');
        }
        if (data.acm) {
          setAcmUrl(data.acm.url || 'https://acm.member-url.vn/login');
          setAcmUsername(data.acm.username || '');
          setAcmPassword(data.acm.password || '');
          setAcmGeminiApiKey(data.acm.geminiApiKey || '');
          setAcmDownloadUrl(data.acm.downloadUrl || '');
          setAcmDownloadBtnSelector(data.acm.downloadBtnSelector || '');
          setAcmSftpHost(data.acm.sftpHost || 'sftp.mxv.com.vn');
          setAcmSftpPort(data.acm.sftpPort || '2231');
          setAcmSftpUsername(data.acm.sftpUsername || '');
          setAcmSftpPassword(data.acm.sftpPassword || '');
          setAcmSftpRemoteDir(data.acm.sftpRemoteDir || '/data/');
        }
        if (data.cast) {
          setCastUrl(data.cast.url || 'https://www.cqgtrader.com/CAST/Logon/Logon.asp');
          setCastUsername(data.cast.username || '');
          setCastPassword(data.cast.password || '');
        }
        if (data.cpp) {
          setCppUrl(data.cpp.url || '');
          setCppUsername(data.cpp.username || '');
          setCppPassword(data.cpp.password || '');
        }
        if (data.ce) {
          setCeUrl(data.ce.url || '');
          setCeUsername(data.ce.username || '');
          setCePassword(data.ce.password || '');
        }
        if (data.schedulerConfig) {
          setSchedulerConfig(data.schedulerConfig);
        }
        if (data.sessionStartTime) {
          setSessionStartTime(data.sessionStartTime);
        }
        if (data.usdExchangeRate) {
          setUsdExchangeRate(data.usdExchangeRate);
        }
        if (data.m365) {
          setM365ClientId(data.m365.clientId || '');
          setM365ClientSecret(data.m365.clientSecret || '');
          setM365TenantId(data.m365.tenantId || '');
          setM365WatcherEmail(data.m365.watcherEmail || '');
          setM365RefreshToken(data.m365.refreshToken || '');
          setM365TokenRenewedAt(data.m365.tokenRenewedAt || '');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải cấu hình Bot từ máy chủ');
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [token]);

  // Save configurations
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingConfig(true);
    const toastId = toast.loading('Đang lưu cấu hình credentials...');

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          msystem: {
            url: msystemUrl.trim(),
            username: msystemUsername.trim(),
            password: msystemPassword,
            pin: msystemPin,
          },
          cqg: {
            url: cqgUrl.trim(),
            username: cqgUsername.trim(),
            password: cqgPassword,
            username1: cqgUsername1.trim(),
            password1: cqgPassword1,
            username2: cqgUsername2.trim(),
            password2: cqgPassword2,
          },
          acm: {
            url: acmUrl.trim(),
            username: acmUsername.trim(),
            password: acmPassword,
            geminiApiKey: acmGeminiApiKey,
            downloadUrl: acmDownloadUrl.trim(),
            downloadBtnSelector: acmDownloadBtnSelector.trim(),
            sftpHost: acmSftpHost.trim(),
            sftpPort: acmSftpPort.trim(),
            sftpUsername: acmSftpUsername.trim(),
            sftpPassword: acmSftpPassword,
            sftpRemoteDir: acmSftpRemoteDir.trim(),
          },
          cast: {
            url: castUrl.trim(),
            username: castUsername.trim(),
            password: castPassword,
          },
          cpp: {
            url: cppUrl.trim(),
            username: cppUsername.trim(),
            password: cppPassword,
          },
          ce: {
            url: ceUrl.trim(),
            username: ceUsername.trim(),
            password: cePassword,
          },
          m365: {
            clientId: m365ClientId.trim(),
            clientSecret: m365ClientSecret,
            tenantId: m365TenantId.trim(),
            watcherEmail: m365WatcherEmail.trim(),
            refreshToken: m365RefreshToken,
          },
          schedulerConfig,
          sessionStartTime,
          usdExchangeRate,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Lỗi khi cập nhật cấu hình');
      }

      toast.success('Lưu cấu hình tài khoản Bot thành công!', { id: toastId });
      fetchConfig();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ', { id: toastId });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    if (!token) return;
    setTestingConnection(true);
    const toastId = toast.loading('Đang khởi chạy Browser Headless và chạy thử đăng nhập M-System...');
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/test-connection`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Đăng nhập thử nghiệm thất bại');
      toast.success(data.message || 'Kết nối M-System thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm thất bại', { id: toastId });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestCqgConnection = async () => {
    if (!token) return;
    setTestingCqgConnection(true);
    const toastId = toast.loading('Đang khởi chạy Browser Headless và chạy thử đăng nhập CQG Price...');
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/test-connection-cqg`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Đăng nhập thử nghiệm CQG thất bại');
      toast.success(data.message || 'Kết nối CQG Price thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm CQG Price thất bại', { id: toastId });
    } finally {
      setTestingCqgConnection(false);
    }
  };

  const handleTestCqg1Connection = async () => {
    if (!token) return;
    setTestingCqg1Connection(true);
    const toastId = toast.loading('Đang kiểm tra đăng nhập CQG1 Trade...');
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/test-connection-cqg1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Đăng nhập CQG1 Trade thất bại');
      toast.success(data.message || 'Kết nối CQG1 Trade thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm CQG1 Trade thất bại', { id: toastId });
    } finally {
      setTestingCqg1Connection(false);
    }
  };

  const handleTestCqg3Connection = async () => {
    if (!token) return;
    setTestingCqg3Connection(true);
    const toastId = toast.loading('Đang kiểm tra đăng nhập CQG3 Trade...');
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/test-connection-cqg3`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Đăng nhập CQG3 Trade thất bại');
      toast.success(data.message || 'Kết nối CQG3 Trade thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm CQG3 Trade thất bại', { id: toastId });
    } finally {
      setTestingCqg3Connection(false);
    }
  };

  const handleTestAcmConnection = async () => {
    if (!token) return;
    setTestingAcmConnection(true);
    const toastId = toast.loading('Đang khởi chạy Browser Headless và chạy thử đăng nhập ACM...');
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/test-connection-acm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Đăng nhập thử nghiệm ACM thất bại');
      toast.success(data.message || 'Kết nối ACM thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm ACM thất bại', { id: toastId });
    } finally {
      setTestingAcmConnection(false);
    }
  };

  const handleTestCppConnection = async () => {
    if (!token) return;
    setTestingCppConnection(true);
    const toastId = toast.loading('Đang khởi chạy Browser Headless và chạy thử đăng nhập CCP...');
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/test-connection-ccp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Đăng nhập thử nghiệm CCP thất bại');
      toast.success(data.message || 'Kết nối CCP thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm CCP thất bại', { id: toastId });
    } finally {
      setTestingCppConnection(false);
    }
  };

  const handleTestCeConnection = async () => {
    if (!token) return;
    setTestingCeConnection(true);
    const toastId = toast.loading('Đang khởi chạy Browser Headless và chạy thử đăng nhập CE...');
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/test-connection-ce`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Đăng nhập thử nghiệm CE thất bại');
      toast.success(data.message || 'Kết nối CE thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm CE thất bại', { id: toastId });
    } finally {
      setTestingCeConnection(false);
    }
  };

  if (loadingConfig) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
        <Server className="animate-spin" size={24} style={{ marginRight: '12px', color: 'var(--color-primary)' }} />
        <span>Đang tải thông tin cấu hình credentials...</span>
      </div>
    );
  }

  const anyTesting =
    testingConnection ||
    testingCqgConnection ||
    testingAcmConnection ||
    testingCppConnection ||
    testingCeConnection ||
    savingConfig;

  // Common Label Style
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
      {/* Test Buttons Panel */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
            Kiểm tra kết nối tức thì
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            Kích hoạt bot chạy headless để thử nghiệm đăng nhập trực tiếp.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <button type="button" onClick={handleTestConnection} disabled={anyTesting} className="btn btn-secondary">
            <Play size={14} className={testingConnection ? 'animate-spin' : ''} />
            M-System
          </button>
          <button type="button" onClick={handleTestCqgConnection} disabled={anyTesting} className="btn btn-secondary">
            <Play size={14} className={testingCqgConnection ? 'animate-spin' : ''} />
            CQG Desktop
          </button>
          <button type="button" onClick={handleTestAcmConnection} disabled={anyTesting} className="btn btn-secondary">
            <Play size={14} className={testingAcmConnection ? 'animate-spin' : ''} />
            ACM
          </button>
          <button type="button" onClick={handleTestCppConnection} disabled={anyTesting} className="btn btn-secondary">
            <Play size={14} className={testingCppConnection ? 'animate-spin' : ''} />
            CCP
          </button>
          <button type="button" onClick={handleTestCeConnection} disabled={anyTesting} className="btn btn-secondary">
            <Play size={14} className={testingCeConnection ? 'animate-spin' : ''} />
            CE
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
          
          {/* M-System Config */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h4 style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '12px',
              margin: 0,
            }}>
              <Server size={18} />
              Cấu hình M-System
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>M-System URL</label>
                <div style={{ position: 'relative' }}>
                  <Globe size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="url"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="https://msystem.mxv.vn/"
                    value={msystemUrl}
                    onChange={(e) => setMsystemUrl(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Tên đăng nhập..."
                    value={msystemUsername}
                    onChange={(e) => setMsystemUsername(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Mã PIN ảo</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showMsystemPin ? 'text' : 'password'}
                      className="form-input"
                      style={{ paddingRight: '38px' }}
                      placeholder="Mã PIN..."
                      value={msystemPin}
                      onChange={(e) => setMsystemPin(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowMsystemPin(!showMsystemPin)}
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
                      {showMsystemPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Mật khẩu</label>
                <div style={{ position: 'relative' }}>
                  <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type={showMsystemPassword ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingLeft: '38px', paddingRight: '38px' }}
                    placeholder="Mật khẩu..."
                    value={msystemPassword}
                    onChange={(e) => setMsystemPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowMsystemPassword(!showMsystemPassword)}
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
                    {showMsystemPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CQG Desktop Config */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h4 style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '12px',
              margin: 0,
            }}>
              <Cpu size={18} />
              Cấu hình CQG Desktop
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>CQG Desktop URL</label>
                <div style={{ position: 'relative' }}>
                  <Globe size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="url"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="https://m.cqg.com/..."
                    value={cqgUrl}
                    onChange={(e) => setCqgUrl(e.target.value)}
                    required
                  />
                </div>
              </div>

               {/* CQG Price Account (mxvprice) — chỉ xem giá, KHÔNG tải file */}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', display: 'block', marginBottom: '4px' }}>
                  Tài khoản CQG Price (mxvprice)
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  ⚠️ Chỉ dùng xem giá / hợp đồng. Không có quyền tải bất kỳ file backup nào.
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Username CQG Price</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="mà giá CQG (VD: mxvprice)..."
                      value={cqgUsername}
                      onChange={(e) => setCqgUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Mật khẩu CQG Price</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCqgPassword ? 'text' : 'password'}
                        className="form-input"
                        style={{ paddingRight: '38px' }}
                        placeholder="CQG Price Password..."
                        value={cqgPassword}
                        onChange={(e) => setCqgPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCqgPassword(!showCqgPassword)}
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
                        {showCqgPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* CQG1 Trade Account — tải FR1/PS1/OP1/OD1 */}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', display: 'block', marginBottom: '4px' }}>
                  Tài khoản CQG1 Trade
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  Tải báo cáo: FR1.xlsx / PS1.xlsx / OP1.xlsx / OD1.xlsx
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Username CQG1</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="CQG1 Trade Username..."
                      value={cqgUsername1}
                      onChange={(e) => setCqgUsername1(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Mật khẩu CQG1</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCqgPassword1 ? 'text' : 'password'}
                        className="form-input"
                        style={{ paddingRight: '38px' }}
                        placeholder="CQG1 Trade Password..."
                        value={cqgPassword1}
                        onChange={(e) => setCqgPassword1(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCqgPassword1(!showCqgPassword1)}
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
                        {showCqgPassword1 ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
                {/* Test CQG1 Trade button */}
                <div style={{ marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={handleTestCqg1Connection}
                    disabled={testingCqg1Connection || !cqgUsername1 || !cqgPassword1}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Play size={12} className={testingCqg1Connection ? 'animate-spin' : ''} />
                    {testingCqg1Connection ? 'Đang kiểm tra...' : 'Test CQG1 Trade'}
                  </button>
                </div>
              </div>

              {/* CQG3 Account — QLGD gọi là CQG3, DB lưu field username2/password2 */}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', display: 'block', marginBottom: '4px' }}>
                  Tài khoản CQG3 Trade
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  Tải báo cáo: FR2.xlsx / PS2.xlsx / OP2.xlsx / OD2.xlsx
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Username CQG3</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="CQG3 Username..."
                      value={cqgUsername2}
                      onChange={(e) => setCqgUsername2(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Mật khẩu CQG3</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCqgPassword2 ? 'text' : 'password'}
                        className="form-input"
                        style={{ paddingRight: '38px' }}
                        placeholder="CQG3 Password..."
                        value={cqgPassword2}
                        onChange={(e) => setCqgPassword2(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCqgPassword2(!showCqgPassword2)}
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
                        {showCqgPassword2 ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
                {/* Test CQG3 Trade button */}
                <div style={{ marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={handleTestCqg3Connection}
                    disabled={testingCqg3Connection || !cqgUsername2 || !cqgPassword2}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Play size={12} className={testingCqg3Connection ? 'animate-spin' : ''} />
                    {testingCqg3Connection ? 'Đang kiểm tra...' : 'Test CQG3 Trade'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* CAST, CCP & CE Config Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
          {/* CAST Config */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h4 style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#f43f5e',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '12px',
              margin: 0,
            }}>
              <Server size={18} />
              Cấu hình CQG CAST
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>CAST URL</label>
                <div style={{ position: 'relative' }}>
                  <Globe size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="url"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="https://www.cqgtrader.com/CAST/Logon/Logon.asp"
                    value={castUrl}
                    onChange={(e) => setCastUrl(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Username CAST</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Username..."
                    value={castUsername}
                    onChange={(e) => setCastUsername(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Mật khẩu CAST</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCastPassword ? 'text' : 'password'}
                      className="form-input"
                      style={{ paddingRight: '38px' }}
                      placeholder="Mật khẩu..."
                      value={castPassword}
                      onChange={(e) => setCastPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCastPassword(!showCastPassword)}
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
                      {showCastPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CCP Config */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h4 style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#ec4899',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '12px',
              margin: 0,
            }}>
              <Server size={18} />
              Cấu hình Core CCP
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>CCP URL</label>
                <div style={{ position: 'relative' }}>
                  <Globe size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="url"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="https://uat-coreccp.mxv.com.vn/"
                    value={cppUrl}
                    onChange={(e) => setCppUrl(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Username CCP</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Username..."
                    value={cppUsername}
                    onChange={(e) => setCppUsername(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Mật khẩu CCP</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCppPassword ? 'text' : 'password'}
                      className="form-input"
                      style={{ paddingRight: '38px' }}
                      placeholder="Mật khẩu..."
                      value={cppPassword}
                      onChange={(e) => setCppPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCppPassword(!showCppPassword)}
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
                      {showCppPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CE Config */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h4 style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '12px',
              margin: 0,
            }}>
              <Server size={18} />
              Cấu hình Core CE
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>CE URL</label>
                <div style={{ position: 'relative' }}>
                  <Globe size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="url"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="https://uat-coreexchange.mxv.com.vn/"
                    value={ceUrl}
                    onChange={(e) => setCeUrl(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Username CE</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Username..."
                    value={ceUsername}
                    onChange={(e) => setCeUsername(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Mật khẩu CE</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCePassword ? 'text' : 'password'}
                      className="form-input"
                      style={{ paddingRight: '38px' }}
                      placeholder="Mật khẩu..."
                      value={cePassword}
                      onChange={(e) => setCePassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCePassword(!showCePassword)}
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
                      {showCePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ACM Config */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <h4 style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '12px',
            margin: 0,
          }}>
            <Server size={18} />
            Cấu hình Cổng ACM & WinSCP SFTP
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', borderLeft: '3px solid #38bdf8', paddingLeft: '8px' }}>
                ACM Web Login
              </span>
              <div>
                <label style={labelStyle}>ACM URL</label>
                <div style={{ position: 'relative' }}>
                  <Globe size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="url"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="https://acm.member-url.vn/login"
                    value={acmUrl}
                    onChange={(e) => setAcmUrl(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Tên đăng nhập..."
                    value={acmUsername}
                    onChange={(e) => setAcmUsername(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Mật khẩu</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showAcmPassword ? 'text' : 'password'}
                      className="form-input"
                      style={{ paddingRight: '38px' }}
                      placeholder="Mật khẩu..."
                      value={acmPassword}
                      onChange={(e) => setAcmPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowAcmPassword(!showAcmPassword)}
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
                      {showAcmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>API Key giải Captcha (Gemini API)</label>
                <div style={{ position: 'relative' }}>
                  <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type={showAcmGeminiApiKey ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingLeft: '38px', paddingRight: '38px' }}
                    placeholder="Gemini API Key..."
                    value={acmGeminiApiKey}
                    onChange={(e) => setAcmGeminiApiKey(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAcmGeminiApiKey(!showAcmGeminiApiKey)}
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
                    {showAcmGeminiApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', borderLeft: '3px solid #10b981', paddingLeft: '8px' }}>
                SFTP Sync Configuration
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>SFTP Host</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="sftp.mxv.com.vn"
                    value={acmSftpHost}
                    onChange={(e) => setAcmSftpHost(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Port</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="2231"
                    value={acmSftpPort}
                    onChange={(e) => setAcmSftpPort(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>SFTP Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="SFTP User..."
                    value={acmSftpUsername}
                    onChange={(e) => setAcmSftpUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>SFTP Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showAcmSftpPassword ? 'text' : 'password'}
                      className="form-input"
                      style={{ paddingRight: '38px' }}
                      placeholder="SFTP Password..."
                      value={acmSftpPassword}
                      onChange={(e) => setAcmSftpPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAcmSftpPassword(!showAcmSftpPassword)}
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
                      {showAcmSftpPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Remote Directory Path</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="/data/"
                  value={acmSftpRemoteDir}
                  onChange={(e) => setAcmSftpRemoteDir(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Microsoft 365 Email Bot Config */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h4 style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '12px',
              margin: 0,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={18} />
                Cấu hình Đọc Email (M365 / Graph API)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {m365TokenRenewedAt && (
                  <span style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 500,
                  }} title="Thời gian cấp lại token gần nhất">
                    <Clock size={13} color="#10b981" />
                    <span>Cập nhật: </span>
                    <strong style={{ color: '#10b981' }}>{new Date(m365TokenRenewedAt).toLocaleString('vi-VN')}</strong>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleM365Reauthorize}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', cursor: 'pointer' }}
                  title="Đăng nhập Microsoft và cấp quyền lại cho hòm thư Bot để tự động đọc và tải file từ email"
                >
                  <Link2 size={12} />
                  Cấp quyền (Authorize)
                </button>
              </div>
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Watcher Email (Hòm thư của Bot)</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="it.support@mxv.vn"
                  value={m365WatcherEmail}
                  onChange={(e) => setM365WatcherEmail(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Client ID (App ID)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Application (client) ID..."
                    value={m365ClientId}
                    onChange={(e) => setM365ClientId(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Tenant ID (Directory ID)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Directory (tenant) ID..."
                    value={m365TenantId}
                    onChange={(e) => setM365TenantId(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Client Secret</label>
                <div style={{ position: 'relative' }}>
                  <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type={showM365ClientSecret ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingLeft: '38px', paddingRight: '38px' }}
                    placeholder="Client Secret Value..."
                    value={m365ClientSecret}
                    onChange={(e) => setM365ClientSecret(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowM365ClientSecret(!showM365ClientSecret)}
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
                    {showM365ClientSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Refresh Token (Có thể chỉnh sửa/cấu hình tay)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showM365RefreshToken ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingRight: '38px' }}
                    placeholder="M365 Refresh Token..."
                    value={m365RefreshToken}
                    onChange={(e) => setM365RefreshToken(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowM365RefreshToken(!showM365RefreshToken)}
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
                    {showM365RefreshToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Submit Save config button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            type="submit"
            disabled={anyTesting || savingConfig}
            className="btn btn-primary"
            style={{ padding: '12px 28px', fontSize: '0.85rem', fontWeight: 700 }}
          >
            <Save size={16} />
            {savingConfig ? 'Đang lưu...' : 'Lưu tất cả cấu hình tài khoản Bot'}
          </button>
        </div>
      </form>
    </div>
  );
}
