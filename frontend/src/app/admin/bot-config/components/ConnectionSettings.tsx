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
  Shield,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Layers,
  Table,
  LayoutGrid,
  Edit3,
  X,
  Lock,
  Check,
  ExternalLink,
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
              <Check size={10} />
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

  // Chế độ xem: 'table' (Mặc định doanh nghiệp) vs 'cards' (Chi tiết mở rộng)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Trạng thái Modal
  const [viewingSystem, setViewingSystem] = useState<'msystem' | 'cqg' | 'ccp' | 'ce' | 'acm' | 'm365' | null>(null);
  const [editingSystem, setEditingSystem] = useState<'msystem' | 'cqg' | 'ccp' | 'ce' | 'acm' | 'm365' | null>(null);

  // Phương thức kết nối (4 phân hệ hỗ trợ Direct API Adapter: MS, CCP, CE, ACM Web ETP)
  const [ingressModeMs, setIngressModeMs] = useState<'REST_API' | 'PLAYWRIGHT'>('REST_API');
  const [ingressModeCcp, setIngressModeCcp] = useState<'REST_API' | 'PLAYWRIGHT'>('REST_API');
  const [ingressModeCe, setIngressModeCe] = useState<'REST_API' | 'PLAYWRIGHT'>('REST_API');
  const [ingressModeAcm, setIngressModeAcm] = useState<'REST_API' | 'PLAYWRIGHT'>('REST_API');

  // Sub-tab cho CQG Card để giữ bố cục gọn gàng
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

  // Chuyển đổi phương thức kết nối nhanh ngay trên dòng Bảng
  const handleToggleIngress = async (
    systemKey: 'ms' | 'ccp' | 'ce' | 'acm',
    newMode: 'REST_API' | 'PLAYWRIGHT'
  ) => {
    if (systemKey === 'ms') setIngressModeMs(newMode);
    if (systemKey === 'ccp') setIngressModeCcp(newMode);
    if (systemKey === 'ce') setIngressModeCe(newMode);
    if (systemKey === 'acm') setIngressModeAcm(newMode);

    try {
      await api.ingress.saveBotConfig(
        {
          ingressModeMs: systemKey === 'ms' ? newMode : ingressModeMs,
          ingressModeCcp: systemKey === 'ccp' ? newMode : ingressModeCcp,
          ingressModeCe: systemKey === 'ce' ? newMode : ingressModeCe,
          ingressModeAcm: systemKey === 'acm' ? newMode : ingressModeAcm,
        },
        token,
      );
      toast.success(
        `Đã chuyển phương thức kết nối sang: ${newMode === 'REST_API' ? 'API Trực tiếp' : 'Trình duyệt tự động'}`,
      );
    } catch (err: any) {
      toast.error('Lỗi khi lưu phương thức kết nối: ' + err.message);
    }
  };

  // Save configurations
  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token) return;
    setSavingConfig(true);
    const toastId = toast.loading('Đang lưu cấu hình tài khoản kết nối...');

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
            url: cqgUrl.trim(),
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
            geminiApiKey: acmGeminiApiKey.trim(),
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

      toast.success('Lưu cấu hình hệ thống thành công!', { id: toastId });
      fetchConfig();
      if (editingSystem) setEditingSystem(null);
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
    testingCeConnection;

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    boxShadow: 'var(--shadow-sm)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const modalBackdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflowY: 'auto',
    zIndex: 9999,
    padding: '20px',
  };

  const modalContentStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '680px',
    background: 'var(--bg-app)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '26px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    margin: 'auto',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
    maxHeight: '90vh',
    overflowY: 'auto',
  };

  // Helper render badge phương thức
  const renderMethodBadge = (mode: 'REST_API' | 'PLAYWRIGHT', color: string = '#10b981') => {
    const isApi = mode === 'REST_API';
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '0.72rem',
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: '6px',
          background: isApi ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
          color: isApi ? color : 'var(--text-muted)',
          border: `1px solid ${isApi ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.25)'}`,
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: isApi ? color : 'var(--text-muted)',
          }}
        />
        {isApi ? 'API Trực tiếp' : 'Trình duyệt tự động'}
      </span>
    );
  };

  if (loadingConfig) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
        <span>Đang tải cấu hình kết nối hệ thống...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── THANH TIÊU ĐỀ DOANH NGHIỆP & CHUYỂN ĐỔI CHẾ ĐỘ XEM ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '16px 20px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Cấu hình Tài khoản Kết nối Hệ thống
            </h3>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.25)',
              }}
            >
              Đồng bộ Đa Hệ thống
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
            Quản lý thông tin xác thực máy chủ và phương thức thu thập dữ liệu (API Trực tiếp hoặc Trình duyệt) cho từng phân hệ nghiệp vụ.
          </p>
        </div>

        {/* NÚT CHUYỂN CHẾ ĐỘ XEM (BẢNG VS THẺ) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '0.78rem',
                fontWeight: viewMode === 'table' ? 700 : 500,
                background: viewMode === 'table' ? 'var(--color-accent)' : 'transparent',
                color: viewMode === 'table' ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Table size={14} />
              Dạng Bảng (Khuyên dùng)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '0.78rem',
                fontWeight: viewMode === 'cards' ? 700 : 500,
                background: viewMode === 'cards' ? 'var(--color-accent)' : 'transparent',
                color: viewMode === 'cards' ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <LayoutGrid size={14} />
              Dạng Thẻ Đầy Đủ
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          CHẾ ĐỘ XEM 1: DẠNG BẢNG & CỘT (TABLE VIEW) - CHUẨN DOANH NGHIỆP
         ══════════════════════════════════════════════════════════ */}
      {viewMode === 'table' && (
        <div className="glass-panel" style={{ padding: '0px', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '14px 18px', width: '25%' }}>Hệ thống Nghiệp vụ</th>
                  <th style={{ padding: '14px 18px', width: '22%' }}>Phương thức Thu thập</th>
                  <th style={{ padding: '14px 18px', width: '25%' }}>Tài khoản & Máy chủ Kết nối</th>
                  <th style={{ padding: '14px 18px', width: '13%' }}>Kiểm tra Kết nối</th>
                  <th style={{ padding: '14px 18px', width: '15%', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {/* 1. M-SYSTEM */}
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.005)' }}>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                        <Server size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>M-System (Newgen)</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quản trị & Giám sát Giao dịch MXV</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={ingressModeMs === 'REST_API'}
                        onClick={() => handleToggleIngress('ms', ingressModeMs === 'REST_API' ? 'PLAYWRIGHT' : 'REST_API')}
                        style={{
                          position: 'relative',
                          width: '40px',
                          height: '22px',
                          borderRadius: '11px',
                          background: ingressModeMs === 'REST_API' ? '#10b981' : '#475569',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          transition: 'background 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            transform: ingressModeMs === 'REST_API' ? 'translateX(18px)' : 'translateX(0px)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                      {renderMethodBadge(ingressModeMs, '#10b981')}
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                        <Globe size={13} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontWeight: 600 }}>{msystemUsername || <em style={{ color: 'var(--text-muted)' }}>Chưa cấu hình</em>}</span>
                        {msystemPassword && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>• Mật khẩu: ••••••••</span>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                        {msystemUrl || 'https://msadmin.mxv.com.vn'}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={anyTesting || !msystemUsername}
                      className="btn btn-xs btn-outline"
                      style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Play size={10} className={testingConnection ? 'animate-spin' : ''} />
                      Kiểm tra
                    </button>
                  </td>
                  <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setViewingSystem('msystem')}
                        className="btn btn-xs btn-secondary"
                        style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={12} />
                        Xem
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSystem('msystem')}
                        className="btn btn-xs btn-primary"
                        style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit3 size={12} />
                        Sửa
                      </button>
                    </div>
                  </td>
                </tr>

                {/* 2. CQG DESKTOP */}
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.005)' }}>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flexShrink: 0 }}>
                        <DownloadCloud size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Hệ thống CQG (Quốc tế)</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cổng Dữ liệu CME / CBOT (Desktop & CAST)</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'rgba(245, 158, 11, 0.12)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                      }}
                    >
                      Trình duyệt tự động (2 tài khoản song song)
                    </span>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', gap: '6px' }}>
                        <span>TK1: <strong>{cqgUsername1 || 'Chưa cấu hình'}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>|</span>
                        <span>TK2: <strong>{cqgUsername2 || 'Chưa cấu hình'}</strong></span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Giá: {cqgUsername || 'mxvprice'} • CAST: {castUsername || 'Chưa có'}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <button
                      type="button"
                      onClick={handleTestCqg1Connection}
                      disabled={anyTesting || !cqgUsername1}
                      className="btn btn-xs btn-outline"
                      style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Play size={10} className={testingCqg1Connection ? 'animate-spin' : ''} />
                      Kiểm tra
                    </button>
                  </td>
                  <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setViewingSystem('cqg')}
                        className="btn btn-xs btn-secondary"
                        style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={12} />
                        Xem
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSystem('cqg')}
                        className="btn btn-xs btn-primary"
                        style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit3 size={12} />
                        Sửa
                      </button>
                    </div>
                  </td>
                </tr>

                {/* 3. CORECCP */}
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.005)' }}>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899', flexShrink: 0 }}>
                        <Shield size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>CoreCCP (VNCLEAR Clearing)</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hệ thống Bù trừ & Quản lý Ký quỹ</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={ingressModeCcp === 'REST_API'}
                        onClick={() => handleToggleIngress('ccp', ingressModeCcp === 'REST_API' ? 'PLAYWRIGHT' : 'REST_API')}
                        style={{
                          position: 'relative',
                          width: '40px',
                          height: '22px',
                          borderRadius: '11px',
                          background: ingressModeCcp === 'REST_API' ? '#ec4899' : '#475569',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          transition: 'background 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            transform: ingressModeCcp === 'REST_API' ? 'translateX(18px)' : 'translateX(0px)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                      {renderMethodBadge(ingressModeCcp, '#ec4899')}
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {cppUsername || <em style={{ color: 'var(--text-muted)' }}>Chưa cấu hình</em>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                        {cppUrl || 'https://uat-coreccp.mxv.com.vn'}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <button
                      type="button"
                      onClick={handleTestCppConnection}
                      disabled={anyTesting || !cppUsername}
                      className="btn btn-xs btn-outline"
                      style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Play size={10} className={testingCppConnection ? 'animate-spin' : ''} />
                      Kiểm tra
                    </button>
                  </td>
                  <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setViewingSystem('ccp')}
                        className="btn btn-xs btn-secondary"
                        style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={12} />
                        Xem
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSystem('ccp')}
                        className="btn btn-xs btn-primary"
                        style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit3 size={12} />
                        Sửa
                      </button>
                    </div>
                  </td>
                </tr>

                {/* 4. CORE EXCHANGE (CE) */}
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.005)' }}>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6', flexShrink: 0 }}>
                        <Cpu size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Core Exchange (CE)</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hệ thống Khớp lệnh & Sàn Giao dịch</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={ingressModeCe === 'REST_API'}
                        onClick={() => handleToggleIngress('ce', ingressModeCe === 'REST_API' ? 'PLAYWRIGHT' : 'REST_API')}
                        style={{
                          position: 'relative',
                          width: '40px',
                          height: '22px',
                          borderRadius: '11px',
                          background: ingressModeCe === 'REST_API' ? '#8b5cf6' : '#475569',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          transition: 'background 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            transform: ingressModeCe === 'REST_API' ? 'translateX(18px)' : 'translateX(0px)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                      {renderMethodBadge(ingressModeCe, '#8b5cf6')}
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {ceUsername || <em style={{ color: 'var(--text-muted)' }}>Chưa cấu hình</em>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                        {ceUrl || 'https://corex.mxv.com.vn'}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <button
                      type="button"
                      onClick={handleTestCeConnection}
                      disabled={anyTesting || !ceUsername}
                      className="btn btn-xs btn-outline"
                      style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Play size={10} className={testingCeConnection ? 'animate-spin' : ''} />
                      Kiểm tra
                    </button>
                  </td>
                  <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setViewingSystem('ce')}
                        className="btn btn-xs btn-secondary"
                        style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={12} />
                        Xem
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSystem('ce')}
                        className="btn btn-xs btn-primary"
                        style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit3 size={12} />
                        Sửa
                      </button>
                    </div>
                  </td>
                </tr>

                {/* 5. ACM & SFTP */}
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.005)' }}>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9', flexShrink: 0 }}>
                        <Globe size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Cổng Đối tác ACM & SFTP</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Báo cáo Straits CSV & Cổng ETP Orders/Trades</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={ingressModeAcm === 'REST_API'}
                          onClick={() => handleToggleIngress('acm', ingressModeAcm === 'REST_API' ? 'PLAYWRIGHT' : 'REST_API')}
                          style={{
                            position: 'relative',
                            width: '36px',
                            height: '20px',
                            borderRadius: '10px',
                            background: ingressModeAcm === 'REST_API' ? '#0ea5e9' : '#475569',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px',
                            transition: 'background 0.2s',
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              display: 'block',
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              background: '#ffffff',
                              transform: ingressModeAcm === 'REST_API' ? 'translateX(16px)' : 'translateX(0px)',
                              transition: 'transform 0.2s',
                            }}
                          />
                        </button>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: ingressModeAcm === 'REST_API' ? '#0ea5e9' : 'var(--text-muted)' }}>
                          ETP: {ingressModeAcm === 'REST_API' ? 'API Trực tiếp' : 'Trình duyệt'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Straits: Giao thức SFTP (Port {acmSftpPort})
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        ETP: <strong>{acmUsername || 'Chưa cấu hình'}</strong>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        SFTP: {acmSftpUsername || 'Chưa cấu hình'} @ {acmSftpHost}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <button
                      type="button"
                      onClick={handleTestAcmConnection}
                      disabled={anyTesting || (!acmUsername && !acmSftpUsername)}
                      className="btn btn-xs btn-outline"
                      style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Play size={10} className={testingAcmConnection ? 'animate-spin' : ''} />
                      Kiểm tra
                    </button>
                  </td>
                  <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setViewingSystem('acm')}
                        className="btn btn-xs btn-secondary"
                        style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={12} />
                        Xem
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSystem('acm')}
                        className="btn btn-xs btn-primary"
                        style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit3 size={12} />
                        Sửa
                      </button>
                    </div>
                  </td>
                </tr>

                {/* 6. MICROSOFT 365 */}
                <tr style={{ background: 'rgba(255, 255, 255, 0.005)' }}>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}>
                        <Mail size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Microsoft 365 Watcher</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Giám sát & Bóc tách Hòm thư Báo cáo EOD</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: '#3b82f6',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                      }}
                    >
                      Microsoft Graph API
                    </span>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {m365WatcherEmail || <em style={{ color: 'var(--text-muted)' }}>Chưa cấu hình email</em>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: m365RefreshToken ? '#10b981' : '#f59e0b' }}>
                        {m365RefreshToken ? 'Đã liên kết OAuth2 hợp lệ' : 'Chưa cấp quyền đăng nhập'}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 18px' }}>
                    <button
                      type="button"
                      onClick={handleM365Reauthorize}
                      className="btn btn-xs btn-outline"
                      style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Link2 size={10} />
                      Cấp quyền
                    </button>
                  </td>
                  <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setViewingSystem('m365')}
                        className="btn btn-xs btn-secondary"
                        style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={12} />
                        Xem
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSystem('m365')}
                        className="btn btn-xs btn-primary"
                        style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit3 size={12} />
                        Sửa
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          CHẾ ĐỘ XEM 2: DẠNG THẺ (CARD VIEW) - TOÀN BỘ VĂN PHONG DOANH NGHIỆP
         ══════════════════════════════════════════════════════════ */}
      {viewMode === 'cards' && (
        <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', alignItems: 'start' }}>
            {/* CỘT TRÁI */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* CARD M-SYSTEM */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Server size={18} style={{ color: '#10b981' }} />
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Cấu hình M-System (Newgen)
                    </h4>
                  </div>
                  <button type="button" onClick={handleTestConnection} disabled={anyTesting} className="btn btn-xs btn-outline" style={{ fontSize: '0.72rem' }}>
                    <Play size={10} className={testingConnection ? 'animate-spin' : ''} /> Test MS
                  </button>
                </div>

                <AutomationSwitch
                  checked={ingressModeMs === 'REST_API'}
                  onChange={(checked) => setIngressModeMs(checked ? 'REST_API' : 'PLAYWRIGHT')}
                  title="Phương thức kết nối"
                  labelOn="API Trực tiếp: Kết nối và nhận dữ liệu trực tiếp từ cổng dịch vụ"
                  labelOff="Trình duyệt tự động: Khởi chạy trình duyệt mô phỏng thao tác người dùng (Dự phòng)"
                  badgeOn="API TRỰC TIẾP"
                  badgeOff="TRÌNH DUYỆT TỰ ĐỘNG"
                  color="#10b981"
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>M-System URL (Portal / Gateway)</label>
                    <input type="url" className="form-input" placeholder="https://msadmin.mxv.com.vn/#/login" value={msystemUrl} onChange={(e) => setMsystemUrl(e.target.value)} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Tên đăng nhập</label>
                      <input type="text" className="form-input" placeholder="Username..." value={msystemUsername} onChange={(e) => setMsystemUsername(e.target.value)} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Mã PIN xác thực</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showMsystemPin ? 'text' : 'password'} className="form-input" style={{ paddingRight: '36px' }} placeholder="Mã PIN..." value={msystemPin} onChange={(e) => setMsystemPin(e.target.value)} required />
                        <button type="button" onClick={() => setShowMsystemPin(!showMsystemPin)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                          {showMsystemPin ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Mật khẩu</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showMsystemPassword ? 'text' : 'password'} className="form-input" style={{ paddingRight: '36px' }} placeholder="Mật khẩu..." value={msystemPassword} onChange={(e) => setMsystemPassword(e.target.value)} required />
                      <button type="button" onClick={() => setShowMsystemPassword(!showMsystemPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        {showMsystemPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD CORECCP */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Shield size={18} style={{ color: '#ec4899' }} />
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Cấu hình CoreCCP (VNCLEAR Clearing)
                    </h4>
                  </div>
                  <button type="button" onClick={handleTestCppConnection} disabled={anyTesting} className="btn btn-xs btn-outline" style={{ fontSize: '0.72rem' }}>
                    <Play size={10} className={testingCppConnection ? 'animate-spin' : ''} /> Test CCP
                  </button>
                </div>

                <AutomationSwitch
                  checked={ingressModeCcp === 'REST_API'}
                  onChange={(checked) => setIngressModeCcp(checked ? 'REST_API' : 'PLAYWRIGHT')}
                  title="Phương thức kết nối"
                  labelOn="API Trực tiếp: Tải dữ liệu bù trừ qua cổng REST API"
                  labelOff="Trình duyệt tự động: Khởi chạy trình duyệt tự động (Dự phòng)"
                  badgeOn="API TRỰC TIẾP"
                  badgeOff="TRÌNH DUYỆT TỰ ĐỘNG"
                  color="#ec4899"
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>CoreCCP URL</label>
                    <input type="url" className="form-input" placeholder="https://uat-coreccp.mxv.com.vn" value={cppUrl} onChange={(e) => setCppUrl(e.target.value)} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Tên đăng nhập</label>
                      <input type="text" className="form-input" placeholder="Username..." value={cppUsername} onChange={(e) => setCppUsername(e.target.value)} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Mật khẩu</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showCppPassword ? 'text' : 'password'} className="form-input" style={{ paddingRight: '36px' }} placeholder="Mật khẩu..." value={cppPassword} onChange={(e) => setCppPassword(e.target.value)} required />
                        <button type="button" onClick={() => setShowCppPassword(!showCppPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                          {showCppPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD CORE EXCHANGE */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Cpu size={18} style={{ color: '#8b5cf6' }} />
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Cấu hình Core Exchange (CE)
                    </h4>
                  </div>
                  <button type="button" onClick={handleTestCeConnection} disabled={anyTesting} className="btn btn-xs btn-outline" style={{ fontSize: '0.72rem' }}>
                    <Play size={10} className={testingCeConnection ? 'animate-spin' : ''} /> Test CE
                  </button>
                </div>

                <AutomationSwitch
                  checked={ingressModeCe === 'REST_API'}
                  onChange={(checked) => setIngressModeCe(checked ? 'REST_API' : 'PLAYWRIGHT')}
                  title="Phương thức kết nối"
                  labelOn="API Trực tiếp: Tải dữ liệu qua cổng API OAuth2 Session"
                  labelOff="Trình duyệt tự động: Khởi chạy trình duyệt tự động (Dự phòng)"
                  badgeOn="API TRỰC TIẾP"
                  badgeOff="TRÌNH DUYỆT TỰ ĐỘNG"
                  color="#8b5cf6"
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Core Exchange URL</label>
                    <input type="url" className="form-input" placeholder="https://corex.mxv.com.vn" value={ceUrl} onChange={(e) => setCeUrl(e.target.value)} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Tên đăng nhập</label>
                      <input type="text" className="form-input" placeholder="Username..." value={ceUsername} onChange={(e) => setCeUsername(e.target.value)} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Mật khẩu</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showCePassword ? 'text' : 'password'} className="form-input" style={{ paddingRight: '36px' }} placeholder="Mật khẩu..." value={cePassword} onChange={(e) => setCePassword(e.target.value)} required />
                        <button type="button" onClick={() => setShowCePassword(!showCePassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                          {showCePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI: CQG */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <DownloadCloud size={18} style={{ color: '#f59e0b' }} />
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Hệ thống CQG (Desktop & CAST)
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                    Trình duyệt tự động
                  </span>
                </div>

                {/* Sub-tabs CQG */}
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(15, 23, 42, 0.4)', padding: '4px', borderRadius: '8px' }}>
                  <button type="button" onClick={() => setCqgActiveTab('trade')} style={{ flex: 1, padding: '7px 10px', fontSize: '0.75rem', fontWeight: cqgActiveTab === 'trade' ? 700 : 500, background: cqgActiveTab === 'trade' ? 'rgba(16, 185, 129, 0.2)' : 'transparent', color: cqgActiveTab === 'trade' ? '#10b981' : 'var(--text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    CQG Trade (Tải Báo Cáo)
                  </button>
                  <button type="button" onClick={() => setCqgActiveTab('price')} style={{ flex: 1, padding: '7px 10px', fontSize: '0.75rem', fontWeight: cqgActiveTab === 'price' ? 700 : 500, background: cqgActiveTab === 'price' ? 'rgba(245, 158, 11, 0.2)' : 'transparent', color: cqgActiveTab === 'price' ? '#f59e0b' : 'var(--text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    CQG Price (Xem Giá)
                  </button>
                  <button type="button" onClick={() => setCqgActiveTab('cast')} style={{ flex: 1, padding: '7px 10px', fontSize: '0.75rem', fontWeight: cqgActiveTab === 'cast' ? 700 : 500, background: cqgActiveTab === 'cast' ? 'rgba(244, 63, 94, 0.2)' : 'transparent', color: cqgActiveTab === 'cast' ? '#f43f5e' : 'var(--text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    CQG CAST
                  </button>
                </div>

                {cqgActiveTab === 'trade' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={labelStyle}>CQG Trade Desktop URL</label>
                      <input type="url" className="form-input" value={cqgUrlTrade} onChange={(e) => setCqgUrlTrade(e.target.value)} required />
                    </div>
                    {/* TK1 */}
                    <div style={{ border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '12px', background: 'rgba(16, 185, 129, 0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981' }}>Tài khoản CQG1 (FR1, PS1, OP1)</span>
                        <button type="button" onClick={handleTestCqg1Connection} disabled={anyTesting} className="btn btn-xs btn-outline" style={{ fontSize: '0.7rem' }}>Test CQG1</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <input type="text" className="form-input" placeholder="Username..." value={cqgUsername1} onChange={(e) => setCqgUsername1(e.target.value)} />
                        <div style={{ position: 'relative' }}>
                          <input type={showCqgPassword1 ? 'text' : 'password'} className="form-input" placeholder="Mật khẩu..." value={cqgPassword1} onChange={(e) => setCqgPassword1(e.target.value)} />
                          <button type="button" onClick={() => setShowCqgPassword1(!showCqgPassword1)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                            {showCqgPassword1 ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* TK2 */}
                    <div style={{ border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '12px', background: 'rgba(16, 185, 129, 0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981' }}>Tài khoản CQG3 (FR2, PS2, OP2)</span>
                        <button type="button" onClick={handleTestCqg3Connection} disabled={anyTesting} className="btn btn-xs btn-outline" style={{ fontSize: '0.7rem' }}>Test CQG3</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <input type="text" className="form-input" placeholder="Username..." value={cqgUsername2} onChange={(e) => setCqgUsername2(e.target.value)} />
                        <div style={{ position: 'relative' }}>
                          <input type={showCqgPassword2 ? 'text' : 'password'} className="form-input" placeholder="Mật khẩu..." value={cqgPassword2} onChange={(e) => setCqgPassword2(e.target.value)} />
                          <button type="button" onClick={() => setShowCqgPassword2(!showCqgPassword2)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                            {showCqgPassword2 ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {cqgActiveTab === 'price' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>CQG Price Desktop URL</label>
                      <input type="url" className="form-input" value={cqgUrlPrice} onChange={(e) => setCqgUrlPrice(e.target.value)} required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <input type="text" className="form-input" placeholder="Username (mxvprice)..." value={cqgUsername} onChange={(e) => setCqgUsername(e.target.value)} />
                      <input type={showCqgPassword ? 'text' : 'password'} className="form-input" placeholder="Mật khẩu..." value={cqgPassword} onChange={(e) => setCqgPassword(e.target.value)} />
                    </div>
                  </div>
                )}

                {cqgActiveTab === 'cast' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>CAST URL</label>
                      <input type="url" className="form-input" value={castUrl} onChange={(e) => setCastUrl(e.target.value)} required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <input type="text" className="form-input" placeholder="Username CAST..." value={castUsername} onChange={(e) => setCastUsername(e.target.value)} />
                      <input type={showCastPassword ? 'text' : 'password'} className="form-input" placeholder="Mật khẩu..." value={castPassword} onChange={(e) => setCastPassword(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* KHỐI FULL-WIDTH: CỔNG ACM & SFTP */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Globe size={18} style={{ color: '#0ea5e9' }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Cấu hình Cổng ACM & WinSCP SFTP (Straits)
                </h4>
              </div>
              <button type="button" onClick={handleTestAcmConnection} disabled={anyTesting} className="btn btn-xs btn-outline" style={{ fontSize: '0.72rem' }}>
                <Play size={10} className={testingAcmConnection ? 'animate-spin' : ''} /> Test ACM
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>
              {/* CỘT 1: ACM WEB LOGIN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(14, 165, 233, 0.02)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0ea5e9' }}>ACM Web Login (Cổng ETP Orders & Trades)</span>
                <AutomationSwitch
                  checked={ingressModeAcm === 'REST_API'}
                  onChange={(checked) => setIngressModeAcm(checked ? 'REST_API' : 'PLAYWRIGHT')}
                  title="Phương thức kết nối ETP"
                  labelOn="API Trực tiếp: Tải qua API và tự động xác thực Captcha"
                  labelOff="Trình duyệt tự động: Khởi chạy trình duyệt tự động (Dự phòng)"
                  badgeOn="API TRỰC TIẾP"
                  badgeOff="TRÌNH DUYỆT TỰ ĐỘNG"
                  color="#0ea5e9"
                />
                <input type="url" className="form-input" placeholder="ACM URL..." value={acmUrl} onChange={(e) => setAcmUrl(e.target.value)} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input type="text" className="form-input" placeholder="Username..." value={acmUsername} onChange={(e) => setAcmUsername(e.target.value)} />
                  <input type={showAcmPassword ? 'text' : 'password'} className="form-input" placeholder="Mật khẩu..." value={acmPassword} onChange={(e) => setAcmPassword(e.target.value)} />
                </div>
              </div>

              {/* CỘT 2: SFTP SYNC */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(16, 185, 129, 0.02)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981' }}>SFTP Sync Configuration (Straits CSV)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: '10px' }}>
                  <input type="text" className="form-input" placeholder="Host (sftp.mxv.com.vn)..." value={acmSftpHost} onChange={(e) => setAcmSftpHost(e.target.value)} />
                  <input type="number" className="form-input" placeholder="Port (2231)..." value={acmSftpPort} onChange={(e) => setAcmSftpPort(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input type="text" className="form-input" placeholder="SFTP Username..." value={acmSftpUsername} onChange={(e) => setAcmSftpUsername(e.target.value)} />
                  <input type={showAcmSftpPassword ? 'text' : 'password'} className="form-input" placeholder="SFTP Mật khẩu..." value={acmSftpPassword} onChange={(e) => setAcmSftpPassword(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* KHỐI FULL-WIDTH: MICROSOFT 365 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail size={18} style={{ color: '#3b82f6' }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Hòm Thư Microsoft 365 (Báo cáo EOD Watcher)
                </h4>
              </div>
              <button type="button" onClick={handleM365Reauthorize} className="btn btn-xs btn-outline" style={{ fontSize: '0.72rem' }}>
                <Link2 size={10} /> Cấp quyền lại OAuth2
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Watcher Email</label>
                <input type="email" className="form-input" placeholder="bot.report@mxv.com.vn" value={m365WatcherEmail} onChange={(e) => setM365WatcherEmail(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Client ID (Application ID)</label>
                <input type="text" className="form-input" placeholder="Application (Client) ID..." value={m365ClientId} onChange={(e) => setM365ClientId(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Tenant ID</label>
                <input type="text" className="form-input" placeholder="Directory (Tenant) ID..." value={m365TenantId} onChange={(e) => setM365TenantId(e.target.value)} />
              </div>
            </div>
          </div>

          {/* THANH LƯU TỔNG DƯỚI CÙNG Ở DẠNG THẺ */}
          <div
            style={{
              position: 'sticky',
              bottom: '16px',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 24px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Mọi thay đổi thông tin xác thực và phương thức kết nối có hiệu lực ngay tại runtime.
            </span>
            <button
              type="submit"
              disabled={anyTesting || savingConfig}
              className="btn btn-primary"
              style={{ padding: '10px 28px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={16} />
              {savingConfig ? 'Đang lưu...' : 'Lưu tất cả cấu hình'}
            </button>
          </div>
        </form>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL 1: XEM CHI TIẾT KẾT NỐI (READ-ONLY VIEW MODAL)
         ══════════════════════════════════════════════════════════ */}
      {viewingSystem && (
        <div style={modalBackdropStyle} onClick={() => setViewingSystem(null)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Eye size={20} style={{ color: 'var(--color-accent)' }} />
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Chi tiết Cấu hình Kết nối
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {viewingSystem === 'msystem' && 'Hệ thống Quản trị & Giám sát Giao dịch M-System'}
                    {viewingSystem === 'cqg' && 'Hệ thống Khớp lệnh Quốc tế CQG Desktop & CAST'}
                    {viewingSystem === 'ccp' && 'Hệ thống Bù trừ & Quản lý Ký quỹ CoreCCP VNCLEAR'}
                    {viewingSystem === 'ce' && 'Hệ thống Khớp lệnh Sàn Giao dịch Core Exchange'}
                    {viewingSystem === 'acm' && 'Cổng Đối tác ACM & Dịch vụ SFTP Straits'}
                    {viewingSystem === 'm365' && 'Dịch vụ Giám sát Hòm thư Báo cáo Microsoft 365'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingSystem(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Chi tiết từng hệ thống */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.85rem' }}>
              {viewingSystem === 'msystem' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Phương thức kết nối:</span>
                    {renderMethodBadge(ingressModeMs, '#10b981')}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Địa chỉ máy chủ (URL):</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{msystemUrl || 'Chưa cấu hình'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tên đăng nhập:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{msystemUsername || 'Chưa cấu hình'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Mật khẩu đăng nhập:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{msystemPassword ? '•••••••• (Đã lưu)' : 'Chưa cấu hình'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Mã PIN xác thực:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{msystemPin ? '•••• (Đã lưu)' : 'Chưa cấu hình'}</span>
                  </div>
                </>
              )}

              {viewingSystem === 'cqg' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Phương thức kết nối:</span>
                    <span style={{ fontWeight: 600, color: '#f59e0b' }}>Trình duyệt tự động (2 tài khoản song song)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>CQG Trade Desktop URL:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cqgUrlTrade}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tài khoản CQG1 (FR1, PS1, OP1):</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cqgUsername1 || 'Chưa cấu hình'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tài khoản CQG3 (FR2, PS2, OP2):</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cqgUsername2 || 'Chưa cấu hình'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tài khoản CQG Price (Xem giá):</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cqgUsername || 'mxvprice'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tài khoản CQG CAST (Ký quỹ):</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{castUsername || 'Chưa cấu hình'}</span>
                  </div>
                </>
              )}

              {viewingSystem === 'ccp' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Phương thức kết nối:</span>
                    {renderMethodBadge(ingressModeCcp, '#ec4899')}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Địa chỉ máy chủ (URL):</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cppUrl}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tên đăng nhập:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cppUsername || 'Chưa cấu hình'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Thư mục lưu báo cáo:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cppOutputDir}</span>
                  </div>
                </>
              )}

              {viewingSystem === 'ce' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Phương thức kết nối:</span>
                    {renderMethodBadge(ingressModeCe, '#8b5cf6')}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Địa chỉ máy chủ (URL):</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ceUrl}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tên đăng nhập:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ceUsername || 'Chưa cấu hình'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Thư mục lưu báo cáo:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ceOutputDir}</span>
                  </div>
                </>
              )}

              {viewingSystem === 'acm' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Phương thức kết nối ETP:</span>
                    {renderMethodBadge(ingressModeAcm, '#0ea5e9')}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>ACM ETP Web URL:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{acmUrl}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tài khoản ACM ETP:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{acmUsername || 'Chưa cấu hình'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Máy chủ SFTP Straits:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{acmSftpHost}:{acmSftpPort}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tài khoản SFTP:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{acmSftpUsername || 'Chưa cấu hình'}</span>
                  </div>
                </>
              )}

              {viewingSystem === 'm365' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Phương thức kết nối:</span>
                    <span style={{ fontWeight: 600, color: '#3b82f6' }}>Microsoft Graph API (OAuth2)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Hòm thư giám sát:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m365WatcherEmail || 'Chưa cấu hình'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Application (Client) ID:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m365ClientId || 'Chưa cấu hình'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Directory (Tenant) ID:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m365TenantId || 'Chưa cấu hình'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Trạng thái OAuth2:</span>
                    <span style={{ fontWeight: 600, color: m365RefreshToken ? '#10b981' : '#f59e0b' }}>
                      {m365RefreshToken ? 'Đã liên kết token hợp lệ' : 'Chưa cấp quyền'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setViewingSystem(null)}
                className="btn btn-secondary"
                style={{ padding: '8px 18px', fontSize: '0.82rem' }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = viewingSystem;
                  setViewingSystem(null);
                  setEditingSystem(target);
                }}
                className="btn btn-primary"
                style={{ padding: '8px 20px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Edit3 size={14} />
                Chuyển sang Chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL 2: CHỈNH SỬA CẤU HÌNH (EDIT CONFIGURATION MODAL)
         ══════════════════════════════════════════════════════════ */}
      {editingSystem && (
        <div style={modalBackdropStyle} onClick={() => setEditingSystem(null)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit3 size={20} style={{ color: 'var(--color-accent)' }} />
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Cấu hình Tài khoản: {editingSystem === 'msystem' ? 'M-System' : editingSystem === 'cqg' ? 'CQG' : editingSystem === 'ccp' ? 'CoreCCP' : editingSystem === 'ce' ? 'Core Exchange' : editingSystem === 'acm' ? 'ACM & SFTP' : 'Microsoft 365'}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Cập nhật tham số kết nối máy chủ và phương thức thu thập dữ liệu
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSystem(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Form M-System */}
              {editingSystem === 'msystem' && (
                <>
                  <AutomationSwitch
                    checked={ingressModeMs === 'REST_API'}
                    onChange={(checked) => setIngressModeMs(checked ? 'REST_API' : 'PLAYWRIGHT')}
                    title="Phương thức kết nối"
                    labelOn="API Trực tiếp: Kết nối và nhận dữ liệu trực tiếp từ cổng dịch vụ"
                    labelOff="Trình duyệt tự động: Khởi chạy trình duyệt mô phỏng thao tác người dùng (Dự phòng)"
                    badgeOn="API TRỰC TIẾP"
                    badgeOff="TRÌNH DUYỆT TỰ ĐỘNG"
                    color="#10b981"
                  />
                  <div>
                    <label style={labelStyle}>M-System URL (Portal / Gateway)</label>
                    <input type="url" className="form-input" value={msystemUrl} onChange={(e) => setMsystemUrl(e.target.value)} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Tên đăng nhập</label>
                      <input type="text" className="form-input" value={msystemUsername} onChange={(e) => setMsystemUsername(e.target.value)} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Mã PIN xác thực</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showMsystemPin ? 'text' : 'password'} className="form-input" style={{ paddingRight: '36px' }} value={msystemPin} onChange={(e) => setMsystemPin(e.target.value)} required />
                        <button type="button" onClick={() => setShowMsystemPin(!showMsystemPin)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                          {showMsystemPin ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Mật khẩu đăng nhập</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showMsystemPassword ? 'text' : 'password'} className="form-input" style={{ paddingRight: '36px' }} value={msystemPassword} onChange={(e) => setMsystemPassword(e.target.value)} required />
                      <button type="button" onClick={() => setShowMsystemPassword(!showMsystemPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                        {showMsystemPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Form CQG */}
              {editingSystem === 'cqg' && (
                <>
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(15, 23, 42, 0.4)', padding: '4px', borderRadius: '8px' }}>
                    <button type="button" onClick={() => setCqgActiveTab('trade')} style={{ flex: 1, padding: '7px', fontSize: '0.75rem', fontWeight: cqgActiveTab === 'trade' ? 700 : 500, background: cqgActiveTab === 'trade' ? 'rgba(16, 185, 129, 0.2)' : 'transparent', color: cqgActiveTab === 'trade' ? '#10b981' : 'var(--text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>CQG Trade</button>
                    <button type="button" onClick={() => setCqgActiveTab('price')} style={{ flex: 1, padding: '7px', fontSize: '0.75rem', fontWeight: cqgActiveTab === 'price' ? 700 : 500, background: cqgActiveTab === 'price' ? 'rgba(245, 158, 11, 0.2)' : 'transparent', color: cqgActiveTab === 'price' ? '#f59e0b' : 'var(--text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>CQG Price</button>
                    <button type="button" onClick={() => setCqgActiveTab('cast')} style={{ flex: 1, padding: '7px', fontSize: '0.75rem', fontWeight: cqgActiveTab === 'cast' ? 700 : 500, background: cqgActiveTab === 'cast' ? 'rgba(244, 63, 94, 0.2)' : 'transparent', color: cqgActiveTab === 'cast' ? '#f43f5e' : 'var(--text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>CQG CAST</button>
                  </div>
                  {cqgActiveTab === 'trade' && (
                    <>
                      <div>
                        <label style={labelStyle}>CQG Trade Desktop URL</label>
                        <input type="url" className="form-input" value={cqgUrlTrade} onChange={(e) => setCqgUrlTrade(e.target.value)} required />
                      </div>
                      <div style={{ border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '12px', background: 'rgba(16, 185, 129, 0.02)' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981', display: 'block', marginBottom: '8px' }}>Tài khoản CQG1 (FR1, PS1, OP1, OD1)</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <input type="text" className="form-input" placeholder="Username..." value={cqgUsername1} onChange={(e) => setCqgUsername1(e.target.value)} />
                          <input type="password" className="form-input" placeholder="Mật khẩu..." value={cqgPassword1} onChange={(e) => setCqgPassword1(e.target.value)} />
                        </div>
                      </div>
                      <div style={{ border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '12px', background: 'rgba(16, 185, 129, 0.02)' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981', display: 'block', marginBottom: '8px' }}>Tài khoản CQG3 (FR2, PS2, OP2, OD2)</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <input type="text" className="form-input" placeholder="Username..." value={cqgUsername2} onChange={(e) => setCqgUsername2(e.target.value)} />
                          <input type="password" className="form-input" placeholder="Mật khẩu..." value={cqgPassword2} onChange={(e) => setCqgPassword2(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}
                  {cqgActiveTab === 'price' && (
                    <>
                      <div>
                        <label style={labelStyle}>CQG Price Desktop URL</label>
                        <input type="url" className="form-input" value={cqgUrlPrice} onChange={(e) => setCqgUrlPrice(e.target.value)} required />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <input type="text" className="form-input" placeholder="Username (mxvprice)..." value={cqgUsername} onChange={(e) => setCqgUsername(e.target.value)} />
                        <input type="password" className="form-input" placeholder="Mật khẩu..." value={cqgPassword} onChange={(e) => setCqgPassword(e.target.value)} />
                      </div>
                    </>
                  )}
                  {cqgActiveTab === 'cast' && (
                    <>
                      <div>
                        <label style={labelStyle}>CAST URL</label>
                        <input type="url" className="form-input" value={castUrl} onChange={(e) => setCastUrl(e.target.value)} required />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <input type="text" className="form-input" placeholder="Username CAST..." value={castUsername} onChange={(e) => setCastUsername(e.target.value)} />
                        <input type="password" className="form-input" placeholder="Mật khẩu..." value={castPassword} onChange={(e) => setCastPassword(e.target.value)} />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Form CoreCCP */}
              {editingSystem === 'ccp' && (
                <>
                  <AutomationSwitch
                    checked={ingressModeCcp === 'REST_API'}
                    onChange={(checked) => setIngressModeCcp(checked ? 'REST_API' : 'PLAYWRIGHT')}
                    title="Phương thức kết nối"
                    labelOn="API Trực tiếp: Tải dữ liệu bù trừ qua cổng REST API"
                    labelOff="Trình duyệt tự động: Khởi chạy trình duyệt tự động (Dự phòng)"
                    badgeOn="API TRỰC TIẾP"
                    badgeOff="TRÌNH DUYỆT TỰ ĐỘNG"
                    color="#ec4899"
                  />
                  <div>
                    <label style={labelStyle}>CoreCCP URL</label>
                    <input type="url" className="form-input" value={cppUrl} onChange={(e) => setCppUrl(e.target.value)} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Tên đăng nhập</label>
                      <input type="text" className="form-input" value={cppUsername} onChange={(e) => setCppUsername(e.target.value)} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Mật khẩu</label>
                      <input type="password" className="form-input" value={cppPassword} onChange={(e) => setCppPassword(e.target.value)} required />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Thư mục lưu báo cáo</label>
                    <input type="text" className="form-input" value={cppOutputDir} onChange={(e) => setCppOutputDir(e.target.value)} />
                  </div>
                </>
              )}

              {/* Form CoreCE */}
              {editingSystem === 'ce' && (
                <>
                  <AutomationSwitch
                    checked={ingressModeCe === 'REST_API'}
                    onChange={(checked) => setIngressModeCe(checked ? 'REST_API' : 'PLAYWRIGHT')}
                    title="Phương thức kết nối"
                    labelOn="API Trực tiếp: Tải dữ liệu qua cổng API OAuth2 Session"
                    labelOff="Trình duyệt tự động: Khởi chạy trình duyệt tự động (Dự phòng)"
                    badgeOn="API TRỰC TIẾP"
                    badgeOff="TRÌNH DUYỆT TỰ ĐỘNG"
                    color="#8b5cf6"
                  />
                  <div>
                    <label style={labelStyle}>Core Exchange URL</label>
                    <input type="url" className="form-input" value={ceUrl} onChange={(e) => setCeUrl(e.target.value)} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Tên đăng nhập</label>
                      <input type="text" className="form-input" value={ceUsername} onChange={(e) => setCeUsername(e.target.value)} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Mật khẩu</label>
                      <input type="password" className="form-input" value={cePassword} onChange={(e) => setCePassword(e.target.value)} required />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Thư mục lưu báo cáo</label>
                    <input type="text" className="form-input" value={ceOutputDir} onChange={(e) => setCeOutputDir(e.target.value)} />
                  </div>
                </>
              )}

              {/* Form ACM & SFTP */}
              {editingSystem === 'acm' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(14, 165, 233, 0.02)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0ea5e9' }}>Cổng ETP Web</span>
                    <AutomationSwitch
                      checked={ingressModeAcm === 'REST_API'}
                      onChange={(checked) => setIngressModeAcm(checked ? 'REST_API' : 'PLAYWRIGHT')}
                      title="Phương thức kết nối ETP"
                      labelOn="API Trực tiếp: Tải qua API và tự động xác thực Captcha"
                      labelOff="Trình duyệt tự động: Khởi chạy trình duyệt tự động (Dự phòng)"
                      badgeOn="API TRỰC TIẾP"
                      badgeOff="TRÌNH DUYỆT TỰ ĐỘNG"
                      color="#0ea5e9"
                    />
                    <input type="url" className="form-input" placeholder="ACM URL..." value={acmUrl} onChange={(e) => setAcmUrl(e.target.value)} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <input type="text" className="form-input" placeholder="Username..." value={acmUsername} onChange={(e) => setAcmUsername(e.target.value)} />
                      <input type="password" className="form-input" placeholder="Mật khẩu..." value={acmPassword} onChange={(e) => setAcmPassword(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(16, 185, 129, 0.02)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981' }}>Đồng bộ SFTP (Straits CSV)</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: '10px' }}>
                      <input type="text" className="form-input" placeholder="Host..." value={acmSftpHost} onChange={(e) => setAcmSftpHost(e.target.value)} />
                      <input type="number" className="form-input" placeholder="Port (2231)..." value={acmSftpPort} onChange={(e) => setAcmSftpPort(e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <input type="text" className="form-input" placeholder="SFTP Username..." value={acmSftpUsername} onChange={(e) => setAcmSftpUsername(e.target.value)} />
                      <input type="password" className="form-input" placeholder="SFTP Password..." value={acmSftpPassword} onChange={(e) => setAcmSftpPassword(e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              {/* Form M365 */}
              {editingSystem === 'm365' && (
                <>
                  <div>
                    <label style={labelStyle}>Hòm thư giám sát (Watcher Email)</label>
                    <input type="email" className="form-input" value={m365WatcherEmail} onChange={(e) => setM365WatcherEmail(e.target.value)} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Application (Client) ID</label>
                    <input type="text" className="form-input" value={m365ClientId} onChange={(e) => setM365ClientId(e.target.value)} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Directory (Tenant) ID</label>
                    <input type="text" className="form-input" value={m365TenantId} onChange={(e) => setM365TenantId(e.target.value)} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Client Secret</label>
                    <input type="password" className="form-input" placeholder="Client secret..." value={m365ClientSecret} onChange={(e) => setM365ClientSecret(e.target.value)} />
                  </div>
                </>
              )}

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setEditingSystem(null)}
                  className="btn btn-secondary"
                  style={{ padding: '8px 18px', fontSize: '0.82rem' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="btn btn-primary"
                  style={{ padding: '8px 24px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={14} />
                  {savingConfig ? 'Đang lưu...' : 'Lưu Cấu Hình'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
