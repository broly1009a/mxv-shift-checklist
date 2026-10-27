'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { useAppSocket } from '@/services/appSocket';
import { tradingOpsApi } from '@/features/trading';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Download,
  RefreshCw,
  Building2,
  Users,
  Clock,
  Layers,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  History,
  RotateCcw,
  Filter,
  CheckCircle2,
  SlidersHorizontal,
  FileSpreadsheet,
  Copy,
  MessageSquare,
  Check,
  X,
  Info,
  Maximize2,
  Search,
  Loader2,
} from 'lucide-react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import toast from 'react-hot-toast';

// Đăng ký các module Chart.js cần thiết
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * Interface cho dữ liệu từng mặt hàng trong bảng ma trận Lãi lỗ & Vị thế
 */
export interface CommodityPositionPnLItem {
  stt: number;
  category: 'Nông sản' | 'Nguyên liệu công nghiệp' | 'Kim loại' | string;
  symbol: string;
  name: string;
  expectedPnL: number; // VND (số âm biểu thị lỗ dự kiến)
  openPositions: number; // lots
  longRatio: number; // % mở Mua (0 - 100)
  shortRatio: number; // % mở Bán (0 - 100)
  realizedPnL: number; // VND (lãi lỗ thực tế đã chốt)
  liquidatedLots: number; // Trạng thái tất toán (lots)
  isTop17?: boolean;
  highlightExpectedLoss?: boolean;
  highlightOpenPosition?: boolean;
  highlightLiquidated?: boolean;
}

/**
 * Interface cho 4 mốc báo cáo Ban Giám Đốc
 */
export interface MilestoneReportData {
  earlySession: number; // Đầu phiên (5h-8h)
  asianSession: number; // Hết phiên Á (5h-16h)
  europeanSession: number; // Hết phiên Âu (5h-23h)
  americanSession: number | null; // Hết phiên Mỹ (cả ngày) - null hoặc pending nếu chưa qua 23h
  isAmericanSessionPending?: boolean;
  uniqueAccounts?: {
    earlySession: number;
    asianSession: number;
    europeanSession: number;
    americanSession: number | null;
  };
}

/**
 * Interface cho phân khúc thị trường (ACM hoặc Còn lại)
 */
export interface MarketSegmentData {
  title: string;
  subTitle: string;
  iconType: 'acm' | 'others';
  latestKlgd: number; // Khối lượng giao dịch (lots)
  latestGtgdStr: string; // Giá trị giao dịch hiển thị (ví dụ "1 tỷ", "10 tỷ")
  latestGtgdVnd: number; // VND
  milestones: MilestoneReportData;
  timelineLabels: string[];
  timelineVolumes: number[];
  timelineValues: number[]; // Tỷ VND
}

/**
 * Metadata thông tin các phân khúc thị trường trên Dashboard
 */
export const SEGMENT_METADATA = {
  acm: {
    title: 'ACM',
    subTitle: 'Khối Tự Doanh & Tạo Lập Thị Trường',
    iconType: 'acm' as const,
  },
  others: {
    title: 'Còn lại',
    subTitle: 'Khách Hàng Thành Viên & CQG Brokerage',
    iconType: 'others' as const,
  },
};

/**
 * Định dạng tiền tệ VND kế toán: số âm đặt trong ngoặc đơn (xxx,xxx,xxx)
 */
function formatAccountingCurrency(val: number): string {
  if (val === 0) return '0';
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const formatted = absVal.toLocaleString('en-US');
  return isNegative ? `(${formatted})` : formatted;
}

/**
 * Định dạng số nguyên
 */
function formatInteger(val: number): string {
  return val.toLocaleString('en-US');
}

const getTodayVnDate = () => {
  const vnTime = new Date(Date.now() + 7 * 3600 * 1000);
  return vnTime.toISOString().split('T')[0];
};

export interface QlgdExecutiveDashboardProps {
  initialDate?: string;
  onRefresh?: () => void;
  hideHeaderCard?: boolean;
  sessionDateProp?: string;
  onSelectDate?: (date: string) => void;
}

export const QlgdExecutiveDashboard: React.FC<QlgdExecutiveDashboardProps> = ({
  initialDate,
  onRefresh,
  hideHeaderCard = false,
  sessionDateProp,
  onSelectDate,
}) => {
  const { token } = useAuth();
  const defaultDate = useMemo(() => sessionDateProp || initialDate || getTodayVnDate(), [sessionDateProp, initialDate]);
  const [internalSessionDate, setInternalSessionDate] = useState<string>(defaultDate);
  const sessionDate = sessionDateProp || internalSessionDate;

  const setSessionDate = useCallback(
    (newDate: string) => {
      setInternalSessionDate(newDate);
      if (onSelectDate) onSelectDate(newDate);
    },
    [onSelectDate],
  );

  useEffect(() => {
    if (sessionDateProp && sessionDateProp !== internalSessionDate) {
      setInternalSessionDate(sessionDateProp);
    }
  }, [sessionDateProp, internalSessionDate]);

    const [selectedScope, setSelectedScope] = useState<'ALL' | 'ACM' | 'OTHERS'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'Nông sản' | 'Nguyên liệu công nghiệp' | 'Kim loại'>('ALL');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Cache Key Helper cho cơ chế Stale-While-Revalidate
  const getDashboardCacheKey = useCallback(
    (date: string, scope: string, jobId?: string | null) =>
      `mxv_qlgd_dashboard_cache_${date}_${scope}_${jobId || 'latest'}`,
    [],
  );

  // Khởi tạo LiveData & CacheTimestamp từ sessionStorage nếu có (tức thì 0ms, zero flicker)
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(`mxv_qlgd_dashboard_cache_${defaultDate}_ALL_latest`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return parsed?.cachedAt || null;
        }
      } catch {}
    }
    return null;
  });

  const [liveData, setLiveData] = useState<any | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(`mxv_qlgd_dashboard_cache_${defaultDate}_ALL_latest`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return parsed?.data || parsed;
        }
      } catch {}
    }
    return null;
  });

  const [loadingLive, setLoadingLive] = useState<boolean>(false);
  const [isSyncingApi, setIsSyncingApi] = useState<boolean>(false);
  const [isBgsModalOpen, setIsBgsModalOpen] = useState<boolean>(false);
  const [activeBgsTab, setActiveBgsTab] = useState<'16H' | '23H' | 'EOD' | 'QLGD'>('16H');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isAllCommoditiesModalOpen, setIsAllCommoditiesModalOpen] = useState<boolean>(false);
  const [modalSearchTerm, setModalSearchTerm] = useState<string>('');
  const [modalCategory, setModalCategory] = useState<string>('ALL');

  const [selectedRunJobId, setSelectedRunJobId] = useState<string | null>(null);
  const selectedRunJobIdRef = useRef<string | null>(null);

  // Cấu hình TTL (Time-To-Live) cho Cache
  const LIVE_CACHE_TTL_MS = 3 * 60 * 1000; // 3 phút cho phiên Live hôm nay
  const HISTORICAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ cho phiên cũ hoặc lượt xem quá khứ

  // Tự động nạp cache khi đổi phiên hoặc đổi lượt check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cacheKey = getDashboardCacheKey(sessionDate, selectedScope, selectedRunJobId);
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          setLiveData(parsed?.data || parsed);
          setCacheTimestamp(parsed?.cachedAt || null);
        }
      } catch {}
    }
  }, [sessionDate, selectedScope, selectedRunJobId, getDashboardCacheKey]);

  // Danh sách các lượt chạy trong ngày (như checkklgd)
  const runs = useMemo(() => {
    return (liveData?.runs || []) as Array<{
      id: string;
      jobId: string;
      time: string;
      label: string;
      createdAt: string;
      status: string;
      triggerType: 'AUTO' | 'MANUAL';
      triggerLabel: string;
      hasDiscrepancy: boolean;
      totalDSGD?: number;
      totalNano?: number;
      cutoffTime?: string;
    }>;
  }, [liveData?.runs]);

  const runsRef = useRef(runs);
  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  const isCacheFresh = useCallback(
    (cachedAt: number, date: string, jobId?: string | null) => {
      const isToday = date === getTodayVnDate();
      const currentRuns = runsRef.current;
      const isHistoricalRun = Boolean(jobId && currentRuns.length > 0 && jobId !== currentRuns[0].id);
      const ttl = (!isToday || isHistoricalRun) ? HISTORICAL_CACHE_TTL_MS : LIVE_CACHE_TTL_MS;
      return Date.now() - cachedAt < ttl;
    },
    [],
  );

  const isViewingHistorical = useMemo(() => {
    return Boolean(
      liveData?.isViewingHistorical ||
        (selectedRunJobId && runs.length > 0 && selectedRunJobId !== runs[0].id),
    );
  }, [liveData?.isViewingHistorical, selectedRunJobId, runs]);

  const currentRunIndex = useMemo(() => {
    if (!runs || runs.length === 0) return -1;
    const targetId = selectedRunJobId || liveData?.currentJobId || runs[0]?.id;
    return runs.findIndex((r) => r.id === targetId);
  }, [runs, selectedRunJobId, liveData?.currentJobId]);

  const hasPrevRun = currentRunIndex >= 0 && currentRunIndex < runs.length - 1; // Lượt cũ hơn
  const hasNextRun = currentRunIndex > 0; // Lượt mới hơn

  // Tải dữ liệu thực tế từ Backend API (kết hợp lưu cache thông minh)
  const fetchLiveDashboard = useCallback(
    async (
      date: string,
      scope: 'ALL' | 'ACM' | 'OTHERS',
      refresh = false,
      jobId?: string | null,
    ) => {
      const targetJobId = jobId !== undefined ? jobId : selectedRunJobIdRef.current;
      const cacheKey = getDashboardCacheKey(date, scope, targetJobId);

      // 1. Kiểm tra Cache trong sessionStorage nếu không phải lệnh bắt buộc làm mới (refresh)
      if (!refresh && typeof window !== 'undefined') {
        try {
          const cachedRaw = sessionStorage.getItem(cacheKey);
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            const cachedData = parsed?.data || parsed;
            const cachedAt = parsed?.cachedAt || 0;

            if (cachedData) {
              setLiveData(cachedData);
              if (cachedAt) setCacheTimestamp(cachedAt);

              // Nếu cache còn mới (Fresh trong TTL) -> Không gọi lại API
              if (cachedAt && isCacheFresh(cachedAt, date, targetJobId)) {
                return;
              }
            }
          }
        } catch {}
      }

      setLoadingLive(true);
      try {
        const data = await tradingOpsApi.getExecutiveDashboard(
          { date, scope, refresh, jobId: targetJobId || undefined },
          token,
        );
        if (data) {
          setLiveData(data);
          const now = Date.now();
          setCacheTimestamp(now);

          // Lưu vào SessionStorage Cache có kèm metadata timestamp
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(
                cacheKey,
                JSON.stringify({
                  data,
                  cachedAt: now,
                  date,
                  scope,
                  jobId: targetJobId || null,
                }),
              );
            } catch {}
          }
          if (
            data.hasActualFiles ||
            data.dataSource === 'DIRECT_API' ||
            data.dataSource === 'BACKUP_FILES'
          ) {
            if (refresh) {
              toast.success(`Đã làm mới dữ liệu phiên ${date}!`, { id: 'live-toast' });
            }
          }
        }
      } catch (e: any) {
        toast.error(`Lỗi tải dữ liệu Live: ${e.message}`);
      } finally {
        setLoadingLive(false);
      }
    },
    [token, getDashboardCacheKey, isCacheFresh],
  );

  const handleSelectRun = useCallback(
    (jobId: string | null, forceLatest: boolean = false) => {
      if (forceLatest || !jobId || (runs.length > 0 && jobId === runs[0].id)) {
        selectedRunJobIdRef.current = null;
        setSelectedRunJobId(null);
        fetchLiveDashboard(sessionDate, selectedScope, false, null);
      } else {
        selectedRunJobIdRef.current = jobId;
        setSelectedRunJobId(jobId);
        fetchLiveDashboard(sessionDate, selectedScope, false, jobId);
      }
    },
    [runs, sessionDate, selectedScope, fetchLiveDashboard],
  );

  const goToPrevRun = useCallback(() => {
    if (hasPrevRun && currentRunIndex >= 0 && runs[currentRunIndex + 1]) {
      handleSelectRun(runs[currentRunIndex + 1].id);
    }
  }, [hasPrevRun, currentRunIndex, runs, handleSelectRun]);

  const goToNextRun = useCallback(() => {
    if (hasNextRun && currentRunIndex > 0 && runs[currentRunIndex - 1]) {
      handleSelectRun(runs[currentRunIndex - 1].id);
    }
  }, [hasNextRun, currentRunIndex, runs, handleSelectRun]);

  // Reset selected run khi đổi ngày
  useEffect(() => {
    selectedRunJobIdRef.current = null;
    setSelectedRunJobId(null);
  }, [sessionDate]);


  const handleSyncFromApi = async () => {
    setIsSyncingApi(true);
    try {
      toast.loading('Đang kích hoạt Direct API tải dữ liệu tươi từ M-System & CoreCCP...', { id: 'sync-api' });
      await tradingOpsApi.syncExecutiveDashboard({ date: sessionDate }, token);
      toast.success('Đồng bộ API thành công! Đang tải lại dữ liệu bảng...', { id: 'sync-api' });
      await fetchLiveDashboard(sessionDate, selectedScope, true);
    } catch (e: any) {
      toast.error(`Lỗi đồng bộ API: ${e.message}`, { id: 'sync-api' });
    } finally {
      setIsSyncingApi(false);
    }
  };

  const getActiveMessageText = () => {
    if (liveData?.bgsMessages) {
      if (activeBgsTab === '16H') return liveData.bgsMessages.session16h;
      if (activeBgsTab === '23H') return liveData.bgsMessages.session23h;
      if (activeBgsTab === 'EOD') return liveData.bgsMessages.sessionEod;
      if (activeBgsTab === 'QLGD') {
        return `${liveData.qlgdMessages?.sessionTitle || ''}\n${liveData.qlgdMessages?.cqgSummary || ''}\n${liveData.qlgdMessages?.acmSummary || ''}`;
      }
    }
    // Fallback tự động tổng hợp từ số liệu thực tế của phiên
    const formatLot = (n: number) => `${formatInteger(n)} lot`;
    const total16h = (othersMilestones.asianSession || 0) + (acmMilestones.asianSession || 0);
    const acc16h = liveData?.milestones?.uniqueAccounts?.at16h || (
      (acmMilestones.uniqueAccounts?.asianSession || 0) + (othersMilestones.uniqueAccounts?.asianSession || 0)
    );

    const total23h = (othersMilestones.europeanSession || 0) + (acmMilestones.europeanSession || 0);
    const acc23h = liveData?.milestones?.uniqueAccounts?.at23h || (
      (acmMilestones.uniqueAccounts?.europeanSession || 0) + (othersMilestones.uniqueAccounts?.europeanSession || 0)
    );

    const totalEod = (othersMilestones.americanSession ?? othersMilestones.europeanSession ?? 0) + (acmMilestones.americanSession ?? acmMilestones.europeanSession ?? 0);
    const accEod = liveData?.milestones?.uniqueAccounts?.atEod || (
      (acmMilestones.uniqueAccounts?.americanSession ?? acmMilestones.uniqueAccounts?.europeanSession ?? 0) +
      (othersMilestones.uniqueAccounts?.americanSession ?? othersMilestones.uniqueAccounts?.europeanSession ?? 0)
    );

    if (activeBgsTab === '16H') {
      return `Em xin phép báo cáo các anh khối lượng giao dịch tính tới 16:00 phiên ${sessionDate} ạ. Tổng khối lượng giao dịch đạt ${formatLot(total16h)}, với Futures là ${formatLot(othersMilestones.asianSession || 0)} và ACM là ${formatLot(acmMilestones.asianSession || 0)}.\nTới thời điểm này có ${acc16h} tài khoản phát sinh giao dịch ạ.`;
    }
    if (activeBgsTab === '23H') {
      return `Em xin phép báo cáo các anh khối lượng giao dịch tính tới 23:00 phiên ${sessionDate} ạ. Tổng khối lượng giao dịch đạt ${formatLot(total23h)}, với Futures là ${formatLot(othersMilestones.europeanSession || 0)} và ACM là ${formatLot(acmMilestones.europeanSession || 0)}.\nTới thời điểm này có ${acc23h} tài khoản phát sinh giao dịch ạ.`;
    }
    if (activeBgsTab === 'EOD') {
      return `Em xin phép báo cáo các anh khối lượng giao dịch phiên ${sessionDate} ạ. Tổng khối lượng giao dịch đạt ${formatLot(totalEod)}, với Futures là ${formatLot(othersMilestones.americanSession ?? othersMilestones.europeanSession ?? 0)} và ACM là ${formatLot(acmMilestones.americanSession ?? acmMilestones.europeanSession ?? 0)}.\nTrong phiên có ${accEod} tài khoản phát sinh giao dịch ạ.`;
    }
    return `Phiên ${sessionDate.slice(5)}:\nCQG: ${formatLot(othersLatestMetrics.klgd)}\nACM: ${formatLot(acmLatestMetrics.klgd)}`;
  };

  const handleCopyBgsMessage = () => {
    const text = getActiveMessageText();
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success('Đã sao chép tin nhắn vào bộ nhớ tạm!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const fetchLiveDashboardRef = useRef(fetchLiveDashboard);
  useEffect(() => {
    fetchLiveDashboardRef.current = fetchLiveDashboard;
  }, [fetchLiveDashboard]);

  const sessionDateRef = useRef(sessionDate);
  useEffect(() => {
    sessionDateRef.current = sessionDate;
  }, [sessionDate]);

  const selectedScopeRef = useRef(selectedScope);
  useEffect(() => {
    selectedScopeRef.current = selectedScope;
  }, [selectedScope]);

  useEffect(() => {
    fetchLiveDashboard(sessionDate, selectedScope);
  }, [sessionDate, selectedScope, fetchLiveDashboard]);

  // Lắng nghe WebSocket qua AppSocket dùng chung an toàn (không ngắt kết nối WebSocket khi unmount hay đổi tab)
  useAppSocket({
    'job-status-updated': () => {
      const isToday = sessionDateRef.current === getTodayVnDate();
      if (isToday && !selectedRunJobIdRef.current) {
        fetchLiveDashboardRef.current?.(sessionDateRef.current, selectedScopeRef.current, true, null);
      }
    },
    'dashboard-updated': () => {
      const isToday = sessionDateRef.current === getTodayVnDate();
      if (isToday && !selectedRunJobIdRef.current) {
        fetchLiveDashboardRef.current?.(sessionDateRef.current, selectedScopeRef.current, true, null);
      }
    },
  });

  // Nguồn dữ liệu hiển thị (100% dữ liệu thực tế từ Backend API)
  const rawDisplayItems = useMemo(() => {
    if (liveData?.items && Array.isArray(liveData.items) && liveData.items.length > 0) {
      return liveData.items as CommodityPositionPnLItem[];
    }
    return [];
  }, [liveData?.items]);

  // 17 mặt hàng chủ lực cho Bảng chính trên Dashboard
  const top17Items = useMemo(() => {
    return rawDisplayItems.filter((item) => item.isTop17 !== false);
  }, [rawDisplayItems]);

  // Lọc dữ liệu theo Nhóm hàng hóa cho Bảng chính
  const displayItems = useMemo(() => {
    if (selectedCategory === 'ALL') return top17Items;
    return top17Items.filter((item) => item.category === selectedCategory);
  }, [selectedCategory, top17Items]);

  // Gom nhóm danh mục phục vụ hiển thị gộp ô (Rowspan) cho Bảng chính
  const categoryGroups = useMemo(() => {
    const map = new Map<string, CommodityPositionPnLItem[]>();
    for (const item of displayItems) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [displayItems]);

  // Tính tổng chân trang Bảng chính
  const footerTotals = useMemo(() => {
    const base = displayItems.reduce(
      (acc, item) => {
        acc.expectedPnL += item.expectedPnL;
        acc.openPositions += item.openPositions;
        acc.realizedPnL += item.realizedPnL;
        acc.liquidatedLots += item.liquidatedLots;
        acc.totalLongLots += item.openPositions * (item.longRatio / 100);
        return acc;
      },
      { expectedPnL: 0, openPositions: 0, realizedPnL: 0, liquidatedLots: 0, totalLongLots: 0 }
    );
    const avgLongRatio = base.openPositions > 0 ? Math.round((base.totalLongLots / base.openPositions) * 100) : 0;
    const avgShortRatio = base.openPositions > 0 ? 100 - avgLongRatio : 0;
    return {
      ...base,
      avgLongRatio,
      avgShortRatio,
    };
  }, [displayItems]);

  // Dữ liệu cho Modal Toàn bộ 44 mặt hàng (Search + Filter nhóm)
  const modalFilteredItems = useMemo(() => {
    let list = rawDisplayItems;
    if (modalCategory !== 'ALL') {
      list = list.filter((item) => item.category === modalCategory);
    }
    if (modalSearchTerm.trim()) {
      const q = modalSearchTerm.toLowerCase().trim();
      list = list.filter((item) => item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q));
    }
    return list;
  }, [rawDisplayItems, modalCategory, modalSearchTerm]);

  const modalCategoryGroups = useMemo(() => {
    const map = new Map<string, CommodityPositionPnLItem[]>();
    for (const item of modalFilteredItems) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [modalFilteredItems]);

  const modalTotals = useMemo(() => {
    const base = modalFilteredItems.reduce(
      (acc, item) => {
        acc.expectedPnL += item.expectedPnL;
        acc.openPositions += item.openPositions;
        acc.realizedPnL += item.realizedPnL;
        acc.liquidatedLots += item.liquidatedLots;
        acc.totalLongLots += item.openPositions * (item.longRatio / 100);
        return acc;
      },
      { expectedPnL: 0, openPositions: 0, realizedPnL: 0, liquidatedLots: 0, totalLongLots: 0 }
    );
    const avgLongRatio = base.openPositions > 0 ? Math.round((base.totalLongLots / base.openPositions) * 100) : 0;
    const avgShortRatio = base.openPositions > 0 ? 100 - avgLongRatio : 0;
    return {
      ...base,
      avgLongRatio,
      avgShortRatio,
    };
  }, [modalFilteredItems]);

  // Dữ liệu 4 mốc thời điểm động từ liveData (mặc định 0 nếu phiên mới chưa có dữ liệu)
  const acmMilestones: MilestoneReportData = useMemo(() => {
    if (liveData?.milestones?.acm) {
      return liveData.milestones.acm;
    }
    return {
      earlySession: 0,
      asianSession: 0,
      europeanSession: 0,
      americanSession: 0,
      isAmericanSessionPending: true,
      uniqueAccounts: {
        earlySession: 0,
        asianSession: 0,
        europeanSession: 0,
        americanSession: 0,
      },
    };
  }, [liveData?.milestones?.acm]);

  const othersMilestones: MilestoneReportData = useMemo(() => {
    if (liveData?.milestones?.others) {
      return liveData.milestones.others;
    }
    return {
      earlySession: 0,
      asianSession: 0,
      europeanSession: 0,
      americanSession: 0,
      isAmericanSessionPending: true,
      uniqueAccounts: {
        earlySession: 0,
        asianSession: 0,
        europeanSession: 0,
        americanSession: 0,
      },
    };
  }, [liveData?.milestones?.others]);

  // Số liệu KLGD & GTGD lần check gần nhất từ liveData
  const acmLatestMetrics = useMemo(() => {
    if (liveData?.latestMetrics?.acm) {
      return liveData.latestMetrics.acm;
    }
    return {
      klgd: 0,
      gtgdStr: '0 đ',
      gtgdVnd: 0,
    };
  }, [liveData?.latestMetrics?.acm]);

  const othersLatestMetrics = useMemo(() => {
    if (liveData?.latestMetrics?.others) {
      return liveData.latestMetrics.others;
    }
    return {
      klgd: 0,
      gtgdStr: '0 đ',
      gtgdVnd: 0,
    };
  }, [liveData?.latestMetrics?.others]);

  // Dòng thời gian các lần kiểm tra trong phiên (sắp xếp tăng dần theo thời gian tạo, chỉ lấy các lượt đã hoàn thành COMPLETED)
  const chronologicalRuns = useMemo(() => {
    if (!runs || runs.length === 0) return [];
    return runs
      .filter((r) => !r.status || r.status === 'COMPLETED')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [runs]);

  // Cấu hình Biểu đồ Check Timeline cho Khối ACM (100% dữ liệu thực)
  const acmChartData = useMemo(() => {
    if (chronologicalRuns.length > 0) {
      const labels = chronologicalRuns.map((r) => r.time ? r.time.slice(0, 5) : '—');
      const volumes = chronologicalRuns.map((r) => r.totalNano ?? 0);
      const values = chronologicalRuns.map((r) => {
        if (acmLatestMetrics.klgd > 0 && acmLatestMetrics.gtgdVnd > 0) {
          const ratio = acmLatestMetrics.gtgdVnd / acmLatestMetrics.klgd;
          return Number((((r.totalNano ?? 0) * ratio) / 1_000_000_000).toFixed(2));
        }
        return 0;
      });

      return {
        labels,
        datasets: [
          {
            label: 'KLGD Tích lũy (Lots)',
            data: volumes,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.35,
            yAxisID: 'yVolume',
          },
          {
            label: 'GTGD (Tỷ VND)',
            data: values,
            borderColor: '#38bdf8',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.35,
            yAxisID: 'yValue',
          },
        ],
      };
    }

    const hasMilestoneData =
      (acmMilestones.earlySession || 0) > 0 ||
      (acmMilestones.asianSession || 0) > 0 ||
      (acmMilestones.europeanSession || 0) > 0 ||
      (acmMilestones.americanSession || 0) > 0;

    const labels = hasMilestoneData
      ? ['Đầu phiên (8h)', 'Hết Á (16h)', 'Hết Âu (23h)', 'Hết Mỹ (5h)']
      : ['08:00', '12:00', '16:00', '20:00', '00:00', '05:00'];

    const volumes = hasMilestoneData
      ? [
          acmMilestones.earlySession || 0,
          acmMilestones.asianSession || 0,
          acmMilestones.europeanSession || 0,
          acmMilestones.americanSession ?? acmMilestones.europeanSession ?? 0,
        ]
      : [0, 0, 0, 0, 0, 0];

    const values = hasMilestoneData
      ? volumes.map((v) => {
          if (acmLatestMetrics.klgd > 0 && acmLatestMetrics.gtgdVnd > 0) {
            const ratio = acmLatestMetrics.gtgdVnd / acmLatestMetrics.klgd;
            return Number(((v * ratio) / 1_000_000_000).toFixed(2));
          }
          return 0;
        })
      : [0, 0, 0, 0, 0, 0];

    return {
      labels,
      datasets: [
        {
          label: 'KLGD Tích lũy (Lots)',
          data: volumes,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.35,
          yAxisID: 'yVolume',
        },
        {
          label: 'GTGD (Tỷ VND)',
          data: values,
          borderColor: '#38bdf8',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [4, 4],
          pointRadius: 2,
          pointHoverRadius: 5,
          tension: 0.35,
          yAxisID: 'yValue',
        },
      ],
    };
  }, [chronologicalRuns, acmLatestMetrics, acmMilestones]);

  // Cấu hình Biểu đồ Check Timeline cho Khối Còn lại (100% dữ liệu thực)
  const othersChartData = useMemo(() => {
    if (chronologicalRuns.length > 0) {
      const labels = chronologicalRuns.map((r) => r.time ? r.time.slice(0, 5) : '—');
      const volumes = chronologicalRuns.map((r) => r.totalDSGD ?? 0);
      const values = chronologicalRuns.map((r) => {
        if (othersLatestMetrics.klgd > 0 && othersLatestMetrics.gtgdVnd > 0) {
          const ratio = othersLatestMetrics.gtgdVnd / othersLatestMetrics.klgd;
          return Number((((r.totalDSGD ?? 0) * ratio) / 1_000_000_000).toFixed(2));
        }
        return 0;
      });

      return {
        labels,
        datasets: [
          {
            label: 'KLGD Tích lũy (Lots)',
            data: volumes,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.35,
            yAxisID: 'yVolume',
          },
          {
            label: 'GTGD (Tỷ VND)',
            data: values,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.35,
            yAxisID: 'yValue',
          },
        ],
      };
    }

    const hasMilestoneData =
      (othersMilestones.earlySession || 0) > 0 ||
      (othersMilestones.asianSession || 0) > 0 ||
      (othersMilestones.europeanSession || 0) > 0 ||
      (othersMilestones.americanSession || 0) > 0;

    const labels = hasMilestoneData
      ? ['Đầu phiên (8h)', 'Hết Á (16h)', 'Hết Âu (23h)', 'Hết Mỹ (5h)']
      : ['08:00', '12:00', '16:00', '20:00', '00:00', '05:00'];

    const volumes = hasMilestoneData
      ? [
          othersMilestones.earlySession || 0,
          othersMilestones.asianSession || 0,
          othersMilestones.europeanSession || 0,
          othersMilestones.americanSession ?? othersMilestones.europeanSession ?? 0,
        ]
      : [0, 0, 0, 0, 0, 0];

    const values = hasMilestoneData
      ? volumes.map((v) => {
          if (othersLatestMetrics.klgd > 0 && othersLatestMetrics.gtgdVnd > 0) {
            const ratio = othersLatestMetrics.gtgdVnd / othersLatestMetrics.klgd;
            return Number(((v * ratio) / 1_000_000_000).toFixed(2));
          }
          return 0;
        })
      : [0, 0, 0, 0, 0, 0];

    return {
      labels,
      datasets: [
        {
          label: 'KLGD Tích lũy (Lots)',
          data: volumes,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.35,
          yAxisID: 'yVolume',
        },
        {
          label: 'GTGD (Tỷ VND)',
          data: values,
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [4, 4],
          pointRadius: 2,
          pointHoverRadius: 5,
          tension: 0.35,
          yAxisID: 'yValue',
        },
      ],
    };
  }, [chronologicalRuns, othersLatestMetrics, othersMilestones]);

  // Tính toán động các mã nổi bật phục vụ chú thích bảng chân trang
  const topLossItem = useMemo(() => {
    if (!rawDisplayItems || rawDisplayItems.length === 0) return null;
    const sorted = [...rawDisplayItems].filter((i) => i.expectedPnL < 0).sort((a, b) => a.expectedPnL - b.expectedPnL);
    return sorted[0] || null;
  }, [rawDisplayItems]);

  const topOpenPositionItem = useMemo(() => {
    if (!rawDisplayItems || rawDisplayItems.length === 0) return null;
    const sorted = [...rawDisplayItems].sort((a, b) => b.openPositions - a.openPositions);
    return sorted[0] || null;
  }, [rawDisplayItems]);

  const topLiquidatedItem = useMemo(() => {
    if (!rawDisplayItems || rawDisplayItems.length === 0) return null;
    const sorted = [...rawDisplayItems].sort((a, b) => b.liquidatedLots - a.liquidatedLots);
    return sorted[0] || null;
  }, [rawDisplayItems]);

  const chartOptionsCommon = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          boxWidth: 10,
          color: '#64748b',
          font: { size: 10, family: 'Inter, sans-serif' },
        },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 8,
        cornerRadius: 6,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
        ticks: { color: '#64748b', font: { size: 9 } },
      },
      yVolume: {
        type: 'linear' as const,
        position: 'left' as const,
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
        ticks: { color: '#64748b', font: { size: 9 } },
      },
      yValue: {
        type: 'linear' as const,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: {
          color: '#0284c7',
          font: { size: 9 },
          callback: (val: any) => `${val}T`,
        },
      },
    },
  };

  // Xử lý xuất file Excel Báo cáo Ban Giám Đốc chuẩn template 1:1 từ Check BGS All.xlsm
  const handleExportExcel = async (scope: 'TOP17' | 'ALL' = 'TOP17') => {
    setIsExporting(true);
    try {
      toast.loading('Đang khởi tạo file Excel báo cáo BGS theo chuẩn template...', { id: 'export-excel' });
      const blob = await tradingOpsApi.exportExecutiveDashboardExcel(
        { date: sessionDate, catalogScope: scope },
        token,
      );
      const cleanDate = (sessionDate || new Date().toISOString().split('T')[0]).replace(/-/g, '');
      const filename = `Bao_Cao_BGS_QLGD_${cleanDate}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Xuất file Excel báo cáo BGS thành công!', { id: 'export-excel' });
    } catch (e: any) {
      toast.error(`Lỗi xuất Excel: ${e.message}`, { id: 'export-excel' });
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Component Skeleton Loader hiển thị hiệu ứng chuyển cảnh mượt mà khi dữ liệu chưa kịp tải
   */
  const DashboardSkeleton = () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
      }}
    >
      {/* Skeleton 2 Card Phân khúc */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: '20px',
        }}
      >
        {[1, 2].map((idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: idx === 1 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #3b82f6, #2563eb)',
              }}
            />
            {/* Card Header Placeholder */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: idx === 1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: idx === 1 ? '#10b981' : '#3b82f6',
                  }}
                >
                  {idx === 1 ? <Building2 size={20} /> : <Users size={20} />}
                </div>
                <div>
                  <div style={{ width: '100px', height: '18px', backgroundColor: 'var(--border-color)', borderRadius: '4px', marginBottom: '6px', opacity: 0.7 }} />
                  <div style={{ width: '160px', height: '12px', backgroundColor: 'var(--border-color)', borderRadius: '4px', opacity: 0.4 }} />
                </div>
              </div>
              <div style={{ width: '130px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--border-color)', opacity: 0.5 }} />
            </div>

            {/* Chart Area Placeholder */}
            <div
              style={{
                height: '180px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px dashed var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
              }}
            >
              <Loader2 size={20} className="animate-spin" color={idx === 1 ? '#10b981' : '#3b82f6'} />
              <span>Đang tính toán biểu đồ & số liệu khớp lệnh...</span>
            </div>

            {/* 4 Mốc thời điểm Placeholder */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[1, 2, 3, 4].map((m) => (
                <div
                  key={m}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    height: '86px',
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Skeleton Bảng 17 Mặt hàng */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ width: '280px', height: '20px', backgroundColor: 'var(--border-color)', borderRadius: '4px', marginBottom: '6px', opacity: 0.7 }} />
            <div style={{ width: '200px', height: '12px', backgroundColor: 'var(--border-color)', borderRadius: '4px', opacity: 0.4 }} />
          </div>
          <div style={{ width: '180px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--border-color)', opacity: 0.5 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                height: '42px',
                borderRadius: '6px',
                backgroundColor: i % 2 === 0 ? 'var(--bg-input)' : 'transparent',
                border: '1px solid var(--border-color)',
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Thanh tiến trình loading mảnh khi đang cập nhật dữ liệu ngầm */}
      {loadingLive && (
        <div
          style={{
            height: '3px',
            width: '100%',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            overflow: 'hidden',
            borderRadius: '2px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: '100%',
              background: 'linear-gradient(90deg, transparent, #10b981, transparent)',
              animation: 'pulse 1.2s infinite',
            }}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP HEADER & METRIC ACTIONS BAR */}
      {/* ========================================================================= */}
      <div
        style={{
          display: 'flex',
          justifyContent: hideHeaderCard ? 'flex-end' : 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: hideHeaderCard ? '12px 18px' : '16px 20px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Khối Header Card cũ chỉ hiện khi không ẩn */}
        {!hideHeaderCard && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa',
              }}
            >
              <BarChart3 size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  DASHBOARD TỔNG HỢP VẬN HÀNH & BÁO CÁO
                </h2>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.18)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  LIVE DATA
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Phân tách khối Tự doanh (ACM) vs Thị trường (Còn lại) | Giám sát 4 mốc thời điểm & Ma trận Lãi lỗ mặt hàng
              </p>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: hideHeaderCard ? '100%' : 'auto', justifyContent: hideHeaderCard ? 'space-between' : 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Date Picker chỉ hiện khi không có Header riêng bên ngoài */}
            {!hideHeaderCard && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                }}
              >
                <Calendar size={15} color="var(--text-muted)" />
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
              </div>
            )}

            {/* Bộ lọc xem lại các lượt check trong ngày (chuẩn như checkklgd) */}
            {runs && runs.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  backgroundColor: isViewingHistorical ? 'rgba(234, 88, 12, 0.12)' : 'var(--bg-input)',
                  border: isViewingHistorical ? '1px solid rgba(234, 88, 12, 0.45)' : '1px solid var(--border-color)',
                  transition: 'all 0.2s',
                }}
              >
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: isViewingHistorical ? '#ea580c' : 'var(--text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <History size={14} style={{ color: isViewingHistorical ? '#ea580c' : 'var(--text-muted)' }} />
                  <span>Lượt:</span>
                </span>

                {/* Nút lùi về lượt cũ hơn (<) */}
                <button
                  type="button"
                  title="Xem lượt chạy trước đó (cũ hơn)"
                  disabled={!hasPrevRun}
                  onClick={goToPrevRun}
                  style={{
                    padding: '4px 6px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: hasPrevRun ? 'var(--bg-card)' : 'transparent',
                    color: hasPrevRun ? 'var(--text-primary)' : 'var(--text-secondary)',
                    opacity: hasPrevRun ? 1 : 0.35,
                    cursor: hasPrevRun ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ChevronLeft size={15} />
                </button>

                {/* Select chọn lượt chạy */}
                <select
                  value={selectedRunJobId || (runs[0]?.id || '')}
                  onChange={(e) => handleSelectRun(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    backgroundColor: 'transparent',
                    color: isViewingHistorical ? '#ea580c' : 'var(--text-primary)',
                    border: 'none',
                    outline: 'none',
                    cursor: 'pointer',
                    maxWidth: '260px',
                  }}
                >
                  {runs.map((r, idx) => {
                    const runNumber = runs.length - idx;
                    const isLatest = idx === 0;
                    const trigger = r.triggerLabel || (r.triggerType === 'MANUAL' ? 'Thủ công' : 'Tự động');
                    const statusNote = r.status === 'FAILED' ? ' [Lỗi]' : '';
                    const labelText = `Lượt #${runNumber} (${r.time}) - ${trigger}${statusNote}${isLatest ? ' (Mới nhất)' : ''}`;
                    return (
                      <option key={r.id} value={r.id}>
                        {labelText}
                      </option>
                    );
                  })}
                </select>

                {/* Nút tiến tới lượt mới hơn (>) */}
                <button
                  type="button"
                  title="Xem lượt chạy tiếp theo (mới hơn)"
                  disabled={!hasNextRun}
                  onClick={goToNextRun}
                  style={{
                    padding: '4px 6px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: hasNextRun ? 'var(--bg-card)' : 'transparent',
                    color: hasNextRun ? 'var(--text-primary)' : 'var(--text-secondary)',
                    opacity: hasNextRun ? 1 : 0.35,
                    cursor: hasNextRun ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ChevronRight size={15} />
                </button>

                {/* Nút quay về lượt mới nhất khi đang xem quá khứ */}
                {isViewingHistorical && (
                  <button
                    type="button"
                    title="Quay lại dữ liệu Live mới nhất"
                    onClick={() => handleSelectRun(null, true)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: '#ea580c',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginLeft: '4px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>Về Live</span>
                  </button>
                )}
              </div>
            )}

            {/* Badge Dữ liệu Live (Đã ẩn hoàn toàn nút Mock Chuẩn BGĐ) */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#10b981',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                }}
              />
              <span>Dữ liệu Live</span>
            </div>

            {/* Cache Timestamp Indicator */}
            {cacheTimestamp && (
              <div
                title={`Dữ liệu lưu tạm (cache) lúc ${new Date(cacheTimestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  fontSize: '0.72rem',
                  color: '#2563eb',
                  fontWeight: 600,
                }}
              >
                <Clock size={12} />
                <span>Cache: {new Date(cacheTimestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            )}

            {/* Loading Indicator */}
            {loadingLive && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.74rem',
                  color: '#10b981',
                  fontWeight: 600,
                }}
              >
                <Loader2 size={13} className="animate-spin" />
                <span>Đang đồng bộ...</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Sync API Button */}
            <button
              type="button"
              disabled={isSyncingApi}
              onClick={handleSyncFromApi}
              style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                cursor: isSyncingApi ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <RefreshCw size={14} className={isSyncingApi ? 'animate-spin' : ''} />
              <span>{isSyncingApi ? 'Đang gọi API...' : 'Đồng bộ API'}</span>
            </button>

          {/* BGS Message Modal Button */}
          <button
            type="button"
            onClick={() => setIsBgsModalOpen(true)}
            style={{
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 700,
              borderRadius: '8px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <MessageSquare size={14} />
            <span>Tin Nhắn BGS</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            disabled={loadingLive}
            onClick={async () => {
              await fetchLiveDashboard(sessionDate, selectedScope, true, selectedRunJobIdRef.current);
              if (onRefresh) onRefresh();
            }}
            className="btn btn-secondary"
            style={{
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              cursor: loadingLive ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={loadingLive ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>

          {/* Export Excel Button */}
          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleExportExcel('TOP17')}
            className="btn btn-primary"
            style={{
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 700,
              borderRadius: '8px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            title="Xuất báo cáo tổng hợp dạng Excel"
          >
            <FileSpreadsheet size={15} />
            <span>{isExporting ? 'Đang xuất...' : 'Xuất File Excel'}</span>
          </button>
        </div>
      </div>
    </div>


      {/* Banner cảnh báo đang xem dữ liệu lịch sử của một lượt cụ thể */}
      {isViewingHistorical && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderRadius: '12px',
            backgroundColor: 'rgba(234, 88, 12, 0.12)',
            border: '1px solid rgba(234, 88, 12, 0.35)',
            color: '#ea580c',
            fontSize: '0.84rem',
            fontWeight: 700,
            boxShadow: 'var(--shadow-sm)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={17} />
            <span>
              Bạn đang xem dữ liệu lịch sử tại thời điểm Lượt #{currentRunIndex >= 0 ? runs.length - currentRunIndex : ''}{' '}
              ({runs[currentRunIndex]?.time} - {runs[currentRunIndex]?.triggerLabel || 'Tự động'}
              {runs[currentRunIndex]?.status === 'FAILED' ? ' - Thất bại' : ''}).
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSelectRun(null, true)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              backgroundColor: '#ea580c',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <RotateCcw size={13} />
            <span>Quay lại Dữ liệu Live mới nhất</span>
          </button>
        </div>
      )}

      {/* Hiệu ứng Transformation / Skeleton khi dữ liệu chưa kịp tải */}
      {loadingLive && !liveData ? (
        <DashboardSkeleton />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            width: '100%',
            transition: 'opacity 0.25s ease-in-out',
            opacity: loadingLive ? 0.8 : 1,
            pointerEvents: loadingLive ? 'none' : 'auto',
          }}
        >
          {/* ========================================================================= */}
          {/* 2. DUAL SEGMENT CARDS (ACM vs CÒN LẠI) WITH TIMELINE CHARTS & 4 MILESTONES */}
          {/* ========================================================================= */}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
              gap: '20px',
            }}
          >
        {/* PANEL 1: ACM */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '14px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle Top Accent Line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #10b981, #059669)',
            }}
          />

          {/* Card Header & Latest Check Metrics */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                }}
              >
                <Building2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.03em' }}>
                  {SEGMENT_METADATA.acm.title}
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{SEGMENT_METADATA.acm.subTitle}</span>
              </div>
            </div>

            {/* Check Gần Nhất Metrics Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '6px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>KLGD Gần Nhất</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formatInteger(acmLatestMetrics.klgd)} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>lots</span>
                </div>
              </div>
              <div style={{ width: '1px', height: '26px', backgroundColor: 'var(--border-color)' }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>GTGD Gần Nhất</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0284c7' }}>
                  {acmLatestMetrics.gtgdStr}
                </div>
              </div>
            </div>
          </div>

          {/* Chart Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Biểu đồ từng lần check trong ngày
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{runs.length > 0 ? `Theo ${runs.length} lượt kiểm tra trong phiên` : 'Theo các mốc thời điểm phiên'}</span>
          </div>

          {/* Chart Canvas */}
          <div
            style={{
              height: '180px',
              width: '100%',
              backgroundColor: 'var(--bg-input)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              padding: '8px',
            }}
          >
            <Line data={acmChartData} options={chartOptionsCommon} />
          </div>

          {/* 4 Mốc Thời Điểm Phục Vụ Báo Cáo BGĐ */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '8px',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <Clock size={13} color="#10b981" />
              <span>4 Mốc Thời Điểm Phục Vụ Báo Cáo BGĐ</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Đầu phiên</div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>5h-8h</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>KLGD</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {formatInteger(acmMilestones.earlySession)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Users size={10} style={{ opacity: 0.7 }} />
                      TKGD
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {acmMilestones.uniqueAccounts?.earlySession != null ? formatInteger(acmMilestones.uniqueAccounts.earlySession) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Hết phiên Á</div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>5h-16h</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>KLGD</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0284c7' }}>
                      {formatInteger(acmMilestones.asianSession)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Users size={10} style={{ opacity: 0.7 }} />
                      TKGD
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {acmMilestones.uniqueAccounts?.asianSession != null ? formatInteger(acmMilestones.uniqueAccounts.asianSession) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Hết phiên Âu</div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>5h-23h</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>KLGD</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#d97706' }}>
                      {formatInteger(acmMilestones.europeanSession)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Users size={10} style={{ opacity: 0.7 }} />
                      TKGD
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {acmMilestones.uniqueAccounts?.europeanSession != null ? formatInteger(acmMilestones.uniqueAccounts.europeanSession) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>Hết phiên Mỹ</div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                    {acmMilestones.isAmericanSessionPending ? 'Chưa qua 23h' : 'Cả ngày'}
                  </div>
                </div>
                <div style={{ borderTop: '1px solid rgba(16, 185, 129, 0.25)', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>KLGD</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981' }}>
                      {acmMilestones.isAmericanSessionPending
                        ? (acmMilestones.americanSession !== null ? `${formatInteger(acmMilestones.americanSession)}*` : '—')
                        : (acmMilestones.americanSession !== null ? formatInteger(acmMilestones.americanSession) : '—')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Users size={10} style={{ opacity: 0.7 }} />
                      TKGD
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {acmMilestones.isAmericanSessionPending
                        ? (acmMilestones.uniqueAccounts?.americanSession != null ? `${formatInteger(acmMilestones.uniqueAccounts.americanSession)}*` : '—')
                        : (acmMilestones.uniqueAccounts?.americanSession != null ? formatInteger(acmMilestones.uniqueAccounts.americanSession) : '—')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 2: CÒN LẠI */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: '14px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle Top Accent Line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
            }}
          />

          {/* Card Header & Latest Check Metrics */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                }}
              >
                <Users size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#2563eb', letterSpacing: '0.03em' }}>
                  {SEGMENT_METADATA.others.title}
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{SEGMENT_METADATA.others.subTitle}</span>
              </div>
            </div>

            {/* Check Gần Nhất Metrics Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '6px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>KLGD Gần Nhất</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formatInteger(othersLatestMetrics.klgd)} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>lots</span>
                </div>
              </div>
              <div style={{ width: '1px', height: '26px', backgroundColor: 'var(--border-color)' }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>GTGD Gần Nhất</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#2563eb' }}>
                  {othersLatestMetrics.gtgdStr}
                </div>
              </div>
            </div>
          </div>

          {/* Chart Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Biểu đồ từng lần check trong ngày
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{runs.length > 0 ? `Theo ${runs.length} lượt kiểm tra trong phiên` : 'Theo các mốc thời điểm phiên'}</span>
          </div>

          {/* Chart Canvas */}
          <div
            style={{
              height: '180px',
              width: '100%',
              backgroundColor: 'var(--bg-input)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              padding: '8px',
            }}
          >
            <Line data={othersChartData} options={chartOptionsCommon} />
          </div>

          {/* 4 Mốc Thời Điểm Phục Vụ Báo Cáo BGĐ */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '8px',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <Clock size={13} color="#2563eb" />
              <span>4 Mốc Thời Điểm Phục Vụ Báo Cáo BGĐ</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Đầu phiên</div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>5h-8h</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>KLGD</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {formatInteger(othersMilestones.earlySession)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Users size={10} style={{ opacity: 0.7 }} />
                      TKGD
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {othersMilestones.uniqueAccounts?.earlySession != null ? formatInteger(othersMilestones.uniqueAccounts.earlySession) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Hết phiên Á</div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>5h-16h</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>KLGD</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0284c7' }}>
                      {formatInteger(othersMilestones.asianSession)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Users size={10} style={{ opacity: 0.7 }} />
                      TKGD
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {othersMilestones.uniqueAccounts?.asianSession != null ? formatInteger(othersMilestones.uniqueAccounts.asianSession) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Hết phiên Âu</div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>5h-23h</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>KLGD</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#d97706' }}>
                      {formatInteger(othersMilestones.europeanSession)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Users size={10} style={{ opacity: 0.7 }} />
                      TKGD
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {othersMilestones.uniqueAccounts?.europeanSession != null ? formatInteger(othersMilestones.uniqueAccounts.europeanSession) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700 }}>Hết phiên Mỹ</div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                    {othersMilestones.isAmericanSessionPending ? 'Chưa qua 23h' : 'Cả ngày'}
                  </div>
                </div>
                <div style={{ borderTop: '1px solid rgba(59, 130, 246, 0.25)', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>KLGD</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#2563eb' }}>
                      {othersMilestones.isAmericanSessionPending
                        ? (othersMilestones.americanSession !== null ? `${formatInteger(othersMilestones.americanSession)}*` : '—')
                        : (othersMilestones.americanSession !== null ? formatInteger(othersMilestones.americanSession) : '—')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Users size={10} style={{ opacity: 0.7 }} />
                      TKGD
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {othersMilestones.isAmericanSessionPending
                        ? (othersMilestones.uniqueAccounts?.americanSession != null ? `${formatInteger(othersMilestones.uniqueAccounts.americanSession)}*` : '—')
                        : (othersMilestones.uniqueAccounts?.americanSession != null ? formatInteger(othersMilestones.uniqueAccounts.americanSession) : '—')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. BẢNG MA TRẬN THỐNG KÊ LÃI LỖ DỰ KIẾN/THỰC TẾ & VỊ THẾ MỞ MUA/BÁN */}
      {/* ========================================================================= */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* Table Top Controls & Filter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              BẢNG THỐNG KÊ 17 MẶT HÀNG CHỦ LỰC
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Dữ liệu phiên chốt: <strong style={{ color: '#0284c7' }}>{sessionDate}</strong>
            </p>
          </div>

          {/* Scope & Category Filter Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Nút bật Modal xem đầy đủ 44 mặt hàng */}
            <button
              type="button"
              onClick={() => {
                setModalCategory('ALL');
                setModalSearchTerm('');
                setIsAllCommoditiesModalOpen(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: '1px solid #0284c7',
                backgroundColor: 'rgba(2, 132, 199, 0.12)',
                color: '#0284c7',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.22)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.12)';
              }}
            >
              <Maximize2 size={14} />
              <span>Xem toàn bộ 44 mặt hàng</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 800,
                }}
              >
                44 mã
              </span>
            </button>

            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)' }} />

            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lọc nhóm:</span>
            {(['ALL', 'Nông sản', 'Nguyên liệu công nghiệp', 'Kim loại'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '5px 12px',
                  fontSize: '0.75rem',
                  fontWeight: selectedCategory === cat ? 700 : 500,
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: selectedCategory === cat ? '#3b82f6' : 'var(--border-color)',
                  backgroundColor: selectedCategory === cat ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                  color: selectedCategory === cat ? '#2563eb' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {cat === 'ALL' ? `Tất cả (${displayItems.length})` : cat}
              </button>
            ))}
          </div>
        </div>

        {/* The Master Data Table - Vừa vặn 17 mặt hàng, không bị cuộn dọc */}
        <div
          style={{
            overflowX: 'auto',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderBottom: '2px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                <th style={{ padding: '8px 6px', borderRight: '1px solid var(--border-color)', width: '40px' }}>STT</th>
                <th style={{ padding: '8px 8px', borderRight: '1px solid var(--border-color)', width: '120px' }}>Nhóm HH</th>
                <th style={{ padding: '8px 6px', borderRight: '1px solid var(--border-color)', width: '65px' }}>Mã HH</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid var(--border-color)', textAlign: 'left', minWidth: '130px' }}>
                  Tên HH
                </th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid var(--border-color)', textAlign: 'right', minWidth: '150px' }}>
                  Tổng lãi lỗ dự kiến (VND)
                </th>
                <th style={{ padding: '8px 8px', borderRight: '1px solid var(--border-color)', textAlign: 'right', width: '105px' }}>
                  Tổng vị thế mở
                </th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid var(--border-color)', textAlign: 'center', width: '120px' }}>
                  % mở Mua
                </th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid var(--border-color)', textAlign: 'center', width: '120px' }}>
                  % mở Bán
                </th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid var(--border-color)', textAlign: 'right', minWidth: '135px' }}>
                  Lãi lỗ thực tế (VND)
                </th>
                <th style={{ padding: '8px 8px', textAlign: 'right', width: '110px' }}>Trạng thái tất toán</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {displayItems.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Chưa có dữ liệu vị thế &amp; lãi lỗ thực tế cho phiên {sessionDate}. Vui lòng nhấn &ldquo;Đồng bộ API tươi&rdquo; hoặc chờ bot quét dữ liệu.
                  </td>
                </tr>
              ) : (
                categoryGroups.map(([catName, items]) => {
                return items.map((item, idx) => {
                  const isFirstOfGroup = idx === 0;
                  const isLastOfGroup = idx === items.length - 1;

                  // Màu số tiền
                  const isExpectedLoss = item.expectedPnL < 0;
                  const isRealizedLoss = item.realizedPnL < 0;

                  return (
                    <tr
                      key={item.symbol}
                      style={{
                        borderBottom: isLastOfGroup ? '2px solid var(--border-color)' : '1px solid var(--border-color)',
                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(148, 163, 184, 0.04)',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          idx % 2 === 0 ? 'transparent' : 'rgba(148, 163, 184, 0.04)';
                      }}
                    >
                      {/* 1. STT */}
                      <td style={{ padding: '6px 6px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{item.stt}</span>
                      </td>

                      {/* 2. Nhóm HH (Gộp ô) */}
                      {isFirstOfGroup ? (
                        <td
                          rowSpan={items.length}
                          style={{
                            padding: '6px 8px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            fontWeight: 700,
                            borderRight: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-input)',
                            color:
                              catName === 'Nông sản'
                                ? '#10b981'
                                : catName === 'Kim loại'
                                ? '#0284c7'
                                : '#d97706',
                            fontSize: '0.78rem',
                          }}
                        >
                          {catName}
                        </td>
                      ) : null}

                      {/* 3. Mã HH */}
                      <td
                        style={{
                          padding: '6px 6px',
                          textAlign: 'center',
                          fontWeight: 700,
                          borderRight: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          fontFamily: 'monospace',
                          fontSize: '0.78rem',
                        }}
                      >
                        {item.symbol}
                      </td>

                      {/* 4. Tên HH */}
                      <td
                        style={{
                          padding: '6px 10px',
                          borderRight: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                          fontSize: '0.78rem',
                        }}
                      >
                        {item.name}
                      </td>

                      {/* 5. Tổng lãi lỗ dự kiến (VND) */}
                      <td
                        style={{
                          padding: '6px 10px',
                          textAlign: 'right',
                          borderRight: '1px solid var(--border-color)',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          fontSize: '0.78rem',
                          color: item.expectedPnL < 0 ? '#ef4444' : item.expectedPnL > 0 ? '#10b981' : 'var(--text-muted)',
                          backgroundColor: (item.highlightExpectedLoss || (topLossItem && item.symbol === topLossItem.symbol))
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'transparent',
                        }}
                      >
                        {formatAccountingCurrency(item.expectedPnL)}
                      </td>

                      {/* 6. Tổng vị thế mở */}
                      <td
                        style={{
                          padding: '6px 8px',
                          textAlign: 'right',
                          borderRight: '1px solid var(--border-color)',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          fontFamily: 'monospace',
                          fontSize: '0.78rem',
                          backgroundColor: (item.highlightOpenPosition || (topOpenPositionItem && item.symbol === topOpenPositionItem.symbol))
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'transparent',
                        }}
                      >
                        {formatInteger(item.openPositions)}
                      </td>

                      {/* 7. % mở Mua (Progress bar xanh lá - Vị thế Mua/Long) */}
                      <td
                        style={{
                          padding: '5px 8px',
                          borderRight: '1px solid var(--border-color)',
                          verticalAlign: 'middle',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div
                            style={{
                              flex: 1,
                              height: '12px',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              borderRadius: '3px',
                              overflow: 'hidden',
                              position: 'relative',
                            }}
                          >
                            <div
                              style={{
                                width: `${item.longRatio}%`,
                                height: '100%',
                                backgroundColor: '#10b981',
                                borderRadius: '3px',
                                transition: 'width 0.4s ease',
                              }}
                            />
                          </div>
                          <span
                            style={{
                              width: '28px',
                              textAlign: 'right',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#10b981',
                            }}
                          >
                            {item.longRatio}%
                          </span>
                        </div>
                      </td>

                      {/* 8. % mở Bán (Progress bar đỏ - Vị thế Bán/Short) */}
                      <td
                        style={{
                          padding: '5px 8px',
                          borderRight: '1px solid var(--border-color)',
                          verticalAlign: 'middle',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div
                            style={{
                              flex: 1,
                              height: '12px',
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              borderRadius: '3px',
                              overflow: 'hidden',
                              position: 'relative',
                            }}
                          >
                            <div
                              style={{
                                width: `${item.shortRatio}%`,
                                height: '100%',
                                backgroundColor: '#ef4444',
                                borderRadius: '3px',
                                transition: 'width 0.4s ease',
                              }}
                            />
                          </div>
                          <span
                            style={{
                              width: '28px',
                              textAlign: 'right',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#ef4444',
                            }}
                          >
                            {item.shortRatio}%
                          </span>
                        </div>
                      </td>

                      {/* 9. Lãi lỗ thực tế (VND) */}
                      <td
                        style={{
                          padding: '6px 10px',
                          textAlign: 'right',
                          borderRight: '1px solid var(--border-color)',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          fontSize: '0.78rem',
                          color: item.realizedPnL < 0 ? '#ef4444' : item.realizedPnL > 0 ? '#10b981' : 'var(--text-muted)',
                          backgroundColor: item.realizedPnL < 0
                            ? 'rgba(239, 68, 68, 0.08)'
                            : item.realizedPnL > 0
                            ? 'rgba(16, 185, 129, 0.08)'
                            : 'transparent',
                        }}
                      >
                        {formatAccountingCurrency(item.realizedPnL)}
                      </td>

                      {/* 10. Trạng thái tất toán */}
                      <td
                        style={{
                          padding: '6px 8px',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          fontSize: '0.78rem',
                          color: 'var(--text-primary)',
                          backgroundColor: (item.highlightLiquidated || (topLiquidatedItem && item.symbol === topLiquidatedItem.symbol))
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'transparent',
                        }}
                      >
                        {formatInteger(item.liquidatedLots)}
                      </td>
                    </tr>
                  );
                });
              })
              )}
            </tbody>

            {/* Table Footer (Tổng cộng) */}
            <tfoot>
              <tr
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderTop: '2px solid var(--border-color)',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                }}
              >
                <td
                  colSpan={4}
                  style={{
                    padding: '8px 10px',
                    textAlign: 'center',
                    borderRight: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Tổng
                </td>

                {/* Tổng lãi lỗ dự kiến */}
                <td
                  style={{
                    padding: '8px 10px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border-color)',
                    color: footerTotals.expectedPnL < 0 ? '#ef4444' : footerTotals.expectedPnL > 0 ? '#10b981' : 'var(--text-primary)',
                    fontFamily: 'monospace',
                  }}
                >
                  {formatAccountingCurrency(footerTotals.expectedPnL)}
                </td>

                {/* Tổng vị thế mở */}
                <td
                  style={{
                    padding: '8px 8px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                  }}
                >
                  {formatInteger(footerTotals.openPositions)}
                </td>

                {/* Tỷ lệ Mua / Bán Toàn sàn */}
                <td
                  colSpan={2}
                  style={{
                    padding: '8px 8px',
                    textAlign: 'center',
                    borderRight: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.72rem',
                  }}
                >
                  Toàn sàn: <strong style={{ color: '#10b981' }}>{footerTotals.avgLongRatio}% Mua</strong> / <strong style={{ color: '#ef4444' }}>{footerTotals.avgShortRatio}% Bán</strong>
                </td>

                {/* Lãi lỗ thực tế */}
                <td
                  style={{
                    padding: '8px 10px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border-color)',
                    color: footerTotals.realizedPnL < 0 ? '#ef4444' : footerTotals.realizedPnL > 0 ? '#10b981' : 'var(--text-primary)',
                    fontFamily: 'monospace',
                  }}
                >
                  {formatAccountingCurrency(footerTotals.realizedPnL)}
                </td>

                {/* Trạng thái tất toán */}
                <td
                  style={{
                    padding: '8px 8px',
                    textAlign: 'right',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                  }}
                >
                  {formatInteger(footerTotals.liquidatedLots)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footnote Guide */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            padding: '6px 4px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.35)',
                border: '1px solid rgba(239, 68, 68, 0.6)',
                borderRadius: '3px',
              }}
            />
            <span>Đỏ đậm: Lỗ dự kiến lớn nhất {topLossItem ? `(${topLossItem.symbol}: ${formatAccountingCurrency(topLossItem.expectedPnL)})` : ''}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.35)',
                border: '1px solid rgba(16, 185, 129, 0.6)',
                borderRadius: '3px',
              }}
            />
            <span>Xanh lá: Vị thế mở & tất toán tập trung cao nhất {topOpenPositionItem ? `(${topOpenPositionItem.symbol}: ${formatInteger(topOpenPositionItem.openPositions)} lots${topLiquidatedItem && topLiquidatedItem.symbol !== topOpenPositionItem.symbol ? `; ${topLiquidatedItem.symbol}: ${formatInteger(topLiquidatedItem.liquidatedLots)} lots` : ''})` : ''}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info size={12} color="#38bdf8" />
            <span>Quy chuẩn số kế toán: Số âm đặt trong ngoặc đơn (xxx)</span>
          </div>
        </div>
      </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL SAO CHÉP TIN NHẮN BÁO CÁO BAN GIÁM SÁT & ROOM QLGD NỘI BỘ        */}
      {/* ========================================================================= */}
      {isBgsModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setIsBgsModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(2, 132, 199, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0284c7',
                  }}
                >
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    MẪU TIN NHẮN BÁO CÁO BAN GIÁM SÁT
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Tự động điền dữ liệu thực tế phiên {sessionDate}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBgsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '12px 20px 0',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                overflowX: 'auto',
              }}
            >
              {[
                { id: '16H', label: 'Báo cáo 16:00 (Hết Á)' },
                { id: '23H', label: 'Báo cáo 23:00 (Hết Âu)' },
                { id: 'EOD', label: 'Báo cáo Kết phiên' },
                { id: 'QLGD', label: 'Room QLGD Nội Bộ' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveBgsTab(tab.id as any)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.78rem',
                    fontWeight: activeBgsTab === tab.id ? 700 : 500,
                    border: 'none',
                    borderBottom: activeBgsTab === tab.id ? '2px solid #0284c7' : '2px solid transparent',
                    backgroundColor: 'transparent',
                    color: activeBgsTab === tab.id ? '#0284c7' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Content */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '16px',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '0.85rem',
                  lineHeight: '1.6',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  minHeight: '130px',
                  userSelect: 'all',
                }}
              >
                {getActiveMessageText()}
              </div>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Nội dung trên được định dạng chuẩn theo mẫu tin nhắn Zalo/Telegram của Ban Giám Sát và Room Vận hành.
              </p>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 20px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
              }}
            >
              <button
                type="button"
                onClick={() => setIsBgsModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  fontSize: '0.8rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleCopyBgsMessage}
                style={{
                  padding: '8px 18px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isCopied ? '#10b981' : '#0284c7',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
              >
                {isCopied ? <Check size={14} /> : <Copy size={14} />}
                <span>{isCopied ? 'Đã sao chép!' : 'Sao chép tin nhắn'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL TOÀN MÀN HÌNH: BẢNG TỔNG HỢP TOÀN BỘ 44 MẶT HÀNG PHÁI SINH (TABLE 3) */}
      {/* ========================================================================= */}
      {isAllCommoditiesModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
            backdropFilter: 'blur(5px)',
          }}
          onClick={() => setIsAllCommoditiesModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              width: '96vw',
              maxWidth: '1440px',
              height: '92vh',
              maxHeight: '92vh',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 22px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(2, 132, 199, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0284c7',
                  }}
                >
                  <Layers size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      BẢNG TỔNG HỢP TOÀN BỘ 44 MẶT HÀNG PHÁI SINH
                    </h3>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(2, 132, 199, 0.2)',
                        color: '#0284c7',
                        border: '1px solid rgba(2, 132, 199, 0.4)',
                      }}
                    >
                      Đầy đủ 44 mã
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Danh mục toàn bộ hợp đồng giao dịch • Dữ liệu phiên: <strong style={{ color: '#0284c7' }}>{sessionDate}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAllCommoditiesModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Toolbar: Search + Category Filter + KPI summary */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '12px 22px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              {/* Left: Search input + Category chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    minWidth: '260px',
                  }}
                >
                  <Search size={15} color="var(--text-muted)" />
                  <input
                    type="text"
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    placeholder="Tìm theo mã (ZCE, SI5CO...) hoặc tên..."
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      outline: 'none',
                      width: '100%',
                    }}
                  />
                  {modalSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setModalSearchTerm('')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {(['ALL', 'Nông sản', 'Nguyên liệu công nghiệp', 'Kim loại'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setModalCategory(cat)}
                      style={{
                        padding: '5px 12px',
                        fontSize: '0.75rem',
                        fontWeight: modalCategory === cat ? 700 : 500,
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: modalCategory === cat ? '#0284c7' : 'var(--border-color)',
                        backgroundColor: modalCategory === cat ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-input)',
                        color: modalCategory === cat ? '#0284c7' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {cat === 'ALL' ? `Tất cả (${modalFilteredItems.length})` : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Quick KPI badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Tổng vị thế mở: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{formatInteger(modalTotals.openPositions)} lots</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Lãi lỗ dự kiến: <strong style={{ color: modalTotals.expectedPnL < 0 ? '#ef4444' : modalTotals.expectedPnL > 0 ? '#10b981' : 'var(--text-primary)', fontFamily: 'monospace' }}>{formatAccountingCurrency(modalTotals.expectedPnL)} VND</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Lãi lỗ thực tế: <strong style={{ color: modalTotals.realizedPnL < 0 ? '#ef4444' : modalTotals.realizedPnL > 0 ? '#10b981' : 'var(--text-primary)', fontFamily: 'monospace' }}>{formatAccountingCurrency(modalTotals.realizedPnL)} VND</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Tất toán: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{formatInteger(modalTotals.liquidatedLots)} lots</strong>
                </div>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportExcel('ALL')}
                  style={{
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    cursor: isExporting ? 'not-allowed' : 'pointer',
                  }}
                  title="Xuất file Excel đầy đủ 44 mặt hàng chuẩn template 1:1"
                >
                  <FileSpreadsheet size={14} />
                  <span>{isExporting ? 'Đang xuất...' : 'Xuất Excel 44 Mã'}</span>
                </button>
              </div>
            </div>

            {/* Modal Table Container with internal scroll & sticky headers */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'auto',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                }}
              >
                <thead
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    backgroundColor: 'var(--bg-input)',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <tr
                    style={{
                      borderBottom: '2px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      textAlign: 'center',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                    }}
                  >
                    <th style={{ padding: '10px 8px', borderRight: '1px solid var(--border-color)', width: '45px' }}>STT</th>
                    <th style={{ padding: '10px 10px', borderRight: '1px solid var(--border-color)', width: '130px' }}>Nhóm HH</th>
                    <th style={{ padding: '10px 8px', borderRight: '1px solid var(--border-color)', width: '70px' }}>Mã HH</th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid var(--border-color)', textAlign: 'left', minWidth: '150px' }}>Tên HH</th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid var(--border-color)', textAlign: 'right', minWidth: '160px' }}>Tổng lãi lỗ dự kiến (VND)</th>
                    <th style={{ padding: '10px 10px', borderRight: '1px solid var(--border-color)', textAlign: 'right', width: '110px' }}>Tổng vị thế mở</th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid var(--border-color)', textAlign: 'center', width: '130px' }}>% mở Mua</th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid var(--border-color)', textAlign: 'center', width: '130px' }}>% mở Bán</th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid var(--border-color)', textAlign: 'right', minWidth: '140px' }}>Lãi lỗ thực tế (VND)</th>
                    <th style={{ padding: '10px 10px', textAlign: 'right', width: '120px' }}>Trạng thái tất toán</th>
                  </tr>
                </thead>
                <tbody>
                  {modalCategoryGroups.map(([catName, items]) => {
                    return items.map((item, idx) => {
                      const isFirstOfGroup = idx === 0;
                      const isLastOfGroup = idx === items.length - 1;
                      const isExpectedLoss = item.expectedPnL < 0;
                      const isRealizedLoss = item.realizedPnL < 0;

                      return (
                        <tr
                          key={item.symbol}
                          style={{
                            borderBottom: isLastOfGroup ? '2px solid var(--border-color)' : '1px solid var(--border-color)',
                            backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(148, 163, 184, 0.04)',
                            transition: 'background-color 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              idx % 2 === 0 ? 'transparent' : 'rgba(148, 163, 184, 0.04)';
                          }}
                        >
                          <td style={{ padding: '9px 8px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{item.stt}</span>
                          </td>
                          {isFirstOfGroup ? (
                            <td
                              rowSpan={items.length}
                              style={{
                                padding: '10px',
                                textAlign: 'center',
                                verticalAlign: 'middle',
                                fontWeight: 700,
                                borderRight: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-input)',
                                color:
                                  catName === 'Nông sản'
                                    ? '#10b981'
                                    : catName === 'Kim loại'
                                    ? '#0284c7'
                                    : '#d97706',
                                fontSize: '0.8rem',
                              }}
                            >
                              {catName}
                            </td>
                          ) : null}
                          <td
                            style={{
                              padding: '9px 8px',
                              textAlign: 'center',
                              fontWeight: 700,
                              borderRight: '1px solid var(--border-color)',
                              color: item.isTop17 ? '#0284c7' : 'var(--text-primary)',
                              fontFamily: 'monospace',
                            }}
                          >
                            {item.symbol}
                          </td>
                          <td
                            style={{
                              padding: '9px 12px',
                              borderRight: '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                              fontWeight: 500,
                            }}
                          >
                            {item.name}
                            {item.isTop17 && (
                              <span
                                style={{
                                  marginLeft: '6px',
                                  fontSize: '0.65rem',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(2, 132, 199, 0.12)',
                                  color: '#0284c7',
                                  fontWeight: 700,
                                }}
                              >
                                Chủ lực
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: '9px 12px',
                              textAlign: 'right',
                              borderRight: '1px solid var(--border-color)',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              color: item.expectedPnL < 0 ? '#ef4444' : item.expectedPnL > 0 ? '#10b981' : 'var(--text-muted)',
                              backgroundColor: (item.highlightExpectedLoss || (topLossItem && item.symbol === topLossItem.symbol))
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'transparent',
                            }}
                          >
                            {formatAccountingCurrency(item.expectedPnL)}
                          </td>
                          <td
                            style={{
                              padding: '9px 10px',
                              textAlign: 'right',
                              borderRight: '1px solid var(--border-color)',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              fontFamily: 'monospace',
                              backgroundColor: (item.highlightOpenPosition || (topOpenPositionItem && item.symbol === topOpenPositionItem.symbol))
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'transparent',
                            }}
                          >
                            {formatInteger(item.openPositions)}
                          </td>
                          <td
                            style={{
                              padding: '6px 10px',
                              borderRight: '1px solid var(--border-color)',
                              verticalAlign: 'middle',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  flex: 1,
                                  height: '16px',
                                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                  borderRadius: '4px',
                                  overflow: 'hidden',
                                  position: 'relative',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${item.longRatio}%`,
                                    height: '100%',
                                    backgroundColor: '#10b981',
                                    borderRadius: '4px',
                                    transition: 'width 0.4s ease',
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  width: '32px',
                                  textAlign: 'right',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: '#10b981',
                                }}
                              >
                                {item.longRatio}%
                              </span>
                            </div>
                          </td>
                          <td
                            style={{
                              padding: '6px 10px',
                              borderRight: '1px solid var(--border-color)',
                              verticalAlign: 'middle',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  flex: 1,
                                  height: '16px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                  borderRadius: '4px',
                                  overflow: 'hidden',
                                  position: 'relative',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${item.shortRatio}%`,
                                    height: '100%',
                                    backgroundColor: '#ef4444',
                                    borderRadius: '4px',
                                    transition: 'width 0.4s ease',
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  width: '32px',
                                  textAlign: 'right',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: '#ef4444',
                                }}
                              >
                                {item.shortRatio}%
                              </span>
                            </div>
                          </td>
                          <td
                            style={{
                              padding: '9px 12px',
                              textAlign: 'right',
                              borderRight: '1px solid var(--border-color)',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              color: item.realizedPnL < 0 ? '#ef4444' : item.realizedPnL > 0 ? '#10b981' : 'var(--text-muted)',
                              backgroundColor: item.realizedPnL < 0
                                ? 'rgba(239, 68, 68, 0.08)'
                                : item.realizedPnL > 0
                                ? 'rgba(16, 185, 129, 0.08)'
                                : 'transparent',
                            }}
                          >
                            {formatAccountingCurrency(item.realizedPnL)}
                          </td>
                          <td
                            style={{
                              padding: '9px 10px',
                              textAlign: 'right',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              color: 'var(--text-primary)',
                              backgroundColor: (item.highlightLiquidated || (topLiquidatedItem && item.symbol === topLiquidatedItem.symbol))
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'transparent',
                            }}
                          >
                            {formatInteger(item.liquidatedLots)}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
                <tfoot
                  style={{
                    position: 'sticky',
                    bottom: 0,
                    zIndex: 8,
                    backgroundColor: 'var(--bg-input)',
                    borderTop: '2px solid var(--border-color)',
                    boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <tr style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                    <td
                      colSpan={4}
                      style={{
                        padding: '12px 14px',
                        textAlign: 'center',
                        borderRight: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Tổng cộng ({modalFilteredItems.length} mặt hàng)
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'right',
                        borderRight: '1px solid var(--border-color)',
                        color: modalTotals.expectedPnL < 0 ? '#ef4444' : modalTotals.expectedPnL > 0 ? '#10b981' : 'var(--text-primary)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {formatAccountingCurrency(modalTotals.expectedPnL)}
                    </td>
                    <td
                      style={{
                        padding: '12px 10px',
                        textAlign: 'right',
                        borderRight: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {formatInteger(modalTotals.openPositions)}
                    </td>
                    <td colSpan={2} style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                      Toàn danh mục: <strong style={{ color: '#10b981' }}>{modalTotals.avgLongRatio}% Mua</strong> / <strong style={{ color: '#ef4444' }}>{modalTotals.avgShortRatio}% Bán</strong>
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'right',
                        borderRight: '1px solid var(--border-color)',
                        color: modalTotals.realizedPnL < 0 ? '#ef4444' : modalTotals.realizedPnL > 0 ? '#10b981' : 'var(--text-primary)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {formatAccountingCurrency(modalTotals.realizedPnL)}
                    </td>
                    <td
                      style={{
                        padding: '12px 10px',
                        textAlign: 'right',
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {formatInteger(modalTotals.liquidatedLots)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 22px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={13} color="#38bdf8" />
                  <span>Quy chuẩn kế toán: Số âm đặt trong ngoặc đơn (xxx)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: 'rgba(2, 132, 199, 0.3)', border: '1px solid #0284c7', borderRadius: '2px' }} />
                  <span>Nhãn 'Chủ lực': 17 mặt hàng trọng yếu theo dõi thường xuyên</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAllCommoditiesModalOpen(false)}
                style={{
                  padding: '8px 20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QlgdExecutiveDashboard;
