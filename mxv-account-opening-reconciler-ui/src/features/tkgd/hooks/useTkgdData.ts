import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  CleanRecord,
  FilterStatus,
  TkgdStats,
  AccountManifest,
  TkgdColumnKey,
  TkgdSortField,
  TkgdSortOrder,
} from '../types/tkgd.types';
import { tkgdApi } from '../services/tkgd.api';

export const DEFAULT_VISIBLE_COLUMNS: Record<TkgdColumnKey, boolean> = {
  stt: true,
  maTKGD: true,
  phanHe: true,
  tenMail: true,
  hoTenMS: true,
  soCCCD: true,
  trangThaiMS: true,
  snapshot: true,
  ketLuan: true,
  thoiGian: true,
  soSanh: true,
};

export const COMPACT_VISIBLE_COLUMNS: Record<TkgdColumnKey, boolean> = {
  stt: true,
  maTKGD: true,
  phanHe: true,
  tenMail: true,
  hoTenMS: true,
  soCCCD: true,
  trangThaiMS: false,
  snapshot: false,
  ketLuan: true,
  thoiGian: false,
  soSanh: true,
};

export function useTkgdData(token?: string | null, userEmail?: string) {
  const [records, setRecords] = useState<CleanRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Helper lấy chuỗi ngày hôm nay YYYY-MM-DD theo giờ địa phương
  const getTodayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  // Filters & Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [batchDate, setBatchDate] = useState<string>(() => getTodayStr());
  const [startDate, setStartDate] = useState<string>(() => getTodayStr());
  const [endDate, setEndDate] = useState<string>(() => getTodayStr());
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Sắp xếp cột
  const [sortBy, setSortBy] = useState<TkgdSortField | undefined>('thoiGian');
  const [sortOrder, setSortOrder] = useState<TkgdSortOrder>('desc');

  // Quản lý hiển thị cột (Column Visibility)
  const [visibleColumns, setVisibleColumns] = useState<Record<TkgdColumnKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem('tkgd_visible_columns');
      if (saved) {
        return { ...DEFAULT_VISIBLE_COLUMNS, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_VISIBLE_COLUMNS;
  });

  // UI display options
  const [showStats, setShowStats] = useState<boolean>(true);
  const [isCompactView, setIsCompactView] = useState<boolean>(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Stats & Inspecting
  const [stats, setStats] = useState<TkgdStats>({
    totalCount: 0,
    pendingMsCount: 0,
    matchedCount: 0,
    matchedTextCount: 0,
    canKiemTraCount: 0,
    mismatchedCount: 0,
    futuresCount: 0,
    acmCount: 0,
    lmeCount: 0,
    spreadCount: 0,
  });
  const [inspectRecord, setInspectRecord] = useState<CleanRecord | null>(null);
  const [accountManifest, setAccountManifest] = useState<AccountManifest | null>(null);
  const [loadingManifest, setLoadingManifest] = useState<boolean>(false);

  // Restore LocalStorage
  useEffect(() => {
    try {
      const savedStats = localStorage.getItem('tkgd_show_stats');
      if (savedStats !== null) setShowStats(savedStats === 'true');
      const savedCompact = localStorage.getItem('tkgd_compact_view');
      if (savedCompact !== null) setIsCompactView(savedCompact === 'true');
    } catch {}
  }, []);

  const toggleStats = useCallback(() => {
    setShowStats((prev) => {
      const next = !prev;
      localStorage.setItem('tkgd_show_stats', String(next));
      return next;
    });
  }, []);

  const toggleCompactView = useCallback(() => {
    setIsCompactView((prev) => {
      const next = !prev;
      localStorage.setItem('tkgd_compact_view', String(next));
      const nextCols = next ? COMPACT_VISIBLE_COLUMNS : DEFAULT_VISIBLE_COLUMNS;
      setVisibleColumns(nextCols);
      try {
        localStorage.setItem('tkgd_visible_columns', JSON.stringify(nextCols));
      } catch {}
      return next;
    });
  }, []);

  const toggleColumn = useCallback((key: TkgdColumnKey) => {
    setVisibleColumns((prev) => {
      if (key === 'maTKGD') return prev; // Khóa cột mã TKGD luôn hiển thị
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('tkgd_visible_columns', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const setColumnPreset = useCallback((preset: 'DEFAULT' | 'COMPACT') => {
    const nextCols = preset === 'COMPACT' ? COMPACT_VISIBLE_COLUMNS : DEFAULT_VISIBLE_COLUMNS;
    setVisibleColumns(nextCols);
    setIsCompactView(preset === 'COMPACT');
    try {
      localStorage.setItem('tkgd_visible_columns', JSON.stringify(nextCols));
      localStorage.setItem('tkgd_compact_view', String(preset === 'COMPACT'));
    } catch {}
  }, []);

  const handleSort = useCallback((field: TkgdSortField) => {
    setSortBy((prevField) => {
      if (prevField === field) {
        setSortOrder((prevOrder) => (prevOrder === 'asc' ? 'desc' : 'asc'));
        return field;
      } else {
        setSortOrder('asc');
        return field;
      }
    });
  }, []);

  // Fetch Records
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tkgdApi.getRecords(
        {
          page,
          limit: pageSize,
          filter,
          batchDate: startDate || endDate ? undefined : batchDate,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: searchTerm,
          sortBy,
          sortOrder,
        },
        token,
        userEmail
      );
      setRecords(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || Math.ceil((data.total || 0) / pageSize) || 1);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      toast.error('Không thể tải dữ liệu đối soát: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [token, userEmail, page, pageSize, filter, batchDate, startDate, endDate, searchTerm, sortBy, sortOrder]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await tkgdApi.getStats(
        startDate || endDate
          ? { startDate: startDate || undefined, endDate: endDate || undefined }
          : batchDate,
        token,
        userEmail
      );
      if (data) setStats(data);
    } catch {}
  }, [token, userEmail, batchDate, startDate, endDate]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Fetch Manifest when inspecting a record
  useEffect(() => {
    if (!inspectRecord) {
      setAccountManifest(null);
      return;
    }
    const code =
      inspectRecord.maTKGDBase ||
      (inspectRecord.maTKGD ? inspectRecord.maTKGD.split('-')[0] : '') ||
      inspectRecord.noiDungMail?.maTKGD_Futures;
    if (!code) return;

    let isMounted = true;
    setLoadingManifest(true);
    tkgdApi
      .getAccountManifest(code, inspectRecord.batchDate, token, userEmail)
      .then((data) => {
        if (isMounted && data && data.success) {
          setAccountManifest(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingManifest(false);
      });

    return () => {
      isMounted = false;
    };
  }, [inspectRecord, token, userEmail]);

  const refreshData = useCallback(async () => {
    await Promise.all([fetchRecords(), fetchStats()]);
  }, [fetchRecords, fetchStats]);

  return {
    records,
    setRecords,
    total,
    totalPages,
    loading,
    page,
    setPage,
    pageSize,
    setPageSize,
    filter,
    setFilter,
    batchDate,
    setBatchDate,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    handleSort,
    visibleColumns,
    setVisibleColumns,
    toggleColumn,
    setColumnPreset,
    searchTerm,
    setSearchTerm,
    showStats,
    setShowStats,
    toggleStats,
    isCompactView,
    toggleCompactView,
    expandedRowId,
    setExpandedRowId,
    stats,
    inspectRecord,
    setInspectRecord,
    accountManifest,
    loadingManifest,
    fetchRecords,
    fetchStats,
    refreshData,
  };
}
