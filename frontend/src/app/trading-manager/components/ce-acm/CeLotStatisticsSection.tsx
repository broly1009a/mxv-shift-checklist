'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Play,
  FileSpreadsheet,
  Save,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Layers,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Info,
  DollarSign,
  Activity,
  Folder,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';
import SmartPathInput from '@/components/admin/SmartPathInput';

export interface CeLotStatisticsSectionProps {
  token: string | null;
  selectedDate: string;
  onOpenGuide?: () => void;
}

interface CeHhStat {
  maHH: string;
  soLot: number;
  giaTri: number;
}

interface CeTvkdStat {
  tvkd: string;
  tenThanhVien?: string;
  soLot: number;
  giaTri: number;
  isFull4Types: boolean;
  missingTypes: string[];
  byHH: CeHhStat[];
  ttmMua: number;
  ttmBan: number;
  ttmLaiLoDuKienVnd: number;
}

interface CeDailyFileInfo {
  present: boolean;
  filename: string;
  size: number;
  path: string;
}

interface CeDailyScanResult {
  folderPath: string;
  exists: boolean;
  canProcess: boolean;
  files: {
    dsgd?: CeDailyFileInfo;
    ttm?: CeDailyFileInfo;
    gtt?: CeDailyFileInfo;
    hh?: CeDailyFileInfo;
    hd?: CeDailyFileInfo;
  };
  dbExchangeRates?: {
    usd: number;
    detectedRate?: number;
    detectedSource?: string;
  };
}

interface CeLotResultData {
  ngayGD: string;
  byTvkd: CeTvkdStat[];
  totalSoLot: number;
  totalGiaTri: number;
  totalTtmMua: number;
  totalTtmBan: number;
  totalTtmLot: number;
  acmLot: number;
  tyGiaUsed: Record<string, number>;
  warnings: string[];
}

export default function CeLotStatisticsSection({
  token,
  selectedDate,
  onOpenGuide,
}: CeLotStatisticsSectionProps) {
  const [scanResult, setScanResult] = useState<CeDailyScanResult | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const scanningRef = useRef<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [writingLot, setWritingLot] = useState<boolean>(false);
  const [writingValue, setWritingValue] = useState<boolean>(false);
  const [result, setResult] = useState<CeLotResultData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Overwrite Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'LOT' | 'VALUE';
    date: string;
    existingTotal: number;
    calculatedTotal: number;
    message: string;
  } | null>(null);

  // Config Modal State
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [backupPathCe, setBackupPathCe] = useState<string>('');
  const [pathAcmLot, setPathAcmLot] = useState<string>('');
  const [pathAcmGtgd, setPathAcmGtgd] = useState<string>('');

  // Table View & Filtering State
  const [searchTvkd, setSearchTvkd] = useState<string>('');
  const [filterActiveOnly, setFilterActiveOnly] = useState<boolean>(false);
  const [filterMissingTypesOnly, setFilterMissingTypesOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'TVKD' | 'COMMODITY'>('TVKD');

  // Load Config
  const fetchConfig = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.ceClearing.getLotConfig(token);
      const cfg = data?.data || data;
      if (cfg) {
        setBackupPathCe(cfg.bot_backup_path_ce || '');
        setPathAcmLot(cfg.ce_path_acm_lot || cfg.pathAcmLot || '');
        setPathAcmGtgd(cfg.ce_path_acm_gtgd || cfg.pathAcmGtgd || '');
      }
    } catch (err: any) {
      console.warn('Lỗi nạp cấu hình CE:', err.message);
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Save Config
  const handleSaveConfig = async () => {
    if (!token) return;
    setSavingConfig(true);
    const toastId = toast.loading('Đang lưu cấu hình thống kê CE...');
    try {
      await api.ceClearing.saveLotConfig(
        {
          bot_backup_path_ce: backupPathCe,
          ce_path_acm_lot: pathAcmLot,
          ce_path_acm_gtgd: pathAcmGtgd,
        },
        token,
      );
      toast.success('Đã lưu cấu hình đường dẫn CE thành công!', { id: toastId });
      setShowConfig(false);
      handleScan(false);
    } catch (err: any) {
      toast.error(`Lỗi lưu cấu hình: ${err.message}`, { id: toastId });
    } finally {
      setSavingConfig(false);
    }
  };

  // Quét thư mục
  const handleScan = useCallback(
    async (showToast: boolean = true) => {
      if (!token || !selectedDate || scanningRef.current) return;
      scanningRef.current = true;
      setScanning(true);
      let toastId: string | undefined;
      if (showToast) toastId = toast.loading(`Đang quét thư mục backup CE ngày ${selectedDate}...`);
      try {
        const data = await api.ceClearing.scanDailyLot(selectedDate, token);
        setScanResult(data?.data || data);
        if (showToast && toastId) {
          if (data?.data?.canProcess) {
            toast.success('Đã tìm thấy file DSGD CE sẵn sàng tính toán!', { id: toastId });
          } else {
            toast('Chưa đủ file DSGD CE trong thư mục ngày.', { icon: 'ℹ️', id: toastId });
          }
        }
      } catch (err: any) {
        if (showToast && toastId) {
          toast.error(`Lỗi quét thư mục CE: ${err.message}`, { id: toastId });
        }
      } finally {
        scanningRef.current = false;
        setScanning(false);
      }
    },
    [token, selectedDate],
  );

  useEffect(() => {
    if (selectedDate && token) {
      handleScan(false);
    }
  }, [selectedDate, token, handleScan]);

  // Tính toán Thống kê
  const handleProcess = async () => {
    if (!token || loading) return;
    setLoading(true);
    const toastId = toast.loading(`Đang tính toán thống kê CE ngày ${selectedDate}...`);
    try {
      const data = await api.ceClearing.processDailyLot(selectedDate, token);
      const res = data?.data || data;
      setResult(res);
      toast.success(
        `Thống kê thành công: ${res.totalSoLot?.toLocaleString('vi-VN')} lot, ${(res.totalGiaTri / 1e9).toFixed(2)} tỷ VND`,
        { id: toastId },
      );
    } catch (err: any) {
      toast.error(`Lỗi tính toán CE: ${err.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Ghi file Số Lot
  const handleRunLot = async (opts?: { forceOverwrite?: boolean; exportDraft?: boolean }) => {
    if (!token || writingLot) return;
    setWritingLot(true);
    const toastId = toast.loading(
      opts?.exportDraft
        ? 'Đang xuất bản nháp Draft Số Lot ACM...'
        : opts?.forceOverwrite
        ? 'Đang ghi đè file lũy kế Số Lot ACM...'
        : 'Đang kiểm tra và ghi Số Lot CE vào file lũy kế...'
    );
    try {
      const data = await api.ceClearing.runLotStatistics(selectedDate, token, opts);
      if (data?.requiresConfirmation) {
        toast.dismiss(toastId);
        setConfirmModal({
          isOpen: true,
          type: 'LOT',
          date: selectedDate,
          existingTotal: data.existingTotal || 0,
          calculatedTotal: result?.totalSoLot || 0,
          message: data.message || `Ngày phiên ${selectedDate} đã có số liệu trong file lũy kế Số Lot ACM.`,
        });
        return;
      }
      if (data?.isDraft) {
        toast.success(`Đã xuất bản nháp: ${data.draftFile}`, { id: toastId });
        if (data.draftFile) {
          await api.ceClearing.downloadDraftFile(data.draftFile, token);
        }
      } else {
        toast.success(data?.message || 'Đã ghi thành công file lũy kế Số Lot ACM!', { id: toastId });
      }
      if (data?.logs) setLogs(data.logs);
      setConfirmModal(null);
    } catch (err: any) {
      toast.error(`Lỗi ghi file Số Lot: ${err.message}`, { id: toastId });
    } finally {
      setWritingLot(false);
    }
  };

  // Ghi file Giá Trị
  const handleRunValue = async (opts?: { forceOverwrite?: boolean; exportDraft?: boolean }) => {
    if (!token || writingValue) return;
    setWritingValue(true);
    const toastId = toast.loading(
      opts?.exportDraft
        ? 'Đang xuất bản nháp Draft GTGD ACM...'
        : opts?.forceOverwrite
        ? 'Đang ghi đè file lũy kế GTGD ACM...'
        : 'Đang kiểm tra và ghi GTGD CE vào file lũy kế...'
    );
    try {
      const data = await api.ceClearing.runValueStatistics(selectedDate, token, opts);
      if (data?.requiresConfirmation) {
        toast.dismiss(toastId);
        setConfirmModal({
          isOpen: true,
          type: 'VALUE',
          date: selectedDate,
          existingTotal: data.existingTotal || 0,
          calculatedTotal: result?.totalGiaTri || 0,
          message: data.message || `Ngày phiên ${selectedDate} đã có số liệu trong file lũy kế GTGD ACM.`,
        });
        return;
      }
      if (data?.isDraft) {
        toast.success(`Đã xuất bản nháp: ${data.draftFile}`, { id: toastId });
        if (data.draftFile) {
          await api.ceClearing.downloadDraftFile(data.draftFile, token);
        }
      } else {
        toast.success(data?.message || 'Đã ghi thành công file lũy kế GTGD ACM!', { id: toastId });
      }
      if (data?.logs) setLogs(data.logs);
      setConfirmModal(null);
    } catch (err: any) {
      toast.error(`Lỗi ghi file GTGD: ${err.message}`, { id: toastId });
    } finally {
      setWritingValue(false);
    }
  };

  // Danh sách hàng hóa động từ kết quả
  const uniqueCommodities = useMemo(() => {
    if (!result?.byTvkd) return ['SI5CO', 'PL1NY', 'CP2CO'];
    const set = new Set<string>();
    for (const t of result.byTvkd) {
      for (const h of t.byHH || []) {
        if (h.maHH) set.add(h.maHH.toUpperCase());
      }
    }
    const arr = Array.from(set);
    return arr.length > 0 ? arr : ['SI5CO', 'PL1NY', 'CP2CO'];
  }, [result]);

  // Lọc dữ liệu bảng
  const filteredTvkd = useMemo(() => {
    if (!result?.byTvkd) return [];
    return result.byTvkd.filter((t) => {
      if (filterActiveOnly && t.soLot <= 0) return false;
      if (filterMissingTypesOnly && t.isFull4Types) return false;
      if (searchTvkd) {
        const q = searchTvkd.trim().toUpperCase();
        const matchCode = t.tvkd.toUpperCase().includes(q);
        const matchName = (t.tenThanhVien || '').toUpperCase().includes(q);
        if (!matchCode && !matchName) return false;
      }
      return true;
    });
  }, [result, filterActiveOnly, filterMissingTypesOnly, searchTvkd]);

  // Tổng hợp theo Hàng hóa
  const commoditySummary = useMemo(() => {
    if (!result?.byTvkd) return [];
    const map = new Map<string, { soLot: number; giaTri: number }>();
    for (const t of result.byTvkd) {
      for (const h of t.byHH || []) {
        const ma = h.maHH.toUpperCase();
        if (!map.has(ma)) map.set(ma, { soLot: 0, giaTri: 0 });
        const entry = map.get(ma)!;
        entry.soLot += h.soLot;
        entry.giaTri += h.giaTri;
      }
    }
    return Array.from(map.entries())
      .map(([maHH, v]) => ({ maHH, ...v }))
      .sort((a, b) => b.soLot - a.soLot);
  }, [result]);

  const activeTvkdCount = useMemo(() => {
    return result?.byTvkd.filter((t) => t.soLot > 0).length || 0;
  }, [result]);

  const missingTypesTvkdCount = useMemo(() => {
    return result?.byTvkd.filter((t) => t.soLot > 0 && !t.isFull4Types).length || 0;
  }, [result]);

  const fmtNum = (n?: number) => (n !== undefined && n !== null ? n.toLocaleString('vi-VN') : '0');
  const fmtMoney = (n?: number) => (n !== undefined && n !== null ? n.toLocaleString('vi-VN') + ' đ' : '0 đ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ===== TOP BAR: KPI METRICS CARDS ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* KPI 1: TỔNG SỐ LOT CE */}
        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Tổng Số Lot CE (ACM)
            </span>
            <Layers size={18} color="#0ea5e9" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, fontFamily: 'monospace', color: '#0ea5e9' }}>
            {fmtNum(result?.totalSoLot || 0)}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Phiên giao dịch: {selectedDate || 'Hôm nay'}
          </span>
        </div>

        {/* KPI 2: TỔNG GIÁ TRỊ GIAO DỊCH (VND) */}
        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Tổng Giá Trị Giao Dịch
            </span>
            <DollarSign size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'monospace', color: '#10b981' }}>
            {result?.totalGiaTri ? (result.totalGiaTri / 1e9).toFixed(2) + ' tỷ' : '0 đ'}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Tỷ giá: {result?.tyGiaUsed?.USD?.toLocaleString('vi-VN') || '25.920'} VND/USD
          </span>
        </div>

        {/* KPI 3: THÀNH VIÊN KINH DOANH */}
        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              TVKD Khớp Lệnh
            </span>
            <Activity size={18} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, fontFamily: 'monospace', color: '#8b5cf6' }}>
            {activeTvkdCount} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ {result?.byTvkd?.length || 0}</span>
          </div>
          <span style={{ fontSize: '0.74rem', color: missingTypesTvkdCount > 0 ? '#ef4444' : '#10b981' }}>
            {missingTypesTvkdCount > 0 ? `${missingTypesTvkdCount} TVKD thiếu 4 loại lệnh` : '100% đủ 4 loại lệnh'}
          </span>
        </div>

        {/* KPI 4: VỊ THẾ MỞ (TTM) */}
        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Vị Thế Mở (TTM CE)
            </span>
            <TrendingUp size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'monospace', color: '#f59e0b' }}>
            {fmtNum(result?.totalTtmMua || 0)} M / {fmtNum(result?.totalTtmBan || 0)} B
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Tổng: {fmtNum(result?.totalTtmLot || 0)} Lot
          </span>
        </div>
      </div>

      {/* ===== ACTION CONTROL BAR ===== */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Nút Quét Thư Mục */}
          <button
            type="button"
            onClick={() => handleScan(true)}
            disabled={scanning || loading}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {scanning ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            <span>{scanning ? 'Đang quét...' : 'Quét Thư Mục CE'}</span>
          </button>

          {/* Nút Tính Toán */}
          <button
            type="button"
            onClick={handleProcess}
            disabled={loading || scanning || !scanResult?.canProcess}
            className="btn"
            style={{
              fontSize: '0.82rem',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: scanResult?.canProcess ? '#0ea5e9' : 'var(--bg-input)',
              color: scanResult?.canProcess ? '#fff' : 'var(--text-muted)',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: scanResult?.canProcess ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            <span>{loading ? 'Đang tính toán...' : 'Tính Toán Thống Kê'}</span>
          </button>

          {/* Nút Ghi File Số Lot */}
          <button
            type="button"
            onClick={() => handleRunLot()}
            disabled={writingLot || !result}
            className="btn btn-secondary"
            style={{
              fontSize: '0.82rem',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: result ? '#10b981' : 'var(--text-muted)',
            }}
          >
            {writingLot ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>Ghi File Số Lot ACM</span>
          </button>

          {/* Nút Ghi File Giá Trị */}
          <button
            type="button"
            onClick={() => handleRunValue()}
            disabled={writingValue || !result}
            className="btn btn-secondary"
            style={{
              fontSize: '0.82rem',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: result ? '#10b981' : 'var(--text-muted)',
            }}
          >
            {writingValue ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>Ghi File GTGD ACM</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Nút Cấu Hình */}
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sliders size={15} />
            <span>Cấu Hình Đường Dẫn</span>
          </button>
        </div>
      </div>

      {/* ===== FILE SCAN BADGES ===== */}
      {scanResult && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            padding: '10px 16px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            fontSize: '0.76rem',
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Folder size={14} color="#0ea5e9" />
            <span>Thư mục:</span>
          </span>
          <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
            {scanResult.folderPath}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: scanResult.files.dsgd ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: scanResult.files.dsgd ? '#10b981' : '#ef4444',
                fontWeight: 700,
              }}
            >
              DSGD CE: {scanResult.files.dsgd ? 'OK' : 'THIẾU'}
            </span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: scanResult.files.ttm ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                color: scanResult.files.ttm ? '#10b981' : 'var(--text-muted)',
                fontWeight: 700,
              }}
            >
              TTM CE: {scanResult.files.ttm ? 'OK' : 'Chưa có'}
            </span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: scanResult.files.gtt ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                color: scanResult.files.gtt ? '#10b981' : 'var(--text-muted)',
                fontWeight: 700,
              }}
            >
              GTT ACM: {scanResult.files.gtt ? 'OK' : 'Chưa có'}
            </span>
          </div>
        </div>
      )}

      {/* ===== CONFIG DRAWER ===== */}
      {showConfig && (
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #0ea5e9',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={16} />
              <span>Cấu Hình Đường Dẫn Thống Kê Core Exchange (CE)</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowConfig(false)}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.74rem' }}
            >
              Đóng
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Thư mục gốc Backup CE (bot_backup_path_ce)
              </label>
              <SmartPathInput
                value={backupPathCe}
                onChange={setBackupPathCe}
                placeholder="M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CE\Futures"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                File lũy kế Số Lot ACM (ce_path_acm_lot)
              </label>
              <SmartPathInput
                value={pathAcmLot}
                onChange={setPathAcmLot}
                placeholder="M:\...\Thong ke ccp\output\Thong ke so lot giao dich ACM 2026.xlsx"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                File lũy kế GTGD ACM (ce_path_acm_gtgd)
              </label>
              <SmartPathInput
                value={pathAcmGtgd}
                onChange={setPathAcmGtgd}
                placeholder="M:\...\Thong ke ccp\output\Thong ke gia tri giao dich ACM 2026.xlsx"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="btn"
              style={{
                padding: '8px 18px',
                backgroundColor: '#0ea5e9',
                color: '#fff',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {savingConfig ? 'Đang lưu...' : 'Lưu Cấu Hình'}
            </button>
          </div>
        </div>
      )}

      {/* ===== RESULTS TABLE SECTION ===== */}
      {result && (
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Table Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setViewMode('TVKD')}
                className="btn"
                style={{
                  fontSize: '0.78rem',
                  padding: '6px 14px',
                  backgroundColor: viewMode === 'TVKD' ? '#0ea5e9' : 'transparent',
                  color: viewMode === 'TVKD' ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                Theo TVKD ({filteredTvkd.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('COMMODITY')}
                className="btn"
                style={{
                  fontSize: '0.78rem',
                  padding: '6px 14px',
                  backgroundColor: viewMode === 'COMMODITY' ? '#0ea5e9' : 'transparent',
                  color: viewMode === 'COMMODITY' ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                Theo Hàng Hóa ({commoditySummary.length})
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {viewMode === 'TVKD' && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <Search size={14} color="var(--text-muted)" />
                    <input
                      type="text"
                      value={searchTvkd}
                      onChange={(e) => setSearchTvkd(e.target.value)}
                      placeholder="Tìm mã hoặc tên TVKD..."
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: '0.78rem',
                        color: 'var(--text-primary)',
                        width: '160px',
                      }}
                    />
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={filterActiveOnly}
                      onChange={(e) => setFilterActiveOnly(e.target.checked)}
                    />
                    <span>Chỉ hiện có Lot</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={filterMissingTypesOnly}
                      onChange={(e) => setFilterMissingTypesOnly(e.target.checked)}
                    />
                    <span style={{ color: filterMissingTypesOnly ? '#ef4444' : 'inherit' }}>Thiếu loại lệnh</span>
                  </label>
                </>
              )}
            </div>
          </div>

          {/* VIEW 1: THEO TVKD */}
          {viewMode === 'TVKD' && (
            <div className="table-responsive-wrapper" style={{ overflowX: 'auto', maxHeight: '600px' }}>
              <table className="custom-table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800 }}>Mã TVKD</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800 }}>Tên Thành Viên</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#0ea5e9' }}>Số Lot</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>GTGD (VND)</th>
                    {uniqueCommodities.map((comm) => (
                      <th key={comm} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800 }}>
                        {comm}
                      </th>
                    ))}
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800 }}>4 Loại Lệnh</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800 }}>TTM (M/B)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTvkd.map((row) => {
                    const hhMap = new Map(row.byHH?.map((h) => [h.maHH.toUpperCase(), h.soLot]) || []);
                    return (
                      <tr
                        key={row.tvkd}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          backgroundColor: row.soLot > 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                        }}
                      >
                        <td style={{ padding: '8px 12px', fontWeight: 800, fontFamily: 'monospace', color: '#0ea5e9' }}>
                          {row.tvkd}
                        </td>
                        <td style={{ padding: '8px 12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.tenThanhVien || '—'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: row.soLot > 0 ? '#0ea5e9' : 'var(--text-muted)' }}>
                          {fmtNum(row.soLot)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: row.giaTri > 0 ? '#10b981' : 'var(--text-muted)' }}>
                          {fmtMoney(row.giaTri)}
                        </td>
                        {uniqueCommodities.map((comm) => {
                          const lot = hhMap.get(comm) || 0;
                          return (
                            <td key={comm} style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: lot > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {lot > 0 ? fmtNum(lot) : '—'}
                            </td>
                          );
                        })}
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {row.soLot > 0 ? (
                            row.isFull4Types ? (
                              <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 800, fontSize: '0.72rem' }}>
                                ĐỦ 4 LOẠI
                              </span>
                            ) : (
                              <span
                                style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 800, fontSize: '0.72rem' }}
                                title={`Thiếu: ${row.missingTypes.join(', ')}`}
                              >
                                THIẾU {row.missingTypes.length}
                              </span>
                            )
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          {row.ttmMua > 0 || row.ttmBan > 0 ? `${fmtNum(row.ttmMua)} / ${fmtNum(row.ttmBan)}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 2: THEO HÀNG HÓA */}
          {viewMode === 'COMMODITY' && (
            <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
              <table className="custom-table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800 }}>Mã Hàng Hóa</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#0ea5e9' }}>Tổng Số Lot</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>Tổng GTGD (VND)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800 }}>Tỷ Trọng Lot (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {commoditySummary.map((item) => {
                    const pct = result.totalSoLot > 0 ? ((item.soLot / result.totalSoLot) * 100).toFixed(1) : '0';
                    return (
                      <tr key={item.maHH} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 800, fontFamily: 'monospace', color: '#0ea5e9' }}>
                          {item.maHH}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#0ea5e9' }}>
                          {fmtNum(item.soLot)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#10b981' }}>
                          {fmtMoney(item.giaTri)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                          {pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== ACCUMULATOR LOGS (NẾU CÓ) ===== */}
      {logs.length > 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '16px 20px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-card)',
            fontSize: '0.74rem',
            fontFamily: 'monospace',
            color: 'var(--text-secondary)',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          <div style={{ fontWeight: 800, color: '#10b981', marginBottom: '6px' }}>
            Nhật Ký Ghi File Lũy Kế:
          </div>
          {logs.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
      )}

      {/* ===== MODAL XÁC NHẬN GHI ĐÈ & TÙY CHỌN DRAFT (ENTERPRISE CONFIRM) ===== */}
      {confirmModal && confirmModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          className="animate-fade-in"
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={24} color="#f59e0b" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Xác Nhận Ghi Đè Dữ Liệu Thống Kê
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Phát hiện dữ liệu ngày phiên {confirmModal.date} đã tồn tại trong file Master
                </span>
              </div>
            </div>

            {/* Modal Content Info Box */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                backgroundColor: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.82rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Loại thống kê:</span>
                <span style={{ fontWeight: 800, color: confirmModal.type === 'LOT' ? '#0ea5e9' : '#10b981' }}>
                  {confirmModal.type === 'LOT' ? 'Số Lot Giao Dịch ACM' : 'Giá Trị Giao Dịch ACM (GTGD)'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Số liệu hiện tại trong file:</span>
                <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#f59e0b' }}>
                  {confirmModal.type === 'LOT'
                    ? `${confirmModal.existingTotal.toLocaleString('vi-VN')} Lot`
                    : `${confirmModal.existingTotal.toLocaleString('vi-VN')} VND`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Số liệu mới tính toán:</span>
                <span style={{ fontWeight: 800, fontFamily: 'monospace', color: confirmModal.type === 'LOT' ? '#0ea5e9' : '#10b981' }}>
                  {confirmModal.type === 'LOT'
                    ? `${confirmModal.calculatedTotal.toLocaleString('vi-VN')} Lot`
                    : `${confirmModal.calculatedTotal.toLocaleString('vi-VN')} VND`}
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Vui lòng chọn hướng xử lý:
              <br />
              • <strong>Xuất Bản Nháp (Draft)</strong>: Tạo file riêng biệt trong thư mục <code>_Drafts/</code> và tải về máy để đối soát, <em>tuyệt đối không làm thay đổi file chính thức</em>.
              <br />
              • <strong>Ghi Đè</strong>: Tự động sao lưu dự phòng file cũ vào <code>Backup_Snapshots/</code> và cập nhật số liệu mới vào file Master.
            </p>

            {/* Modal Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={writingLot || writingValue}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '8px 14px' }}
              >
                Hủy Bỏ
              </button>

              {/* Nút 1: Xuất Bản Nháp Draft (Khuyến nghị an toàn) */}
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.type === 'LOT') {
                    handleRunLot({ exportDraft: true });
                  } else {
                    handleRunValue({ exportDraft: true });
                  }
                }}
                disabled={writingLot || writingValue}
                className="btn"
                style={{
                  fontSize: '0.8rem',
                  padding: '8px 16px',
                  backgroundColor: '#0ea5e9',
                  color: '#ffffff',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FileSpreadsheet size={15} />
                <span>Xuất Bản Nháp Draft (Không ghi đè)</span>
              </button>

              {/* Nút 2: Ghi Đè Chính Thức */}
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.type === 'LOT') {
                    handleRunLot({ forceOverwrite: true });
                  } else {
                    handleRunValue({ forceOverwrite: true });
                  }
                }}
                disabled={writingLot || writingValue}
                className="btn"
                style={{
                  fontSize: '0.8rem',
                  padding: '8px 16px',
                  backgroundColor: '#ea580c',
                  color: '#ffffff',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Save size={15} />
                <span>Ghi Đè File Chính Thức</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
