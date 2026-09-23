'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Play,
  FileSpreadsheet,
  Upload,
  Save,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  TrendingUp,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Clock,
  Loader2,
  Info,
  DollarSign,
  Activity,
  FileText,
  BookOpen,
  Folder,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/context/AuthContext';
import SmartPathInput from '@/components/admin/SmartPathInput';

export interface CcpLotStatisticsSectionProps {
  token: string | null;
  selectedDate: string;
  onOpenGuide?: () => void;
  viewMode?: 'USER' | 'EXPERT';
  onToggleViewMode?: (mode: 'USER' | 'EXPERT') => void;
}

interface CcpHhStat {
  maHH: string;
  soLot: number;
  giaTri: number;
}

interface CcpTvkdStat {
  tvkd: string;
  tenThanhVien?: string;
  soLot: number;
  giaTri: number;
  isFull4Types: boolean;
  missingTypes: string[];
  byHH: CcpHhStat[];
  ttmMua: number;
  ttmBan: number;
  ttmLaiLoDuKienVnd: number;
  kltt: number;
  ttttLaiLoThucTeVnd: number;
}

interface CcpDailyFileInfo {
  present: boolean;
  filename: string;
  size: number;
  path: string;
}

interface CcpDailyScanResult {
  folderPath: string;
  exists: boolean;
  canProcess: boolean;
  files: {
    dsgd?: CcpDailyFileInfo;
    ttm?: CcpDailyFileInfo;
    tttt?: CcpDailyFileInfo;
    tyGia?: CcpDailyFileInfo;
    maHD?: CcpDailyFileInfo;
  };
  dbExchangeRates?: {
    usd: number;
    ccpUsd?: number;
    jpy?: number;
    myr?: number;
    cny?: number;
    lastSynced?: string;
    detectedRate?: number;
    detectedSource?: string;
  };
}

interface CcpLotResultData {
  ngayGD: string;
  byTvkd: CcpTvkdStat[];
  totalSoLot: number;
  totalGiaTri: number;
  totalTtmMua: number;
  totalTtmBan: number;
  totalTtmLot: number;
  totalKltt: number;
  totalTtttLot: number;
  acmLot: number;
  normalLot?: number;
  spreadLot?: number;
  lmeLot?: number;
  optionsLot?: number;
  bacThoiLot?: number;
  bacThoiGtgd?: number;
  byType?: any;
  tyGiaUsed: Record<string, number>;
  warnings: string[];
}

export default function CcpLotStatisticsSection({
  token,
  selectedDate,
  onOpenGuide,
  viewMode: propViewMode,
  onToggleViewMode,
}: CcpLotStatisticsSectionProps) {
  // Chế độ giao diện: USER (Mặc định tinh gọn cho Vận hành) vs EXPERT (Đầy đủ cho IT Kỹ thuật)
  const [internalViewMode, setInternalViewMode] = useState<'USER' | 'EXPERT'>('USER');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('core_ccp_view_mode') as 'USER' | 'EXPERT';
      if (saved) setInternalViewMode(saved);
    }
  }, []);

  const currentViewMode = propViewMode || internalViewMode;

  // Data source mode: AUTO_DETECT (quét thư mục ngày) vs MANUAL_UPLOAD (chọn file tay)
  const [dataSourceMode, setDataSourceMode] = useState<'AUTO_DETECT' | 'MANUAL_UPLOAD'>('AUTO_DETECT');
  const [scanResult, setScanResult] = useState<CcpDailyScanResult | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);

  // Input states
  const [ngayGD, setNgayGD] = useState<string>(selectedDate);
  const [dsgdFile, setDsgdFile] = useState<File | null>(null);
  const [ttmFile, setTtmFile] = useState<File | null>(null);
  const [ttttFile, setTtttFile] = useState<File | null>(null);
  const [tyGiaFile, setTyGiaFile] = useState<File | null>(null);

  // Results & processing state
  const [loading, setLoading] = useState<boolean>(false);
  const [writingAccumulator, setWritingAccumulator] = useState<boolean>(false);
  const [result, setResult] = useState<CcpLotResultData | null>(null);
  const [accumulatorLogs, setAccumulatorLogs] = useState<string[]>([]);

  // Config state (Phase 1 & Phase 2 - 11 file lũy kế)
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [backupPathCcp, setBackupPathCcp] = useState<string>('');
  // Phase 1 - ACM
  const [pathAcmLot, setPathAcmLot] = useState<string>('');
  const [pathAcmGtgd, setPathAcmGtgd] = useState<string>('');
  // Phase 2 - Số Lot theo loại
  const [pathNormalLot, setPathNormalLot] = useState<string>('');
  const [pathSpreadLot, setPathSpreadLot] = useState<string>('');
  const [pathLmeLot, setPathLmeLot] = useState<string>('');
  const [pathOptionsLot, setPathOptionsLot] = useState<string>('');
  // Phase 2 - GTGD theo loại
  const [pathGtgdNormal, setPathGtgdNormal] = useState<string>('');
  const [pathGtgdSpread, setPathGtgdSpread] = useState<string>('');
  const [pathGtgdLme, setPathGtgdLme] = useState<string>('');
  const [pathGtgdOptions, setPathGtgdOptions] = useState<string>('');
  // Phase 2 - Raw DSGD
  const [pathDsgdCumulative, setPathDsgdCumulative] = useState<string>('');

  // Table filtering & view states
  const [searchTvkd, setSearchTvkd] = useState<string>('');
  const [filterActiveOnly, setFilterActiveOnly] = useState<boolean>(false);
  const [filterMissingTypesOnly, setFilterMissingTypesOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'TVKD' | 'COMMODITY'>('TVKD');

  // Sync date when parent selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setNgayGD(selectedDate);
    }
  }, [selectedDate]);

  // Load config on mount
  const fetchConfig = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/ccp-statistics/lot-statistics/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const cfg = data?.data || data;
      if (cfg) {
        setBackupPathCcp(cfg.bot_backup_path_ccp || '');
        setPathAcmLot(cfg.pathAcmLot || cfg.pathAcmCumulative || '');
        setPathAcmGtgd(cfg.pathAcmGtgd || cfg.pathGtgdAcm || '');
        setPathNormalLot(cfg.pathNormalLot || cfg.pathNormalCumulative || '');
        setPathSpreadLot(cfg.pathSpreadLot || cfg.pathSpreadCumulative || '');
        setPathLmeLot(cfg.pathLmeLot || cfg.pathLmeCumulative || '');
        setPathOptionsLot(cfg.pathOptionsLot || cfg.pathOptionsCumulative || '');
        setPathGtgdNormal(cfg.pathGtgdNormal || '');
        setPathGtgdSpread(cfg.pathGtgdSpread || '');
        setPathGtgdLme(cfg.pathGtgdLme || '');
        setPathGtgdOptions(cfg.pathGtgdOptions || '');
        setPathDsgdCumulative(cfg.pathDsgdCumulative || '');
      }
    } catch (err) {
      console.warn('Lỗi tải cấu hình file lũy kế:', err);
    }
  }, [token]);

  // Quét thư mục backup ngày tự động
  const fetchDailyScan = useCallback(async (date: string) => {
    if (!token || !date) return;
    setScanning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/ccp-statistics/lot-statistics/scan-daily?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.data) {
          setScanResult(data.data);
        }
      }
    } catch (err) {
      console.warn('Lỗi quét thư mục backup ngày:', err);
    } finally {
      setScanning(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (ngayGD) {
      fetchDailyScan(ngayGD);
    }
  }, [ngayGD, fetchDailyScan]);

  // Save config
  const handleSaveConfig = async () => {
    if (!token) return;
    setSavingConfig(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/ccp-statistics/lot-statistics/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bot_backup_path_ccp: backupPathCcp,
          pathAcmLot,
          pathAcmGtgd,
          pathAcmCumulative: pathAcmLot,
          pathGtgdAcm: pathAcmGtgd,
          pathNormalLot,
          pathNormalCumulative: pathNormalLot,
          pathSpreadLot,
          pathSpreadCumulative: pathSpreadLot,
          pathLmeLot,
          pathLmeCumulative: pathLmeLot,
          pathOptionsLot,
          pathOptionsCumulative: pathOptionsLot,
          pathGtgdNormal,
          pathGtgdSpread,
          pathGtgdLme,
          pathGtgdOptions,
          pathDsgdCumulative,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        toast.success('Đã lưu cấu hình đường dẫn thành công');
        setShowConfig(false);
        if (ngayGD) {
          fetchDailyScan(ngayGD);
        }
      } else {
        toast.error(data?.message || 'Không thể lưu cấu hình');
      }
    } catch (err: any) {
      toast.error('Lỗi khi lưu cấu hình: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  // Đồng bộ tỷ giá mới nhất từ tệp ngày CoreCCP hoặc M-System và lưu vào CSDL
  const [syncingRate, setSyncingRate] = useState<boolean>(false);
  const handleSyncExchangeRates = async () => {
    if (!token) return;
    setSyncingRate(true);
    const toastId = toast.loading('Đang lấy tỷ giá mới nhất từ tệp ngày CoreCCP / M-System...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/ccp-statistics/lot-statistics/sync-exchange-rate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date: ngayGD }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Đã đồng bộ tỷ giá thành công vào CSDL!', { id: toastId });
        if (ngayGD) {
          fetchDailyScan(ngayGD);
        }
      } else {
        toast.error(data.message || 'Không thể đồng bộ tỷ giá', { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`, { id: toastId });
    } finally {
      setSyncingRate(false);
    }
  };

  // Tải lên riêng file tỷ giá và lưu trực tiếp vào CSDL MongoDB
  const [uploadingTyGia, setUploadingTyGia] = useState<boolean>(false);
  const handleUploadTyGiaOnly = async (file: File) => {
    if (!token || !file) return;
    setUploadingTyGia(true);
    const toastId = toast.loading(`Đang xử lý tệp tỷ giá ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/api/v1/ccp-statistics/lot-statistics/upload-tygia`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Đã bóc tách và lưu tỷ giá vào CSDL thành công!', { id: toastId });
        if (ngayGD) {
          fetchDailyScan(ngayGD);
        }
      } else {
        toast.error(data.message || 'Lỗi xử lý file tỷ giá', { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Lỗi tải lên: ${err.message}`, { id: toastId });
    } finally {
      setUploadingTyGia(false);
    }
  };

  // Run calculation
  const handleProcess = async () => {
    if (!token) return;
    if (!dsgdFile) {
      toast.error('Vui lòng chọn tệp DSGD CoreCCP (bắt buộc)');
      return;
    }

    setLoading(true);
    setAccumulatorLogs([]);
    try {
      const formData = new FormData();
      formData.append('dsgdCcp', dsgdFile);
      if (ttmFile) formData.append('ttm', ttmFile);
      if (ttttFile) formData.append('tttt', ttttFile);
      if (tyGiaFile) formData.append('tyGia', tyGiaFile);
      formData.append('ngayGD', ngayGD);

      const res = await fetch(`${API_BASE_URL}/api/v1/ccp-statistics/lot-statistics`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data?.success) {
        setResult(data.data);
        toast.success(`Thống kê hoàn tất: ${data.data.totalSoLot.toLocaleString('vi-VN')} lot`);
      } else {
        toast.error(data?.message || 'Có lỗi khi xử lý thống kê CCP');
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối máy chủ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Write to accumulator files
  const handleWriteAccumulator = async () => {
    if (!token) return;
    if (!result) {
      toast.error('Chưa có kết quả thống kê để ghi');
      return;
    }

    setWritingAccumulator(true);
    setAccumulatorLogs([]);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/ccp-statistics/lot-statistics/write-accumulator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ result }),
      });

      const data = await res.json();
      if (data?.logs && Array.isArray(data.logs)) {
        setAccumulatorLogs(data.logs);
      }

      if (res.ok && data?.success) {
        toast.success(data.message || 'Đã ghi thành công vào toàn bộ các file lũy kế Excel');
      } else {
        toast.error(data?.message || 'Lỗi khi ghi file lũy kế');
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối khi ghi file lũy kế: ' + err.message);
    } finally {
      setWritingAccumulator(false);
    }
  };

  // Process tự động từ thư mục backup ngày
  const handleProcessDaily = async () => {
    if (!token) return;
    if (!scanResult?.canProcess) {
      toast.error('Chưa tìm thấy file DSGD trong thư mục ngày. Vui lòng kiểm tra lại!');
      return;
    }

    setLoading(true);
    setAccumulatorLogs([]);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/ccp-statistics/lot-statistics/process-daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ date: ngayGD }),
      });

      const data = await res.json();
      if (res.ok && data?.success) {
        setResult(data.data);
        toast.success(`Tổng hợp thành công từ thư mục backup: ${data.data.totalSoLot.toLocaleString('vi-VN')} lot`);
      } else {
        toast.error(data?.message || 'Có lỗi khi xử lý từ thư mục backup');
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối máy chủ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Formatter helpers
  const fmtNum = (v?: number) => (v !== undefined && v !== null ? v.toLocaleString('vi-VN') : '0');
  const fmtCur = (v?: number) => (v !== undefined && v !== null ? `${v.toLocaleString('vi-VN')} đ` : '0 đ');

  // Filtered TVKD list
  const filteredTvkd = useMemo(() => {
    if (!result?.byTvkd) return [];
    return result.byTvkd.filter((item) => {
      if (searchTvkd) {
        const query = searchTvkd.trim().toUpperCase();
        const code = (item.tvkd || '').toUpperCase();
        const name = (item.tenThanhVien || '').toUpperCase();
        if (!code.includes(query) && !name.includes(query)) return false;
      }
      if (filterActiveOnly && item.soLot === 0) return false;
      if (filterMissingTypesOnly && item.isFull4Types) return false;
      return true;
    });
  }, [result?.byTvkd, searchTvkd, filterActiveOnly, filterMissingTypesOnly]);

  // Aggregate commodities breakdown from all TVKD
  const commodityBreakdown = useMemo(() => {
    if (!result?.byTvkd) return [];
    const map = new Map<string, { maHH: string; soLot: number; giaTri: number }>();

    for (const tvkd of result.byTvkd) {
      for (const hh of tvkd.byHH || []) {
        const existing = map.get(hh.maHH) || { maHH: hh.maHH, soLot: 0, giaTri: 0 };
        existing.soLot += hh.soLot;
        existing.giaTri += hh.giaTri;
        map.set(hh.maHH, existing);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.soLot - a.soLot);
  }, [result?.byTvkd]);

  // 4 Order types summary
  const orderTypesSummary = useMemo(() => {
    if (!result?.byTvkd || result.byTvkd.length === 0) return null;
    const activeTvkd = result.byTvkd.filter((t) => t.soLot > 0);
    const missingAny = activeTvkd.filter((t) => !t.isFull4Types);
    return {
      totalActive: activeTvkd.length,
      fullTypesCount: activeTvkd.length - missingAny.length,
      missingCount: missingAny.length,
      missingList: missingAny,
    };
  }, [result?.byTvkd]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {currentViewMode === 'USER' ? (
        /* ── GIAO DIỆN VẬN HÀNH (USER MODE): TINH GỌN, 2 BƯỚC RÕ RÀNG, CHUẨN DOANH NGHIỆP ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header & 2-Step Action Bar */}
          <div
            className="glass-panel"
            style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              borderLeft: '4px solid #10b981',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  CoreCCP VNCLEAR
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Thống Kê Số Lot & Giá Trị Giao Dịch (Toàn Thị Trường)
                </h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                Tự động tổng hợp số lot và giá trị giao dịch của toàn bộ 5 phân hệ (Thường, ACM, Spread, LME, Options) từ thư mục ngày và cập nhật 10 sổ lũy kế Excel.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: scanResult?.canProcess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: scanResult?.canProcess ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                  Thư mục ngày: {ngayGD} ({scanResult?.canProcess ? 'Sẵn sàng' : 'Chưa có file DSGD'})
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>•</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  DSGD: {scanResult?.files.dsgd?.present ? '✓' : '✗'} | TTM: {scanResult?.files.ttm?.present ? '✓' : '✗'} | TTTT: {scanResult?.files.tttt?.present ? '✓' : '✗'} | Tỷ giá: 1 USD = {fmtNum(scanResult?.dbExchangeRates?.detectedRate || result?.tyGiaUsed?.['USD'] || 26000)} đ
                </span>
              </div>
            </div>

            {/* 2-Step Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleProcessDaily}
                disabled={loading || !scanResult?.canProcess}
                className="btn btn-primary"
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  padding: '10px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  cursor: loading || !scanResult?.canProcess ? 'not-allowed' : 'pointer',
                  backgroundColor: scanResult?.canProcess ? '#10b981' : undefined,
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang Tổng Hợp...</span>
                  </>
                ) : (
                  <>
                    <Play size={16} fill="currentColor" />
                    <span>Bước 1: Tổng Hợp Dữ Liệu Ngày</span>
                  </>
                )}
              </button>

              {result && (
                <button
                  type="button"
                  onClick={handleWriteAccumulator}
                  disabled={writingAccumulator}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    padding: '10px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    borderColor: 'rgba(59, 130, 246, 0.4)',
                    color: '#60a5fa',
                    cursor: writingAccumulator ? 'not-allowed' : 'pointer',
                  }}
                >
                  {writingAccumulator ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang Ghi File...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Bước 2: Ghi Vào 10 File Lũy Kế Excel</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* User Mode: Accumulator Logs (nếu có) */}
          {accumulatorLogs.length > 0 && (
            <div
              className="glass-panel"
              style={{
                padding: '14px 18px',
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10b981' }}>
                  Nhật Ký Ghi Các File Lũy Kế Excel CoreCCP:
                </span>
              </div>
              <div
                style={{
                  maxHeight: '120px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                }}
              >
                {accumulatorLogs.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* User Mode: 4 KPI Cards (khi có result) */}
          {result && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {/* Total Lot */}
              <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Tổng Số Lot Toàn Thị Trường
                  </span>
                  <TrendingUp size={18} color="#10b981" />
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981' }}>
                  {fmtNum(result.totalSoLot)} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Lot</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>Thường: <strong style={{ color: 'var(--text-primary)' }}>{fmtNum(result.normalLot)}</strong></span> |
                  <span>ACM: <strong style={{ color: 'var(--text-primary)' }}>{fmtNum(result.acmLot)}</strong></span> |
                  <span>Spread: <strong style={{ color: 'var(--text-primary)' }}>{fmtNum(result.spreadLot)}</strong></span> |
                  <span>LME: <strong style={{ color: 'var(--text-primary)' }}>{fmtNum(result.lmeLot)}</strong></span> |
                  <span>Options: <strong style={{ color: 'var(--text-primary)' }}>{fmtNum(result.optionsLot)}</strong></span>
                </div>
              </div>

              {/* Total GTGD */}
              <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Tổng Giá Trị Giao Dịch
                  </span>
                  <DollarSign size={18} color="#3b82f6" />
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#3b82f6' }}>
                  {fmtCur(result.totalGiaTri)}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Tỷ giá quy đổi: 1 USD = {fmtNum(result.tyGiaUsed['USD'] || 25920)} đ
                </span>
              </div>

              {/* Vị Thế & 4 Loại Lệnh */}
              <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Vị Thế & 4 Loại Lệnh
                  </span>
                  {orderTypesSummary && orderTypesSummary.missingCount === 0 ? (
                    <CheckCircle2 size={18} color="#10b981" />
                  ) : (
                    <AlertTriangle size={18} color="#ef4444" />
                  )}
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: orderTypesSummary && orderTypesSummary.missingCount === 0 ? '#10b981' : '#ef4444' }}>
                  {orderTypesSummary && orderTypesSummary.missingCount === 0 ? 'ĐỦ 4 LOẠI LỆNH CHUẨN' : `${orderTypesSummary?.missingCount || 0} TVKD THIẾU LỆNH`}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  TTM: {fmtNum(result.totalTtmMua)} Mua / {fmtNum(result.totalTtmBan)} Bán | TTTT: {fmtNum(result.totalKltt ?? result.totalTtttLot ?? 0)} Lot
                </span>
              </div>

              {/* Trạng Thái Ghi Sổ Lũy Kế */}
              <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Ghi 10 File Lũy Kế Excel
                  </span>
                  <Save size={18} color={accumulatorLogs.length > 0 ? '#10b981' : '#8b5cf6'} />
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: accumulatorLogs.length > 0 ? '#10b981' : '#8b5cf6' }}>
                  {accumulatorLogs.length > 0 ? 'ĐÃ GHI THÀNH CÔNG VÀO EXCEL' : 'SẴN SÀNG GHI SỔ'}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Zero-Lot Bypass: Bật (tự động bỏ qua phân hệ 0 lot)
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── GIAO DIỆN KỸ THUẬT (EXPERT MODE): BẢO LƯU 100% CẤU HÌNH VÀ THÀNH PHẦN CHI TIẾT CỦA IT ── */
        <>
          {/* ── 1. ACTION & FILE INPUT PANEL ── */}
          <div
            className="glass-panel"
            style={{
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
        {/* Title Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                CoreCCP Automation
              </span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Thống Kê Số Lot & Giá Trị Giao Dịch CCP
              </h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              Tổng hợp dữ liệu từ DSGD, TTM, TTTT của CCP; kiểm tra đủ 4 loại lệnh và ghi trực tiếp vào file lũy kế ACM Excel.
            </p>
          </div>

          {/* Top Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onOpenGuide && (
              <button
                type="button"
                onClick={onOpenGuide}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  borderColor: 'rgba(16, 185, 129, 0.35)',
                  color: '#10b981',
                }}
              >
                <BookOpen size={14} />
                <span>Hướng Dẫn & Công Thức</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="btn btn-secondary"
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Sliders size={14} />
              <span>Đường Dẫn File Lũy Kế</span>
              {showConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {dataSourceMode === 'AUTO_DETECT' ? (
              <button
                type="button"
                onClick={handleProcessDaily}
                disabled={loading || !scanResult?.canProcess}
                className="btn btn-primary"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '8px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: loading || !scanResult?.canProcess ? 'not-allowed' : 'pointer',
                  backgroundColor: scanResult?.canProcess ? '#10b981' : undefined,
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang Tổng Hợp...</span>
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    <span>Tổng Hợp Từ Thư Mục Backup</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleProcess}
                disabled={loading || !dsgdFile}
                className="btn btn-primary"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '8px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: loading || !dsgdFile ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang Tổng Hợp...</span>
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    <span>Tổng Hợp Số Lot & GTGD</span>
                  </>
                )}
              </button>
            )}

            {result && (
              <button
                type="button"
                onClick={handleWriteAccumulator}
                disabled={writingAccumulator}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '8px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  color: '#10b981',
                  cursor: writingAccumulator ? 'not-allowed' : 'pointer',
                }}
              >
                {writingAccumulator ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang Ghi File...</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Ghi Vào Các File Lũy Kế Excel (Toàn Bộ Báo Cáo)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* DATA SOURCE MODE SELECTOR BAR */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Nguồn dữ liệu:</span>
            <button
              type="button"
              onClick={() => setDataSourceMode('AUTO_DETECT')}
              className="btn btn-secondary"
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '5px 14px',
                borderRadius: '6px',
                backgroundColor: dataSourceMode === 'AUTO_DETECT' ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                borderColor: dataSourceMode === 'AUTO_DETECT' ? '#10b981' : 'var(--border-color)',
                color: dataSourceMode === 'AUTO_DETECT' ? '#10b981' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Folder size={14} />
              <span>Tự Động Quét Thư Mục Ngày</span>
              {scanResult?.canProcess && (
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              )}
            </button>

            <button
              type="button"
              onClick={() => setDataSourceMode('MANUAL_UPLOAD')}
              className="btn btn-secondary"
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '5px 14px',
                borderRadius: '6px',
                backgroundColor: dataSourceMode === 'MANUAL_UPLOAD' ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                borderColor: dataSourceMode === 'MANUAL_UPLOAD' ? '#10b981' : 'var(--border-color)',
                color: dataSourceMode === 'MANUAL_UPLOAD' ? '#10b981' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Upload size={14} />
              <span>Tải Lên File Thủ Công</span>
            </button>

            <button
              type="button"
              onClick={handleSyncExchangeRates}
              disabled={syncingRate}
              className="btn btn-secondary"
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '5px 14px',
                borderRadius: '6px',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                borderColor: '#3b82f6',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Đồng bộ tỷ giá mới nhất từ tệp ngày CoreCCP (TTTT/TTM) hoặc M-System và lưu vào CSDL MongoDB"
            >
              <RefreshCw size={14} className={syncingRate ? 'animate-spin' : ''} />
              <span>{syncingRate ? 'Đang Lấy...' : 'Lấy Tỷ Giá Mới Nhất'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>Ngày Phiên:</span>
            <input
              type="date"
              value={ngayGD}
              onChange={(e) => setNgayGD(e.target.value)}
              className="form-input"
              style={{ height: '32px', width: '140px', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700 }}
            />
            {dataSourceMode === 'AUTO_DETECT' && (
              <button
                type="button"
                onClick={() => fetchDailyScan(ngayGD)}
                disabled={scanning}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Quét lại thư mục backup ngày này"
              >
                <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} />
                <span>Quét Lại</span>
              </button>
            )}
          </div>
        </div>

        {/* DATA SOURCE VIEW 1: AUTO DETECT FROM DAILY BACKUP FOLDER */}
        {dataSourceMode === 'AUTO_DETECT' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  Thư mục quét: {scanResult?.folderPath || 'Đang xác định...'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowConfig(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-accent)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                  title="Mở cấu hình để sửa đường dẫn thư mục quét"
                >
                  [Sửa / Đổi Thư Mục]
                </button>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: scanResult?.canProcess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: scanResult?.canProcess ? '#10b981' : '#ef4444',
                }}
              >
                {scanResult?.canProcess ? 'ĐỦ ĐIỀU KIỆN TỔNG HỢP' : 'CHƯA ĐỦ FILE BẮT BUỘC (DSGD)'}
              </span>
            </div>

            {scanResult && !scanResult.exists && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>
                  Không thể truy cập thư mục backup: Ổ đĩa mạng chia sẻ (/mnt/qlgd-it) đang bị mất kết nối hoặc thư mục ngày chưa được tạo. Vui lòng kiểm tra trạng thái mount trên máy chủ.
                </span>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px',
                backgroundColor: 'var(--bg-input)',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
              }}
            >
              {/* File 1: DSGD */}
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: scanResult?.files.dsgd?.present ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${scanResult?.files.dsgd?.present ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>1. DSGD CoreCCP (*)</span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: scanResult?.files.dsgd?.present ? '#10b981' : '#ef4444',
                      color: scanResult?.files.dsgd?.present ? '#000' : '#fff',
                    }}
                  >
                    {scanResult?.files.dsgd?.present ? 'ĐÃ CÓ FILE' : 'THIẾU FILE (BẮT BUỘC)'}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: scanResult?.files.dsgd?.present ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {scanResult?.files.dsgd?.present
                    ? `${scanResult.files.dsgd.filename} (${(scanResult.files.dsgd.size / 1024).toFixed(1)} KB)`
                    : 'Bắt buộc phải có file DSGD để đối chiếu số lot & GTGD'}
                </span>
              </div>

              {/* File 2: TTM */}
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: scanResult?.files.ttm?.present ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                  border: `1px solid ${scanResult?.files.ttm?.present ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>2. TTM (Trạng Thái Mở)</span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: scanResult?.files.ttm?.present ? '#10b981' : '#f59e0b',
                      color: '#000',
                    }}
                  >
                    {scanResult?.files.ttm?.present ? 'ĐÃ CÓ FILE' : 'CHƯA TÌM THẤY'}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: scanResult?.files.ttm?.present ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {scanResult?.files.ttm?.present
                    ? `${scanResult.files.ttm.filename} (${(scanResult.files.ttm.size / 1024).toFixed(1)} KB)`
                    : 'Chưa có file TTM (sẽ tính số lot mở = 0 nếu bỏ qua)'}
                </span>
              </div>

              {/* File 3: TTTT */}
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: scanResult?.files.tttt?.present ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                  border: `1px solid ${scanResult?.files.tttt?.present ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>3. TTTT (Tất Toán)</span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: scanResult?.files.tttt?.present ? '#10b981' : '#f59e0b',
                      color: '#000',
                    }}
                  >
                    {scanResult?.files.tttt?.present ? 'ĐÃ CÓ FILE' : 'CHƯA TÌM THẤY'}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: scanResult?.files.tttt?.present ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {scanResult?.files.tttt?.present
                    ? `${scanResult.files.tttt.filename} (${(scanResult.files.tttt.size / 1024).toFixed(1)} KB)`
                    : 'Chưa có file TTTT (sẽ tính số lot tất toán = 0 nếu bỏ qua)'}
                </span>
              </div>

              {/* File 4: Tỷ giá */}
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: scanResult?.files.tyGia?.present
                    ? 'rgba(16, 185, 129, 0.08)'
                    : scanResult?.dbExchangeRates?.detectedRate
                    ? 'rgba(16, 185, 129, 0.08)'
                    : 'rgba(59, 130, 246, 0.08)',
                  border: `1px solid ${
                    scanResult?.files.tyGia?.present || scanResult?.dbExchangeRates?.detectedRate
                      ? 'rgba(16, 185, 129, 0.3)'
                      : 'rgba(59, 130, 246, 0.3)'
                  }`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>4. Tỷ Giá CCP</span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: scanResult?.files.tyGia?.present
                        ? '#10b981'
                        : scanResult?.dbExchangeRates?.detectedRate
                        ? '#10b981'
                        : '#3b82f6',
                      color: scanResult?.files.tyGia?.present || scanResult?.dbExchangeRates?.detectedRate ? '#000' : '#fff',
                    }}
                  >
                    {scanResult?.files.tyGia?.present
                      ? 'ĐÃ CÓ TỆP'
                      : scanResult?.dbExchangeRates?.detectedRate
                      ? 'BÁO CÁO NGÀY'
                      : 'CSDL MONGODB'}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: scanResult?.files.tyGia?.present || scanResult?.dbExchangeRates?.detectedRate ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {scanResult?.files.tyGia?.present
                    ? `${scanResult.files.tyGia.filename} (${(scanResult.files.tyGia.size / 1024).toFixed(1)} KB)`
                    : scanResult?.dbExchangeRates?.detectedRate
                    ? `1 USD = ${scanResult.dbExchangeRates.detectedRate.toLocaleString('vi-VN')} đ (${scanResult.dbExchangeRates.detectedSource || 'từ tệp ngày'})`
                    : `1 USD = ${(scanResult?.dbExchangeRates?.ccpUsd || scanResult?.dbExchangeRates?.usd || 25920).toLocaleString('vi-VN')} đ ${scanResult?.dbExchangeRates?.lastSynced ? `(Đã lưu DB: ${new Date(scanResult.dbExchangeRates.lastSynced).toLocaleTimeString('vi-VN')} ${new Date(scanResult.dbExchangeRates.lastSynced).toLocaleDateString('vi-VN')})` : ''}`}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* DATA SOURCE VIEW 2: MANUAL FILE PICKERS */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
              backgroundColor: 'var(--bg-input)',
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
            }}
          >

            {/* 1. File DSGD */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>
                  1. DSGD CoreCCP (*)
                </label>
                <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>Bắt buộc</span>
              </div>
              <label
                style={{
                  border: '1px dashed rgba(16, 185, 129, 0.4)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  backgroundColor: dsgdFile ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                  height: '36px',
                }}
              >
                <FileSpreadsheet size={15} color="#10b981" />
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    color: dsgdFile ? 'var(--text-primary)' : 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {dsgdFile ? dsgdFile.name : 'Chọn file DSGD_*.xlsx'}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => e.target.files?.[0] && setDsgdFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* 2. File TTM */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  2. TTM (Trạng Thái Mở)
                </label>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tùy chọn</span>
              </div>
              <label
                style={{
                  border: '1px dashed var(--border-color)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  backgroundColor: ttmFile ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                  height: '36px',
                }}
              >
                <FileSpreadsheet size={15} color={ttmFile ? '#3b82f6' : 'var(--text-muted)'} />
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    color: ttmFile ? 'var(--text-primary)' : 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {ttmFile ? ttmFile.name : 'Chọn file TTM_*.xlsx'}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => e.target.files?.[0] && setTtmFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* 3. File TTTT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  3. TTTT (Tất Toán)
                </label>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tùy chọn</span>
              </div>
              <label
                style={{
                  border: '1px dashed var(--border-color)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  backgroundColor: ttttFile ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                  height: '36px',
                }}
              >
                <FileSpreadsheet size={15} color={ttttFile ? '#f59e0b' : 'var(--text-muted)'} />
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    color: ttttFile ? 'var(--text-primary)' : 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {ttttFile ? ttttFile.name : 'Chọn file TTTT_*.xlsx'}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => e.target.files?.[0] && setTtttFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* 4. File Tỷ Giá */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  4. Tỷ Giá CCP
                </label>
                {tyGiaFile ? (
                  <button
                    type="button"
                    onClick={() => handleUploadTyGiaOnly(tyGiaFile)}
                    disabled={uploadingTyGia}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.68rem', padding: '1px 6px', height: '22px', display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', borderColor: '#10b981' }}
                    title="Lưu tỷ giá từ file này vào CSDL MongoDB ngay"
                  >
                    <Save size={11} />
                    <span>{uploadingTyGia ? 'Đang lưu...' : 'Lưu vào CSDL'}</span>
                  </button>
                ) : (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mặc định CSDL</span>
                )}
              </div>
              <label
                style={{
                  border: '1px dashed var(--border-color)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  backgroundColor: tyGiaFile ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
                  height: '36px',
                }}
              >
                <FileSpreadsheet size={15} color={tyGiaFile ? '#a855f7' : 'var(--text-muted)'} />
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    color: tyGiaFile ? 'var(--text-primary)' : 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {tyGiaFile ? tyGiaFile.name : 'Tỷ giá_*.xlsx (hoặc CSDL)'}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => e.target.files?.[0] && setTyGiaFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        )}

        {/* Collapsible Config Box */}
        {showConfig && (
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Cấu Hình Đường Dẫn 10 File Lũy Kế Excel CoreCCP
              </span>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '5px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {savingConfig ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Lưu Cấu Hình</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SmartPathInput
                value={backupPathCcp}
                onChange={setBackupPathCcp}
                label="Thư mục gốc quét báo cáo CCP (bot_backup_path_ccp):"
                placeholder="M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CCP\Futures (hoặc /mnt/...)"
                targetType="folder"
                presets={[
                  {
                    name: 'Backup CCP',
                    path: 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures',
                  },
                  {
                    name: 'Backup MS',
                    path: 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
                  },
                ]}
              />

              {/* ── Nhóm 1: File ACM (Phase 1) ── */}
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#10b981', marginTop: '4px' }}>
                1. Nhóm File Lũy Kế ACM (Nano):
              </div>
              <SmartPathInput
                value={pathAcmLot}
                onChange={setPathAcmLot}
                label="File Số Lot ACM (pathAcmLot):"
                placeholder="M:\...\Thong ke so lot giao dich ACM ${YYYY}.xlsx"
                targetType="file"
              />
              <SmartPathInput
                value={pathAcmGtgd}
                onChange={setPathAcmGtgd}
                label="File Giá Trị Giao Dịch ACM (pathAcmGtgd):"
                placeholder="M:\...\Thong ke gia tri giao dich ACM ${YYYY}.xlsx"
                targetType="file"
              />

              {/* ── Nhóm 2: Số Lot Theo Phân Hệ (Phase 2) ── */}
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#3b82f6', marginTop: '8px' }}>
                2. Nhóm File Lũy Kế Số Lot Theo Phân Hệ:
              </div>
              <SmartPathInput
                value={pathNormalLot}
                onChange={setPathNormalLot}
                label="File Số Lot Futures Thường (pathNormalLot):"
                placeholder="M:\...\Thong ke so lot giao dich ${YYYY}.xlsx"
                targetType="file"
              />
              <SmartPathInput
                value={pathSpreadLot}
                onChange={setPathSpreadLot}
                label="File Số Lot Spread (pathSpreadLot):"
                placeholder="M:\...\Thong ke so lot giao dich Spread ${YYYY}.xlsx"
                targetType="file"
              />
              <SmartPathInput
                value={pathLmeLot}
                onChange={setPathLmeLot}
                label="File Số Lot LME (pathLmeLot):"
                placeholder="M:\...\Thong ke so lot giao dich LME ${YYYY}.xlsx"
                targetType="file"
              />
              <SmartPathInput
                value={pathOptionsLot}
                onChange={setPathOptionsLot}
                label="File Số Lot Options (pathOptionsLot):"
                placeholder="M:\...\Thong ke so lot giao dich Options ${YYYY}.xlsx"
                targetType="file"
              />

              {/* ── Nhóm 3: Giá Trị Giao Dịch Theo Phân Hệ (Phase 2) ── */}
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f59e0b', marginTop: '8px' }}>
                3. Nhóm File Lũy Kế Giá Trị Giao Dịch:
              </div>
              <SmartPathInput
                value={pathGtgdNormal}
                onChange={setPathGtgdNormal}
                label="File GTGD Thường (pathGtgdNormal):"
                placeholder="M:\...\Thong ke gia tri giao dich ${YYYY}.xlsx"
                targetType="file"
              />
              <SmartPathInput
                value={pathGtgdSpread}
                onChange={setPathGtgdSpread}
                label="File GTGD Spread (pathGtgdSpread):"
                placeholder="M:\...\Thong ke gia tri giao dich Spread ${YYYY}.xlsx"
                targetType="file"
              />
              <SmartPathInput
                value={pathGtgdLme}
                onChange={setPathGtgdLme}
                label="File GTGD LME (pathGtgdLme):"
                placeholder="M:\...\Thong ke gia tri giao dich LME ${YYYY}.xlsx"
                targetType="file"
              />
              <SmartPathInput
                value={pathGtgdOptions}
                onChange={setPathGtgdOptions}
                label="File GTGD Options (pathGtgdOptions):"
                placeholder="M:\...\Thong ke gia tri giao dich Options ${YYYY}.xlsx"
                targetType="file"
              />

              {/* ── Nhóm 4: Sổ Giao Dịch Thô Lũy Kế ── */}
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#8b5cf6', marginTop: '8px' }}>
                4. File Sổ Giao Dịch Gốc Lũy Kế Tháng:
              </div>
              <SmartPathInput
                value={pathDsgdCumulative}
                onChange={setPathDsgdCumulative}
                label="File DSGD CCP Lũy Kế Tháng (pathDsgdCumulative):"
                placeholder="M:\...\DSGD T${MM}.${YYYY} CCP.xlsx"
                targetType="file"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 2. ACCUMULATOR LOGS (IF EXECUTED) ── */}
      {accumulatorLogs.length > 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '14px 18px',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#10b981" />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10b981' }}>
              Nhật Ký Ghi Các File Lũy Kế Excel CoreCCP:
            </span>
          </div>
          <div
            style={{
              maxHeight: '120px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            {accumulatorLogs.map((log, idx) => (
              <div key={idx}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. KPI STATS CARDS (WHEN RESULT READY) ── */}
      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {/* Total Lot */}
          <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Tổng Số Lot Toàn Thị Trường
              </span>
              <TrendingUp size={18} color="#10b981" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981' }}>
              {fmtNum(result.totalSoLot)} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Lot</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Từ {result.byTvkd.filter((t) => t.soLot > 0).length} TVKD có phát sinh giao dịch
            </span>
          </div>

          {/* Total GTGD */}
          <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Tổng Giá Trị Giao Dịch
              </span>
              <DollarSign size={18} color="#3b82f6" />
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#3b82f6' }}>
              {fmtCur(result.totalGiaTri)}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Tỷ giá quy đổi: 1 USD = {fmtNum(result.tyGiaUsed['USD'] || 25920)} đ
            </span>
          </div>

          {/* TTM Position */}
          <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Trạng Thái Mở (TTM)
              </span>
              <Activity size={18} color="#f59e0b" />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              Mua: <span style={{ color: '#10b981' }}>{fmtNum(result.totalTtmMua)}</span> | Bán:{' '}
              <span style={{ color: '#ef4444' }}>{fmtNum(result.totalTtmBan)}</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Tổng vị thế mở: {fmtNum(result.totalTtmLot)} lot
            </span>
          </div>

          {/* TTTT Position (Tất toán) */}
          <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Trạng Thái Tất Toán (TTTT)
              </span>
              <CheckCircle2 size={18} color="#8b5cf6" />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#8b5cf6' }}>
              {fmtNum(result.totalKltt ?? result.totalTtttLot ?? 0)} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Lot</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Lãi/Lỗ: {fmtCur(result.byTvkd.reduce((acc, t) => acc + (t.ttttLaiLoThucTeVnd || 0), 0))}
            </span>
          </div>

          {/* 4 Order Types */}
          <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Kiểm Tra 4 Loại Lệnh
              </span>
              {orderTypesSummary && orderTypesSummary.missingCount === 0 ? (
                <CheckCircle2 size={18} color="#10b981" />
              ) : (
                <AlertTriangle size={18} color="#ef4444" />
              )}
            </div>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: 900,
                color: orderTypesSummary && orderTypesSummary.missingCount === 0 ? '#10b981' : '#ef4444',
              }}
            >
              {orderTypesSummary && orderTypesSummary.missingCount === 0 ? (
                'ĐỦ 4 LOẠI LỆNH'
              ) : (
                `${orderTypesSummary?.missingCount || 0} TVKD THIẾU LỆNH`
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Chuẩn: MKT, LMT, STP, STL
            </span>
          </div>
        </div>
      )}
        </>
      )}

      {/* ── 4. DATA TABLE VIEW & TOGGLE ── */}
      {result && (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Table Header & Controls */}
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-input)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* View Mode Switch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setViewMode('TVKD')}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '6px 14px',
                  backgroundColor: viewMode === 'TVKD' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  borderColor: viewMode === 'TVKD' ? '#10b981' : 'var(--border-color)',
                  color: viewMode === 'TVKD' ? '#10b981' : 'var(--text-secondary)',
                }}
              >
                Chi Tiết Theo TVKD ({filteredTvkd.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('COMMODITY')}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '6px 14px',
                  backgroundColor: viewMode === 'COMMODITY' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  borderColor: viewMode === 'COMMODITY' ? '#10b981' : 'var(--border-color)',
                  color: viewMode === 'COMMODITY' ? '#10b981' : 'var(--text-secondary)',
                }}
              >
                Phân Bổ Theo Hàng Hóa ({commodityBreakdown.length})
              </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {viewMode === 'TVKD' && (
                <>
                  {/* Search */}
                  <div style={{ position: 'relative', width: '180px' }}>
                    <Search
                      size={14}
                      color="var(--text-muted)"
                      style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                      type="text"
                      placeholder="Tìm TVKD..."
                      value={searchTvkd}
                      onChange={(e) => setSearchTvkd(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: '30px', height: '32px', fontSize: '0.78rem' }}
                    />
                  </div>

                  {/* Filter Active */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={filterActiveOnly}
                      onChange={(e) => setFilterActiveOnly(e.target.checked)}
                      style={{ accentColor: '#10b981', width: '14px', height: '14px' }}
                    />
                    <span>Chỉ TVKD có lot</span>
                  </label>

                  {/* Filter Missing 4 types */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={filterMissingTypesOnly}
                      onChange={(e) => setFilterMissingTypesOnly(e.target.checked)}
                      style={{ accentColor: '#ef4444', width: '14px', height: '14px' }}
                    />
                    <span>Thiếu loại lệnh</span>
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Table Content */}
          <div style={{ minHeight: '350px', maxHeight: '560px', overflowY: 'auto' }}>
            {viewMode === 'TVKD' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-input)', zIndex: 5 }}>
                  <tr
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      borderBottom: '1px solid var(--border-color)',
                      textTransform: 'uppercase',
                    }}
                  >
                    <th style={{ padding: '10px 14px', fontWeight: 700, width: '90px' }}>Mã TVKD</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700 }}>Tên Thành Viên</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Số Lot GD</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>GTGD (VND)</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>TTM Mua</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>TTM Bán</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Lãi Lỗ TTM (VND)</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>KLTT</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Lãi Lỗ TTTT (VND)</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'center', width: '150px' }}>
                      4 Loại Lệnh
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTvkd.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Không có bản ghi nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredTvkd.map((item, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          backgroundColor: item.soLot > 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '8px 14px', fontWeight: 800, color: item.soLot > 0 ? '#10b981' : 'var(--text-muted)' }}>
                          {item.tvkd}
                        </td>
                        <td style={{ padding: '8px 14px', color: 'var(--text-primary)', fontFamily: 'sans-serif' }}>
                          {item.tenThanhVien || '—'}
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 800, color: item.soLot > 0 ? '#10b981' : 'var(--text-muted)' }}>
                          {fmtNum(item.soLot)}
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700 }}>
                          {fmtNum(item.giaTri)}
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', color: item.ttmMua > 0 ? '#10b981' : 'var(--text-muted)' }}>
                          {fmtNum(item.ttmMua)}
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', color: item.ttmBan > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                          {fmtNum(item.ttmBan)}
                        </td>
                        <td
                          style={{
                            padding: '8px 14px',
                            textAlign: 'right',
                            color: item.ttmLaiLoDuKienVnd > 0 ? '#10b981' : item.ttmLaiLoDuKienVnd < 0 ? '#ef4444' : 'var(--text-muted)',
                          }}
                        >
                          {fmtNum(item.ttmLaiLoDuKienVnd)}
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                          {fmtNum(item.kltt)}
                        </td>
                        <td
                          style={{
                            padding: '8px 14px',
                            textAlign: 'right',
                            color: item.ttttLaiLoThucTeVnd > 0 ? '#10b981' : item.ttttLaiLoThucTeVnd < 0 ? '#ef4444' : 'var(--text-muted)',
                          }}
                        >
                          {fmtNum(item.ttttLaiLoThucTeVnd)}
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                          {item.soLot === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Không GD</span>
                          ) : item.isFull4Types ? (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                color: '#10b981',
                              }}
                            >
                              Đủ 4 Loại
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                color: '#ef4444',
                              }}
                              title={`Thiếu: ${item.missingTypes.join(', ')}`}
                            >
                              Thiếu {item.missingTypes.join('/')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-input)', zIndex: 5 }}>
                  <tr
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      borderBottom: '1px solid var(--border-color)',
                      textTransform: 'uppercase',
                    }}
                  >
                    <th style={{ padding: '10px 16px', fontWeight: 700 }}>Mã Hàng Hóa</th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Số Lot Khớp</th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Tỷ Trọng Số Lot</th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Giá Trị Giao Dịch (VND)</th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Tỷ Trọng GTGD</th>
                  </tr>
                </thead>
                <tbody>
                  {commodityBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Không có dữ liệu phân bổ hàng hóa.
                      </td>
                    </tr>
                  ) : (
                    commodityBreakdown.map((hh, idx) => {
                      const lotPct = result.totalSoLot > 0 ? (hh.soLot / result.totalSoLot) * 100 : 0;
                      const valPct = result.totalGiaTri > 0 ? (hh.giaTri / result.totalGiaTri) * 100 : 0;
                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            fontFamily: 'monospace',
                            fontSize: '0.82rem',
                          }}
                        >
                          <td style={{ padding: '10px 16px', fontWeight: 800, color: '#10b981' }}>
                            {hh.maHH}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800 }}>
                            {fmtNum(hh.soLot)}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {lotPct.toFixed(2)}%
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>
                            {fmtCur(hh.giaTri)}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {valPct.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
