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
  const [cqgUsername, setCqgUsername] = useState('');
  const [cqgPassword, setCqgPassword] = useState('');
  const [cqgUsername2, setCqgUsername2] = useState('');
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

  // Connection testing states
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingCqgConnection, setTestingCqgConnection] = useState(false);
  const [testingAcmConnection, setTestingAcmConnection] = useState(false);
  const [testingCppConnection, setTestingCppConnection] = useState(false);
  const [testingCeConnection, setTestingCeConnection] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

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
    const toastId = toast.loading('Đang khởi chạy Browser Headless và chạy thử đăng nhập CQG...');
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/test-connection-cqg`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Đăng nhập thử nghiệm CQG thất bại');
      toast.success(data.message || 'Kết nối CQG thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm CQG thất bại', { id: toastId });
    } finally {
      setTestingCqgConnection(false);
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

               {/* CQG1 Account */}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', display: 'block', marginBottom: '8px' }}>
                  Tài khoản CQG1 (mxvprice)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Username CQG1</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="CQG1 Username..."
                      value={cqgUsername}
                      onChange={(e) => setCqgUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Mật khẩu CQG1</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCqgPassword ? 'text' : 'password'}
                        className="form-input"
                        style={{ paddingRight: '38px' }}
                        placeholder="CQG1 Password..."
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

              {/* CQG3 Account */}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', display: 'block', marginBottom: '8px' }}>
                  Tài khoản CQG3
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
