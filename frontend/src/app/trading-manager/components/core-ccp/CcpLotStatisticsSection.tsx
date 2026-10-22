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
  RotateCcw,
  Download,
  Calendar,
  Sparkles,
  Eye,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  User,
  FileSearch,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';
import SmartPathInput from '@/components/admin/SmartPathInput';
import { STORAGE_MOUNT_CONFIG } from '@/config/storage-path.config';
import PreFlightFileInspectorModal from '../shared/PreFlightFileInspectorModal';

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

  // ── Tab Switcher state: DAILY vs ADHOC_RANGE ──
  const [mainTab, setMainTab] = useState<'DAILY' | 'ADHOC_RANGE'>('DAILY');

  // ── Ad-hoc Range states (Báo cáo đột xuất theo kỳ) ──
  const [adhocFromDate, setAdhocFromDate] = useState<string>(() => {
    if (selectedDate && selectedDate.includes('-')) {
      const parts = selectedDate.split('-');
      return `${parts[0]}-${parts[1]}-01`;
    }
    return new Date().toISOString().slice(0, 7) + '-01';
  });
  const [adhocToDate, setAdhocToDate] = useState<string>(selectedDate || new Date().toISOString().slice(0, 10));
  const [adhocScope, setAdhocScope] = useState<'ACM_ONLY' | 'ALL_PHASE2'>('ALL_PHASE2');
  const [runningAdHoc, setRunningAdHoc] = useState<boolean>(false);
  const [adhocResult, setAdhocResult] = useState<any | null>(null);
  const [adhocLogs, setAdhocLogs] = useState<string[]>([]);
  const [adhocReports, setAdhocReports] = useState<any[]>([]);
  const [loadingAdHocReports, setLoadingAdHocReports] = useState<boolean>(false);

  // ── Lịch sử / tiến trình các tác vụ Thống kê CoreCCP gần nhất ──
  const [runHistory, setRunHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'ALL' | 'LOT' | 'VALUE'>('ALL');
  const [historyPage, setHistoryPage] = useState<number>(1);
  const historyPageSize = 5;
  const [selectedHistoryLog, setSelectedHistoryLog] = useState<{ title: string; logs: string[] } | null>(null);

  // ── Pre-Flight Inspector Modal (Kiểm tra tệp & đường dẫn trước khi chạy) ──
  const [inspectorModal, setInspectorModal] = useState<{ isOpen: boolean; type: 'LOT' | 'VALUE' | 'ALL' } | null>(null);

  const fetchRunHistory = useCallback(async () => {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const data = await api.ccpClearing.getLotRunHistory({ limit: 20 }, token);
      if (Array.isArray(data)) {
        setRunHistory(data);
      }
    } catch (err: any) {
      console.warn('Không thể nạp lịch sử thống kê CoreCCP:', err.message);
    } finally {
      setLoadingHistory(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRunHistory();
  }, [fetchRunHistory]);

  // Lọc lịch sử
  const filteredHistory = useMemo(() => {
    return runHistory.filter((item) => {
      if (historyTypeFilter === 'ALL') return true;
      if (historyTypeFilter === 'LOT') {
        return item.runType === 'LOT' || (!item.runType && item.accumulatorLogs?.[0]?.includes('Lot'));
      }
      if (historyTypeFilter === 'VALUE') {
        return item.runType === 'VALUE' || item.accumulatorLogs?.[0]?.includes('GTGD');
      }
      return true;
    });
  }, [runHistory, historyTypeFilter]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredHistory.slice(start, start + historyPageSize);
  }, [filteredHistory, historyPage, historyPageSize]);

  // Bộ đếm theo loại
  const historyCounts = useMemo(() => {
    const total = runHistory.length;
    const lotCount = runHistory.filter(
      (h) => h.runType === 'LOT' || (!h.runType && h.accumulatorLogs?.[0]?.includes('Lot')),
    ).length;
    const valueCount = runHistory.filter(
      (h) => h.runType === 'VALUE' || h.accumulatorLogs?.[0]?.includes('GTGD'),
    ).length;
    return { total, lotCount, valueCount };
  }, [runHistory]);

  // Kiểm tra xem phiên đang chọn (ngayGD) đã có lượt chạy thành công nào chưa
  const latestRunForSelectedDate = useMemo(() => {
    if (!ngayGD) return null;
    return runHistory.find((h) => h.sessionDate === ngayGD) || null;
  }, [runHistory, ngayGD]);

  // Nạp nhanh kết quả đã lưu vào màn hình
  const handleQuickLoadResult = (item: any) => {
    if (!item?.result) {
      toast.error('Bản ghi này không có cấu trúc dữ liệu kết quả để hiển thị.');
      return;
    }
    setResult(item.result);
    if (Array.isArray(item.accumulatorLogs)) {
      setAccumulatorLogs(item.accumulatorLogs);
    }
    if (item.sessionDate && item.sessionDate !== ngayGD) {
      setNgayGD(item.sessionDate);
    }
    toast.success(
      `Đã nạp số liệu thống kê phiên ${item.sessionDate} (${item.result?.totalSoLot ? item.result.totalSoLot.toLocaleString('vi-VN') + ' lot' : 'hoàn tất'})!`,
    );
  };

  // Sync date when parent selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setNgayGD(selectedDate);
      setAdhocToDate(selectedDate);
    }
  }, [selectedDate]);

  // Load config on mount
  const fetchConfig = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.ccpClearing.getLotConfig(token);
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
      const data = await api.ccpClearing.scanDailyLot(date, token);
      if (data?.success && data?.data) {
        setScanResult(data.data);
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
      const data = await api.ccpClearing.saveLotConfig({
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
      }, token);
      if (data?.success) {
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

  // Tạo nhanh bộ 10 file con dựa trên Thư mục gốc CCP đã cấu hình (Data-Driven, không hardcode thư mục)
  const handleApplyDefaultOutputPaths = () => {
    const baseDir = backupPathCcp.trim().replace(/[/\\]+$/, '');
    if (!baseDir) {
      toast.error('Vui lòng cấu hình "Thư mục gốc quét báo cáo CCP" trước để hệ thống tạo nhanh đường dẫn file con!');
      return;
    }
    const outputDir = `${baseDir}\\output`;
    setPathAcmLot(`${outputDir}\\Thong ke so lot giao dich ACM \${YYYY}.xlsx`);
    setPathAcmGtgd(`${outputDir}\\Thong ke gia tri giao dich ACM \${YYYY}.xlsx`);
    setPathNormalLot(`${outputDir}\\Thong ke so lot giao dich \${YYYY}.xlsx`);
    setPathSpreadLot(`${outputDir}\\Thong ke so lot giao dich Spread \${YYYY}.xlsx`);
    setPathLmeLot(`${outputDir}\\Thong ke so lot giao dich LME \${YYYY}.xlsx`);
    setPathOptionsLot(`${outputDir}\\Thong ke so lot giao dich Options \${YYYY}.xlsx`);
    setPathGtgdNormal(`${outputDir}\\Thong ke gia tri giao dich \${YYYY}.xlsx`);
    setPathGtgdSpread(`${outputDir}\\Thong ke gia tri giao dich Spread \${YYYY}.xlsx`);
    setPathGtgdLme(`${outputDir}\\Thong ke gia tri giao dich LME \${YYYY}.xlsx`);
    setPathGtgdOptions(`${outputDir}\\Thong ke gia tri giao dich Options \${YYYY}.xlsx`);
    setPathDsgdCumulative(`${outputDir}\\DSGD T\${MM}.\${YYYY} CCP.xlsx`);
    toast.success(`Đã tạo nhanh bộ đường dẫn 10 file con trỏ vào: ${outputDir}`);
  };

  // Đồng bộ tỷ giá mới nhất từ tệp ngày CoreCCP hoặc M-System và lưu vào CSDL
  const [syncingRate, setSyncingRate] = useState<boolean>(false);
  const handleSyncExchangeRates = async () => {
    if (!token) return;
    setSyncingRate(true);
    const toastId = toast.loading('Đang lấy tỷ giá mới nhất từ tệp ngày CoreCCP / M-System...');
    try {
      const data = await api.ccpClearing.syncExchangeRateLot({ date: ngayGD }, token);
      if (data?.success) {
        toast.success(data.message || 'Đã đồng bộ tỷ giá thành công vào CSDL!', { id: toastId });
        if (ngayGD) {
          fetchDailyScan(ngayGD);
        }
      } else {
        toast.error(data?.message || 'Không thể đồng bộ tỷ giá', { id: toastId });
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
      const data = await api.ccpClearing.uploadTygia(formData, token);
      if (data?.success) {
        toast.success(data.message || 'Đã bóc tách và lưu tỷ giá vào CSDL thành công!', { id: toastId });
        if (ngayGD) {
          fetchDailyScan(ngayGD);
        }
      } else {
        toast.error(data?.message || 'Lỗi xử lý file tỷ giá', { id: toastId });
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

      const data = await api.ccpClearing.processLotStatistics(formData, token);
      if (data?.success) {
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
      const data = await api.ccpClearing.writeAccumulator({ result }, token);
      if (data?.logs && Array.isArray(data.logs)) {
        setAccumulatorLogs(data.logs);
      }

      if (data?.success) {
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
      const data = await api.ccpClearing.processDailyLot({ date: ngayGD }, token);
      if (data?.success) {
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

  // ─── 1-CHẠM: Thống Kê Số Lot Trực Tiếp (CoreCCP) ──────────────────────────
  const [runningLot, setRunningLot] = useState<boolean>(false);
  const handleRunLotDirect = async () => {
    if (!token) return;
    if (!scanResult?.canProcess) {
      toast.error('Chưa tìm thấy file DSGD trong thư mục ngày. Vui lòng kiểm tra lại!');
      return;
    }

    setRunningLot(true);
    setAccumulatorLogs([]);
    const toastId = toast.loading(`Đang tính toán và ghi file Số Lot ngày ${ngayGD}...`);
    try {
      const data = await api.ccpClearing.runLot({ date: ngayGD }, token);
      if (data?.logs && Array.isArray(data.logs)) {
        setAccumulatorLogs(data.logs);
      }
      if (data?.success) {
        if (data?.result) setResult(data.result);
        toast.success(
          data.message || `Đã ghi thành công các file Số Lot ngày ${ngayGD} (${data.result?.totalSoLot?.toLocaleString('vi-VN')} lot)`,
          { id: toastId },
        );
        fetchRunHistory();
      } else {
        toast.error(data?.message || 'Có lỗi khi ghi file Số Lot', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối máy chủ: ' + err.message, { id: toastId });
    } finally {
      setRunningLot(false);
    }
  };

  // ─── 1-CHẠM: Thống Kê Giá Trị Giao Dịch Trực Tiếp (CoreCCP) ───────────────
  const [runningValue, setRunningValue] = useState<boolean>(false);
  const handleRunValueDirect = async () => {
    if (!token) return;
    if (!scanResult?.canProcess) {
      toast.error('Chưa tìm thấy file DSGD trong thư mục ngày. Vui lòng kiểm tra lại!');
      return;
    }

    setRunningValue(true);
    setAccumulatorLogs([]);
    const toastId = toast.loading(`Đang tính toán và ghi file Giá Trị Giao Dịch ngày ${ngayGD}...`);
    try {
      const data = await api.ccpClearing.runValue({ date: ngayGD }, token);
      if (data?.logs && Array.isArray(data.logs)) {
        setAccumulatorLogs(data.logs);
      }
      if (data?.success) {
        if (data?.result) setResult(data.result);
        toast.success(
          data.message || `Đã ghi thành công các file Giá Trị Giao Dịch ngày ${ngayGD}`,
          { id: toastId },
        );
        fetchRunHistory();
      } else {
        toast.error(data?.message || 'Có lỗi khi ghi file Giá Trị', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối máy chủ: ' + err.message, { id: toastId });
    } finally {
      setRunningValue(false);
    }
  };

  // ─── 1-CHẠM: Chạy Macro Toàn Diện (11 File: Số Lot + GTGD) ────────────────
  const [runningMacro, setRunningMacro] = useState<boolean>(false);
  const handleRunMacroDirect = async () => {
    if (!token) return;
    if (!scanResult?.canProcess) {
      toast.error('Chưa tìm thấy file DSGD trong thư mục ngày. Vui lòng kiểm tra lại!');
      return;
    }

    setRunningMacro(true);
    setAccumulatorLogs([]);
    const toastId = toast.loading(`Đang chạy Macro toàn diện (11 file) ngày ${ngayGD}...`);
    try {
      const data = await api.ccpClearing.runMacro({ date: ngayGD }, token);
      if (data?.logs && Array.isArray(data.logs)) {
        setAccumulatorLogs(data.logs);
      }
      if (data?.success) {
        if (data?.result) setResult(data.result);
        toast.success(
          data.message || `Đã chạy hoàn tất Macro CoreCCP toàn diện ngày ${ngayGD}!`,
          { id: toastId },
        );
        fetchRunHistory();
      } else {
        toast.error(data?.message || 'Có lỗi khi chạy Macro CoreCCP', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối máy chủ: ' + err.message, { id: toastId });
    } finally {
      setRunningMacro(false);
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

  // ── Callbacks cho Thống kê Khoảng Thời Gian (Ad-hoc Range) ──
  const fetchAdHocReports = useCallback(async () => {
    if (!token) return;
    setLoadingAdHocReports(true);
    try {
      const res = await api.ccpClearing.getAdHocReports(token);
      const data = res?.data || res;
      if (Array.isArray(data)) {
        setAdhocReports(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAdHocReports(false);
    }
  }, [token]);

  useEffect(() => {
    if (mainTab === 'ADHOC_RANGE') {
      fetchAdHocReports();
    }
  }, [mainTab, fetchAdHocReports]);

  const handleRunAdHocRange = async () => {
    if (!token) {
      toast.error('Vui lòng đăng nhập để thực hiện');
      return;
    }
    if (!adhocFromDate || !adhocToDate) {
      toast.error('Vui lòng chọn đầy đủ Từ ngày và Đến ngày');
      return;
    }
    if (new Date(adhocFromDate) > new Date(adhocToDate)) {
      toast.error('Ngày bắt đầu không được lớn hơn ngày kết thúc');
      return;
    }

    setRunningAdHoc(true);
    setAdhocLogs([]);
    try {
      const res = await api.ccpClearing.runAdHocRange(
        {
          fromDate: adhocFromDate,
          toDate: adhocToDate,
          scope: adhocScope,
          downloadFresh: true,
        },
        token,
      );

      const data = res?.data || res;
      if (data?.success) {
        setAdhocResult(data);
        setAdhocLogs(data.logs || []);
        toast.success(`Đã xuất thành công ${data.files?.length || 0} file báo cáo Template chuẩn MXV!`);
        fetchAdHocReports();
      } else {
        toast.error(data?.message || 'Không thể tạo báo cáo đột xuất');
        if (data?.logs) setAdhocLogs(data.logs);
      }
    } catch (err: any) {
      toast.error(`Lỗi khi tạo báo cáo đột xuất: ${err.message}`);
    } finally {
      setRunningAdHoc(false);
    }
  };

  const handleDownloadAdHocFile = async (fileName: string) => {
    try {
      const url = `/api/v1/ccp-statistics/lot-statistics/download-adhoc?filename=${encodeURIComponent(fileName)}`;
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Không thể tải tệp');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(`Đã tải xuống: ${fileName}`);
    } catch (err: any) {
      toast.error(`Lỗi tải file: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── THANH CHUYỂN TAB CHÍNH: CA TRỰC HÀNG NGÀY vs BÁO CÁO ĐỘT XUẤT ── */}
      <div
        className="glass-panel"
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setMainTab('DAILY')}
            className="btn"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              border: mainTab === 'DAILY' ? '1px solid #10b981' : '1px solid var(--border-color)',
              backgroundColor: mainTab === 'DAILY' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: mainTab === 'DAILY' ? '#10b981' : 'var(--text-secondary)',
              transition: 'all 0.2s ease',
            }}
          >
            <Calendar size={16} />
            <span>Thống Kê Phiên Hàng Ngày (Ca Trực)</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab('ADHOC_RANGE')}
            className="btn"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              border: mainTab === 'ADHOC_RANGE' ? '1px solid #3b82f6' : '1px solid var(--border-color)',
              backgroundColor: mainTab === 'ADHOC_RANGE' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: mainTab === 'ADHOC_RANGE' ? '#3b82f6' : 'var(--text-secondary)',
              transition: 'all 0.2s ease',
            }}
          >
            <Sparkles size={16} />
            <span>Báo Cáo Tổng Hợp Theo Kỳ</span>
            <span
              style={{
                fontSize: '0.68rem',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: '#3b82f6',
                color: '#fff',
                fontWeight: 800,
              }}
            >
              Tùy chọn ngày
            </span>
          </button>
        </div>

        {mainTab === 'DAILY' && onToggleViewMode && (
          <button
            type="button"
            onClick={() => onToggleViewMode(currentViewMode === 'USER' ? 'EXPERT' : 'USER')}
            className="btn btn-outline"
            style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sliders size={14} />
            <span>{currentViewMode === 'USER' ? 'Chế độ Chuyên gia (Expert)' : 'Chế độ Vận hành (User)'}</span>
          </button>
        )}
      </div>

      {mainTab === 'DAILY' ? (
        <>
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
                  DSGD: {scanResult?.files.dsgd?.present ? '✓' : '✗'} | TTM: {scanResult?.files.ttm?.present ? '✓' : '✗'} | TTTT: {scanResult?.files.tttt?.present ? '✓' : '✗'} | Tỷ giá: 1 USD = {(scanResult?.dbExchangeRates?.detectedRate || scanResult?.dbExchangeRates?.ccpUsd || scanResult?.dbExchangeRates?.usd || result?.tyGiaUsed?.['USD']) ? `${fmtNum(scanResult?.dbExchangeRates?.detectedRate || scanResult?.dbExchangeRates?.ccpUsd || scanResult?.dbExchangeRates?.usd || result?.tyGiaUsed?.['USD'])} đ` : 'Chưa tải'}
                </span>
              </div>
            </div>

            {/* 1-Click Action Buttons: Tách Độc Lập Số Lot & Giá Trị Giao Dịch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Nút 0: Chạy Macro Toàn Diện (11 File) + Icon Kiểm Tra PreFlight */}
              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleRunMacroDirect}
                  disabled={runningMacro || runningLot || runningValue || !scanResult?.canProcess}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    padding: '10px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderTopLeftRadius: '8px',
                    borderBottomLeftRadius: '8px',
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                    borderRight: '1px solid rgba(255, 255, 255, 0.25)',
                    boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                    cursor: runningMacro || runningLot || runningValue || !scanResult?.canProcess ? 'not-allowed' : 'pointer',
                    backgroundColor: scanResult?.canProcess ? '#8b5cf6' : undefined,
                  }}
                >
                  {runningMacro ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang Ghi 11 File...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Chạy Macro (11 File)</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorModal({ isOpen: true, type: 'ALL' })}
                  style={{
                    fontSize: '0.86rem',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderTopRightRadius: '8px',
                    borderBottomRightRadius: '8px',
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    border: 'none',
                    backgroundColor: scanResult?.canProcess ? '#7c3aed' : '#334155',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  title="Xem thông tin các file sẽ chạy và kiểm tra đường dẫn lưu toàn bộ 11 file lũy kế CoreCCP"
                >
                  <FileSearch size={16} />
                </button>
              </div>

              {/* Nút 1: Thống Kê Số Lot (1-Chạm Ghi Trực Tiếp) + Icon Kiểm Tra File */}
              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleRunLotDirect}
                  disabled={runningMacro || runningLot || runningValue || !scanResult?.canProcess}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    padding: '10px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderTopLeftRadius: '8px',
                    borderBottomLeftRadius: '8px',
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                    borderRight: '1px solid rgba(255, 255, 255, 0.25)',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    cursor: runningLot || runningValue || !scanResult?.canProcess ? 'not-allowed' : 'pointer',
                    backgroundColor: scanResult?.canProcess ? '#10b981' : undefined,
                  }}
                >
                  {runningLot ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang Ghi File Số Lot...</span>
                    </>
                  ) : (
                    <>
                      <Layers size={16} />
                      <span>Thống Kê Số Lot (CoreCCP)</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorModal({ isOpen: true, type: 'LOT' })}
                  style={{
                    fontSize: '0.86rem',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderTopRightRadius: '8px',
                    borderBottomRightRadius: '8px',
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    border: 'none',
                    backgroundColor: scanResult?.canProcess ? '#059669' : '#334155',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  title="Xem thông tin các file sẽ chạy và kiểm tra đường dẫn lưu file Số Lot CoreCCP"
                >
                  <FileSearch size={16} />
                </button>
              </div>

              {/* Nút 2: Thống Kê Giá Trị (1-Chạm Ghi Trực Tiếp) + Icon Kiểm Tra File */}
              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleRunValueDirect}
                  disabled={runningLot || runningValue || !scanResult?.canProcess}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    padding: '10px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderTopLeftRadius: '8px',
                    borderBottomLeftRadius: '8px',
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                    borderRight: 'none',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    borderColor: 'rgba(245, 158, 11, 0.4)',
                    color: '#f59e0b',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.2)',
                    cursor: runningLot || runningValue || !scanResult?.canProcess ? 'not-allowed' : 'pointer',
                  }}
                >
                  {runningValue ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang Ghi File Giá Trị...</span>
                    </>
                  ) : (
                    <>
                      <DollarSign size={16} />
                      <span>Thống Kê Giá Trị (CoreCCP)</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorModal({ isOpen: true, type: 'VALUE' })}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.86rem',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderTopRightRadius: '8px',
                    borderBottomRightRadius: '8px',
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    backgroundColor: 'rgba(245, 158, 11, 0.22)',
                    borderColor: 'rgba(245, 158, 11, 0.4)',
                    color: '#f59e0b',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.2)',
                  }}
                  title="Xem thông tin các file sẽ chạy và kiểm tra đường dẫn lưu file Giá Trị CoreCCP"
                >
                  <FileSearch size={16} />
                </button>
              </div>

              {/* Nút 3: Kiểm Tra Toàn Bộ Luồng File (Pre-Flight File Inspector) */}
              <button
                type="button"
                onClick={() => setInspectorModal({ isOpen: true, type: 'ALL' })}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(14, 165, 233, 0.1)',
                  borderColor: 'rgba(14, 165, 233, 0.35)',
                  color: '#0ea5e9',
                  cursor: 'pointer',
                }}
                title="Kiểm tra chi tiết tình trạng các file đầu vào và đường dẫn lưu 11 file lũy kế CoreCCP"
              >
                <FileSearch size={16} />
                <span>Kiểm Tra Luồng File</span>
              </button>
            </div>

            {/* LUỒNG CŨ 2 BƯỚC (DỰ PHÒNG ROLLBACK - TẠM ẨN) */}
            {/*
            <div style={{ display: 'none', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleProcessDaily}
                disabled={loading || !scanResult?.canProcess}
              >
                Bước 1: Tổng Hợp Dữ Liệu Ngày
              </button>
              {result && (
                <button
                  type="button"
                  onClick={handleWriteAccumulator}
                  disabled={writingAccumulator}
                >
                  Bước 2: Ghi Vào 10 File Lũy Kế Excel
                </button>
              )}
            </div>
            */}
          </div>

          {/* Thông báo nếu phiên đang chọn đã có kết quả chạy thành công và màn hình chưa nạp số liệu */}
          {latestRunForSelectedDate && !result && (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Info size={18} color="#3b82f6" />
                <div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Phiên {ngayGD} đã có kết quả thống kê trong hệ thống
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                    (Thực hiện lúc {latestRunForSelectedDate.createdAt ? new Date(latestRunForSelectedDate.createdAt).toLocaleTimeString('vi-VN') : '--'} bởi {latestRunForSelectedDate.username || 'SYSTEM'} — {latestRunForSelectedDate.result?.totalSoLot ? `${latestRunForSelectedDate.result.totalSoLot.toLocaleString('vi-VN')} lot` : 'Đã ghi sổ'})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickLoadResult(latestRunForSelectedDate)}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.76rem',
                  padding: '5px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  color: '#3b82f6',
                  borderColor: '#3b82f6',
                }}
              >
                <Eye size={14} />
                <span>Xem nhanh số liệu</span>
              </button>
            </div>
          )}

          {/* Component: Tiến trình chạy Thống kê gần nhất (CoreCCP) */}
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Header & Bộ lọc nhanh trạng thái */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} color="var(--text-muted)" />
                  <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                    Tiến trình chạy Thống kê gần nhất
                  </strong>
                </div>

                {/* Filter Chips */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => { setHistoryTypeFilter('ALL'); setHistoryPage(1); }}
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: historyTypeFilter === 'ALL' ? '#10b981' : 'var(--border-color)',
                      backgroundColor: historyTypeFilter === 'ALL' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                      color: historyTypeFilter === 'ALL' ? '#10b981' : 'var(--text-secondary)',
                      fontWeight: historyTypeFilter === 'ALL' ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    Tất cả ({historyCounts.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setHistoryTypeFilter('LOT'); setHistoryPage(1); }}
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: historyTypeFilter === 'LOT' ? '#3b82f6' : 'var(--border-color)',
                      backgroundColor: historyTypeFilter === 'LOT' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      color: historyTypeFilter === 'LOT' ? '#3b82f6' : 'var(--text-secondary)',
                      fontWeight: historyTypeFilter === 'LOT' ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    Số Lot ({historyCounts.lotCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setHistoryTypeFilter('VALUE'); setHistoryPage(1); }}
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: historyTypeFilter === 'VALUE' ? '#f59e0b' : 'var(--border-color)',
                      backgroundColor: historyTypeFilter === 'VALUE' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                      color: historyTypeFilter === 'VALUE' ? '#f59e0b' : 'var(--text-secondary)',
                      fontWeight: historyTypeFilter === 'VALUE' ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    Giá Trị ({historyCounts.valueCount})
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={fetchRunHistory}
                  disabled={loadingHistory}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '3px 9px', display: 'flex', alignItems: 'center', gap: '4px', height: '26px' }}
                  title="Làm mới danh sách tiến trình"
                >
                  <RefreshCw size={11} className={loadingHistory ? 'animate-spin' : ''} />
                  <span>Làm mới</span>
                </button>
                <a
                  href="/trading-manager/job-queue"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '3px 9px', display: 'flex', alignItems: 'center', gap: '4px', height: '26px', textDecoration: 'none' }}
                  title="Mở toàn bộ trang quản trị Hàng Đợi & Nhật Ký Robot"
                >
                  <span>Hàng đợi logs</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                {loadingHistory ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Đang nạp lịch sử thống kê...</span>
                  </div>
                ) : (
                  'Chưa có tác vụ Thống kê CoreCCP nào được ghi nhận gần đây.'
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Bảng cuộn mượt có giới hạn chiều cao & Sticky Header */}
                <div
                  style={{
                    maxHeight: '230px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.76rem' }}>
                    <thead>
                      <tr style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '7px 10px', minWidth: '150px' }}>Loại tác vụ</th>
                        <th style={{ padding: '7px 10px', minWidth: '110px' }}>Người chạy</th>
                        <th style={{ padding: '7px 10px', minWidth: '105px' }}>Trạng thái</th>
                        <th style={{ padding: '7px 10px', minWidth: '95px' }}>Phiên</th>
                        <th style={{ padding: '7px 10px', minWidth: '110px' }}>Thời gian</th>
                        <th style={{ padding: '7px 10px' }}>Số liệu tóm tắt</th>
                        <th style={{ padding: '7px 10px', minWidth: '150px', textAlign: 'center' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedHistory.map((item) => {
                        const isLot = item.runType === 'LOT' || (!item.runType && item.accumulatorLogs?.[0]?.includes('Lot'));
                        const isValue = item.runType === 'VALUE' || item.accumulatorLogs?.[0]?.includes('GTGD');
                        const label = isLot ? 'Thống Kê Số Lot' : isValue ? 'Thống Kê Giá Trị' : 'Ghi Lũy Kế CoreCCP';
                        const color = isLot ? '#3b82f6' : isValue ? '#f59e0b' : '#10b981';
                        const bg = isLot ? 'rgba(59, 130, 246, 0.12)' : isValue ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)';
                        const border = isLot ? 'rgba(59, 130, 246, 0.3)' : isValue ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)';

                        const totalSoLot = item.result?.totalSoLot;
                        const totalGiaTri = item.result?.totalGiaTri;

                        return (
                          <tr
                            key={item._id || item.id}
                            style={{
                              borderBottom: '1px solid var(--border-color)',
                              transition: 'background-color 0.15s ease',
                            }}
                            className="hover-row"
                          >
                            <td style={{ padding: '7px 10px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  backgroundColor: bg,
                                  color,
                                  border: `1px solid ${border}`,
                                }}
                              >
                                {label}
                              </span>
                            </td>
                            <td style={{ padding: '7px 10px', color: 'var(--text-primary)' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem' }}>
                                <User size={12} color="var(--text-muted)" />
                                {item.username || 'SYSTEM'}
                              </span>
                            </td>
                            <td style={{ padding: '7px 10px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.72rem', fontWeight: 700 }}>
                                <CheckCircle2 size={12} />
                                Đã ghi file
                              </span>
                            </td>
                            <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 600 }}>
                              {item.sessionDate || '--'}
                            </td>
                            <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>
                              {item.createdAt ? new Date(item.createdAt).toLocaleTimeString('vi-VN') : '--'}
                            </td>
                            <td
                              style={{
                                padding: '7px 10px',
                                color: 'var(--text-secondary)',
                                fontSize: '0.73rem',
                                maxWidth: '300px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={
                                totalSoLot !== undefined
                                  ? `Tổng số lot: ${totalSoLot.toLocaleString('vi-VN')} lot`
                                  : totalGiaTri !== undefined
                                  ? `Tổng giá trị: ${totalGiaTri.toLocaleString('vi-VN')} đ`
                                  : 'Đã hoàn tất ghi sổ'
                              }
                            >
                              {totalSoLot !== undefined && (
                                <strong style={{ color: '#10b981' }}>{totalSoLot.toLocaleString('vi-VN')} lot</strong>
                              )}
                              {totalSoLot !== undefined && totalGiaTri !== undefined && ' | '}
                              {totalGiaTri !== undefined && (
                                <span style={{ color: '#f59e0b' }}>{(totalGiaTri / 1e9).toFixed(2)} tỷ đ</span>
                              )}
                              {totalSoLot === undefined && totalGiaTri === undefined && 'Đã hoàn tất ghi file Excel'}
                            </td>
                            <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleQuickLoadResult(item)}
                                  className="btn btn-secondary"
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '2px 8px',
                                    height: '24px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontWeight: 700,
                                    color: '#3b82f6',
                                    borderColor: 'rgba(59, 130, 246, 0.4)',
                                  }}
                                  title="Nạp số liệu này vào màn hình để xem biểu đồ, KPI và phân tích TVKD"
                                >
                                  <Eye size={12} />
                                  <span>Xem số liệu</span>
                                </button>
                                {item.accumulatorLogs && item.accumulatorLogs.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedHistoryLog({ title: `Nhật ký ghi file: ${label} - ${item.sessionDate}`, logs: item.accumulatorLogs })}
                                    className="btn btn-secondary"
                                    style={{
                                      fontSize: '0.7rem',
                                      padding: '2px 6px',
                                      height: '24px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                    title="Xem chi tiết nhật ký ghi file Excel"
                                  >
                                    <FileText size={12} />
                                    <span>Log</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Thanh phân trang nhỏ gọn & đếm số lượng */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>
                    Hiển thị {(historyPage - 1) * historyPageSize + 1} - {Math.min(historyPage * historyPageSize, filteredHistory.length)} trên tổng số {filteredHistory.length} tác vụ
                  </span>

                  {historyTotalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={historyPage <= 1}
                        className="btn btn-secondary"
                        style={{ padding: '2px 6px', height: '22px', fontSize: '0.7rem', display: 'flex', alignItems: 'center' }}
                        title="Trang trước"
                      >
                        <ChevronLeft size={12} />
                      </button>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {historyPage} / {historyTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                        disabled={historyPage >= historyTotalPages}
                        className="btn btn-secondary"
                        style={{ padding: '2px 6px', height: '22px', fontSize: '0.7rem', display: 'flex', alignItems: 'center' }}
                        title="Trang tiếp theo"
                      >
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
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
                  Tỷ giá quy đổi: 1 USD = {result.tyGiaUsed?.['USD'] ? `${fmtNum(result.tyGiaUsed['USD'])} đ` : 'Chưa có'}
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
              <>
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleRunLotDirect}
                    disabled={runningLot || runningValue || !scanResult?.canProcess}
                    className="btn btn-primary"
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                      borderRight: '1px solid rgba(255, 255, 255, 0.25)',
                      cursor: runningLot || runningValue || !scanResult?.canProcess ? 'not-allowed' : 'pointer',
                      backgroundColor: scanResult?.canProcess ? '#10b981' : undefined,
                    }}
                  >
                    {runningLot ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Đang Ghi Lot...</span>
                      </>
                    ) : (
                      <>
                        <Layers size={15} />
                        <span>Thống Kê Số Lot</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorModal({ isOpen: true, type: 'LOT' })}
                    style={{
                      fontSize: '0.82rem',
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderTopRightRadius: '6px',
                      borderBottomRightRadius: '6px',
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                      border: 'none',
                      backgroundColor: scanResult?.canProcess ? '#059669' : '#334155',
                      color: '#ffffff',
                      cursor: 'pointer',
                    }}
                    title="Kiểm tra file Số Lot"
                  >
                    <FileSearch size={14} />
                  </button>
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleRunValueDirect}
                    disabled={runningLot || runningValue || !scanResult?.canProcess}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                      borderRight: 'none',
                      cursor: runningLot || runningValue || !scanResult?.canProcess ? 'not-allowed' : 'pointer',
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      borderColor: 'rgba(245, 158, 11, 0.4)',
                      color: '#f59e0b',
                    }}
                  >
                    {runningValue ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Đang Ghi GTGD...</span>
                      </>
                    ) : (
                      <>
                        <DollarSign size={15} />
                        <span>Thống Kê Giá Trị</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorModal({ isOpen: true, type: 'VALUE' })}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.82rem',
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderTopRightRadius: '6px',
                      borderBottomRightRadius: '6px',
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                      backgroundColor: 'rgba(245, 158, 11, 0.22)',
                      borderColor: 'rgba(245, 158, 11, 0.4)',
                      color: '#f59e0b',
                      cursor: 'pointer',
                    }}
                    title="Kiểm tra file Giá Trị"
                  >
                    <FileSearch size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectorModal({ isOpen: true, type: 'ALL' })}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    color: '#0ea5e9',
                    borderColor: 'rgba(14, 165, 233, 0.35)',
                    backgroundColor: 'rgba(14, 165, 233, 0.1)',
                    cursor: 'pointer',
                  }}
                  title="Kiểm tra toàn bộ luồng file đầu vào & đầu ra CoreCCP"
                >
                  <FileSearch size={14} />
                  <span>Kiểm Tra File</span>
                </button>
              </>
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
                    : (scanResult?.dbExchangeRates?.ccpUsd || scanResult?.dbExchangeRates?.usd)
                    ? `1 USD = ${(scanResult?.dbExchangeRates?.ccpUsd || scanResult?.dbExchangeRates?.usd).toLocaleString('vi-VN')} đ ${scanResult?.dbExchangeRates?.lastSynced ? `(Đã lưu DB: ${new Date(scanResult.dbExchangeRates.lastSynced).toLocaleTimeString('vi-VN')} ${new Date(scanResult.dbExchangeRates.lastSynced).toLocaleDateString('vi-VN')})` : ''}`
                    : 'Chưa cấu hình tỷ giá USD trong DB'}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Cấu Hình Đường Dẫn 10 File Lũy Kế Excel CoreCCP
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleApplyDefaultOutputPaths}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Điền tự động đường dẫn chuẩn trỏ vào thư mục con output/"
                >
                  <RotateCcw size={13} />
                  <span>Nạp Mặc Định (output/)</span>
                </button>
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
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SmartPathInput
                value={backupPathCcp}
                onChange={setBackupPathCcp}
                label="Thư mục gốc quét báo cáo CCP (bot_backup_path_ccp):"
                placeholder="vd: M:\...\Backup CCP\Futures hoặc /mnt/qlgd-it/..."
                targetType="folder"
              />

              {/* ── Nhóm 1: File ACM (Phase 1) ── */}
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#10b981', marginTop: '4px' }}>
                1. Nhóm File Lũy Kế ACM (Nano):
              </div>
              <SmartPathInput
                value={pathAcmLot}
                onChange={setPathAcmLot}
                label="File Số Lot ACM (pathAcmLot):"
                placeholder="M:\...\Thong ke ccp\output\Thong ke so lot giao dich ACM ${YYYY}.xlsx"
                targetType="file"
              />
              <SmartPathInput
                value={pathAcmGtgd}
                onChange={setPathAcmGtgd}
                label="File Giá Trị Giao Dịch ACM (pathAcmGtgd):"
                placeholder="M:\...\Thong ke ccp\output\Thong ke gia tri giao dich ACM ${YYYY}.xlsx"
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
                placeholder="M:\...\Thong ke ccp\output\Thong ke so lot giao dich ${YYYY}.xlsx"
                targetType="file"
              />
              <SmartPathInput
                value={pathSpreadLot}
                onChange={setPathSpreadLot}
                label="File Số Lot Spread (pathSpreadLot):"
                placeholder="M:\...\Thong ke ccp\output\Thong ke so lot giao dich Spread ${YYYY}.xlsx"
                targetType="file"
              />
              <SmartPathInput
                value={pathLmeLot}
                onChange={setPathLmeLot}
                label="File Số Lot LME (pathLmeLot):"
                placeholder="M:\...\Thong ke ccp\output\Thong ke so lot giao dich LME ${YYYY}.xlsx"
                targetType="file"
              />
              <SmartPathInput
                value={pathOptionsLot}
                onChange={setPathOptionsLot}
                label="File Số Lot Options (pathOptionsLot):"
                placeholder="M:\...\Thong ke ccp\output\Thong ke so lot giao dich Options ${YYYY}.xlsx"
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
                placeholder="M:\...\Thong ke ccp\output\Thong ke gia tri giao dich ${YYYY}.xlsx"
                targetType="file"
              />
              <SmartPathInput
                value={pathGtgdSpread}
                onChange={setPathGtgdSpread}
                label="File GTGD Spread (pathGtgdSpread):"
                placeholder="M:\...\Thong ke ccp\output\Thong ke gia tri giao dich Spread ${YYYY}.xlsx"
                targetType="file"
              />
              <SmartPathInput
                value={pathGtgdLme}
                onChange={setPathGtgdLme}
                label="File GTGD LME (pathGtgdLme):"
                placeholder="M:\...\Thong ke ccp\output\Thong ke gia tri giao dich LME ${YYYY}.xlsx"
                targetType="file"
              />
              <SmartPathInput
                value={pathGtgdOptions}
                onChange={setPathGtgdOptions}
                label="File GTGD Options (pathGtgdOptions):"
                placeholder="M:\...\Thong ke ccp\output\Thong ke gia tri giao dich Options ${YYYY}.xlsx"
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
                placeholder="M:\...\Thong ke ccp\output\DSGD T${MM}.${YYYY} CCP.xlsx"
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
              Tỷ giá quy đổi: 1 USD = {result.tyGiaUsed?.['USD'] ? `${fmtNum(result.tyGiaUsed['USD'])} đ` : 'Chưa có'}
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
    </>
  ) : (
        /* ── GIAO DIỆN THỐNG KÊ THEO KHOẢNG THỜI GIAN (BÁO CÁO ĐỘT XUẤT 1-PASS) ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Panel */}
          <div
            className="glass-panel"
            style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              borderLeft: '4px solid #3b82f6',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#3b82f6',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Báo Cáo Theo Kỳ
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Thống Kê Khối Lượng &amp; Giá Trị Giao Dịch CoreCCP
                </h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '850px' }}>
                Tổng hợp toàn bộ khối lượng khớp lệnh và giá trị giao dịch trong khoảng thời gian được chọn, tự động kết xuất bộ sổ sách Excel theo đúng biểu mẫu chuẩn của MXV.
              </p>
            </div>
          </div>

          {/* Form Chọn Kỳ & Kích Hoạt */}
          <div
            className="glass-panel"
            style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              {/* Từ ngày */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Từ ngày:
                </label>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <Calendar size={15} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                  <input
                    type="date"
                    value={adhocFromDate}
                    onChange={(e) => setAdhocFromDate(e.target.value)}
                    style={{
                      padding: '8px 12px 8px 32px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>

              {/* Đến ngày */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Đến ngày:
                </label>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <Calendar size={15} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                  <input
                    type="date"
                    value={adhocToDate}
                    onChange={(e) => setAdhocToDate(e.target.value)}
                    style={{
                      padding: '8px 12px 8px 32px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>

              {/* Phạm vi báo cáo */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Phạm vi xuất:
                </label>
                <select
                  value={adhocScope}
                  onChange={(e: any) => setAdhocScope(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL_PHASE2">Toàn bộ 10 sổ sách chuẩn MXV (Thường, ACM, Spread, LME, Options)</option>
                  <option value="ACM_ONLY">Chỉ phân hệ ACM (2 sổ: Khối lượng lot &amp; Giá trị giao dịch)</option>
                </select>
              </div>
            </div>

            {/* Nút Run */}
            <div>
              <button
                type="button"
                onClick={handleRunAdHocRange}
                disabled={runningAdHoc || !adhocFromDate || !adhocToDate}
                className="btn btn-primary"
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  padding: '12px 28px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 16px rgba(59, 130, 246, 0.35)',
                  backgroundColor: '#3b82f6',
                  cursor: runningAdHoc || !adhocFromDate || !adhocToDate ? 'not-allowed' : 'pointer',
                }}
              >
                {runningAdHoc ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Đang tổng hợp dữ liệu...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Xuất Báo Cáo Tổng Hợp</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* KPI Summary Cards (Khi có kết quả) */}
          {adhocResult && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '4px solid #10b981' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TỔNG SỐ LOT KỲ GD</span>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                  {fmtNum(adhocResult.summary?.totalLot)} <span style={{ fontSize: '0.85rem' }}>Lot</span>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '4px solid #3b82f6' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TỔNG GIÁ TRỊ GIAO DỊCH (VND)</span>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#3b82f6', marginTop: '4px' }}>
                  {((adhocResult.summary?.totalGiaTri || 0) / 1e9).toFixed(2)} <span style={{ fontSize: '0.85rem' }}>Tỷ VNĐ</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{fmtNum(adhocResult.summary?.totalGiaTri)} đ</span>
              </div>

              <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '4px solid #f59e0b' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>SỐ LOT ACM TRONG KỲ</span>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
                  {fmtNum(adhocResult.summary?.acmLot)} <span style={{ fontSize: '0.85rem' }}>Lot</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>GTGD: {((adhocResult.summary?.acmGiaTri || 0) / 1e9).toFixed(2)} Tỷ VNĐ</span>
              </div>

              <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '4px solid #8b5cf6' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>KỲ BÁO CÁO</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px' }}>
                  {adhocResult.period}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{adhocResult.files?.length || 0} file báo cáo đã tạo</span>
              </div>
            </div>
          )}

          {/* Danh sách File Template vừa sinh */}
          {adhocResult?.files && adhocResult.files.length > 0 && (
            <div className="glass-panel" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={18} style={{ color: '#10b981' }} />
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Danh Sách Báo Cáo Đã Khởi Tạo
                  </h4>
                </div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  Đã lưu vào kho báo cáo tổng hợp
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '12px' }}>
                {adhocResult.files.map((file: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontWeight: 800,
                            backgroundColor: file.reportType === 'LOT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: file.reportType === 'LOT' ? '#10b981' : '#3b82f6',
                          }}
                        >
                          {file.reportType === 'LOT' ? 'SỐ LOT' : 'GIÁ TRỊ'}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {file.category}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '240px',
                        }}
                        title={file.fileName}
                      >
                        {file.fileName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {(file.fileSizeBytes / 1024).toFixed(1)} KB • Row {file.targetRow} | Tổng Row {file.tongRow}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadAdHocFile(file.fileName)}
                      className="btn btn-outline"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <Download size={14} />
                      <span>Tải Về</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bảng Preview TVKD Trong Kỳ */}
          {adhocResult?.summary?.byTvSummary && adhocResult.summary.byTvSummary.length > 0 && (
            <div className="glass-panel" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} style={{ color: '#3b82f6' }} />
                  <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Khối Lượng Khớp Lệnh Theo Thành Viên Kinh Doanh ({adhocResult.summary.byTvSummary.length} TVKD)
                  </h4>
                </div>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '350px', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '50px' }}>STT</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Mã TVKD</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Tổng Số Lot GD</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Tổng GTGD (VND)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adhocResult.summary.byTvSummary.map((tv: any, i: number) => (
                      <tr key={tv.tvkd} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>{tv.tvkd}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                          {fmtNum(tv.lot)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>
                          {fmtCur(tv.giaTri)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lịch sử Báo Cáo Đã Sinh (Historical reports in _AdHoc_Reports) */}
          <div className="glass-panel" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: 'var(--text-secondary)' }} />
                <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Danh Mục Báo Cáo Đã Xuất Bản
                </h4>
              </div>
              <button
                type="button"
                onClick={fetchAdHocReports}
                disabled={loadingAdHocReports}
                className="btn btn-outline"
                style={{ padding: '4px 10px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={13} className={loadingAdHocReports ? 'animate-spin' : ''} />
                <span>Làm Mới</span>
              </button>
            </div>

            {loadingAdHocReports ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                <span>Đang quét danh mục báo cáo...</span>
              </div>
            ) : adhocReports.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                Chưa có file báo cáo nào được tạo. Vui lòng chọn khoảng thời gian bên trên và bấm &quot;Xuất Báo Cáo Tổng Hợp&quot;.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '10px' }}>
                {adhocReports.map((rpt, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '220px',
                        }}
                        title={rpt.fileName}
                      >
                        {rpt.fileName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {(rpt.sizeBytes / 1024).toFixed(1)} KB • {new Date(rpt.mtime).toLocaleString('vi-VN')}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadAdHocFile(rpt.fileName)}
                      className="btn btn-outline"
                      style={{ padding: '5px 10px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Download size={13} />
                      <span>Tải</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nhật ký thực thi */}
          {adhocLogs.length > 0 && (
            <div className="glass-panel" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Activity size={16} style={{ color: '#3b82f6' }} />
                <h5 style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Nhật Ký Thực Thi &amp; Xuất File
                </h5>
              </div>
              <div
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  backgroundColor: '#0f172a',
                  color: '#94a3b8',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '0.74rem',
                  lineHeight: '1.4',
                }}
              >
                {adhocLogs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}
          {/* Modal Xem Chi Tiết Nhật Ký Ghi File Lũy Kế */}
          {selectedHistoryLog && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '20px',
                backdropFilter: 'blur(3px)',
              }}
              onClick={() => setSelectedHistoryLog(null)}
            >
              <div
                className="glass-panel"
                style={{
                  width: '100%',
                  maxWidth: '750px',
                  maxHeight: '85vh',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} color="#3b82f6" />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {selectedHistoryLog.title}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedHistoryLog(null)}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', height: '28px' }}
                    title="Đóng modal"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    backgroundColor: '#0f172a',
                    color: '#e2e8f0',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.74rem',
                    lineHeight: '1.5',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    maxHeight: '450px',
                  }}
                >
                  {selectedHistoryLog.logs.length === 0 ? (
                    <div style={{ color: '#94a3b8' }}>Không có log chi tiết nào được ghi lại cho bản ghi này.</div>
                  ) : (
                    selectedHistoryLog.logs.map((log, idx) => (
                      <div key={idx} style={{ color: log.includes('ERR') || log.includes('Cảnh báo') ? '#f59e0b' : '#93c5fd' }}>
                        {log}
                      </div>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedHistoryLog(null)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 18px', fontWeight: 600 }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Kiểm Tra Tình Trạng File & Đường Dẫn (Pre-Flight File Inspector) */}
      <PreFlightFileInspectorModal
        isOpen={!!inspectorModal?.isOpen}
        onClose={() => setInspectorModal(null)}
        taskKey="CCP_STATISTICS"
        system="CCP"
        targetDate={ngayGD}
        initialType={inspectorModal?.type || 'ALL'}
        token={token}
        onOpenConfig={() => {
          setInspectorModal(null);
          setShowConfig(true);
        }}
      />
    </div>
  );
}
