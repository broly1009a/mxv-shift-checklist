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

  // Test connection M-System
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
      if (!res.ok) {
        throw new Error(data.message || 'Đăng nhập thử nghiệm thất bại');
      }

      toast.success(data.message || 'Kết nối M-System thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm thất bại', { id: toastId });
    } finally {
      setTestingConnection(false);
    }
  };

  // Test CQG connection
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
      if (!res.ok) {
        throw new Error(data.message || 'Đăng nhập thử nghiệm CQG thất bại');
      }

      toast.success(data.message || 'Kết nối CQG thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm CQG thất bại', { id: toastId });
    } finally {
      setTestingCqgConnection(false);
    }
  };

  // Test ACM connection
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
      if (!res.ok) {
        throw new Error(data.message || 'Đăng nhập thử nghiệm ACM thất bại');
      }

      toast.success(data.message || 'Kết nối ACM thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm ACM thất bại', { id: toastId });
    } finally {
      setTestingAcmConnection(false);
    }
  };

  // Test CCP connection
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
      if (!res.ok) {
        throw new Error(data.message || 'Đăng nhập thử nghiệm CCP thất bại');
      }

      toast.success(data.message || 'Kết nối CCP thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm CCP thất bại', { id: toastId });
    } finally {
      setTestingCppConnection(false);
    }
  };

  // Test CE connection
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
      if (!res.ok) {
        throw new Error(data.message || 'Đăng nhập thử nghiệm CE thất bại');
      }

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
      <div className="flex items-center justify-center p-12 text-zinc-400">
        <Server className="animate-spin mr-3 text-emerald-500" size={24} />
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

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {/* Test Buttons Panel */}
      <div className="glass-panel p-6 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Kiểm tra kết nối tức thì</h3>
          <p className="text-xs text-zinc-400">Kích hoạt bot chạy headless để thử nghiệm đăng nhập trực tiếp.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={anyTesting}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Play size={14} className={testingConnection ? 'animate-spin' : ''} />
            M-System
          </button>
          <button
            type="button"
            onClick={handleTestCqgConnection}
            disabled={anyTesting}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Play size={14} className={testingCqgConnection ? 'animate-spin' : ''} />
            CQG Desktop
          </button>
          <button
            type="button"
            onClick={handleTestAcmConnection}
            disabled={anyTesting}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Play size={14} className={testingAcmConnection ? 'animate-spin' : ''} />
            ACM
          </button>
          <button
            type="button"
            onClick={handleTestCppConnection}
            disabled={anyTesting}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Play size={14} className={testingCppConnection ? 'animate-spin' : ''} />
            CCP
          </button>
          <button
            type="button"
            onClick={handleTestCeConnection}
            disabled={anyTesting}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Play size={14} className={testingCeConnection ? 'animate-spin' : ''} />
            CE
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveConfig} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* M-System Config */}
          <div className="glass-panel p-6 flex flex-col gap-4">
            <h4 className="text-md font-bold text-emerald-400 flex items-center gap-2 border-b border-zinc-800 pb-3">
              <Server size={18} />
              Cấu hình M-System
            </h4>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">M-System URL</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3.5 text-zinc-500" size={16} />
                  <input
                    type="url"
                    className="form-input pl-10"
                    placeholder="https://msystem.mxv.vn/"
                    value={msystemUrl}
                    onChange={(e) => setMsystemUrl(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Username</label>
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
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Mã PIN ảo</label>
                  <div className="relative">
                    <input
                      type={showMsystemPin ? 'text' : 'password'}
                      className="form-input pr-10"
                      placeholder="Mã PIN..."
                      value={msystemPin}
                      onChange={(e) => setMsystemPin(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowMsystemPin(!showMsystemPin)}
                      className="absolute right-3 top-3.5 text-zinc-500 hover:text-white"
                    >
                      {showMsystemPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Mật khẩu</label>
                <div className="relative">
                  <Key className="absolute left-3 top-3.5 text-zinc-500" size={16} />
                  <input
                    type={showMsystemPassword ? 'text' : 'password'}
                    className="form-input pl-10 pr-10"
                    placeholder="Mật khẩu..."
                    value={msystemPassword}
                    onChange={(e) => setMsystemPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowMsystemPassword(!showMsystemPassword)}
                    className="absolute right-3 top-3.5 text-zinc-500 hover:text-white"
                  >
                    {showMsystemPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CQG Desktop Config */}
          <div className="glass-panel p-6 flex flex-col gap-4">
            <h4 className="text-md font-bold text-amber-400 flex items-center gap-2 border-b border-zinc-800 pb-3">
              <Cpu size={18} />
              Cấu hình CQG Desktop
            </h4>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">CQG Desktop URL</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3.5 text-zinc-500" size={16} />
                  <input
                    type="url"
                    className="form-input pl-10"
                    placeholder="https://m.cqg.com/..."
                    value={cqgUrl}
                    onChange={(e) => setCqgUrl(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="CQG Username..."
                    value={cqgUsername}
                    onChange={(e) => setCqgUsername(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Mật khẩu</label>
                  <div className="relative">
                    <input
                      type={showCqgPassword ? 'text' : 'password'}
                      className="form-input pr-10"
                      placeholder="CQG Password..."
                      value={cqgPassword}
                      onChange={(e) => setCqgPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCqgPassword(!showCqgPassword)}
                      className="absolute right-3 top-3.5 text-zinc-500 hover:text-white"
                    >
                      {showCqgPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ACM Config */}
          <div className="glass-panel p-6 flex flex-col gap-4 md:col-span-2">
            <h4 className="text-md font-bold text-sky-400 flex items-center gap-2 border-b border-zinc-800 pb-3">
              <Server size={18} />
              Cấu hình Cổng ACM & WinSCP SFTP
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <span className="text-xs font-bold text-zinc-300 border-l-2 border-sky-400 pl-2">ACM Web Login</span>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">ACM URL</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3.5 text-zinc-500" size={16} />
                    <input
                      type="url"
                      className="form-input pl-10"
                      placeholder="https://acm.member-url.vn/login"
                      value={acmUrl}
                      onChange={(e) => setAcmUrl(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1">Username</label>
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
                    <label className="text-xs font-semibold text-zinc-400 block mb-1">Mật khẩu</label>
                    <div className="relative">
                      <input
                        type={showAcmPassword ? 'text' : 'password'}
                        className="form-input pr-10"
                        placeholder="Mật khẩu..."
                        value={acmPassword}
                        onChange={(e) => setAcmPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowAcmPassword(!showAcmPassword)}
                        className="absolute right-3 top-3.5 text-zinc-500 hover:text-white"
                      >
                        {showAcmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">API Key giải Captcha (Gemini API)</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3.5 text-zinc-500" size={16} />
                    <input
                      type={showAcmGeminiApiKey ? 'text' : 'password'}
                      className="form-input pl-10 pr-10"
                      placeholder="Gemini API Key..."
                      value={acmGeminiApiKey}
                      onChange={(e) => setAcmGeminiApiKey(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAcmGeminiApiKey(!showAcmGeminiApiKey)}
                      className="absolute right-3 top-3.5 text-zinc-500 hover:text-white"
                    >
                      {showAcmGeminiApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1">Download URL Path</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="/acm/report/download"
                      value={acmDownloadUrl}
                      onChange={(e) => setAcmDownloadUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1">Button Selector</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="#btnExportExcel"
                      value={acmDownloadBtnSelector}
                      onChange={(e) => setAcmDownloadBtnSelector(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-xs font-bold text-zinc-300 border-l-2 border-emerald-400 pl-2">SFTP Sync Configuration</span>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-zinc-400 block mb-1">SFTP Host</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="sftp.mxv.com.vn"
                      value={acmSftpHost}
                      onChange={(e) => setAcmSftpHost(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1">Port</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="2231"
                      value={acmSftpPort}
                      onChange={(e) => setAcmSftpPort(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1">SFTP Username</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="SFTP User..."
                      value={acmSftpUsername}
                      onChange={(e) => setAcmSftpUsername(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1">SFTP Password</label>
                    <div className="relative">
                      <input
                        type={showAcmSftpPassword ? 'text' : 'password'}
                        className="form-input pr-10"
                        placeholder="SFTP Password..."
                        value={acmSftpPassword}
                        onChange={(e) => setAcmSftpPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAcmSftpPassword(!showAcmSftpPassword)}
                        className="absolute right-3 top-3.5 text-zinc-500 hover:text-white"
                      >
                        {showAcmSftpPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Remote Directory Path</label>
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

          {/* CAST Config */}
          <div className="glass-panel p-6 flex flex-col gap-4">
            <h4 className="text-md font-bold text-orange-400 flex items-center gap-2 border-b border-zinc-800 pb-3">
              <Globe size={18} />
              CQG CAST Config
            </h4>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">CAST URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://www.cqgtrader.com/CAST/..."
                  value={castUrl}
                  onChange={(e) => setCastUrl(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="CAST Username..."
                    value={castUsername}
                    onChange={(e) => setCastUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Mật khẩu</label>
                  <div className="relative">
                    <input
                      type={showCastPassword ? 'text' : 'password'}
                      className="form-input pr-10"
                      placeholder="CAST Password..."
                      value={castPassword}
                      onChange={(e) => setCastPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCastPassword(!showCastPassword)}
                      className="absolute right-3 top-3.5 text-zinc-500 hover:text-white"
                    >
                      {showCastPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CPP & CE Config */}
          <div className="glass-panel p-6 flex flex-col gap-4">
            <h4 className="text-md font-bold text-violet-400 flex items-center gap-2 border-b border-zinc-800 pb-3">
              <Settings size={18} />
              Hệ thống CPP & CE
            </h4>
            <div className="flex flex-col gap-4">
              {/* CPP */}
              <div className="border-b border-zinc-800/40 pb-3 flex flex-col gap-2">
                <span className="text-xs font-bold text-violet-300">CPP (MM / CPP Check)</span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="url"
                    className="form-input col-span-2 text-xs"
                    placeholder="URL CPP..."
                    value={cppUrl}
                    onChange={(e) => setCppUrl(e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input text-xs"
                    placeholder="User CPP..."
                    value={cppUsername}
                    onChange={(e) => setCppUsername(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <input
                    type={showCppPassword ? 'text' : 'password'}
                    className="form-input pr-10 text-xs"
                    placeholder="Mật khẩu CPP..."
                    value={cppPassword}
                    onChange={(e) => setCppPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCppPassword(!showCppPassword)}
                    className="absolute right-3 top-3.5 text-zinc-500 hover:text-white"
                  >
                    {showCppPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* CE */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-cyan-300">CE (CE / EOD Check)</span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="url"
                    className="form-input col-span-2 text-xs"
                    placeholder="URL CE..."
                    value={ceUrl}
                    onChange={(e) => setCeUrl(e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input text-xs"
                    placeholder="User CE..."
                    value={ceUsername}
                    onChange={(e) => setCeUsername(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <input
                    type={showCePassword ? 'text' : 'password'}
                    className="form-input pr-10 text-xs"
                    placeholder="Mật khẩu CE..."
                    value={cePassword}
                    onChange={(e) => setCePassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCePassword(!showCePassword)}
                    className="absolute right-3 top-3.5 text-zinc-500 hover:text-white"
                  >
                    {showCePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scheduler config panel */}
        <div className="glass-panel p-6 flex flex-col gap-4">
          <h4 className="text-md font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Clock size={18} className="text-emerald-500" />
            Lập lịch chạy tự động (Scheduler)
          </h4>
          <div className="flex flex-col gap-3">
            {schedulerConfig.map((task, idx) => (
              <div
                key={task.id || idx}
                className="flex items-center justify-between bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg flex-wrap gap-3 hover:border-zinc-700 transition"
              >
                <div>
                  <h5 className="text-sm font-bold text-white">{task.name}</h5>
                  <span className="text-xs text-zinc-500">
                    Job Type: <code className="text-emerald-400">{task.jobType}</code>
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">Giờ chạy:</span>
                    <input
                      type="time"
                      className="form-input py-1.5 px-3 text-xs w-28"
                      value={task.time}
                      onChange={(e) => {
                        const updated = [...schedulerConfig];
                        updated[idx] = { ...updated[idx], time: e.target.value };
                        setSchedulerConfig(updated);
                      }}
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={task.enabled}
                      onChange={(e) => {
                        const updated = [...schedulerConfig];
                        updated[idx] = { ...updated[idx], enabled: e.target.checked };
                        setSchedulerConfig(updated);
                      }}
                      className="rounded border-zinc-800 text-emerald-500 focus:ring-emerald-500 bg-zinc-950"
                    />
                    Kích hoạt
                  </label>
                </div>
              </div>
            ))}
            {schedulerConfig.length === 0 && (
              <p className="text-center text-xs text-zinc-500 py-4">Không tìm thấy cấu hình lập lịch.</p>
            )}
          </div>
        </div>

        {/* Submit Save config button */}
        <div className="flex justify-end mt-4">
          <button
            type="submit"
            disabled={anyTesting}
            className="btn btn-primary py-3 px-8 flex items-center gap-2 text-sm font-bold shadow-lg"
          >
            <Save size={16} />
            Lưu tất cả cấu hình credentials & lập lịch
          </button>
        </div>
      </form>
    </div>
  );
}
