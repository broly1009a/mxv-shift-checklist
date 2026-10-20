'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Settings,
  RefreshCw,
  Cpu,
  Save,
  BarChart2,
  Download,
  FolderOpen,
  Play,
} from 'lucide-react';
import { api } from '@/services/api';
import { requestJson } from '@/services/api/client';

interface BackupAuditorProps {
  token: string;
  apiBaseUrl: string;
  fetchJobs: () => Promise<void>;
  setTrackedJobs: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function BackupAuditor({
  token,
  apiBaseUrl,
  fetchJobs,
  setTrackedJobs,
}: BackupAuditorProps) {
  // Backup MS states
  const [backupPathMs, setBackupPathMs] = useState('');
  const [savingBackupPathMs, setSavingBackupPathMs] = useState(false);
  const [auditingMs, setAuditingMs] = useState(false);
  const [auditMsResults, setAuditMsResults] = useState<any>(null);
  const [triggeringAuditMs, setTriggeringAuditMs] = useState(false);

  // Backup CQG states
  const [backupPathCqg, setBackupPathCqg] = useState('');
  const [savingBackupPathCqg, setSavingBackupPathCqg] = useState(false);
  const [auditingCqg, setAuditingCqg] = useState(false);
  const [auditCqgResults, setAuditCqgResults] = useState<any>(null);
  const [triggeringAuditCqg, setTriggeringAuditCqg] = useState(false);

  // Backup ACM states
  const [backupPathAcm, setBackupPathAcm] = useState('');
  const [auditingAcm, setAuditingAcm] = useState(false);
  const [auditAcmResults, setAuditAcmResults] = useState<any>(null);
  const [triggeringAuditAcm, setTriggeringAuditAcm] = useState(false);

  // CAST download trigger state
  const [backupPathCast, setBackupPathCast] = useState('');
  const [triggeringCastDownload, setTriggeringCastDownload] = useState(false);

  // Margin Decision folder path state
  const [marginDecisionPath, setMarginDecisionPath] = useState('');
  const [savingMarginPath, setSavingMarginPath] = useState(false);

  // Excel Macro Lot Consolidation state
  const [macroLotPath, setMacroLotPath] = useState('');
  const [macroLotScriptPath, setMacroLotScriptPath] = useState('');
  const [pythonExe, setPythonExe] = useState('python');
  const [targetRoot, setTargetRoot] = useState('');
  const [savingMacroConfig, setSavingMacroConfig] = useState(false);
  const [triggeringMacroLot, setTriggeringMacroLot] = useState(false);

  // Excel Macro Value state
  const [macroValuePath, setMacroValuePath] = useState('');
  const [macroValueScriptPath, setMacroValueScriptPath] = useState('');
  const [savingValueMacroConfig, setSavingValueMacroConfig] = useState(false);
  const [triggeringMacroValue, setTriggeringMacroValue] = useState(false);

  // Fetch initial paths
  const fetchPaths = async () => {
    if (!token) return;
    try {
      // Backup MS path
      try {
        const backupData = await requestJson<any>('/api/v1/bot-engine/backup-ms/config', {}, token);
        if (backupData?.backupPath) {
          setBackupPathMs(backupData.backupPath);
        }
      } catch {}

      // Backup CQG path
      try {
        const backupCqgData = await requestJson<any>('/api/v1/bot-engine/backup-cqg/config', {}, token);
        if (backupCqgData?.backupPath) {
          setBackupPathCqg(backupCqgData.backupPath);
          setBackupPathCast(backupCqgData.backupPath);
        }
      } catch {}

      // Backup ACM path
      try {
        const backupAcmData = await requestJson<any>('/api/v1/bot-engine/backup-acm/config', {}, token);
        if (backupAcmData?.backupPath) {
          setBackupPathAcm(backupAcmData.backupPath);
        }
      } catch {}

      // Macro Lot config
      try {
        const macroData = await requestJson<any>('/api/v1/bot-engine/macro-lot/config', {}, token);
        if (macroData?.macroPath) setMacroLotPath(macroData.macroPath);
        if (macroData?.scriptPath) setMacroLotScriptPath(macroData.scriptPath);
        if (macroData?.pythonExe) setPythonExe(macroData.pythonExe);
        if (macroData?.targetRoot) setTargetRoot(macroData.targetRoot);
      } catch {}

      // Macro Value config
      try {
        const macroValueData = await requestJson<any>('/api/v1/bot-engine/macro-value/config', {}, token);
        if (macroValueData?.macroPath) setMacroValuePath(macroValueData.macroPath);
        if (macroValueData?.scriptPath) setMacroValueScriptPath(macroValueData.scriptPath);
      } catch {}

      // Margin Decision folder path setting
      try {
        const marginData = await requestJson<any>('/api/v1/system-settings/margin_decision_folder_path', {}, token);
        if (marginData?.value) {
          setMarginDecisionPath(marginData.value);
        }
      } catch {}
    } catch (err) {
      console.error('Failed to fetch backup path configurations', err);
    }
  };

  useEffect(() => {
    fetchPaths();
  }, [token]);

  // MS Backup Config
  const handleSaveBackupMsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingBackupPathMs(true);
    try {
      const data = await requestJson<any>(
        '/api/v1/bot-engine/backup-ms/config',
        {
          method: 'POST',
          body: JSON.stringify({ backupPath: backupPathMs }),
        },
        token,
      );
      toast.success(data?.message || 'Đã lưu đường dẫn backup MS thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình');
    } finally {
      setSavingBackupPathMs(false);
    }
  };

  const handleAuditMsBackup = async () => {
    if (!token) return;
    setAuditingMs(true);
    setAuditMsResults(null);
    const toastId = toast.loading('Đang scan thư mục backup MS...');
    try {
      const data = await api.ingress.auditMsBackup(undefined, token);
      setAuditMsResults(data);
      const { ok, missing, outdated } = (data as any)?.summary || {};
      toast.success(`Quét xong! OK: ${ok ?? 0}, Thiếu: ${missing ?? 0}, Cũ: ${outdated ?? 0}`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kiểm tra backup', { id: toastId });
    } finally {
      setAuditingMs(false);
    }
  };

  const handleTriggerAuditMs = async () => {
    if (!token) return;
    setTriggeringAuditMs(true);
    const toastId = toast.loading('Đang khởi tạo job tải bổ sung file thiếu...');
    try {
      const data = await requestJson<any>(
        '/api/v1/bot-engine/trigger-audit-ms',
        { method: 'POST' },
        token,
      );
      toast.success('Đã xếp hàng job kiểm tra & tải bổ sung file MS thành công!', { id: toastId });
      if (data?.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi chạy bot recovery', { id: toastId });
    } finally {
      setTriggeringAuditMs(false);
    }
  };

  // CQG Backup Config
  const handleSaveBackupCqgConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingBackupPathCqg(true);
    try {
      const data = await requestJson<any>(
        '/api/v1/bot-engine/backup-cqg/config',
        {
          method: 'POST',
          body: JSON.stringify({ backupPath: backupPathCqg }),
        },
        token,
      );
      toast.success(data?.message || 'Đã lưu đường dẫn backup CQG thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình');
    } finally {
      setSavingBackupPathCqg(false);
    }
  };

  const handleAuditCqgBackup = async () => {
    if (!token) return;
    setAuditingCqg(true);
    setAuditCqgResults(null);
    const toastId = toast.loading('Đang scan thư mục backup CQG...');
    try {
      const data = await api.ingress.auditCqgBackup(undefined, token);
      setAuditCqgResults(data);
      const { ok, missing, outdated } = (data as any)?.summary || {};
      toast.success(`Quét xong! OK: ${ok ?? 0}, Thiếu: ${missing ?? 0}, Cũ: ${outdated ?? 0}`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kiểm tra backup CQG', { id: toastId });
    } finally {
      setAuditingCqg(false);
    }
  };

  const handleTriggerAuditCqg = async () => {
    if (!token) return;
    setTriggeringAuditCqg(true);
    const toastId = toast.loading('Đang khởi tạo job ghép file backup CQG...');
    try {
      const data = await requestJson<any>(
        '/api/v1/bot-engine/trigger-audit-cqg',
        { method: 'POST' },
        token,
      );
      toast.success('Đã xếp hàng job tự động ghép file CQG thành công!', { id: toastId });
      if (data?.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi chạy bot CQG merge', { id: toastId });
    } finally {
      setTriggeringAuditCqg(false);
    }
  };

  // ACM Backup Config
  const handleAuditAcmBackup = async () => {
    if (!token) return;
    setAuditingAcm(true);
    setAuditAcmResults(null);
    const toastId = toast.loading('Đang scan thư mục backup ACM...');
    try {
      const data = await api.ingress.auditAcmBackup(undefined, token);
      setAuditAcmResults(data);
      const { ok, missing, outdated } = (data as any)?.summary || {};
      toast.success(`Quét xong! OK: ${ok ?? 0}, Thiếu: ${missing ?? 0}, Cũ: ${outdated ?? 0}`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kiểm tra backup ACM', { id: toastId });
    } finally {
      setAuditingAcm(false);
    }
  };

  const handleTriggerAuditAcm = async () => {
    if (!token) return;
    setTriggeringAuditAcm(true);
    const toastId = toast.loading('Đang khởi tạo job tải file backup ACM...');
    try {
      const data = await requestJson<any>(
        '/api/v1/bot-engine/trigger-audit-acm',
        { method: 'POST' },
        token,
      );
      toast.success('Đã xếp hàng job tự động tải file ACM thành công!', { id: toastId });
      if (data?.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi chạy bot ACM', { id: toastId });
    } finally {
      setTriggeringAuditAcm(false);
    }
  };

  // Margin decision config
  const handleSaveMarginPathConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingMarginPath(true);
    try {
      await api.admin.saveSystemSetting('margin_decision_folder_path', marginDecisionPath, token);
      toast.success('Đã lưu đường dẫn thư mục Quyết định Ký quỹ thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình');
    } finally {
      setSavingMarginPath(false);
    }
  };

  // CQG CAST Download trigger
  const handleTriggerCastDownload = async () => {
    if (!token) return;
    setTriggeringCastDownload(true);
    const toastId = toast.loading('Đang khởi tạo job tải báo cáo CQG CAST...');
    try {
      const data = await requestJson<any>(
        '/api/v1/bot-engine/trigger-cast-download',
        {
          method: 'POST',
          body: JSON.stringify({ backupPath: backupPathCast }),
        },
        token,
      );
      toast.success('Đã xếp hàng job tự động tải báo cáo CQG CAST thành công!', { id: toastId });
      if (data?.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi chạy bot CQG CAST', { id: toastId });
    } finally {
      setTriggeringCastDownload(false);
    }
  };

  // Macro Lot Save
  const handleSaveMacroLotConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingMacroConfig(true);
    try {
      const data = await requestJson<any>(
        '/api/v1/bot-engine/macro-lot/config',
        {
          method: 'POST',
          body: JSON.stringify({
            macroPath: macroLotPath,
            scriptPath: macroLotScriptPath,
            pythonExe,
            targetRoot,
          }),
        },
        token,
      );
      toast.success(data?.message || 'Đã lưu cấu hình macro Excel thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình');
    } finally {
      setSavingMacroConfig(false);
    }
  };

  // Trigger Macro Lot script
  const handleTriggerLotMacro = async () => {
    if (!token) return;
    setTriggeringMacroLot(true);
    const toastId = toast.loading('Đang khởi tạo job chạy Excel Macro...');
    try {
      const data = await api.ccpClearing.triggerLotMacro(token);
      toast.success('Đã xếp hàng job chạy Excel Macro thành công!', { id: toastId });
      if (data?.jobId) {
        const newJobId = data.jobId;
        setTrackedJobs((prev) => [...prev, newJobId]);
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi chạy macro', { id: toastId });
    } finally {
      setTriggeringMacroLot(false);
    }
  };

  // Macro Value Save
  const handleSaveMacroValueConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingValueMacroConfig(true);
    try {
      const data = await requestJson<any>(
        '/api/v1/bot-engine/macro-value/config',
        {
          method: 'POST',
          body: JSON.stringify({
            macroPath: macroValuePath,
            scriptPath: macroValueScriptPath,
          }),
        },
        token,
      );
      toast.success(data?.message || 'Đã lưu cấu hình macro Excel giá trị thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình');
    } finally {
      setSavingValueMacroConfig(false);
    }
  };

  // Trigger Macro Value script
  const handleTriggerValueMacro = async () => {
    if (!token) return;
    setTriggeringMacroValue(true);
    const toastId = toast.loading('Đang khởi tạo job chạy Excel Macro Giá trị...');
    try {
      const data = await api.ccpClearing.triggerValueMacro(token);
      toast.success('Đã xếp hàng job chạy Excel Macro Giá trị thành công!', { id: toastId });
      if (data?.jobId) {
        const newJobId = data.jobId;
        setTrackedJobs((prev) => [...prev, newJobId]);
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi chạy macro', { id: toastId });
    } finally {
      setTriggeringMacroValue(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    display: 'block',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', color: 'var(--text-primary)' }} className="animate-fade-in">
      {/* 1. Backup MS Audit */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', margin: 0 }}>
          <Settings size={18} color="#10b981" />
          Kiểm tra & Đồng bộ File Backup MS
        </h4>
        <form onSubmit={handleSaveBackupMsConfig} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <label style={labelStyle}>
              Đường dẫn thư mục backup MS của IT Tool
            </label>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
              value={backupPathMs}
              onChange={(e) => setBackupPathMs(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={savingBackupPathMs} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '8px 16px', fontWeight: 600, height: '36px' }}>
            {savingBackupPathMs ? 'Đang lưu...' : 'Lưu đường dẫn'}
          </button>
        </form>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleAuditMsBackup}
            disabled={auditingMs || triggeringAuditMs}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={14} className={auditingMs ? 'animate-spin' : ''} />
            Quét thư mục backup MS
          </button>
          <button
            type="button"
            onClick={handleTriggerAuditMs}
            disabled={auditingMs || triggeringAuditMs}
            className="btn btn-primary"
            style={{ fontSize: '0.75rem', padding: '8px 18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Cpu size={14} className={triggeringAuditMs ? 'animate-pulse' : ''} />
            Tải bổ sung file thiếu MS
          </button>
        </div>

        {/* MS Results Table */}
        {auditMsResults && renderAuditResultsTable(auditMsResults)}
      </div>

      {/* 2. Backup CQG Audit */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', margin: 0 }}>
          <Settings size={18} color="#f59e0b" />
          Kiểm tra & Đồng bộ File Backup CQG
        </h4>
        <form onSubmit={handleSaveBackupCqgConfig} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <label style={labelStyle}>
              Đường dẫn thư mục backup CQG của IT Tool
            </label>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
              value={backupPathCqg}
              onChange={(e) => setBackupPathCqg(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={savingBackupPathCqg} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '8px 16px', fontWeight: 600, height: '36px' }}>
            {savingBackupPathCqg ? 'Đang lưu...' : 'Lưu đường dẫn'}
          </button>
        </form>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleAuditCqgBackup}
            disabled={auditingCqg || triggeringAuditCqg}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={14} className={auditingCqg ? 'animate-spin' : ''} />
            Quét thư mục backup CQG
          </button>
          <button
            type="button"
            onClick={handleTriggerAuditCqg}
            disabled={auditingCqg || triggeringAuditCqg}
            className="btn btn-primary"
            style={{ fontSize: '0.75rem', padding: '8px 18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Cpu size={14} className={triggeringAuditCqg ? 'animate-pulse' : ''} />
            Ghép file backup CQG
          </button>
        </div>

        {/* CQG Results Table */}
        {auditCqgResults && renderAuditResultsTable(auditCqgResults, true)}
      </div>

      {/* 3. Backup ACM Audit */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', margin: 0 }}>
          <Settings size={18} color="#0284c7" />
          Kiểm tra & Đồng bộ File Backup ACM (Web & SFTP)
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={labelStyle}>
            Thư mục backup ACM (Tự động đồng bộ theo cấu hình Backup MS)
          </label>
          <input
            type="text"
            className="form-input"
            style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%', opacity: 0.7, cursor: 'not-allowed', backgroundColor: 'var(--bg-input)' }}
            value={backupPathAcm}
            disabled
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            * Thư mục ACM tự động được nhận diện song song với Futures của Backup MS.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleAuditAcmBackup}
            disabled={auditingAcm || triggeringAuditAcm}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={14} className={auditingAcm ? 'animate-spin' : ''} />
            Quét thư mục backup ACM
          </button>
          <button
            type="button"
            onClick={handleTriggerAuditAcm}
            disabled={auditingAcm || triggeringAuditAcm}
            className="btn btn-primary"
            style={{ fontSize: '0.75rem', padding: '8px 18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Cpu size={14} className={triggeringAuditAcm ? 'animate-pulse' : ''} />
            Đồng bộ Backup ACM
          </button>
        </div>

        {/* ACM Results Table */}
        {auditAcmResults && renderAuditResultsTable(auditAcmResults)}
      </div>

      {/* 4. CQG CAST & Margin folder path */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* CAST */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', margin: 0 }}>
            <Download size={16} color="#0284c7" />
            Báo cáo CQG CAST
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Thư mục tải báo cáo CQG CAST</label>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
                value={backupPathCast}
                onChange={(e) => setBackupPathCast(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handleTriggerCastDownload}
              disabled={triggeringCastDownload}
              className="btn btn-primary"
              style={{ fontSize: '0.75rem', padding: '8px 16px', fontWeight: 700, width: 'fit-content', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Cpu size={14} className={triggeringCastDownload ? 'animate-pulse' : ''} />
              Tải báo cáo CQG CAST
            </button>
          </div>
        </div>

        {/* Margin Decision */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', margin: 0 }}>
            <FolderOpen size={16} color="#10b981" />
            Thư mục Quyết định Ký quỹ
          </h4>
          <form onSubmit={handleSaveMarginPathConfig} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>
                Đường dẫn chứa các file QĐ ban hành mức ký quỹ (.docx)
              </label>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
                value={marginDecisionPath}
                onChange={(e) => setMarginDecisionPath(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={savingMarginPath}
              className="btn btn-primary"
              style={{ fontSize: '0.75rem', padding: '8px 16px', fontWeight: 700, width: 'fit-content', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={14} />
              Lưu đường dẫn
            </button>
          </form>
        </div>
      </div>

      {/* 5. Python Excel Macros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Macro Lot */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', margin: 0 }}>
            <BarChart2 size={16} color="#0284c7" />
            Excel Macro Thống Kê Số Lot
          </h4>
          <form onSubmit={handleSaveMacroLotConfig} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Đường dẫn file Excel Macro (.xlsm)</label>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
                value={macroLotPath}
                onChange={(e) => setMacroLotPath(e.target.value)}
                placeholder="C:\...\Macro thong ke so lot giao dich có ACM.xlsm"
              />
            </div>
            <div>
              <label style={labelStyle}>Script Python (.py) thực thi</label>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                value={macroLotScriptPath}
                onChange={(e) => setMacroLotScriptPath(e.target.value)}
                placeholder="C:\POC\scripts\run_lot_macro.py"
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', marginTop: '8px', flexWrap: 'wrap' }}>
              <button type="submit" disabled={savingMacroConfig} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '8px 14px' }}>
                Lưu cấu hình Macro
              </button>
              <button
                type="button"
                onClick={handleTriggerLotMacro}
                disabled={triggeringMacroLot}
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '8px 16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Play size={12} />
                Chạy Script Macro Lot
              </button>
            </div>
          </form>
        </div>

        {/* Macro Value */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', margin: 0 }}>
            <BarChart2 size={16} color="#f59e0b" />
            Excel Macro Giá Trị Giao Dịch
          </h4>
          <form onSubmit={handleSaveMacroValueConfig} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Đường dẫn file Excel Macro Giá Trị (.xlsm)</label>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
                value={macroValuePath}
                onChange={(e) => setMacroValuePath(e.target.value)}
                placeholder="C:\...\Macro thong ke gia tri giao dich.xlsm"
              />
            </div>
            <div>
              <label style={labelStyle}>Script Python (.py) thực thi</label>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                value={macroValueScriptPath}
                onChange={(e) => setMacroValueScriptPath(e.target.value)}
                placeholder="C:\POC\scripts\run_value_macro.py"
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', marginTop: '8px', flexWrap: 'wrap' }}>
              <button type="submit" disabled={savingValueMacroConfig} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '8px 14px' }}>
                Lưu cấu hình Macro
              </button>
              <button
                type="button"
                onClick={handleTriggerValueMacro}
                disabled={triggeringMacroValue}
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '8px 16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Play size={12} />
                Chạy Script Macro Value
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Sub-render function for audit table
function renderAuditResultsTable(auditResults: any, isCqg = false) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.7rem', fontWeight: 600 }}>
        <span style={{ backgroundColor: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '4px 10px', borderRadius: '6px' }}>
          Tổng số file: {auditResults.summary.total}
        </span>
        <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 10px', borderRadius: '6px' }}>
          Đầy đủ (Hôm nay): {auditResults.summary.ok}
        </span>
        {auditResults.summary.missing > 0 && (
          <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 10px', borderRadius: '6px' }}>
            Thiếu: {auditResults.summary.missing}
          </span>
        )}
        {auditResults.summary.outdated > 0 && (
          <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '4px 10px', borderRadius: '6px' }}>
            Cũ: {auditResults.summary.outdated}
          </span>
        )}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '260px' }}>
        <table style={{ width: '100%', textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700, zIndex: 10 }}>
            <tr>
              <th style={{ padding: '10px 12px' }}>Tên File</th>
              <th style={{ padding: '10px 12px', width: '100px' }}>Trạng thái</th>
              {isCqg && <th style={{ padding: '10px 12px', width: '120px' }}>Loại file</th>}
              <th style={{ padding: '10px 12px', width: '160px' }}>Thời gian sửa đổi</th>
            </tr>
          </thead>
          <tbody>
            {auditResults.files.map((file: any) => (
              <tr key={file.key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{file.filename}</td>
                <td style={{ padding: '10px 12px' }}>
                  {file.status === 'OK' ? (
                    <span style={{ color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.12)', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>OK</span>
                  ) : file.status === 'OUTDATED' ? (
                    <span style={{ color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.12)', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>FILE CŨ</span>
                  ) : (
                    <span style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.12)', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>THIẾU</span>
                  )}
                </td>
                {isCqg && (
                  <td style={{ padding: '10px 12px' }}>
                    {file.type === 'RAW' ? (
                      <span style={{ color: '#0284c7', fontSize: '0.7rem' }}>File thô</span>
                    ) : file.type === 'CONSOLIDATED' ? (
                      <span style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 600 }}>Tự động gộp</span>
                    ) : (
                      <span style={{ color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700 }}>Thủ công</span>
                    )}
                  </td>
                )}
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  {file.lastModified ? new Date(file.lastModified).toLocaleString('vi-VN') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
