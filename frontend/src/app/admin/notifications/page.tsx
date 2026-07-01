'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  AlertCircle,
  Mail,
  MessageSquare,
  Globe,
  Settings,
  RefreshCw,
  Play,
  CheckCircle2,
  Info,
  User,
  Shield,
  Layers,
  FileText
} from 'lucide-react';

interface NotificationChannel {
  _id: string;
  name: string;
  code: string;
  type: 'TELEGRAM' | 'EMAIL' | 'WEB';
  isActive: boolean;
  config: Record<string, any>;
}

interface NotificationRule {
  _id: string;
  name: string;
  code: string;
  eventType: string;
  departmentId?: any; // populated department
  shiftSlotId?: any;   // populated shiftSlot
  channelIds: any[];   // populated/unpopulated channels
  recipientUsers?: any[]; // populated/unpopulated users
  recipientRoles?: string[];
  isActive: boolean;
  conditions: Record<string, any>;
  template: {
    title: string;
    body: string;
  };
}

interface NotificationLog {
  _id: string;
  eventType: string;
  channelType: string;
  channelId?: any;
  ruleId?: any;
  recipient: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  payload: Record<string, any>;
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
}

interface Department {
  _id: string;
  name: string;
  code: string;
}

interface ShiftSlot {
  _id: string;
  name: string;
  code: string;
}

interface UserItem {
  _id: string;
  fullName: string;
  username: string;
  role: string;
}

export default function AdminNotificationsPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'channels' | 'rules' | 'logs' | 'test'>('channels');

  // Lists Data
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  
  // Lookups Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shiftSlots, setShiftSlots] = useState<ShiftSlot[]>([]);
  const [usersList, setUsersList] = useState<UserItem[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal control
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);

  // Edit states
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);

  // Banners state
  const [apiError, setApiError] = useState('');
  const [apiSuccess, setApiSuccess] = useState('');

  // ----------------------------------------------------
  // CHANNEL FORM STATES
  // ----------------------------------------------------
  const [channelName, setChannelName] = useState('');
  const [channelCode, setChannelCode] = useState('');
  const [channelType, setChannelType] = useState<'TELEGRAM' | 'EMAIL' | 'WEB'>('TELEGRAM');
  const [channelIsActive, setChannelIsActive] = useState(true);
  const [channelConfigToken, setChannelConfigToken] = useState('');
  const [channelConfigChatId, setChannelConfigChatId] = useState('');
  const [channelConfigSmtpHost, setChannelConfigSmtpHost] = useState('');
  const [channelConfigSmtpPort, setChannelConfigSmtpPort] = useState('');
  const [channelConfigSenderEmail, setChannelConfigSenderEmail] = useState('');
  const [channelConfigSenderPass, setChannelConfigSenderPass] = useState('');

  // ----------------------------------------------------
  // RULE FORM STATES
  // ----------------------------------------------------
  const [ruleName, setRuleName] = useState('');
  const [ruleCode, setRuleCode] = useState('');
  const [ruleEventType, setRuleEventType] = useState('SHIFT_JOB_GENERATED');
  const [ruleDeptId, setRuleDeptId] = useState('');
  const [ruleSlotId, setRuleSlotId] = useState('');
  const [ruleChannelIds, setRuleChannelIds] = useState<string[]>([]);
  const [ruleRecipientUsers, setRuleRecipientUsers] = useState<string[]>([]);
  const [ruleRecipientRoles, setRuleRecipientRoles] = useState<string[]>([]);
  const [ruleIsActive, setRuleIsActive] = useState(true);
  const [ruleTemplateTitle, setRuleTemplateTitle] = useState('');
  const [ruleTemplateBody, setRuleTemplateBody] = useState('');

  // ----------------------------------------------------
  // TEST TAB STATES
  // ----------------------------------------------------
  const [testEventType, setTestEventType] = useState('SHIFT_JOB_GENERATED');
  const [testRuleId, setTestRuleId] = useState('');
  const [testRecipient, setTestRecipient] = useState('');
  const [testPayload, setTestPayload] = useState('{\n  "jobName": "Ca trực sáng QLGD",\n  "operatorName": "Nguyễn Văn A",\n  "status": "COMPLETED"\n}');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Field errors validation
  const [channelErrors, setChannelErrors] = useState<Record<string, string>>({});
  const [ruleErrors, setRuleErrors] = useState<Record<string, string>>({});

  // Redirect if not admin
  useEffect(() => {
    if (user) {
      if (user.role !== 'ADMIN') {
        router.push('/dashboard');
      }
    }
  }, [user, router]);

  // Fetch Lookups
  const fetchLookups = useCallback(async () => {
    if (!token) return;
    try {
      const [deptRes, slotRes, userRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/departments`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/v1/shift-slots`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/v1/users?limit=200`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (deptRes.ok) setDepartments(await deptRes.json());
      if (slotRes.ok) setShiftSlots(await slotRes.json());
      if (userRes.ok) {
        const userData = await userRes.json();
        setUsersList(userData.users || userData);
      }
    } catch (err) {
      console.error('Error fetching lookups for notifications:', err);
    }
  }, [token]);

  // Fetch Channels
  const fetchChannels = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/notifications/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setChannels(await res.json());
      }
    } catch (err) {
      console.error('Error fetching channels:', err);
    }
  }, [token]);

  // Fetch Rules
  const fetchRules = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/notifications/rules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setRules(await res.json());
      }
    } catch (err) {
      console.error('Error fetching rules:', err);
    }
  }, [token]);

  // Fetch Logs
  const fetchLogs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/notifications/logs?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  }, [token]);

  // Initial Load
  useEffect(() => {
    if (token) {
      setLoading(true);
      Promise.all([fetchLookups(), fetchChannels(), fetchRules(), fetchLogs()])
        .finally(() => setLoading(false));
    }
  }, [token, fetchLookups, fetchChannels, fetchRules, fetchLogs]);

  // Handle Tab Switch
  const handleTabChange = (tab: 'channels' | 'rules' | 'logs' | 'test') => {
    setActiveTab(tab);
    setApiError('');
    setApiSuccess('');
    if (tab === 'logs') {
      fetchLogs();
    }
  };

  // ----------------------------------------------------
  // CHANNEL LOGIC
  // ----------------------------------------------------
  const openAddChannel = () => {
    setEditingChannel(null);
    setChannelName('');
    setChannelCode('');
    setChannelType('TELEGRAM');
    setChannelIsActive(true);
    setChannelConfigToken('');
    setChannelConfigChatId('');
    setChannelConfigSmtpHost('');
    setChannelConfigSmtpPort('');
    setChannelConfigSenderEmail('');
    setChannelConfigSenderPass('');
    setChannelErrors({});
    setApiError('');
    setApiSuccess('');
    setChannelModalOpen(true);
  };

  const openEditChannel = (channel: NotificationChannel) => {
    setEditingChannel(channel);
    setChannelName(channel.name);
    setChannelCode(channel.code);
    setChannelType(channel.type);
    setChannelIsActive(channel.isActive);
    setChannelConfigToken(channel.config?.token || '');
    setChannelConfigChatId(channel.config?.chatId || '');
    setChannelConfigSmtpHost(channel.config?.smtpHost || '');
    setChannelConfigSmtpPort(channel.config?.smtpPort || '');
    setChannelConfigSenderEmail(channel.config?.senderEmail || '');
    setChannelConfigSenderPass(channel.config?.senderPassword || '');
    setChannelErrors({});
    setApiError('');
    setApiSuccess('');
    setChannelModalOpen(true);
  };

  const handleChannelCodeChange = (val: string) => {
    setChannelCode(val.toUpperCase().replace(/[^A-Z0-9_]/g, ''));
  };

  const validateChannel = () => {
    const errors: Record<string, string> = {};
    if (!channelName.trim()) errors.name = 'Tên kênh không được để trống';
    if (!channelCode.trim()) errors.code = 'Mã kênh không được để trống';
    else if (!/^[A-Z0-9_]+$/.test(channelCode.trim())) {
      errors.code = 'Mã chỉ được chứa CHỮ HOA, số và dấu gạch dưới';
    }

    if (channelType === 'TELEGRAM') {
      if (!channelConfigToken.trim()) errors.token = 'Bot token Telegram không được để trống';
      if (!channelConfigChatId.trim()) errors.chatId = 'Chat ID nhận tin không được để trống';
    } else if (channelType === 'EMAIL') {
      if (!channelConfigSmtpHost.trim()) errors.smtpHost = 'SMTP Host không được để trống';
      if (!channelConfigSmtpPort.trim()) errors.smtpPort = 'SMTP Port không được để trống';
      if (!channelConfigSenderEmail.trim()) errors.senderEmail = 'Email người gửi không được để trống';
    }

    setChannelErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateChannel()) return;
    setSubmitting(true);
    setApiError('');
    setApiSuccess('');

    const config: Record<string, any> = {};
    if (channelType === 'TELEGRAM') {
      config.token = channelConfigToken.trim();
      config.chatId = channelConfigChatId.trim();
    } else if (channelType === 'EMAIL') {
      config.smtpHost = channelConfigSmtpHost.trim();
      config.smtpPort = channelConfigSmtpPort.trim();
      config.senderEmail = channelConfigSenderEmail.trim();
      if (channelConfigSenderPass) config.senderPassword = channelConfigSenderPass.trim();
    }

    const payload = {
      name: channelName.trim(),
      code: channelCode.trim(),
      type: channelType,
      isActive: channelIsActive,
      config
    };

    try {
      const method = editingChannel ? 'PUT' : 'POST';
      const url = editingChannel
        ? `${API_BASE_URL}/api/v1/notifications/channels/${editingChannel._id}`
        : `${API_BASE_URL}/api/v1/notifications/channels`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Thao tác lưu kênh thất bại');
      }

      setApiSuccess(editingChannel ? 'Cập nhật kênh thành công!' : 'Tạo kênh thành công!');
      fetchChannels();
      setTimeout(() => setChannelModalOpen(false), 1000);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi hệ thống');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteChannel = async (channel: NotificationChannel) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa kênh thông báo "${channel.name}"?`)) return;
    setDeletingId(channel._id);
    setApiError('');
    setApiSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/notifications/channels/${channel._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Xóa kênh thất bại');
      }
      setApiSuccess(`Đã xóa kênh "${channel.name}"`);
      fetchChannels();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi hệ thống');
    } finally {
      setDeletingId(null);
    }
  };

  // ----------------------------------------------------
  // RULE LOGIC
  // ----------------------------------------------------
  const openAddRule = () => {
    setEditingRule(null);
    setRuleName('');
    setRuleCode('');
    setRuleEventType('SHIFT_JOB_GENERATED');
    setRuleDeptId('');
    setRuleSlotId('');
    setRuleChannelIds([]);
    setRuleRecipientUsers([]);
    setRuleRecipientRoles([]);
    setRuleIsActive(true);
    setRuleTemplateTitle('');
    setRuleTemplateBody('');
    setRuleErrors({});
    setApiError('');
    setApiSuccess('');
    setRuleModalOpen(true);
  };

  const openEditRule = (rule: NotificationRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setRuleCode(rule.code);
    setRuleEventType(rule.eventType);
    setRuleDeptId(rule.departmentId?._id || rule.departmentId || '');
    setRuleSlotId(rule.shiftSlotId?._id || rule.shiftSlotId || '');
    setRuleChannelIds((rule.channelIds || []).map(c => c._id || c));
    setRuleRecipientUsers((rule.recipientUsers || []).map(u => u._id || u));
    setRuleRecipientRoles(rule.recipientRoles || []);
    setRuleIsActive(rule.isActive);
    setRuleTemplateTitle(rule.template?.title || '');
    setRuleTemplateBody(rule.template?.body || '');
    setRuleErrors({});
    setApiError('');
    setApiSuccess('');
    setRuleModalOpen(true);
  };

  const handleRuleCodeChange = (val: string) => {
    setRuleCode(val.toUpperCase().replace(/[^A-Z0-9_]/g, ''));
  };

  const validateRule = () => {
    const errors: Record<string, string> = {};
    if (!ruleName.trim()) errors.name = 'Tên luật không được để trống';
    if (!ruleCode.trim()) errors.code = 'Mã luật không được để trống';
    else if (!/^[A-Z0-9_]+$/.test(ruleCode.trim())) {
      errors.code = 'Mã chỉ được chứa CHỮ HOA, số và dấu gạch dưới';
    }
    if (ruleChannelIds.length === 0) errors.channels = 'Vui lòng chọn ít nhất một kênh nhận thông báo';
    if (!ruleTemplateTitle.trim()) errors.templateTitle = 'Tiêu đề mẫu thông báo không được để trống';
    if (!ruleTemplateBody.trim()) errors.templateBody = 'Nội dung mẫu thông báo không được để trống';

    setRuleErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRule()) return;
    setSubmitting(true);
    setApiError('');
    setApiSuccess('');

    const payload = {
      name: ruleName.trim(),
      code: ruleCode.trim(),
      eventType: ruleEventType,
      departmentId: ruleDeptId || null,
      shiftSlotId: ruleSlotId || null,
      channelIds: ruleChannelIds,
      recipientUsers: ruleRecipientUsers,
      recipientRoles: ruleRecipientRoles,
      isActive: ruleIsActive,
      conditions: {},
      template: {
        title: ruleTemplateTitle.trim(),
        body: ruleTemplateBody.trim()
      }
    };

    try {
      const method = editingRule ? 'PUT' : 'POST';
      const url = editingRule
        ? `${API_BASE_URL}/api/v1/notifications/rules/${editingRule._id}`
        : `${API_BASE_URL}/api/v1/notifications/rules`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Thao tác lưu luật thất bại');
      }

      setApiSuccess(editingRule ? 'Cập nhật luật thành công!' : 'Tạo luật thành công!');
      fetchRules();
      setTimeout(() => setRuleModalOpen(false), 1000);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi hệ thống');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRule = async (rule: NotificationRule) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa luật thông báo "${rule.name}"?`)) return;
    setDeletingId(rule._id);
    setApiError('');
    setApiSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/notifications/rules/${rule._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Xóa luật thất bại');
      }
      setApiSuccess(`Đã xóa luật "${rule.name}"`);
      fetchRules();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi hệ thống');
    } finally {
      setDeletingId(null);
    }
  };

  // ----------------------------------------------------
  // TEST NOTIFICATION LOGIC
  // ----------------------------------------------------
  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient.trim()) {
      setApiError('Người nhận (Recipient) không được để trống');
      return;
    }
    setApiError('');
    setApiSuccess('');
    setTestLoading(true);
    setTestResult(null);

    let parsedPayload = {};
    try {
      if (testPayload.trim()) {
        parsedPayload = JSON.parse(testPayload);
      }
    } catch (err) {
      setApiError('Payload JSON không hợp lệ');
      setTestLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          eventType: testEventType,
          ruleId: testRuleId || undefined,
          recipient: testRecipient.trim(),
          payload: parsedPayload
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Gửi test thất bại');
      }

      const resData = await res.json();
      setTestResult(resData);
      setApiSuccess('Đã gửi thử nghiệm thành công! Log đã được tạo.');
      fetchLogs();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi gửi test');
    } finally {
      setTestLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT': return <span className="badge badge-low">Đã Gửi</span>;
      case 'PENDING': return <span className="badge badge-medium">Chờ Gửi</span>;
      case 'FAILED': return <span className="badge badge-critical">Lỗi</span>;
      default: return <span className="badge badge-secondary">Bỏ Qua</span>;
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'TELEGRAM': return <MessageSquare size={16} color="var(--color-primary)" />;
      case 'EMAIL': return <Mail size={16} color="var(--color-accent)" />;
      default: return <Globe size={16} color="#10b981" />;
    }
  };

  return (
    <ProtectedRoute>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <Bell size={28} color="var(--color-accent)" />
              <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', margin: 0 }}>
                Cấu Hình Thông Báo & Cảnh Báo
              </h1>
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>
              Quản lý các kênh gửi tin (Telegram, Email) và cấu hình điều kiện kích hoạt thông báo tự động.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            {activeTab === 'channels' && (
              <button onClick={openAddChannel} className="btn btn-primary" style={{ padding: '12px 20px' }}>
                <Plus size={18} /> Thêm Kênh Mới
              </button>
            )}
            {activeTab === 'rules' && (
              <button onClick={openAddRule} className="btn btn-primary" style={{ padding: '12px 20px' }}>
                <Plus size={18} /> Thêm Luật Mới
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          gap: '8px',
          paddingBottom: '2px'
        }}>
          <button
            onClick={() => handleTabChange('channels')}
            className={`tab-btn ${activeTab === 'channels' ? 'active' : ''}`}
            style={{
              padding: '12px 20px',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: activeTab === 'channels' ? 'var(--color-accent)' : 'var(--text-secondary)',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: activeTab === 'channels' ? '2px solid var(--color-accent)' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={16} /> Kênh Thông Báo ({channels.length})
            </span>
          </button>
          <button
            onClick={() => handleTabChange('rules')}
            className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
            style={{
              padding: '12px 20px',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: activeTab === 'rules' ? 'var(--color-accent)' : 'var(--text-secondary)',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: activeTab === 'rules' ? '2px solid var(--color-accent)' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} /> Luật Kích Hoạt ({rules.length})
            </span>
          </button>
          <button
            onClick={() => handleTabChange('logs')}
            className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            style={{
              padding: '12px 20px',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: activeTab === 'logs' ? 'var(--color-accent)' : 'var(--text-secondary)',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: activeTab === 'logs' ? '2px solid var(--color-accent)' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} /> Nhật Ký Gửi Tin
            </span>
          </button>
          <button
            onClick={() => handleTabChange('test')}
            className={`tab-btn ${activeTab === 'test' ? 'active' : ''}`}
            style={{
              padding: '12px 20px',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: activeTab === 'test' ? 'var(--color-accent)' : 'var(--text-secondary)',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: activeTab === 'test' ? '2px solid var(--color-accent)' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={16} /> Thử Nghiệm API
            </span>
          </button>
        </div>

        {/* Global notification alerts */}
        {apiError && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#ef4444', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} /> {apiError}
          </div>
        )}
        {apiSuccess && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px 16px', borderRadius: '8px', color: 'var(--color-primary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="var(--color-primary)" /> {apiSuccess}
          </div>
        )}

        {/* Content body */}
        <div style={{ minHeight: '300px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0' }}>Đang tải dữ liệu cấu hình thông báo...</div>
          ) : (
            <>
              {/* TAB CHANNELS */}
              {activeTab === 'channels' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
                  {channels.length === 0 ? (
                    <div className="glass-panel" style={{ gridColumn: '1/-1', padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Chưa cấu hình kênh thông báo nào. Bấm nút <strong>"Thêm Kênh Mới"</strong> ở góc phải.
                    </div>
                  ) : (
                    channels.map(channel => (
                      <div key={channel._id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center' }}>
                              {getChannelIcon(channel.type)}
                            </div>
                            <div>
                              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{channel.name}</h3>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{channel.code}</span>
                            </div>
                          </div>
                          <span className={`badge ${channel.isActive ? 'badge-low' : 'badge-secondary'}`}>
                            {channel.isActive ? 'Hoạt động' : 'Tắt'}
                          </span>
                        </div>

                        <div style={{ flex: 1, fontSize: '0.85rem', background: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Loại kênh:</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{channel.type}</span>
                          </div>
                          {channel.type === 'TELEGRAM' && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Chat ID:</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{channel.config?.chatId || 'Chưa điền'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Bot Token:</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{channel.config?.token ? '••••••••' : 'Chưa điền'}</span>
                              </div>
                            </>
                          )}
                          {channel.type === 'EMAIL' && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>SMTP Host:</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{channel.config?.smtpHost || 'Chưa điền'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Email gửi:</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{channel.config?.senderEmail || 'Chưa điền'}</span>
                              </div>
                            </>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
                          <button
                            onClick={() => openEditChannel(channel)}
                            className="btn btn-secondary"
                            style={{ flex: 1, fontSize: '0.8rem', padding: '8px 12px' }}
                          >
                            <Edit size={14} /> Chỉnh Sửa
                          </button>
                          <button
                            onClick={() => deleteChannel(channel)}
                            disabled={deletingId === channel._id}
                            className="btn btn-secondary"
                            style={{ flex: 1, fontSize: '0.8rem', color: '#ef4444', padding: '8px 12px', opacity: deletingId === channel._id ? 0.6 : 1 }}
                          >
                            <Trash2 size={14} /> Xóa
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB RULES */}
              {activeTab === 'rules' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {rules.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Chưa cấu hình luật thông báo nào. Bấm nút <strong>"Thêm Luật Mới"</strong> ở góc phải.
                    </div>
                  ) : (
                    <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '12px 16px' }}>Tên Luật / Code</th>
                            <th style={{ padding: '12px 16px' }}>Sự Kiện Kích Hoạt</th>
                            <th style={{ padding: '12px 16px' }}>Phạm Vi Áp Dụng</th>
                            <th style={{ padding: '12px 16px' }}>Kênh Gửi</th>
                            <th style={{ padding: '12px 16px' }}>Người Nhận</th>
                            <th style={{ padding: '12px 16px' }}>Trạng Thái</th>
                            <th style={{ padding: '12px 16px' }}>Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rules.map(rule => (
                            <tr key={rule._id} style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.005)' }}>
                              <td style={{ padding: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{rule.name}</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{rule.code}</span>
                                </div>
                              </td>
                              <td style={{ padding: '16px' }}>
                                <code style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.78rem', color: 'var(--color-accent)' }}>
                                  {rule.eventType}
                                </code>
                              </td>
                              <td style={{ padding: '16px', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span>Bộ phận: <strong>{rule.departmentId?.name || 'Tất cả'}</strong></span>
                                  <span>Ca trực: <strong>{rule.shiftSlotId?.name || 'Tất cả'}</strong></span>
                                </div>
                              </td>
                              <td style={{ padding: '16px' }}>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                  {rule.channelIds?.map((ch: any) => {
                                    const chData = typeof ch === 'object' ? ch : channels.find(c => c._id === ch);
                                    return (
                                      <span key={chData?._id || ch} className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                                        {chData ? getChannelIcon(chData.type) : <Globe size={12} />}
                                        {chData?.name || 'Kênh ẩn'}
                                      </span>
                                    );
                                  })}
                                  {(!rule.channelIds || rule.channelIds.length === 0) && (
                                    <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>Chưa cấu hình kênh!</span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '16px', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  {rule.recipientRoles && rule.recipientRoles.length > 0 && (
                                    <span>Quyền: <strong>{rule.recipientRoles.join(', ')}</strong></span>
                                  )}
                                  {rule.recipientUsers && rule.recipientUsers.length > 0 && (
                                    <span>T.khoản: <strong>{rule.recipientUsers.length} người</strong></span>
                                  )}
                                  {(!rule.recipientRoles?.length && !rule.recipientUsers?.length) && (
                                    <span style={{ color: 'var(--text-muted)' }}>Mặc định hòm thư phòng</span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '16px' }}>
                                <span className={`badge ${rule.isActive ? 'badge-low' : 'badge-secondary'}`}>
                                  {rule.isActive ? 'Hoạt động' : 'Tắt'}
                                </span>
                              </td>
                              <td style={{ padding: '16px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() => openEditRule(rule)}
                                    className="btn btn-secondary"
                                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    onClick={() => deleteRule(rule)}
                                    disabled={deletingId === rule._id}
                                    className="btn btn-secondary"
                                    style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#ef4444', opacity: deletingId === rule._id ? 0.6 : 1 }}
                                  >
                                    Xóa
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB LOGS */}
              {activeTab === 'logs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Lịch Sử 50 Thông Báo Gần Nhất</h3>
                    <button onClick={fetchLogs} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', fontSize: '0.85rem' }}>
                      <RefreshCw size={14} /> Tải lại log
                    </button>
                  </div>

                  <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
                    {logs.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Chưa ghi nhận lịch sử gửi thông báo nào.</div>
                    ) : (
                      <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '12px 16px' }}>Thời Gian (VN)</th>
                            <th style={{ padding: '12px 16px' }}>Sự Kiện (Event)</th>
                            <th style={{ padding: '12px 16px' }}>Kênh gửi (Channel)</th>
                            <th style={{ padding: '12px 16px' }}>Người nhận (Recipient)</th>
                            <th style={{ padding: '12px 16px' }}>Trạng Thái</th>
                            <th style={{ padding: '12px 16px' }}>Nội dung lỗi (nếu có)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map(log => {
                            const date = new Date(log.createdAt);
                            const timeStr = date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
                            return (
                              <tr key={log._id} style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.005)' }}>
                                <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>{timeStr}</td>
                                <td style={{ padding: '14px 16px' }}>
                                  <code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {log.eventType}
                                  </code>
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    {getChannelIcon(log.channelType)}
                                    <strong>{log.channelType}</strong>
                                    {log.channelId && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({log.channelId.name || log.channelId.code || 'ID Kênh'})</span>}
                                  </span>
                                </td>
                                <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.recipient}>
                                  {log.recipient}
                                </td>
                                <td style={{ padding: '14px 16px' }}>{getStatusBadge(log.status)}</td>
                                <td style={{ padding: '14px 16px', color: '#ef4444', fontSize: '0.8rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.errorMessage || ''}>
                                  {log.errorMessage || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {/* TAB TEST API TOOL */}
              {activeTab === 'test' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
                  
                  {/* Left Column: Form */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '1.1rem', margin: '0 0 20px 0', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Play size={18} color="var(--color-accent)" />
                      Gửi Thông Báo Thử Nghiệm (Stub)
                    </h3>
                    
                    <form onSubmit={handleTestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          Mã Sự Kiện (Event Type)
                        </label>
                        <select
                          className="form-input"
                          value={testEventType}
                          onChange={(e) => setTestEventType(e.target.value)}
                        >
                          <option value="SHIFT_JOB_GENERATED">SHIFT_JOB_GENERATED</option>
                          <option value="SHIFT_JOB_CLOSED">SHIFT_JOB_CLOSED</option>
                          <option value="TASK_COMPLETED">TASK_COMPLETED</option>
                          <option value="TASK_UNCHECKED">TASK_UNCHECKED</option>
                          <option value="TASK_NOTE_UPDATED">TASK_NOTE_UPDATED</option>
                          <option value="BOT_TASK_FAILED_PLACEHOLDER">BOT_TASK_FAILED_PLACEHOLDER</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          Luật Thông Báo (Tùy chọn)
                        </label>
                        <select
                          className="form-input"
                          value={testRuleId}
                          onChange={(e) => setTestRuleId(e.target.value)}
                        >
                          <option value="">-- Không sử dụng luật / Chỉ ghi nhận log cơ bản --</option>
                          {rules.map(r => (
                            <option key={r._id} value={r._id}>{r.name} ({r.code})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          Địa Chỉ Người Nhận (Recipient) <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Email (vd: admin@mxv.vn) hoặc Telegram ChatId (vd: -1001234567)"
                          value={testRecipient}
                          onChange={(e) => setTestRecipient(e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          Dữ Liệu Payload (JSON format)
                        </label>
                        <textarea
                          className="form-input"
                          rows={6}
                          style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                          value={testPayload}
                          onChange={(e) => setTestPayload(e.target.value)}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={testLoading}
                        className="btn btn-primary"
                        style={{ padding: '12px', justifyContent: 'center', gap: '8px' }}
                      >
                        {testLoading ? (
                          'Đang xử lý test...'
                        ) : (
                          <>
                            <Play size={16} /> Bắt đầu chạy test
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Right Column: Result */}
                  <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Info size={18} color="var(--color-accent)" />
                      Kết Quả Trả Về (API Response)
                    </h3>
                    
                    <div style={{ flex: 1, background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', fontSize: '0.85rem', overflow: 'auto', fontFamily: 'monospace', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                      {testResult ? (
                        JSON.stringify(testResult, null, 2)
                      ) : (
                        <div style={{ color: 'var(--text-muted)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                          Nhập thông tin bên trái và bấm chạy thử nghiệm.<br/>Kết quả API sẽ hiển thị tại đây.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* CHANNEL MODAL */}
      {channelModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', zIndex: 9999, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} color="var(--color-accent)" />
                {editingChannel ? 'Chỉnh Sửa Kênh Cấu Hình' : 'Thêm Kênh Thông Báo Mới'}
              </h2>
              <button onClick={() => setChannelModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitChannel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Tên kênh <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="VD: Telegram Cảnh báo Giao dịch"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  style={{ borderColor: channelErrors.name ? '#ef4444' : undefined }}
                />
                {channelErrors.name && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{channelErrors.name}</p>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Mã kênh (Code) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: TG_ALERT"
                    value={channelCode}
                    onChange={(e) => handleChannelCodeChange(e.target.value)}
                    disabled={!!editingChannel}
                    style={{ borderColor: channelErrors.code ? '#ef4444' : undefined, fontFamily: 'monospace' }}
                  />
                  {channelErrors.code && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{channelErrors.code}</p>}
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Loại kênh</label>
                  <select
                    className="form-input"
                    value={channelType}
                    onChange={(e: any) => setChannelType(e.target.value)}
                    disabled={!!editingChannel}
                  >
                    <option value="TELEGRAM">Telegram Bot</option>
                    <option value="EMAIL">SMTP Email Gateway</option>
                    <option value="WEB">Web Alerts Dashboard</option>
                  </select>
                </div>
              </div>

              {channelType === 'TELEGRAM' && (
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Cấu hình Telegram Bot</h4>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bot Token <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Điền bot token do BotFather cấp"
                      value={channelConfigToken}
                      onChange={(e) => setChannelConfigToken(e.target.value)}
                      style={{ borderColor: channelErrors.token ? '#ef4444' : undefined }}
                    />
                    {channelErrors.token && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{channelErrors.token}</p>}
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Chat ID Nhóm / Cá Nhân <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VD: -100194857643 hoặc ID người nhận"
                      value={channelConfigChatId}
                      onChange={(e) => setChannelConfigChatId(e.target.value)}
                      style={{ borderColor: channelErrors.chatId ? '#ef4444' : undefined }}
                    />
                    {channelErrors.chatId && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{channelErrors.chatId}</p>}
                  </div>
                </div>
              )}

              {channelType === 'EMAIL' && (
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Cấu hình SMTP Email Gateway</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>SMTP Host <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="smtp.office365.com hoặc smtp.gmail.com"
                        value={channelConfigSmtpHost}
                        onChange={(e) => setChannelConfigSmtpHost(e.target.value)}
                        style={{ borderColor: channelErrors.smtpHost ? '#ef4444' : undefined }}
                      />
                      {channelErrors.smtpHost && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{channelErrors.smtpHost}</p>}
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Port <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="587 hoặc 465"
                        value={channelConfigSmtpPort}
                        onChange={(e) => setChannelConfigSmtpPort(e.target.value)}
                        style={{ borderColor: channelErrors.smtpPort ? '#ef4444' : undefined }}
                      />
                      {channelErrors.smtpPort && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{channelErrors.smtpPort}</p>}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email Tài Khoản Gửi <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="vd: qlgd@mxv.vn"
                      value={channelConfigSenderEmail}
                      onChange={(e) => setChannelConfigSenderEmail(e.target.value)}
                      style={{ borderColor: channelErrors.senderEmail ? '#ef4444' : undefined }}
                    />
                    {channelErrors.senderEmail && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{channelErrors.senderEmail}</p>}
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Mật Khẩu (Để trống nếu giữ nguyên)</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Mật khẩu ứng dụng email"
                      value={channelConfigSenderPass}
                      onChange={(e) => setChannelConfigSenderPass(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={channelIsActive}
                    onChange={(e) => setChannelIsActive(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--color-accent)' }}
                  />
                  Kênh này hoạt động ngay sau khi lưu
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setChannelModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }} disabled={submitting}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  <Save size={16} /> {submitting ? 'Đang lưu...' : 'Lưu Cấu Hình'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RULE MODAL */}
      {ruleModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', zIndex: 9999, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={20} color="var(--color-accent)" />
                {editingRule ? 'Chỉnh Sửa Luật Gửi Thông Báo' : 'Tạo Luật Kích Hoạt Mới'}
              </h2>
              <button onClick={() => setRuleModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitRule} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '6px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Tên luật thông báo <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="VD: Cảnh báo khi có lỗi ca trực"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  style={{ borderColor: ruleErrors.name ? '#ef4444' : undefined }}
                />
                {ruleErrors.name && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{ruleErrors.name}</p>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Mã luật (Unique Code) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: ALERT_ON_FAIL"
                    value={ruleCode}
                    onChange={(e) => handleRuleCodeChange(e.target.value)}
                    disabled={!!editingRule}
                    style={{ borderColor: ruleErrors.code ? '#ef4444' : undefined, fontFamily: 'monospace' }}
                  />
                  {ruleErrors.code && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{ruleErrors.code}</p>}
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Sự kiện kích hoạt</label>
                  <select
                    className="form-input"
                    value={ruleEventType}
                    onChange={(e) => setRuleEventType(e.target.value)}
                  >
                    <option value="SHIFT_JOB_GENERATED">SHIFT_JOB_GENERATED (Khi sinh ca trực)</option>
                    <option value="SHIFT_JOB_CLOSED">SHIFT_JOB_CLOSED (Khi đóng ca trực)</option>
                    <option value="TASK_COMPLETED">TASK_COMPLETED (Khi tích xong task)</option>
                    <option value="TASK_UNCHECKED">TASK_UNCHECKED (Khi bỏ tích task)</option>
                    <option value="TASK_NOTE_UPDATED">TASK_NOTE_UPDATED (Khi ghi chú được đổi)</option>
                    <option value="BOT_TASK_FAILED_PLACEHOLDER">BOT_TASK_FAILED (Khi bot check bị lỗi)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Áp dụng bộ phận</label>
                  <select
                    className="form-input"
                    value={ruleDeptId}
                    onChange={(e) => setRuleDeptId(e.target.value)}
                  >
                    <option value="">Tất cả các bộ phận</option>
                    {departments.map(d => (
                      <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Áp dụng ca trực</label>
                  <select
                    className="form-input"
                    value={ruleSlotId}
                    onChange={(e) => setRuleSlotId(e.target.value)}
                  >
                    <option value="">Tất cả các ca</option>
                    {shiftSlots.map(s => (
                      <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Channels Selector */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Kênh nhận tin nhắn <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '12px', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  {channels.map(ch => (
                    <label key={ch._id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem' }}>
                      <input
                        type="checkbox"
                        checked={ruleChannelIds.includes(ch._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRuleChannelIds([...ruleChannelIds, ch._id]);
                          } else {
                            setRuleChannelIds(ruleChannelIds.filter(id => id !== ch._id));
                          }
                          setRuleErrors(prev => ({ ...prev, channels: '' }));
                        }}
                        style={{ accentColor: 'var(--color-accent)' }}
                      />
                      {getChannelIcon(ch.type)}
                      {ch.name}
                    </label>
                  ))}
                  {channels.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Vui lòng tạo kênh cấu hình trước!</span>}
                </div>
                {ruleErrors.channels && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{ruleErrors.channels}</p>}
              </div>

              {/* Recipient Roles */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Nhóm quyền nhận tin (Roles)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '10px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  {['ADMIN', 'CHAIRMAN', 'CEO', 'DIVISION_DIRECTOR', 'DEPARTMENT_HEAD', 'STAFF'].map(role => (
                    <label key={role} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                      <input
                        type="checkbox"
                        checked={ruleRecipientRoles.includes(role)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRuleRecipientRoles([...ruleRecipientRoles, role]);
                          } else {
                            setRuleRecipientRoles(ruleRecipientRoles.filter(r => r !== role));
                          }
                        }}
                        style={{ accentColor: 'var(--color-accent)' }}
                      />
                      {role}
                    </label>
                  ))}
                </div>
              </div>

              {/* Recipient Users */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Nhân viên nhận tin cụ thể</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '8px', padding: '12px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                  {usersList.map(u => (
                    <label key={u._id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={ruleRecipientUsers.includes(u._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRuleRecipientUsers([...ruleRecipientUsers, u._id]);
                          } else {
                            setRuleRecipientUsers(ruleRecipientUsers.filter(id => id !== u._id));
                          }
                        }}
                        style={{ accentColor: 'var(--color-accent)' }}
                      />
                      {u.fullName} ({u.username})
                    </label>
                  ))}
                </div>
              </div>

              {/* Template Setup */}
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={14} color="var(--color-accent)" /> Mẫu Gửi Tin Nhắn (Template)
                </h4>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tiêu đề mẫu (Subject / Header) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: [Checklist MXV] {jobName} đã đóng ca"
                    value={ruleTemplateTitle}
                    onChange={(e) => setRuleTemplateTitle(e.target.value)}
                    style={{ borderColor: ruleErrors.templateTitle ? '#ef4444' : undefined }}
                  />
                  {ruleErrors.templateTitle && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{ruleErrors.templateTitle}</p>}
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nội dung mẫu (Body) <span style={{ color: '#ef4444' }}>*</span></label>
                  <textarea
                    className="form-input"
                    rows={4}
                    placeholder="VD: Nhân viên {operatorName} đã hoàn thành ca trực vào lúc {time}. Tiến độ: {progress}%."
                    value={ruleTemplateBody}
                    onChange={(e) => setRuleTemplateBody(e.target.value)}
                    style={{ borderColor: ruleErrors.templateBody ? '#ef4444' : undefined, fontSize: '0.85rem' }}
                  />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '4px' }}>
                    * Có thể sử dụng các placeholder động: <code>{`{jobName}`}</code>, <code>{`{operatorName}`}</code>, <code>{`{status}`}</code>, <code>{`{progress}`}</code>, <code>{`{time}`}</code>
                  </p>
                  {ruleErrors.templateBody && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{ruleErrors.templateBody}</p>}
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={ruleIsActive}
                    onChange={(e) => setRuleIsActive(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--color-accent)' }}
                  />
                  Kích hoạt luật gửi thông báo này ngay
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setRuleModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }} disabled={submitting}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  <Save size={16} /> {submitting ? 'Đang lưu...' : 'Lưu Luật Giao Việc'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styled tabs & elements */}
      <style jsx global>{`
        .tab-btn {
          transition: all 0.2s ease;
        }
        .tab-btn:hover {
          color: var(--text-primary) !important;
          background: rgba(255, 255, 255, 0.02) !important;
        }
        .tab-btn.active {
          background: transparent !important;
        }
      `}</style>

    </ProtectedRoute>
  );
}
