'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Settings,
  RefreshCw,
  Cpu,
  Save,
  BarChart2,
  FileText,
  Download,
  AlertTriangle,
  FolderOpen,
  Play,
} from 'lucide-react';

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
  const [backupPathMs, setBackupPathMs] = useState('C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures');
  const [savingBackupPathMs, setSavingBackupPathMs] = useState(false);
  const [auditingMs, setAuditingMs] = useState(false);
  const [auditMsResults, setAuditMsResults] = useState<any>(null);
  const [triggeringAuditMs, setTriggeringAuditMs] = useState(false);

  // Backup CQG states
  const [backupPathCqg, setBackupPathCqg] = useState('M:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures');
  const [savingBackupPathCqg, setSavingBackupPathCqg] = useState(false);
  const [auditingCqg, setAuditingCqg] = useState(false);
  const [auditCqgResults, setAuditCqgResults] = useState<any>(null);
  const [triggeringAuditCqg, setTriggeringAuditCqg] = useState(false);

  // Backup ACM states
  const [backupPathAcm, setBackupPathAcm] = useState('C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup ACM\\Futures');
  const [savingBackupPathAcm, setSavingBackupPathAcm] = useState(false);
  const [auditingAcm, setAuditingAcm] = useState(false);
  const [auditAcmResults, setAuditAcmResults] = useState<any>(null);
  const [triggeringAuditAcm, setTriggeringAuditAcm] = useState(false);

  // CAST download trigger state
  const [backupPathCast, setBackupPathCast] = useState('C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures');
  const [triggeringCastDownload, setTriggeringCastDownload] = useState(false);

  // Margin Decision folder path state
  const [marginDecisionPath, setMarginDecisionPath] = useState('M:\\Quanlygiaodich\\Tai lieu hoat dong\\Quyết định - Thông báo\\2. QĐ ban hành mức ký quỹ');
  const [savingMarginPath, setSavingMarginPath] = useState(false);

  // Excel Macro Lot Consolidation state
  const [macroLotPath, setMacroLotPath] = useState('');
  const [macroLotScriptPath, setMacroLotScriptPath] = useState('');
  const [pythonExe, setPythonExe] = useState('python');
  const [targetRoot, setTargetRoot] = useState('M:\\Quanlygiaodich\\Tai lieu hoat dong');
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
      const backupRes = await fetch(`${apiBaseUrl}/api/v1/bot-engine/backup-ms/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (backupRes.ok) {
        const backupData = await backupRes.json();
        if (backupData.backupPath) {
          setBackupPathMs(backupData.backupPath);
          setBackupPathCast(backupData.backupPath);
        }
      }

      // Backup CQG path
      const backupCqgRes = await fetch(`${apiBaseUrl}/api/v1/bot-engine/backup-cqg/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (backupCqgRes.ok) {
        const backupCqgData = await backupCqgRes.json();
        if (backupCqgData.backupPath) {
          setBackupPathCqg(backupCqgData.backupPath);
        }
      }

      // Backup ACM path
      const backupAcmRes = await fetch(`${apiBaseUrl}/api/v1/bot-engine/backup-acm/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (backupAcmRes.ok) {
        const backupAcmData = await backupAcmRes.json();
        if (backupAcmData.backupPath) {
          setBackupPathAcm(backupAcmData.backupPath);
        }
      }

      // Macro Lot config
      const macroRes = await fetch(`${apiBaseUrl}/api/v1/bot-engine/macro-lot/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (macroRes.ok) {
        const macroData = await macroRes.json();
        if (macroData.macroPath) setMacroLotPath(macroData.macroPath);
        if (macroData.scriptPath) setMacroLotScriptPath(macroData.scriptPath);
        if (macroData.pythonExe) setPythonExe(macroData.pythonExe);
        if (macroData.targetRoot) setTargetRoot(macroData.targetRoot);
      }

      // Macro Value config
      const macroValueRes = await fetch(`${apiBaseUrl}/api/v1/bot-engine/macro-value/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (macroValueRes.ok) {
        const macroValueData = await macroValueRes.json();
        if (macroValueData.macroPath) setMacroValuePath(macroValueData.macroPath);
        if (macroValueData.scriptPath) setMacroValueScriptPath(macroValueData.scriptPath);
      }

      // Margin Decision folder path setting
      const marginRes = await fetch(`${apiBaseUrl}/api/v1/system-settings/margin_decision_folder_path`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (marginRes.ok) {
        const marginData = await marginRes.json();
        if (marginData.value) {
          setMarginDecisionPath(marginData.value);
        }
      }
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
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/backup-ms/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ backupPath: backupPathMs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi lưu cấu hình');
      toast.success(data.message || 'Đã lưu đường dẫn backup MS thành công!');
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
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/audit-ms-backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi quét thư mục backup');
      setAuditMsResults(data);
      const { ok, missing, outdated } = data.summary;
      toast.success(`Quét xong! OK: ${ok}, Thiếu: ${missing}, Cũ: ${outdated}`, { id: toastId });
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
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/trigger-audit-ms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã xếp hàng job kiểm tra & tải bổ sung file MS thành công!', { id: toastId });
      if (data.jobId) {
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
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/backup-cqg/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ backupPath: backupPathCqg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi lưu cấu hình');
      toast.success(data.message || 'Đã lưu đường dẫn backup CQG thành công!');
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
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/audit-cqg-backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi quét thư mục backup CQG');
      setAuditCqgResults(data);
      const { ok, missing, outdated } = data.summary;
      toast.success(`Quét xong! OK: ${ok}, Thiếu: ${missing}, Cũ: ${outdated}`, { id: toastId });
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
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/trigger-audit-cqg`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã xếp hàng job tự động ghép file CQG thành công!', { id: toastId });
      if (data.jobId) {
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
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/audit-acm-backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi quét thư mục backup ACM');
      setAuditAcmResults(data);
      const { ok, missing, outdated } = data.summary;
      toast.success(`Quét xong! OK: ${ok}, Thiếu: ${missing}, Cũ: ${outdated}`, { id: toastId });
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
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/trigger-audit-acm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã xếp hàng job tự động tải file ACM thành công!', { id: toastId });
      if (data.jobId) {
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
      const res = await fetch(`${apiBaseUrl}/api/v1/system-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key: 'margin_decision_folder_path',
          value: marginDecisionPath,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi lưu cấu hình');
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
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/trigger-cast-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ backupPath: backupPathCast }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã xếp hàng job tự động tải báo cáo CQG CAST thành công!', { id: toastId });
      if (data.jobId) {
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
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/macro-lot/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          macroPath: macroLotPath,
          scriptPath: macroLotScriptPath,
          pythonExe,
          targetRoot,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi lưu cấu hình');
      toast.success(data.message || 'Đã lưu cấu hình macro Excel thành công!');
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
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/trigger-lot-macro`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã xếp hàng job chạy Excel Macro thành công!', { id: toastId });
      if (data.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
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
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/macro-value/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          macroPath: macroValuePath,
          scriptPath: macroValueScriptPath,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi lưu cấu hình');
      toast.success(data.message || 'Đã lưu cấu hình macro Excel giá trị thành công!');
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
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/trigger-value-macro`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã xếp hàng job chạy Excel Macro Giá trị thành công!', { id: toastId });
      if (data.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi chạy macro', { id: toastId });
    } finally {
      setTriggeringMacroValue(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in text-zinc-300">
      {/* 1. Backup MS Audit */}
      <div className="glass-panel p-6 flex flex-col gap-4">
        <h4 className="text-md font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
          <Settings size={18} className="text-emerald-500" />
          Kiểm tra & Đồng bộ File Backup MS
        </h4>
        <form onSubmit={handleSaveBackupMsConfig} className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <label className="text-xs font-semibold text-zinc-400 block mb-1">
              Đường dẫn thư mục backup MS của IT Tool
            </label>
            <input
              type="text"
              className="form-input"
              value={backupPathMs}
              onChange={(e) => setBackupPathMs(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={savingBackupPathMs} className="btn btn-secondary py-2.5 px-4 text-xs font-semibold whitespace-nowrap">
            {savingBackupPathMs ? 'Đang lưu...' : 'Lưu đường dẫn'}
          </button>
        </form>

        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleAuditMsBackup}
            disabled={auditingMs || triggeringAuditMs}
            className="btn btn-secondary flex items-center gap-2 text-xs"
          >
            <RefreshCw size={14} className={auditingMs ? 'animate-spin' : ''} />
            Quét thư mục backup MS
          </button>
          <button
            type="button"
            onClick={handleTriggerAuditMs}
            disabled={auditingMs || triggeringAuditMs}
            className="btn btn-primary flex items-center gap-2 text-xs font-bold"
          >
            <Cpu size={14} className={triggeringAuditMs ? 'animate-pulse' : ''} />
            🤖 Tải bổ sung file thiếu MS
          </button>
        </div>

        {/* MS Results Table */}
        {auditMsResults && renderAuditResultsTable(auditMsResults)}
      </div>

      {/* 2. Backup CQG Audit */}
      <div className="glass-panel p-6 flex flex-col gap-4">
        <h4 className="text-md font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
          <Settings size={18} className="text-amber-500" />
          Kiểm tra & Đồng bộ File Backup CQG
        </h4>
        <form onSubmit={handleSaveBackupCqgConfig} className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <label className="text-xs font-semibold text-zinc-400 block mb-1">
              Đường dẫn thư mục backup CQG của IT Tool
            </label>
            <input
              type="text"
              className="form-input"
              value={backupPathCqg}
              onChange={(e) => setBackupPathCqg(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={savingBackupPathCqg} className="btn btn-secondary py-2.5 px-4 text-xs font-semibold whitespace-nowrap">
            {savingBackupPathCqg ? 'Đang lưu...' : 'Lưu đường dẫn'}
          </button>
        </form>

        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleAuditCqgBackup}
            disabled={auditingCqg || triggeringAuditCqg}
            className="btn btn-secondary flex items-center gap-2 text-xs"
          >
            <RefreshCw size={14} className={auditingCqg ? 'animate-spin' : ''} />
            Quét thư mục backup CQG
          </button>
          <button
            type="button"
            onClick={handleTriggerAuditCqg}
            disabled={auditingCqg || triggeringAuditCqg}
            className="btn btn-primary flex items-center gap-2 text-xs font-bold"
          >
            <Cpu size={14} className={triggeringAuditCqg ? 'animate-pulse' : ''} />
            🤖 Ghép file backup CQG
          </button>
        </div>

        {/* CQG Results Table */}
        {auditCqgResults && renderAuditResultsTable(auditCqgResults, true)}
      </div>

      {/* 3. Backup ACM Audit */}
      <div className="glass-panel p-6 flex flex-col gap-4">
        <h4 className="text-md font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
          <Settings size={18} className="text-sky-500" />
          Kiểm tra & Đồng bộ File Backup ACM (Web & SFTP)
        </h4>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-400">
            Thư mục backup ACM (Tự động đồng bộ theo cấu hình Backup MS)
          </label>
          <input
            type="text"
            className="form-input bg-zinc-950/65 text-zinc-500 cursor-not-allowed border-zinc-850"
            value={backupPathAcm}
            disabled
          />
          <span className="text-[10px] text-zinc-500">
            * Thư mục ACM tự động được nhận diện song song với Futures của Backup MS.
          </span>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleAuditAcmBackup}
            disabled={auditingAcm || triggeringAuditAcm}
            className="btn btn-secondary flex items-center gap-2 text-xs"
          >
            <RefreshCw size={14} className={auditingAcm ? 'animate-spin' : ''} />
            Quét thư mục backup ACM
          </button>
          <button
            type="button"
            onClick={handleTriggerAuditAcm}
            disabled={auditingAcm || triggeringAuditAcm}
            className="btn btn-primary flex items-center gap-2 text-xs font-bold"
          >
            <Cpu size={14} className={triggeringAuditAcm ? 'animate-pulse' : ''} />
            🤖 Đồng bộ Backup ACM
          </button>
        </div>

        {/* ACM Results Table */}
        {auditAcmResults && renderAuditResultsTable(auditAcmResults)}
      </div>

      {/* 4. CQG CAST & Margin folder path */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CAST */}
        <div className="glass-panel p-6 flex flex-col gap-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-2">
            <Download size={16} className="text-sky-400" />
            Báo cáo CQG CAST
          </h4>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Thư mục tải báo cáo CQG CAST</label>
              <input
                type="text"
                className="form-input text-xs"
                value={backupPathCast}
                onChange={(e) => setBackupPathCast(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handleTriggerCastDownload}
              disabled={triggeringCastDownload}
              className="btn btn-primary text-xs py-2 font-bold w-fit flex items-center gap-2"
            >
              <Cpu size={14} className={triggeringCastDownload ? 'animate-pulse' : ''} />
              Tải báo cáo CQG CAST
            </button>
          </div>
        </div>

        {/* Margin Decision */}
        <div className="glass-panel p-6 flex flex-col gap-4 justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-2">
            <FolderOpen size={16} className="text-emerald-400" />
            Thư mục Quyết định Ký quỹ
          </h4>
          <form onSubmit={handleSaveMarginPathConfig} className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Đường dẫn chứa các file QĐ ban hành mức ký quỹ (.docx)
              </label>
              <input
                type="text"
                className="form-input text-xs"
                value={marginDecisionPath}
                onChange={(e) => setMarginDecisionPath(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={savingMarginPath}
              className="btn btn-primary text-xs py-2 px-4 font-bold w-fit flex items-center gap-2"
            >
              <Save size={14} />
              Lưu đường dẫn
            </button>
          </form>
        </div>
      </div>

      {/* 5. Python Excel Macros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Macro Lot */}
        <div className="glass-panel p-6 flex flex-col gap-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-2">
            <BarChart2 size={16} className="text-sky-400" />
            Excel Macro Thống Kê Số Lot
          </h4>
          <form onSubmit={handleSaveMacroLotConfig} className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-0.5">Đường dẫn file Excel Macro (.xlsm)</label>
              <input
                type="text"
                className="form-input text-xs"
                value={macroLotPath}
                onChange={(e) => setMacroLotPath(e.target.value)}
                placeholder="C:\...\Macro thong ke so lot giao dich có ACM.xlsm"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-0.5">Script Python (.py) thực thi</label>
              <input
                type="text"
                className="form-input text-xs font-mono"
                value={macroLotScriptPath}
                onChange={(e) => setMacroLotScriptPath(e.target.value)}
                placeholder="C:\POC\scripts\run_lot_macro.py"
              />
            </div>
            <div className="flex gap-2 justify-between mt-2 flex-wrap">
              <button type="submit" disabled={savingMacroConfig} className="btn btn-secondary text-xs py-2 px-3">
                Lưu cấu hình Macro
              </button>
              <button
                type="button"
                onClick={handleTriggerLotMacro}
                disabled={triggeringMacroLot}
                className="btn btn-primary text-xs py-2 px-4 font-bold flex items-center gap-2"
              >
                <Play size={12} />
                Chạy Script Macro Lot
              </button>
            </div>
          </form>
        </div>

        {/* Macro Value */}
        <div className="glass-panel p-6 flex flex-col gap-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-2">
            <BarChart2 size={16} className="text-amber-400" />
            Excel Macro Giá Trị Giao Dịch
          </h4>
          <form onSubmit={handleSaveMacroValueConfig} className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-0.5">Đường dẫn file Excel Macro Giá Trị (.xlsm)</label>
              <input
                type="text"
                className="form-input text-xs"
                value={macroValuePath}
                onChange={(e) => setMacroValuePath(e.target.value)}
                placeholder="C:\...\Macro thong ke gia tri giao dich.xlsm"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-0.5">Script Python (.py) thực thi</label>
              <input
                type="text"
                className="form-input text-xs font-mono"
                value={macroValueScriptPath}
                onChange={(e) => setMacroValueScriptPath(e.target.value)}
                placeholder="C:\POC\scripts\run_value_macro.py"
              />
            </div>
            <div className="flex gap-2 justify-between mt-2 flex-wrap">
              <button type="submit" disabled={savingValueMacroConfig} className="btn btn-secondary text-xs py-2 px-3">
                Lưu cấu hình Macro
              </button>
              <button
                type="button"
                onClick={handleTriggerValueMacro}
                disabled={triggeringMacroValue}
                className="btn btn-primary text-xs py-2 px-4 font-bold flex items-center gap-2"
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
    <div className="flex flex-col gap-3 mt-2">
      <div className="flex gap-2 flex-wrap text-[10px] font-semibold">
        <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-1 rounded">
          Tổng số file: {auditResults.summary.total}
        </span>
        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded">
          Đầy đủ (Hôm nay): {auditResults.summary.ok}
        </span>
        {auditResults.summary.missing > 0 && (
          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded">
            Thiếu: {auditResults.summary.missing}
          </span>
        )}
        {auditResults.summary.outdated > 0 && (
          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded">
            Cũ: {auditResults.summary.outdated}
          </span>
        )}
      </div>

      <div className="overflow-x-auto border border-zinc-800 rounded-lg max-h-64 overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-semibold z-10">
            <tr>
              <th className="p-2.5">Tên File</th>
              <th className="p-2.5 w-24">Trạng thái</th>
              {isCqg && <th className="p-2.5 w-28">Loại file</th>}
              <th className="p-2.5 w-40">Thời gian sửa đổi</th>
            </tr>
          </thead>
          <tbody>
            {auditResults.files.map((file: any) => (
              <tr key={file.key} className="border-b border-zinc-900 hover:bg-zinc-900/20 transition">
                <td className="p-2.5 font-bold text-white text-[11px] font-mono break-all">{file.filename}</td>
                <td className="p-2.5">
                  {file.status === 'OK' ? (
                    <span className="text-emerald-400 bg-emerald-500/10 text-[9px] font-bold px-1.5 py-0.5 rounded">OK</span>
                  ) : file.status === 'OUTDATED' ? (
                    <span className="text-amber-400 bg-amber-500/10 text-[9px] font-bold px-1.5 py-0.5 rounded">FILE CŨ</span>
                  ) : (
                    <span className="text-red-400 bg-red-500/10 text-[9px] font-bold px-1.5 py-0.5 rounded">THIẾU</span>
                  )}
                </td>
                {isCqg && (
                  <td className="p-2.5">
                    {file.type === 'RAW' ? (
                      <span className="text-sky-400 text-[10px]">File thô</span>
                    ) : file.type === 'CONSOLIDATED' ? (
                      <span className="text-emerald-400 text-[10px] font-semibold">Tự động gộp</span>
                    ) : (
                      <span className="text-amber-400 text-[10px] font-bold">Thủ công</span>
                    )}
                  </td>
                )}
                <td className="p-2.5 text-zinc-500 text-[10px]">
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
