import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { CleanRecord, FilterStatus, TkgdStats, AccountManifest } from '../types/tkgd.types';
import { tkgdApi } from '../services/tkgd.api';

export function useTkgdData(token?: string | null, userEmail?: string) {
  const [records, setRecords] = useState<CleanRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [batchDate, setBatchDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // UI display options
  const [showStats, setShowStats] = useState<boolean>(true);
  const [isCompactView, setIsCompactView] = useState<boolean>(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Stats & Inspecting
  const [stats, setStats] = useState<TkgdStats>({
    totalCount: 0,
    pendingMsCount: 0,
    matchedCount: 0,
    canKiemTraCount: 0,
    mismatchedCount: 0,
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
      return next;
    });
  }, []);

  // Fetch Records
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tkgdApi.getRecords(
        { page, limit: pageSize, filter, batchDate, search: searchTerm },
        token,
        userEmail
      );
      setRecords(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || Math.ceil((data.total || 0) / pageSize) || 1);
    } catch (err: any) {
      toast.error('Không thể tải dữ liệu đối soát: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [token, userEmail, page, pageSize, filter, batchDate, searchTerm]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await tkgdApi.getStats(batchDate, token, userEmail);
      if (data) setStats(data);
    } catch {}
  }, [token, userEmail, batchDate]);

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
