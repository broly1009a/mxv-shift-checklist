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
  Mail,
  Link2,
  TrendingUp,
  DownloadCloud,
  Folder,
  Zap,
  Shield,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Sliders,
  Layers,
} from 'lucide-react';
import SmartPathInput from '@/components/admin/SmartPathInput';
import { api } from '@/services/api';

interface ConnectionSettingsProps {
  token: string;
  apiBaseUrl: string;
  fetchJobs: () => Promise<void>;
}

interface AutomationSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  labelOn: string;
  labelOff: string;
  badgeOn?: string;
  badgeOff?: string;
  subtitle?: string;
  color?: string;
}

const AutomationSwitch: React.FC<AutomationSwitchProps> = ({
  checked,
  onChange,
  title,
  labelOn,
  labelOff,
  badgeOn,
  badgeOff,
  subtitle,
  color = '#10b981',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: checked
          ? 'rgba(16, 185, 129, 0.08)'
          : 'rgba(148, 163, 184, 0.06)',
        border: `1px solid ${checked ? 'rgba(16, 185, 129, 0.25)' : 'rgba(148, 163, 184, 0.2)'}`,
        borderRadius: '8px',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {title}
          </span>
          {checked && badgeOn && (
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Zap size={10} />
              {badgeOn}
            </span>
          )}
          {!checked && badgeOff && (
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(148, 163, 184, 0.15)',
                color: 'var(--text-muted)',
              }}
            >
              {badgeOff}
            </span>
          )}
        </div>
        <span style={{ fontSize: '0.7rem', color: checked ? color : 'var(--text-muted)' }}>
          {checked ? labelOn : labelOff}
          {subtitle && ` • ${subtitle}`}
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          position: 'relative',
          width: '46px',
          height: '24px',
          borderRadius: '12px',
          background: checked ? color : '#475569',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          transition: 'background 0.25s ease',
          outline: 'none',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: 'block',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
            transform: checked ? 'translateX(22px)' : 'translateX(0px)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </button>
    </div>
  );
};

export default function ConnectionSettings({
  token,
  apiBaseUrl,
  fetchJobs,
}: ConnectionSettingsProps) {
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Ingress Mode Automations (4 phân hệ hỗ trợ Direct REST API Adapter: MS, CCP, CE, ACM Web ETP)
  const [ingressModeMs, setIngressModeMs] = useState<'REST_API' | 'PLAYWRIGHT'>('REST_API');
  const [ingressModeCcp, setIngressModeCcp] = useState<'REST_API' | 'PLAYWRIGHT'>('REST_API');
  const [ingressModeCe, setIngressModeCe] = useState<'REST_API' | 'PLAYWRIGHT'>('REST_API');
  const [ingressModeAcm, setIngressModeAcm] = useState<'REST_API' | 'PLAYWRIGHT'>('REST_API');

  // Sub-tab cho CQG Card để giữ bố cục gọn gàng, không bị dài ngoặc
  const [cqgActiveTab, setCqgActiveTab] = useState<'trade' | 'price' | 'cast'>('trade');

  // M-System credentials states
  const [msystemUrl, setMsystemUrl] = useState('');
  const [msystemUsername, setMsystemUsername] = useState('');
  const [msystemPassword, setMsystemPassword] = useState('');
  const [msystemPin, setMsystemPin] = useState('');

  // CQG states
  const [cqgUrl, setCqgUrl] = useState('https://m.cqg.com/cqg/desktop/logon?ref=forced');
  const [cqgUrlPrice, setCqgUrlPrice] = useState('https://mdemo.cqg.com/cqg/desktop/logon?ref=forced');
  const [cqgUrlTrade, setCqgUrlTrade] = useState('https://m.cqg.com/cqg/desktop/logon?ref=forced');
  const [cqgUsername, setCqgUsername] = useState(''); // CQG Price (mxvprice)
  const [cqgPassword, setCqgPassword] = useState('');
  const [cqgUsername1, setCqgUsername1] = useState(''); // CQG1 Trade
  const [cqgPassword1, setCqgPassword1] = useState('');
  const [showCqgPassword1, setShowCqgPassword1] = useState(false);
  const [cqgUsername2, setCqgUsername2] = useState(''); // CQG3 Trade
  const [cqgPassword2, setCqgPassword2] = useState('');
  const [showCqgPassword2, setShowCqgPassword2] = useState(false);

  // ACM states
  const [acmUrl, setAcmUrl] = useState('');
  const [acmOrderUrl, setAcmOrderUrl] = useState('');
  const [acmFillUrl, setAcmFillUrl] = useState('');
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

  // CAST states
  const [castUrl, setCastUrl] = useState('');
  const [castUsername, setCastUsername] = useState('');
  const [castPassword, setCastPassword] = useState('');

  // CoreCCP states
  const [cppUrl, setCppUrl] = useState('');
  const [cppUsername, setCppUsername] = useState('');
  const [cppPassword, setCppPassword] = useState('');
  const [cppOutputDir, setCppOutputDir] = useState('backupCCP');

  // CoreEX states
  const [ceUrl, setCeUrl] = useState('');
  const [ceUsername, setCeUsername] = useState('');
  const [cePassword, setCePassword] = useState('');
  const [ceOutputDir, setCeOutputDir] = useState('backupCE');

  // M365 credentials states
  const [m365ClientId, setM365ClientId] = useState('');
  const [m365ClientSecret, setM365ClientSecret] = useState('');
  const [m365TenantId, setM365TenantId] = useState('');
  const [m365WatcherEmail, setM365WatcherEmail] = useState('');
  const [m365RefreshToken, setM365RefreshToken] = useState('');
  const [m365TokenRenewedAt, setM365TokenRenewedAt] = useState('');

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
      const data = await api.ingress.getBotConfig(token);
      if (data) {
        if (data.ingressModeMs) setIngressModeMs(data.ingressModeMs);
        if (data.ingressModeCcp) setIngressModeCcp(data.ingressModeCcp);
        if (data.ingressModeCe) setIngressModeCe(data.ingressModeCe);
        if (data.ingressModeAcm) setIngressModeAcm(data.ingressModeAcm);

        if (data.msystem) {
          setMsystemUrl(data.msystem.url || '');
          setMsystemUsername(data.msystem.username || '');
          setMsystemPassword(data.msystem.password || '');
          setMsystemPin(data.msystem.pin || '');
        }
        if (data.cqg) {
          setCqgUrl(data.cqg.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced');
          setCqgUrlPrice(data.cqg.urlPrice || data.cqg.url || 'https://mdemo.cqg.com/cqg/desktop/logon?ref=forced');
          setCqgUrlTrade(data.cqg.urlTrade || data.cqg.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced');
          setCqgUsername(data.cqg.username || '');
          setCqgPassword(data.cqg.password || '');
          setCqgUsername1(data.cqg.username1 || '');
          setCqgPassword1(data.cqg.password1 || '');
          setCqgUsername2(data.cqg.username2 || '');
          setCqgPassword2(data.cqg.password2 || '');
        }
        if (data.acm) {
          setAcmUrl(data.acm.url || '');
          setAcmOrderUrl(data.acm.orderUrl || '');
          setAcmFillUrl(data.acm.fillUrl || '');
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
          setCastUrl(data.cast.url || '');
          setCastUsername(data.cast.username || '');
          setCastPassword(data.cast.password || '');
        }
        if (data.ccp || data.cpp) {
          const c = data.ccp || data.cpp;
          setCppUrl(c.url || '');
          setCppUsername(c.username || '');
          setCppPassword(c.password || '');
          setCppOutputDir(c.outputDir || 'backupCCP');
        }
        if (data.ce) {
          setCeUrl(data.ce.url || '');
          setCeUsername(data.ce.username || '');
          setCePassword(data.ce.password || '');
          setCeOutputDir(data.ce.outputDir || 'backupCE');
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
    const toastId = toast.loading('Đang lưu cấu hình tài khoản & chế độ tự động...');

    try {
      await api.ingress.saveBotConfig(
        {
          ingressModeMs,
          ingressModeCcp,
          ingressModeCe,
          ingressModeAcm,
          msystem: {
            url: msystemUrl.trim(),
            username: msystemUsername.trim(),
            password: msystemPassword,
            pin: msystemPin,
          },
          cqg: {
            url: cqgUrlTrade.trim() || cqgUrl.trim(),
            urlPrice: cqgUrlPrice.trim(),
            urlTrade: cqgUrlTrade.trim(),
            username: cqgUsername.trim(),
            password: cqgPassword,
            username1: cqgUsername1.trim(),
            password1: cqgPassword1,
            username2: cqgUsername2.trim(),
            password2: cqgPassword2,
          },
          acm: {
            url: acmUrl.trim(),
            orderUrl: acmOrderUrl.trim(),
            fillUrl: acmFillUrl.trim(),
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
          ccp: {
            url: cppUrl.trim(),
            username: cppUsername.trim(),
            password: cppPassword,
            outputDir: cppOutputDir.trim(),
          },
          ce: {
            url: ceUrl.trim(),
            username: ceUsername.trim(),
            password: cePassword,
            outputDir: ceOutputDir.trim(),
          },
          m365: {
            clientId: m365ClientId.trim(),
            tenantId: m365TenantId.trim(),
            watcherEmail: m365WatcherEmail.trim(),
            clientSecret: m365ClientSecret.trim(),
            refreshToken: m365RefreshToken.trim(),
          },
        },
        token,
      );

      toast.success('Lưu cấu hình hệ thống & chế độ tự động thành công!', { id: toastId });
      fetchConfig();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu cấu hình', { id: toastId });
    } finally {
      setSavingConfig(false);
    }
  };

  // Connection testers
  const handleTestConnection = async () => {
    if (!token) return;
    setTestingConnection(true);
    const toastId = toast.loading('Đang kiểm tra kết nối M-System...');
    try {
      const data = await api.ingress.testConnectionMs({}, token);
      toast.success(data?.message || 'Kết nối M-System thành công!', { id: toastId });
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
    const toastId = toast.loading('Đang chạy thử đăng nhập CQG Price...');
    try {
      const data = await api.ingress.testConnectionCqg({}, token);
      toast.success(data?.message || 'Kết nối CQG Price thành công!', { id: toastId });
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
      const data = await api.ingress.testConnectionCqg1({}, token);
      toast.success(data?.message || 'Kết nối CQG1 Trade thành công!', { id: toastId });
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
      const data = await api.ingress.testConnectionCqg3({}, token);
      toast.success(data?.message || 'Kết nối CQG3 Trade thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm CQG3 Trade thất bại', { id: toastId });
    } finally {
      setTestingCqg3Connection(false);
    }
  };

  const handleTestAcmConnection = async () => {
    if (!token) return;
    setTestingAcmConnection(true);
    const toastId = toast.loading('Đang kiểm tra kết nối Straits ACM...');
    try {
      const data = await api.ingress.testConnectionAcm({}, token);
      toast.success(data?.message || 'Kết nối ACM thành công!', { id: toastId });
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
    const toastId = toast.loading('Đang kiểm tra kết nối CoreCCP...');
    try {
      const data = await api.ingress.testConnectionCcp({}, token);
      toast.success(data?.message || 'Kết nối CoreCCP thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm CoreCCP thất bại', { id: toastId });
    } finally {
      setTestingCppConnection(false);
    }
  };

  const handleTestCeConnection = async () => {
    if (!token) return;
    setTestingCeConnection(true);
    const toastId = toast.loading('Đang kiểm tra kết nối CoreEX...');
    try {
      const data = await api.ingress.testConnectionCe({}, token);
      toast.success(data?.message || 'Kết nối CoreEX thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm CoreEX thất bại', { id: toastId });
    } finally {
      setTestingCeConnection(false);
    }
  };

  const anyTesting =
    testingConnection ||
    testingCqgConnection ||
    testingCqg1Connection ||
    testingCqg3Connection ||
    testingAcmConnection ||
    testingCppConnection ||
    testingCeConnection ||
    savingConfig;

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  };

  if (loadingConfig) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="animate-spin" style={{ marginRight: '10px' }} />
        Đang nạp cấu hình tài khoản hệ thống...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
      {/* ── TOP ACTION BAR & OVERVIEW ── */}
      <div
        className="glass-panel"
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <Sliders size={20} style={{ color: 'var(--primary, #3b82f6)' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Cấu hình Kết nối & Tự động hóa Ingress
            </h3>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              Multi-System Synchronized
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            Quản lý credentials các phân hệ, chuyển mạch chế độ tự động Direct API/SFTP và kiểm tra kết nối thời gian thực.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={anyTesting}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Play size={12} className={testingConnection ? 'animate-spin' : ''} />
            Test MS
          </button>
          <button
            type="button"
            onClick={handleTestCqg1Connection}
            disabled={anyTesting}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Play size={12} className={testingCqg1Connection ? 'animate-spin' : ''} />
            Test CQG
          </button>
          <button
            type="button"
            onClick={handleTestCppConnection}
            disabled={anyTesting}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Play size={12} className={testingCppConnection ? 'animate-spin' : ''} />
            Test CoreCCP
          </button>
          <button
            type="button"
            onClick={handleTestCeConnection}
            disabled={anyTesting}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Play size={12} className={testingCeConnection ? 'animate-spin' : ''} />
            Test CoreEX
          </button>
          <button
            type="button"
            onClick={handleTestAcmConnection}
            disabled={anyTesting}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Play size={12} className={testingAcmConnection ? 'animate-spin' : ''} />
            Test ACM
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* ── 2-COLUMN BALANCED GRID ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', alignItems: 'start' }}>

          {/* ══════════════════════════════════════════════════════════
              CỘT TRÁI: CÁC PHÂN HỆ NỘI ĐỊA & SÀN MXV (MS, CCP, CE)
             ══════════════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* ── CARD 1: M-SYSTEM ── */}
            <div className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Server size={18} />
                  Cấu hình M-System (Newgen)
                </h4>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={anyTesting || !msystemUsername}
                  className="btn btn-xs btn-outline"
                  style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Play size={11} className={testingConnection ? 'animate-spin' : ''} />
                  Test MS
                </button>
              </div>

              {/* NÚT GẠT BẬT TẮT TỰ ĐỘNG M-SYSTEM */}
              <AutomationSwitch
                checked={ingressModeMs === 'REST_API'}
                onChange={(checked) => setIngressModeMs(checked ? 'REST_API' : 'PLAYWRIGHT')}
                title="Tự động hóa Direct REST API"
                labelOn="BẬT: Tải siêu tốc qua API Stream (0.8s, Không mở Browser)"
                labelOff="TẮT: Sử dụng trình duyệt Playwright Chromium để cào web"
                badgeOn="SIÊU TỐC"
                badgeOff="PLAYWRIGHT"
                color="#10b981"
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>M-System URL (Portal / API Gateway)</label>
                  <div style={{ position: 'relative' }}>
                    <Globe size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="url"
                      className="form-input"
                      style={{ paddingLeft: '38px' }}
                      placeholder="https://msadmin.mxv.com.vn/#/login"
                      value={msystemUrl}
                      onChange={(e) => setMsystemUrl(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Username M-System</label>
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
                        placeholder="Mã PIN 6 số..."
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

            {/* ── CARD 2: CORE CCP ── */}
            <div className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ec4899', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Server size={18} />
                  Cấu hình CoreCCP (VNCLEAR Clearing)
                </h4>
                <button
                  type="button"
                  onClick={handleTestCppConnection}
                  disabled={anyTesting || !cppUsername}
                  className="btn btn-xs btn-outline"
                  style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Play size={11} className={testingCppConnection ? 'animate-spin' : ''} />
                  Test CCP
                </button>
              </div>

              {/* NÚT GẠT BẬT TẮT TỰ ĐỘNG CORE CCP */}
              <AutomationSwitch
                checked={ingressModeCcp === 'REST_API'}
                onChange={(checked) => setIngressModeCcp(checked ? 'REST_API' : 'PLAYWRIGHT')}
                title="Tự động hóa Direct REST API"
                labelOn="BẬT: Tải báo cáo bù trừ trực tiếp qua REST API (1.2s)"
                labelOff="TẮT: Sử dụng trình duyệt Playwright Chromium"
                badgeOn="SIÊU TỐC"
                badgeOff="PLAYWRIGHT"
                color="#ec4899"
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>CoreCCP URL</label>
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
                      placeholder="Username CCP..."
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

                <div>
                  <SmartPathInput
                    value={cppOutputDir}
                    onChange={setCppOutputDir}
                    label="Thư mục lưu báo cáo CoreCCP (outputDir):"
                    placeholder="M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CCP\Futures (hoặc backupCCP)"
                    targetType="folder"
                    presets={[
                      { name: 'Mặc định ổ M Backup CCP', path: '' },
                      { name: 'Mặc định local (backupCCP)', path: 'backupCCP' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* ── CARD 3: CORE EXCHANGE (CE) ── */}
            <div className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Server size={18} />
                  Cấu hình Core Exchange (CE)
                </h4>
                <button
                  type="button"
                  onClick={handleTestCeConnection}
                  disabled={anyTesting || !ceUsername}
                  className="btn btn-xs btn-outline"
                  style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Play size={11} className={testingCeConnection ? 'animate-spin' : ''} />
                  Test CE
                </button>
              </div>

              {/* NÚT GẠT BẬT TẮT TỰ ĐỘNG CORE EX */}
              <AutomationSwitch
                checked={ingressModeCe === 'REST_API'}
                onChange={(checked) => setIngressModeCe(checked ? 'REST_API' : 'PLAYWRIGHT')}
                title="Tự động hóa Direct REST API"
                labelOn="BẬT: Tải báo cáo CE trực tiếp qua API OAuth2 Session (1.0s)"
                labelOff="TẮT: Sử dụng trình duyệt Playwright Chromium"
                badgeOn="SIÊU TỐC"
                badgeOff="PLAYWRIGHT"
                color="#8b5cf6"
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Core Exchange URL</label>
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
                      placeholder="Username CE..."
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

                <div>
                  <SmartPathInput
                    value={ceOutputDir}
                    onChange={setCeOutputDir}
                    label="Thư mục lưu báo cáo CoreEX (outputDir):"
                    placeholder="M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CE\Futures (hoặc backupCE)"
                    targetType="folder"
                    presets={[
                      { name: 'Mặc định ổ M Backup CE', path: 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CE\\Futures' },
                      { name: 'Mặc định local (backupCE)', path: 'backupCE' },
                    ]}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* ══════════════════════════════════════════════════════════
              CỘT PHẢI: CÁC PHÂN HỆ QUỐC TẾ (CQG ECOSYSTEM & ACM)
             ══════════════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* ── CARD 4: CQG ECOSYSTEM (TRADE, PRICE, CAST TÍCH HỢP SUB-TABS) ── */}
            <div className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Cpu size={18} />
                  Hệ thống CQG (Desktop & CAST)
                </h4>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                  }}
                >
                  Playwright Crawler
                </span>
              </div>

              {/* SUB-TABS NAVIGATION CHO CQG ĐỂ GIỮ CARD GỌN GÀNG */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  padding: '4px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCqgActiveTab('trade')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    fontWeight: cqgActiveTab === 'trade' ? 700 : 500,
                    background: cqgActiveTab === 'trade' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                    color: cqgActiveTab === 'trade' ? '#10b981' : 'var(--text-muted)',
                    border: cqgActiveTab === 'trade' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  <DownloadCloud size={13} />
                  CQG Trade (Tải Báo Cáo)
                </button>
                <button
                  type="button"
                  onClick={() => setCqgActiveTab('price')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    fontWeight: cqgActiveTab === 'price' ? 700 : 500,
                    background: cqgActiveTab === 'price' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                    color: cqgActiveTab === 'price' ? '#f59e0b' : 'var(--text-muted)',
                    border: cqgActiveTab === 'price' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  <TrendingUp size={13} />
                  CQG Price (Xem Giá)
                </button>
                <button
                  type="button"
                  onClick={() => setCqgActiveTab('cast')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    fontWeight: cqgActiveTab === 'cast' ? 700 : 500,
                    background: cqgActiveTab === 'cast' ? 'rgba(244, 63, 94, 0.2)' : 'transparent',
                    color: cqgActiveTab === 'cast' ? '#f43f5e' : 'var(--text-muted)',
                    border: cqgActiveTab === 'cast' ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid transparent',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  <Shield size={13} />
                  CQG CAST
                </button>
              </div>

              {/* TAB 1: CQG TRADE (TẢI BÁO CÁO FR/PS/OP) */}
              {cqgActiveTab === 'trade' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}>CQG Trade Desktop URL (Áp dụng cho CQG1 & CQG3)</label>
                    <div style={{ position: 'relative' }}>
                      <Globe size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="url"
                        className="form-input"
                        style={{ paddingLeft: '38px' }}
                        placeholder="https://m.cqg.com/cqg/desktop/logon?ref=forced"
                        value={cqgUrlTrade}
                        onChange={(e) => setCqgUrlTrade(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* TK 1 */}
                  <div style={{ border: '1px dashed rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(16, 185, 129, 0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Folder size={14} style={{ color: '#10b981' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
                          Tài khoản CQG1 (Tải: FR1, PS1, OP1, OD1)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleTestCqg1Connection}
                        disabled={testingCqg1Connection || !cqgUsername1}
                        className="btn btn-xs btn-outline"
                        style={{ fontSize: '0.7rem' }}
                      >
                        <Play size={10} className={testingCqg1Connection ? 'animate-spin' : ''} />
                        Test CQG1
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={labelStyle}>Username CQG1</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="CQG1 Username..."
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
                            placeholder="Mật khẩu..."
                            value={cqgPassword1}
                            onChange={(e) => setCqgPassword1(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setShowCqgPassword1(!showCqgPassword1)}
                            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            {showCqgPassword1 ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TK 2 */}
                  <div style={{ border: '1px dashed rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(16, 185, 129, 0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Folder size={14} style={{ color: '#10b981' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
                          Tài khoản CQG3 (Tải: FR2, PS2, OP2, OD2)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleTestCqg3Connection}
                        disabled={testingCqg3Connection || !cqgUsername2}
                        className="btn btn-xs btn-outline"
                        style={{ fontSize: '0.7rem' }}
                      >
                        <Play size={10} className={testingCqg3Connection ? 'animate-spin' : ''} />
                        Test CQG3
                      </button>
                    </div>
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
                            placeholder="Mật khẩu..."
                            value={cqgPassword2}
                            onChange={(e) => setCqgPassword2(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setShowCqgPassword2(!showCqgPassword2)}
                            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            {showCqgPassword2 ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CQG PRICE (MXVPRICE) */}
              {cqgActiveTab === 'price' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(245, 158, 11, 0.03)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Tài khoản xem giá thị trường & kiểm tra lệnh GTT (không dùng tải file khớp lệnh).
                  </span>
                  <div>
                    <label style={labelStyle}>CQG Price Desktop URL</label>
                    <div style={{ position: 'relative' }}>
                      <Globe size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="url"
                        className="form-input"
                        style={{ paddingLeft: '38px' }}
                        placeholder="https://mdemo.cqg.com/cqg/desktop/logon?ref=forced"
                        value={cqgUrlPrice}
                        onChange={(e) => setCqgUrlPrice(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Username CQG Price</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Mã giá (VD: mxvprice)..."
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
                          placeholder="Mật khẩu..."
                          value={cqgPassword}
                          onChange={(e) => setCqgPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCqgPassword(!showCqgPassword)}
                          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          {showCqgPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleTestCqgConnection}
                      disabled={testingCqgConnection || !cqgUsername}
                      className="btn btn-sm btn-outline"
                      style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Play size={12} className={testingCqgConnection ? 'animate-spin' : ''} />
                      Test CQG Price
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: CQG CAST */}
              {cqgActiveTab === 'cast' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(244, 63, 94, 0.03)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
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
                        placeholder="Username CAST..."
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
                          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          {showCastPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════
            HÀNG GIỮA (FULL-WIDTH): CỔNG ACM & WINSCP SFTP
           ══════════════════════════════════════════════════════════ */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Layers size={20} style={{ color: '#0ea5e9' }} />
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0ea5e9', margin: 0 }}>
                  Cấu hình Cổng ACM & WinSCP SFTP
                </h4>
                <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                  Quản lý 2 kênh độc lập: Cổng Web ETP (Báo cáo Orders & Trades) và Máy chủ SFTP (Đồng bộ Straits.csv)
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestAcmConnection}
              disabled={anyTesting}
              className="btn btn-xs btn-outline"
              style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Play size={11} className={testingAcmConnection ? 'animate-spin' : ''} />
              Test ACM
            </button>
          </div>

          {/* LƯỚI 2 CỘT SÓNG ĐÔI: ACM WEB LOGIN vs SFTP SYNC CONFIGURATION */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '24px', alignItems: 'start' }}>

            {/* ── CỘT 1: ACM WEB LOGIN (CỔNG ETP ORDERS & TRADES) ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(14, 165, 233, 0.03)', padding: '18px', borderRadius: '10px', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0ea5e9', borderLeft: '3px solid #0ea5e9', paddingLeft: '8px' }}>
                  ACM Web Login (Cổng ETP Orders & Trades)
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Xuất Sổ lệnh (tetporder) & Khớp lệnh (tetptrade)
                </span>
              </div>

              {/* NÚT GẠT CHUYỂN MẠCH DIRECT REST API (AcmEtpAdapter) */}
              <AutomationSwitch
                checked={ingressModeAcm === 'REST_API'}
                onChange={(checked) => setIngressModeAcm(checked ? 'REST_API' : 'PLAYWRIGHT')}
                title="Tự động hóa Direct REST API (AcmEtpAdapter)"
                labelOn="BẬT: API Stream kết hợp Gemini AI tự động giải Captcha (0.8s, Không mở Browser)"
                labelOff="TẮT: Sử dụng trình duyệt Playwright Chromium để cào web"
                badgeOn="DIRECT API"
                badgeOff="PLAYWRIGHT"
                color="#0ea5e9"
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>ACM URL</label>
                  <div style={{ position: 'relative' }}>
                    <Globe size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="url"
                      className="form-input"
                      style={{ paddingLeft: '38px' }}
                      placeholder="https://acm-etp.acmmex.com/exchange/index.html#/login"
                      value={acmUrl}
                      onChange={(e) => setAcmUrl(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>
                      URL Báo cáo Order <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(tùy chọn)</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Link2 size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        id="acm-order-url"
                        type="url"
                        className="form-input"
                        style={{ paddingLeft: '38px' }}
                        placeholder="Mặc định: ghép từ ACM URL + #/business-tetporder"
                        value={acmOrderUrl}
                        onChange={(e) => setAcmOrderUrl(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>
                      URL Báo cáo Fill/Trade <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(tùy chọn)</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Link2 size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        id="acm-fill-url"
                        type="url"
                        className="form-input"
                        style={{ paddingLeft: '38px' }}
                        placeholder="Mặc định: ghép từ ACM URL + #/business-tetptrade"
                        value={acmFillUrl}
                        onChange={(e) => setAcmFillUrl(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Username</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="MXVRO..."
                      value={acmUsername}
                      onChange={(e) => setAcmUsername(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Mật khẩu</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showAcmPassword ? 'text' : 'password'}
                        className="form-input"
                        style={{ paddingRight: '38px' }}
                        placeholder="Mật khẩu Web..."
                        value={acmPassword}
                        onChange={(e) => setAcmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAcmPassword(!showAcmPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
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
                      placeholder="AIzaSy..."
                      value={acmGeminiApiKey}
                      onChange={(e) => setAcmGeminiApiKey(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAcmGeminiApiKey(!showAcmGeminiApiKey)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {showAcmGeminiApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── CỘT 2: SFTP SYNC CONFIGURATION (ĐỒNG BỘ STRAITS.CSV) ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(16, 185, 129, 0.03)', padding: '18px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981', borderLeft: '3px solid #10b981', paddingLeft: '8px' }}>
                  SFTP Sync Configuration (Đồng bộ Straits.csv)
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  File đối chiếu cuối ngày ACM Nano
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>SFTP Host</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="127.0.0.1 hoặc sftp.mxv.com.vn"
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
                      placeholder="testuser / straits..."
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
                        placeholder="••••••••"
                        value={acmSftpPassword}
                        onChange={(e) => setAcmSftpPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAcmSftpPassword(!showAcmSftpPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
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
        </div>

        {/* ══════════════════════════════════════════════════════════
            HÀNG DƯỚI: HỘP THƯ MICROSOFT 365 (GRAPH API)
           ══════════════════════════════════════════════════════════ */}
        <div className="glass-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Mail size={18} />
              Cấu hình Hòm Thư Microsoft 365 (EOD Email Watcher)
            </h4>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {m365TokenRenewedAt && (
                <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={13} />
                  Token hoạt động: {new Date(m365TokenRenewedAt).toLocaleString('vi-VN')}
                </span>
              )}
              <button
                type="button"
                onClick={handleM365Reauthorize}
                className="btn btn-xs btn-outline"
                style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Link2 size={12} />
                Cấp quyền OAuth2
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Watcher Email (Hòm thư của Bot)</label>
              <input
                type="email"
                className="form-input"
                placeholder="hieptruong@mxv.vn..."
                value={m365WatcherEmail}
                onChange={(e) => setM365WatcherEmail(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Client Secret</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showM365ClientSecret ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingRight: '38px' }}
                    placeholder="Client Secret Value..."
                    value={m365ClientSecret}
                    onChange={(e) => setM365ClientSecret(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowM365ClientSecret(!showM365ClientSecret)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showM365ClientSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Refresh Token</label>
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
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showM365RefreshToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── STICKY BOTTOM SAVE ACTION BAR ── */}
        <div
          style={{
            position: 'sticky',
            bottom: '16px',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={18} style={{ color: '#38bdf8' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Mọi thay đổi thông tin xác thực và chế độ tự động hóa sẽ có hiệu lực ngay tại runtime mà không cần khởi động lại Server.
            </span>
          </div>

          <button
            type="submit"
            disabled={anyTesting || savingConfig}
            className="btn btn-primary"
            style={{
              padding: '12px 32px',
              fontSize: '0.88rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
            }}
          >
            <Save size={16} />
            {savingConfig ? 'Đang lưu cấu hình...' : 'Lưu tất cả cấu hình & Chế độ tự động'}
          </button>
        </div>
      </form>
    </div>
  );
}
