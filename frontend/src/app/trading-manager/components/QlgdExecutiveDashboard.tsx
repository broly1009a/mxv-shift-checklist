'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
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
 * DỮ LIỆU MOCK CHUẨN 100% THEO THIẾT KẾ CỦA USER (MỤC 8 DASHBOARD)
 */
const MOCK_ACM_SEGMENT: MarketSegmentData = {
  title: 'ACM',
  subTitle: 'Khối Tự Doanh & Tạo Lập Thị Trường',
  iconType: 'acm',
  latestKlgd: 150,
  latestGtgdStr: '1 tỷ',
  latestGtgdVnd: 1000000000,
  milestones: {
    earlySession: 123,
    asianSession: 456,
    europeanSession: 789,
    americanSession: 1111,
  },
  timelineLabels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00', '02:00', '05:00'],
  timelineVolumes: [35, 68, 92, 115, 150, 190, 240, 310, 456, 789, 1111],
  timelineValues: [0.2, 0.45, 0.6, 0.8, 1.0, 1.3, 1.6, 2.1, 3.2, 5.5, 7.8],
};

const MOCK_OTHERS_SEGMENT: MarketSegmentData = {
  title: 'Còn lại',
  subTitle: 'Khách Hàng Thành Viên & CQG Brokerage',
  iconType: 'others',
  latestKlgd: 1500,
  latestGtgdStr: '10 tỷ',
  latestGtgdVnd: 10000000000,
  milestones: {
    earlySession: 123,
    asianSession: 456,
    europeanSession: 789,
    americanSession: 1111,
  },
  timelineLabels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00', '02:00', '05:00'],
  timelineVolumes: [210, 480, 750, 1120, 1500, 2100, 2900, 3800, 4900, 6800, 8950],
  timelineValues: [1.8, 3.5, 5.2, 7.8, 10.0, 14.2, 19.5, 25.8, 33.4, 46.2, 62.5],
};

const MOCK_COMMODITY_ITEMS: CommodityPositionPnLItem[] = [
  // 1. Nhóm Nông sản (STT 1-6)
  {
    stt: 1,
    category: 'Nông sản',
    symbol: 'ZWA',
    name: 'Lúa mỳ',
    expectedPnL: -43532775000,
    openPositions: 1437,
    longRatio: 68,
    shortRatio: 32,
    realizedPnL: -260650000,
    liquidatedLots: 359,
  },
  {
    stt: 2,
    category: 'Nông sản',
    symbol: 'ZLE',
    name: 'Dầu đậu tương',
    expectedPnL: -10012548000,
    openPositions: 471,
    longRatio: 77,
    shortRatio: 23,
    realizedPnL: 738816000,
    liquidatedLots: 330,
  },
  {
    stt: 3,
    category: 'Nông sản',
    symbol: 'ZCE',
    name: 'Ngô',
    expectedPnL: -23257975000,
    openPositions: 1551,
    longRatio: 38,
    shortRatio: 62,
    realizedPnL: -317200000,
    liquidatedLots: 562,
  },
  {
    stt: 4,
    category: 'Nông sản',
    symbol: 'ZSE',
    name: 'Đậu tương',
    expectedPnL: -13013975000,
    openPositions: 515,
    longRatio: 55,
    shortRatio: 45,
    realizedPnL: 288275000,
    liquidatedLots: 271,
  },
  {
    stt: 5,
    category: 'Nông sản',
    symbol: 'ZME',
    name: 'Khô đậu tương',
    expectedPnL: -11014120000,
    openPositions: 519,
    longRatio: 40,
    shortRatio: 60,
    realizedPnL: 1005420000,
    liquidatedLots: 1312,
    highlightLiquidated: true,
  },
  {
    stt: 6,
    category: 'Nông sản',
    symbol: 'KWE',
    name: 'Lúa mỳ Kansas',
    expectedPnL: -2670850000,
    openPositions: 106,
    longRatio: 99,
    shortRatio: 1,
    realizedPnL: 11050000,
    liquidatedLots: 3,
  },

  // 2. Nhóm Nguyên liệu công nghiệp (STT 7-10)
  {
    stt: 7,
    category: 'Nguyên liệu công nghiệp',
    symbol: 'KCE',
    name: 'Cà phê Arabica',
    expectedPnL: -9576450000,
    openPositions: 129,
    longRatio: 92,
    shortRatio: 8,
    realizedPnL: -501637500,
    liquidatedLots: 15,
  },
  {
    stt: 8,
    category: 'Nguyên liệu công nghiệp',
    symbol: 'SBE',
    name: 'Đường',
    expectedPnL: -8253481600,
    openPositions: 617,
    longRatio: 43,
    shortRatio: 57,
    realizedPnL: -24460800,
    liquidatedLots: 157,
  },
  {
    stt: 9,
    category: 'Nguyên liệu công nghiệp',
    symbol: 'LRC',
    name: 'Cà phê Robusta',
    expectedPnL: -24372140000,
    openPositions: 552,
    longRatio: 94,
    shortRatio: 6,
    realizedPnL: 501540000,
    liquidatedLots: 173,
  },
  {
    stt: 10,
    category: 'Nguyên liệu công nghiệp',
    symbol: 'CTE',
    name: 'Bông',
    expectedPnL: -2516020000,
    openPositions: 73,
    longRatio: 88,
    shortRatio: 12,
    realizedPnL: -127010000,
    liquidatedLots: 17,
  },

  // 3. Nhóm Kim loại (STT 11-17)
  {
    stt: 11,
    category: 'Kim loại',
    symbol: 'SIE',
    name: 'Bạc',
    expectedPnL: -13521300000,
    openPositions: 28,
    longRatio: 100,
    shortRatio: 0,
    realizedPnL: 819650000,
    liquidatedLots: 7,
  },
  {
    stt: 12,
    category: 'Kim loại',
    symbol: 'SIL',
    name: 'Bạc Micro',
    expectedPnL: -25752090000,
    openPositions: 273,
    longRatio: 96,
    shortRatio: 4,
    realizedPnL: -15730000,
    liquidatedLots: 249,
  },
  {
    stt: 13,
    category: 'Kim loại',
    symbol: 'CPE',
    name: 'Đồng',
    expectedPnL: -651950000,
    openPositions: 14,
    longRatio: 93,
    shortRatio: 7,
    realizedPnL: -26650000,
    liquidatedLots: 45,
  },
  {
    stt: 14,
    category: 'Kim loại',
    symbol: 'MHG',
    name: 'Đồng Micro',
    expectedPnL: -1198340000,
    openPositions: 178,
    longRatio: 78,
    shortRatio: 22,
    realizedPnL: 198997500,
    liquidatedLots: 207,
  },
  {
    stt: 15,
    category: 'Kim loại',
    symbol: 'PLE',
    name: 'Bạch kim',
    expectedPnL: -6101550000,
    openPositions: 65,
    longRatio: 97,
    shortRatio: 3,
    realizedPnL: 242970000,
    liquidatedLots: 25,
  },
  {
    stt: 16,
    category: 'Kim loại',
    symbol: 'SI5CO',
    name: 'Bạc Nano',
    expectedPnL: -67620215000,
    openPositions: 5770,
    longRatio: 95,
    shortRatio: 5,
    realizedPnL: -1248533000,
    liquidatedLots: 1111,
    highlightExpectedLoss: true,
    highlightOpenPosition: true,
    highlightLiquidated: true,
  },
  {
    stt: 17,
    category: 'Kim loại',
    symbol: 'PL1NY',
    name: 'Bạch kim Nano',
    expectedPnL: -9275604000,
    openPositions: 685,
    longRatio: 83,
    shortRatio: 17,
    realizedPnL: -105339000,
    liquidatedLots: 71,
    isTop17: true,
  },
  {
    stt: 18,
    category: 'Kim loại',
    symbol: 'CP2CO',
    name: 'Đồng Nano',
    expectedPnL: 452000000,
    openPositions: 181,
    longRatio: 64,
    shortRatio: 36,
    realizedPnL: 12500000,
    liquidatedLots: 42,
    isTop17: false,
  },
  {
    stt: 19,
    category: 'Nông sản',
    symbol: 'XW',
    name: 'Lúa Mỳ Mini',
    expectedPnL: -156000000,
    openPositions: 92,
    longRatio: 48,
    shortRatio: 52,
    realizedPnL: -8200000,
    liquidatedLots: 15,
    isTop17: false,
  },
  {
    stt: 20,
    category: 'Nông sản',
    symbol: 'XC',
    name: 'Ngô Mini',
    expectedPnL: -320000000,
    openPositions: 145,
    longRatio: 40,
    shortRatio: 60,
    realizedPnL: 18500000,
    liquidatedLots: 38,
    isTop17: false,
  },
  {
    stt: 21,
    category: 'Nông sản',
    symbol: 'XB',
    name: 'Đậu Tương Mini',
    expectedPnL: 180000000,
    openPositions: 74,
    longRatio: 72,
    shortRatio: 28,
    realizedPnL: 9400000,
    liquidatedLots: 20,
    isTop17: false,
  },
  {
    stt: 22,
    category: 'Nguyên liệu công nghiệp',
    symbol: 'FEF',
    name: 'Quặng sắt',
    expectedPnL: -890000000,
    openPositions: 210,
    longRatio: 50,
    shortRatio: 50,
    realizedPnL: -45000000,
    liquidatedLots: 60,
    isTop17: false,
  },
  {
    stt: 23,
    category: 'Nông sản',
    symbol: 'MZM',
    name: 'Khô Đậu tương Micro',
    expectedPnL: -42000000,
    openPositions: 55,
    longRatio: 58,
    shortRatio: 42,
    realizedPnL: 4100000,
    liquidatedLots: 12,
    isTop17: false,
  },
  {
    stt: 24,
    category: 'Nông sản',
    symbol: 'MZC',
    name: 'Ngô Micro',
    expectedPnL: -78000000,
    openPositions: 68,
    longRatio: 35,
    shortRatio: 65,
    realizedPnL: -2500000,
    liquidatedLots: 18,
    isTop17: false,
  },
  {
    stt: 25,
    category: 'Nguyên liệu công nghiệp',
    symbol: 'CCE',
    name: 'Ca cao',
    expectedPnL: 650000000,
    openPositions: 85,
    longRatio: 80,
    shortRatio: 20,
    realizedPnL: 75000000,
    liquidatedLots: 24,
    isTop17: false,
  },
  {
    stt: 26,
    category: 'Nông sản',
    symbol: 'ZFT',
    name: 'Cao su TSR20',
    expectedPnL: -110000000,
    openPositions: 40,
    longRatio: 60,
    shortRatio: 40,
    realizedPnL: 5200000,
    liquidatedLots: 8,
    isTop17: false,
  },
  {
    stt: 27,
    category: 'Nông sản',
    symbol: 'MZL',
    name: 'Dầu đậu tương Micro',
    expectedPnL: 85000000,
    openPositions: 62,
    longRatio: 65,
    shortRatio: 35,
    realizedPnL: 6400000,
    liquidatedLots: 14,
    isTop17: false,
  },
  {
    stt: 28,
    category: 'Nông sản',
    symbol: 'MZW',
    name: 'Lúa Mỳ Micro',
    expectedPnL: -64000000,
    openPositions: 48,
    longRatio: 52,
    shortRatio: 48,
    realizedPnL: -3100000,
    liquidatedLots: 10,
    isTop17: false,
  },
  {
    stt: 29,
    category: 'Kim loại',
    symbol: 'ALI',
    name: 'Nhôm',
    expectedPnL: 340000000,
    openPositions: 115,
    longRatio: 70,
    shortRatio: 30,
    realizedPnL: 28000000,
    liquidatedLots: 35,
    isTop17: false,
  },
  {
    stt: 30,
    category: 'Nông sản',
    symbol: 'MZS',
    name: 'Đậu tương Micro',
    expectedPnL: -52000000,
    openPositions: 50,
    longRatio: 45,
    shortRatio: 55,
    realizedPnL: 1800000,
    liquidatedLots: 11,
    isTop17: false,
  },
  {
    stt: 31,
    category: 'Nông sản',
    symbol: 'MPO',
    name: 'Dầu cọ thô',
    expectedPnL: 210000000,
    openPositions: 78,
    longRatio: 62,
    shortRatio: 38,
    realizedPnL: 14000000,
    liquidatedLots: 19,
    isTop17: false,
  },
  {
    stt: 32,
    category: 'Kim loại',
    symbol: 'AHD',
    name: 'Nhôm LME',
    expectedPnL: -280000000,
    openPositions: 95,
    longRatio: 40,
    shortRatio: 60,
    realizedPnL: -19000000,
    liquidatedLots: 22,
    isTop17: false,
  },
  {
    stt: 33,
    category: 'Kim loại',
    symbol: 'MQC',
    name: 'Đồng mini',
    expectedPnL: 195000000,
    openPositions: 88,
    longRatio: 68,
    shortRatio: 32,
    realizedPnL: 16500000,
    liquidatedLots: 25,
    isTop17: false,
  },
  {
    stt: 34,
    category: 'Nông sản',
    symbol: 'TRU',
    name: 'Cao su RSS3 TOCOM',
    expectedPnL: -95000000,
    openPositions: 35,
    longRatio: 55,
    shortRatio: 45,
    realizedPnL: 3200000,
    liquidatedLots: 7,
    isTop17: false,
  },
  {
    stt: 35,
    category: 'Kim loại',
    symbol: 'MQI',
    name: 'Bạc mini',
    expectedPnL: 420000000,
    openPositions: 130,
    longRatio: 75,
    shortRatio: 25,
    realizedPnL: 38000000,
    liquidatedLots: 30,
    isTop17: false,
  },
  {
    stt: 36,
    category: 'Kim loại',
    symbol: 'SND',
    name: 'Thiếc LME',
    expectedPnL: -180000000,
    openPositions: 45,
    longRatio: 50,
    shortRatio: 50,
    realizedPnL: -8500000,
    liquidatedLots: 9,
    isTop17: false,
  },
  {
    stt: 37,
    category: 'Nguyên liệu công nghiệp',
    symbol: 'QW',
    name: 'Đường trắng',
    expectedPnL: 260000000,
    openPositions: 72,
    longRatio: 65,
    shortRatio: 35,
    realizedPnL: 21000000,
    liquidatedLots: 16,
    isTop17: false,
  },
  {
    stt: 38,
    category: 'Kim loại',
    symbol: 'ZDS',
    name: 'Kẽm LME',
    expectedPnL: -210000000,
    openPositions: 65,
    longRatio: 42,
    shortRatio: 58,
    realizedPnL: -12000000,
    liquidatedLots: 14,
    isTop17: false,
  },
  {
    stt: 39,
    category: 'Kim loại',
    symbol: 'CAD',
    name: 'Đồng LME',
    expectedPnL: 310000000,
    openPositions: 80,
    longRatio: 70,
    shortRatio: 30,
    realizedPnL: 25000000,
    liquidatedLots: 20,
    isTop17: false,
  },
  {
    stt: 40,
    category: 'Kim loại',
    symbol: 'SSR',
    name: 'Thép thanh vằn FOB Thổ Nhĩ Kỳ',
    expectedPnL: -140000000,
    openPositions: 52,
    longRatio: 45,
    shortRatio: 55,
    realizedPnL: -9000000,
    liquidatedLots: 12,
    isTop17: false,
  },
  {
    stt: 41,
    category: 'Kim loại',
    symbol: 'SSC',
    name: 'Thép phế liệu CFR Thổ Nhĩ Kỳ',
    expectedPnL: -98000000,
    openPositions: 44,
    longRatio: 48,
    shortRatio: 52,
    realizedPnL: -6200000,
    liquidatedLots: 10,
    isTop17: false,
  },
  {
    stt: 42,
    category: 'Kim loại',
    symbol: 'LHC',
    name: 'Thép cuộn cán nóng FOB Trung Quốc',
    expectedPnL: 175000000,
    openPositions: 60,
    longRatio: 60,
    shortRatio: 40,
    realizedPnL: 14500000,
    liquidatedLots: 15,
    isTop17: false,
  },
  {
    stt: 43,
    category: 'Kim loại',
    symbol: 'NID',
    name: 'Niken LME',
    expectedPnL: -350000000,
    openPositions: 58,
    longRatio: 38,
    shortRatio: 62,
    realizedPnL: -28000000,
    liquidatedLots: 13,
    isTop17: false,
  },
  {
    stt: 44,
    category: 'Kim loại',
    symbol: 'PBD',
    name: 'Chì LME',
    expectedPnL: 85000000,
    openPositions: 38,
    longRatio: 68,
    shortRatio: 32,
    realizedPnL: 7800000,
    liquidatedLots: 8,
    isTop17: false,
  },
];

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

export interface QlgdExecutiveDashboardProps {
  initialDate?: string;
  onRefresh?: () => void;
}

export const QlgdExecutiveDashboard: React.FC<QlgdExecutiveDashboardProps> = ({
  initialDate = '2026-10-08',
  onRefresh,
}) => {
  const { token } = useAuth();
  const [sessionDate, setSessionDate] = useState<string>(initialDate);
  const [dataMode, setDataMode] = useState<'MOCK' | 'LIVE'>('MOCK');
  const [selectedScope, setSelectedScope] = useState<'ALL' | 'ACM' | 'OTHERS'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'Nông sản' | 'Nguyên liệu công nghiệp' | 'Kim loại'>('ALL');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [liveData, setLiveData] = useState<any | null>(null);
  const [loadingLive, setLoadingLive] = useState<boolean>(false);
  const [isSyncingApi, setIsSyncingApi] = useState<boolean>(false);
  const [isBgsModalOpen, setIsBgsModalOpen] = useState<boolean>(false);
  const [activeBgsTab, setActiveBgsTab] = useState<'16H' | '23H' | 'EOD' | 'QLGD'>('16H');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isAllCommoditiesModalOpen, setIsAllCommoditiesModalOpen] = useState<boolean>(false);
  const [modalSearchTerm, setModalSearchTerm] = useState<string>('');
  const [modalCategory, setModalCategory] = useState<string>('ALL');

  // Tải dữ liệu thực tế từ Backend API
  const fetchLiveDashboard = useCallback(
    async (date: string, scope: 'ALL' | 'ACM' | 'OTHERS', refresh = false) => {
      setLoadingLive(true);
      try {
        const data = await tradingOpsApi.getExecutiveDashboard({ date, scope, refresh }, token);
        if (data && (data.hasActualFiles || data.dataSource === 'DIRECT_API')) {
          setLiveData(data);
          toast.success(`Đã tải dữ liệu Live phiên ${date}!`);
        } else {
          setLiveData(null);
          toast.success('Chưa có file backup M-System phiên này. Hiển thị dữ liệu đối chiếu!');
        }
      } catch (e: any) {
        toast.error(`Lỗi tải dữ liệu Live: ${e.message}`);
      } finally {
        setLoadingLive(false);
      }
    },
    [token],
  );

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
    // Fallback mock text
    if (activeBgsTab === '16H') {
      return `Em xin phép báo cáo các anh khối lượng giao dịch tính tới 16:00 phiên ${sessionDate} ạ. Tổng khối lượng giao dịch đạt 1,956 lot, với Futures là 1,500 lot và ACM là 456 lot.\nTới thời điểm này có 88 tài khoản phát sinh giao dịch ạ.`;
    }
    if (activeBgsTab === '23H') {
      return `Em xin phép báo cáo các anh khối lượng giao dịch tính tới 23:00 phiên ${sessionDate} ạ. Tổng khối lượng giao dịch đạt 3,689 lot, với Futures là 2,900 lot và ACM là 789 lot.\nTới thời điểm này có 142 tài khoản phát sinh giao dịch ạ.`;
    }
    if (activeBgsTab === 'EOD') {
      return `Em xin phép báo cáo các anh khối lượng giao dịch phiên ${sessionDate} ạ. Tổng khối lượng giao dịch đạt 10,061 lot, với Futures là 8,950 lot và ACM là 1,111 lot.\nTrong phiên có 215 tài khoản phát sinh giao dịch ạ.`;
    }
    return `Phiên ${sessionDate.slice(5)}:\nCQG: 8,950 lot - 120 lot Bạch kim - 310 lot Bạc - 240 lot Đồng - 190 lot LRC - 45 lot Spreads - 60 lot LME - 85 lot Options\nACM: 1,111 lot - 620 lot Bạc Nano - 310 lot Bạch kim Nano - 181 lot Đồng Nano`;
  };

  const handleCopyBgsMessage = () => {
    const text = getActiveMessageText();
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success('Đã sao chép tin nhắn vào bộ nhớ tạm!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  useEffect(() => {
    if (dataMode === 'LIVE') {
      fetchLiveDashboard(sessionDate, selectedScope);
    }
  }, [dataMode, sessionDate, selectedScope, fetchLiveDashboard]);

  // Nguồn dữ liệu hiển thị (hỗ trợ lọc 17 chủ lực vs 44 toàn bộ)
  const rawDisplayItems = useMemo(() => {
    if (dataMode === 'LIVE' && liveData && liveData.items && liveData.items.length > 0) {
      return liveData.items as CommodityPositionPnLItem[];
    }
    return MOCK_COMMODITY_ITEMS;
  }, [dataMode, liveData]);

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
    return displayItems.reduce(
      (acc, item) => {
        acc.expectedPnL += item.expectedPnL;
        acc.openPositions += item.openPositions;
        acc.realizedPnL += item.realizedPnL;
        acc.liquidatedLots += item.liquidatedLots;
        return acc;
      },
      { expectedPnL: 0, openPositions: 0, realizedPnL: 0, liquidatedLots: 0 }
    );
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
    return modalFilteredItems.reduce(
      (acc, item) => {
        acc.expectedPnL += item.expectedPnL;
        acc.openPositions += item.openPositions;
        acc.realizedPnL += item.realizedPnL;
        acc.liquidatedLots += item.liquidatedLots;
        return acc;
      },
      { expectedPnL: 0, openPositions: 0, realizedPnL: 0, liquidatedLots: 0 }
    );
  }, [modalFilteredItems]);

  // Dữ liệu 4 mốc thời điểm động (ưu tiên liveData nếu ở chế độ LIVE)
  const acmMilestones: MilestoneReportData = useMemo(() => {
    if (dataMode === 'LIVE' && liveData?.milestones?.acm) {
      return liveData.milestones.acm;
    }
    return MOCK_ACM_SEGMENT.milestones;
  }, [dataMode, liveData]);

  const othersMilestones: MilestoneReportData = useMemo(() => {
    if (dataMode === 'LIVE' && liveData?.milestones?.others) {
      return liveData.milestones.others;
    }
    return MOCK_OTHERS_SEGMENT.milestones;
  }, [dataMode, liveData]);

  // Số liệu KLGD & GTGD lần check gần nhất
  const acmLatestMetrics = useMemo(() => {
    if (dataMode === 'LIVE' && liveData?.latestMetrics?.acm) {
      return liveData.latestMetrics.acm;
    }
    return {
      klgd: MOCK_ACM_SEGMENT.latestKlgd,
      gtgdStr: MOCK_ACM_SEGMENT.latestGtgdStr,
      gtgdVnd: MOCK_ACM_SEGMENT.latestGtgdVnd,
    };
  }, [dataMode, liveData]);

  const othersLatestMetrics = useMemo(() => {
    if (dataMode === 'LIVE' && liveData?.latestMetrics?.others) {
      return liveData.latestMetrics.others;
    }
    return {
      klgd: MOCK_OTHERS_SEGMENT.latestKlgd,
      gtgdStr: MOCK_OTHERS_SEGMENT.latestGtgdStr,
      gtgdVnd: MOCK_OTHERS_SEGMENT.latestGtgdVnd,
    };
  }, [dataMode, liveData]);

  // Cấu hình Biểu đồ Check Timeline cho Khối ACM
  const acmChartData = useMemo(() => {
    return {
      labels: MOCK_ACM_SEGMENT.timelineLabels,
      datasets: [
        {
          label: 'KLGD Tích lũy (Lots)',
          data: MOCK_ACM_SEGMENT.timelineVolumes,
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
          data: MOCK_ACM_SEGMENT.timelineValues,
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
  }, []);

  // Cấu hình Biểu đồ Check Timeline cho Khối Còn lại
  const othersChartData = useMemo(() => {
    return {
      labels: MOCK_OTHERS_SEGMENT.timelineLabels,
      datasets: [
        {
          label: 'KLGD Tích lũy (Lots)',
          data: MOCK_OTHERS_SEGMENT.timelineVolumes,
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
          data: MOCK_OTHERS_SEGMENT.timelineValues,
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
  }, []);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & METRIC ACTIONS BAR */}
      {/* ========================================================================= */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          backdropFilter: 'blur(12px)',
        }}
      >
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
                DASHBOARD TỔNG HỢP VẬN HÀNH & BÁO CÁO BAN GIÁM ĐỐC
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: dataMode === 'MOCK' ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                  color: dataMode === 'MOCK' ? '#fbbf24' : '#34d399',
                  border: dataMode === 'MOCK' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                {dataMode === 'MOCK' ? 'MOCK DATA DEMO' : 'LIVE DATA'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Phân tách khối Tự doanh (ACM) vs Thị trường (Còn lại) | Giám sát 4 mốc thời điểm & Ma trận Lãi lỗ mặt hàng
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Date Picker */}
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

          {/* Mode Switcher */}
          <div
            style={{
              display: 'flex',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
              backgroundColor: 'var(--bg-input)',
            }}
          >
            <button
              type="button"
              onClick={() => setDataMode('MOCK')}
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: dataMode === 'MOCK' ? '#3b82f6' : 'transparent',
                color: dataMode === 'MOCK' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
            >
              Mock Chuẩn BGĐ
            </button>
            <button
              type="button"
              onClick={() => {
                setDataMode('LIVE');
                toast.success('Đang kết nối API nguồn dữ liệu thời gian thực...');
              }}
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: dataMode === 'LIVE' ? '#10b981' : 'transparent',
                color: dataMode === 'LIVE' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
            >
              Dữ liệu Live
            </button>
          </div>

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
            onClick={() => {
              if (onRefresh) onRefresh();
              toast.success('Đã làm mới dữ liệu Dashboard!');
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
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
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
            title="Xuất file Excel báo cáo Ban Giám Đốc chuẩn template 1:1"
          >
            <FileSpreadsheet size={15} />
            <span>{isExporting ? 'Đang xuất Excel...' : 'Xuất File Excel'}</span>
          </button>
        </div>
      </div>

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
                  {MOCK_ACM_SEGMENT.title}
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{MOCK_ACM_SEGMENT.subTitle}</span>
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
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Chu kỳ quét: 15-30 phút/lần</span>
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
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Đầu phiên</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px' }}>5h-8h</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formatInteger(acmMilestones.earlySession)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hết phiên Á</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px' }}>5h-16h</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284c7' }}>
                  {formatInteger(acmMilestones.asianSession)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hết phiên Âu</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px' }}>5h-23h</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#d97706' }}>
                  {formatInteger(acmMilestones.europeanSession)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>Hết phiên Mỹ</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {acmMilestones.isAmericanSessionPending ? 'Chưa qua 23h' : 'Cả ngày'}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981' }}>
                  {acmMilestones.isAmericanSessionPending
                    ? (acmMilestones.americanSession !== null ? `${formatInteger(acmMilestones.americanSession)}*` : '—')
                    : (acmMilestones.americanSession !== null ? formatInteger(acmMilestones.americanSession) : '—')}
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
                  {MOCK_OTHERS_SEGMENT.title}
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{MOCK_OTHERS_SEGMENT.subTitle}</span>
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
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Chu kỳ quét: 15-30 phút/lần</span>
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
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Đầu phiên</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px' }}>5h-8h</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formatInteger(othersMilestones.earlySession)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hết phiên Á</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px' }}>5h-16h</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284c7' }}>
                  {formatInteger(othersMilestones.asianSession)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hết phiên Âu</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px' }}>5h-23h</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#d97706' }}>
                  {formatInteger(othersMilestones.europeanSession)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700 }}>Hết phiên Mỹ</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {othersMilestones.isAmericanSessionPending ? 'Chưa qua 23h' : 'Cả ngày'}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#2563eb' }}>
                  {othersMilestones.isAmericanSessionPending
                    ? (othersMilestones.americanSession !== null ? `${formatInteger(othersMilestones.americanSession)}*` : '—')
                    : (othersMilestones.americanSession !== null ? formatInteger(othersMilestones.americanSession) : '—')}
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
              BẢNG THỐNG KÊ 17 MẶT HÀNG CHỦ LỰC (BAN GIÁM ĐỐC)
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Dữ liệu phiên chốt: <strong style={{ color: '#0284c7' }}>{sessionDate}</strong> | Tự động bóc tách từ TTM & TTTT (Check BGS All.xlsm)
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

        {/* The Master Data Table */}
        <div
          style={{
            maxHeight: '680px',
            overflowY: 'auto',
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
              fontSize: '0.82rem',
              color: 'var(--text-primary)',
            }}
          >
            {/* Table Header with Sticky */}
            <thead
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: 'var(--bg-input)',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
              }}
            >
              <tr
                style={{
                  backgroundColor: 'var(--bg-input)',
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
                <th style={{ padding: '10px 12px', borderRight: '1px solid var(--border-color)', textAlign: 'left', minWidth: '140px' }}>
                  Tên HH
                </th>
                <th style={{ padding: '10px 12px', borderRight: '1px solid var(--border-color)', textAlign: 'right', minWidth: '160px' }}>
                  Tổng lãi lỗ dự kiến (VND)
                </th>
                <th style={{ padding: '10px 10px', borderRight: '1px solid var(--border-color)', textAlign: 'right', width: '110px' }}>
                  Tổng vị thế mở
                </th>
                <th style={{ padding: '10px 12px', borderRight: '1px solid var(--border-color)', textAlign: 'center', width: '130px' }}>
                  % mở Mua
                </th>
                <th style={{ padding: '10px 12px', borderRight: '1px solid var(--border-color)', textAlign: 'center', width: '130px' }}>
                  % mở Bán
                </th>
                <th style={{ padding: '10px 12px', borderRight: '1px solid var(--border-color)', textAlign: 'right', minWidth: '140px' }}>
                  Lãi lỗ thực tế (VND)
                </th>
                <th style={{ padding: '10px 10px', textAlign: 'right', width: '120px' }}>Trạng thái tất toán</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {categoryGroups.map(([catName, items]) => {
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
                      <td style={{ padding: '9px 8px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{item.stt}</span>
                      </td>

                      {/* 2. Nhóm HH (Gộp ô) */}
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

                      {/* 3. Mã HH */}
                      <td
                        style={{
                          padding: '9px 8px',
                          textAlign: 'center',
                          fontWeight: 700,
                          borderRight: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {item.symbol}
                      </td>

                      {/* 4. Tên HH */}
                      <td
                        style={{
                          padding: '9px 12px',
                          borderRight: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                        }}
                      >
                        {item.name}
                      </td>

                      {/* 5. Tổng lãi lỗ dự kiến (VND) */}
                      <td
                        style={{
                          padding: '9px 12px',
                          textAlign: 'right',
                          borderRight: '1px solid var(--border-color)',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: isExpectedLoss ? '#ef4444' : '#10b981',
                          backgroundColor: item.highlightExpectedLoss
                            ? 'rgba(239, 68, 68, 0.12)'
                            : 'transparent',
                        }}
                      >
                        {formatAccountingCurrency(item.expectedPnL)}
                      </td>

                      {/* 6. Tổng vị thế mở */}
                      <td
                        style={{
                          padding: '9px 10px',
                          textAlign: 'right',
                          borderRight: '1px solid var(--border-color)',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          fontFamily: 'monospace',
                          backgroundColor: item.highlightOpenPosition
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'transparent',
                        }}
                      >
                        {formatInteger(item.openPositions)}
                      </td>

                      {/* 7. % mở Mua (Progress bar xanh) */}
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
                              backgroundColor: 'rgba(148, 163, 184, 0.18)',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              position: 'relative',
                            }}
                          >
                            <div
                              style={{
                                width: `${item.longRatio}%`,
                                height: '100%',
                                backgroundColor: '#3b82f6',
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
                              color: '#2563eb',
                            }}
                          >
                            {item.longRatio}%
                          </span>
                        </div>
                      </td>

                      {/* 8. % mở Bán (Progress bar xám) */}
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
                              backgroundColor: 'rgba(148, 163, 184, 0.18)',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              position: 'relative',
                            }}
                          >
                            <div
                              style={{
                                width: `${item.shortRatio}%`,
                                height: '100%',
                                backgroundColor: '#94a3b8',
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
                              fontWeight: 600,
                              color: 'var(--text-muted)',
                            }}
                          >
                            {item.shortRatio}%
                          </span>
                        </div>
                      </td>

                      {/* 9. Lãi lỗ thực tế (VND) */}
                      <td
                        style={{
                          padding: '9px 12px',
                          textAlign: 'right',
                          borderRight: '1px solid var(--border-color)',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: isRealizedLoss ? '#ef4444' : '#10b981',
                          backgroundColor: isRealizedLoss
                            ? 'rgba(239, 68, 68, 0.08)'
                            : 'rgba(16, 185, 129, 0.08)',
                        }}
                      >
                        {formatAccountingCurrency(item.realizedPnL)}
                      </td>

                      {/* 10. Trạng thái tất toán */}
                      <td
                        style={{
                          padding: '9px 10px',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: 'var(--text-primary)',
                          backgroundColor: item.highlightLiquidated
                            ? 'rgba(16, 185, 129, 0.12)'
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

            {/* Table Footer (Tổng cộng) with Sticky */}
            <tfoot
              style={{
                position: 'sticky',
                bottom: 0,
                zIndex: 8,
                backgroundColor: 'var(--bg-input)',
                boxShadow: '0 -1px 2px rgba(0, 0, 0, 0.08)',
              }}
            >
              <tr
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderTop: '2px solid var(--border-color)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                }}
              >
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
                  Tổng
                </td>

                {/* Tổng lãi lỗ dự kiến */}
                <td
                  style={{
                    padding: '12px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border-color)',
                    color: '#ef4444',
                    fontFamily: 'monospace',
                  }}
                >
                  {formatAccountingCurrency(footerTotals.expectedPnL)}
                </td>

                {/* Tổng vị thế mở */}
                <td
                  style={{
                    padding: '12px 10px',
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
                    padding: '12px 10px',
                    textAlign: 'center',
                    borderRight: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                  }}
                >
                  Toàn sàn: <strong style={{ color: '#2563eb' }}>78% Mua</strong> / <strong style={{ color: 'var(--text-muted)' }}>22% Bán</strong>
                </td>

                {/* Lãi lỗ thực tế */}
                <td
                  style={{
                    padding: '12px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border-color)',
                    color: '#10b981',
                    fontFamily: 'monospace',
                  }}
                >
                  {formatAccountingCurrency(footerTotals.realizedPnL)}
                </td>

                {/* Trạng thái tất toán */}
                <td
                  style={{
                    padding: '12px 10px',
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
            <span>Đỏ đậm: Lỗ dự kiến lớn nhất (SI5CO: (67.6 tỷ))</span>
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
            <span>Xanh lá: Vị thế mở & tất toán tập trung cao nhất (SI5CO: 5,770 lots; ZME: 1,312 lots)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info size={12} color="#38bdf8" />
            <span>Quy chuẩn số kế toán: Số âm đặt trong ngoặc đơn (xxx)</span>
          </div>
        </div>
      </div>

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
                      BẢNG TỔNG HỢP TOÀN BỘ 44 MẶT HÀNG PHÁI SINH (TABLE 3)
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
                    Bóc tách 100% từ Table 3 (Check BGS All.xlsm) | Dữ liệu phiên chốt: <strong style={{ color: '#0284c7' }}>{sessionDate}</strong>
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
                  Lãi lỗ dự kiến: <strong style={{ color: modalTotals.expectedPnL < 0 ? '#ef4444' : '#10b981', fontFamily: 'monospace' }}>{formatAccountingCurrency(modalTotals.expectedPnL)} VND</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Lãi lỗ thực tế: <strong style={{ color: modalTotals.realizedPnL < 0 ? '#ef4444' : '#10b981', fontFamily: 'monospace' }}>{formatAccountingCurrency(modalTotals.realizedPnL)} VND</strong>
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
                              color: isExpectedLoss ? '#ef4444' : '#10b981',
                              backgroundColor: item.highlightExpectedLoss
                                ? 'rgba(239, 68, 68, 0.12)'
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
                              backgroundColor: item.highlightOpenPosition
                                ? 'rgba(16, 185, 129, 0.12)'
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
                                  backgroundColor: 'rgba(148, 163, 184, 0.18)',
                                  borderRadius: '4px',
                                  overflow: 'hidden',
                                  position: 'relative',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${item.longRatio}%`,
                                    height: '100%',
                                    backgroundColor: '#3b82f6',
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
                                  color: '#2563eb',
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
                                  backgroundColor: 'rgba(148, 163, 184, 0.18)',
                                  borderRadius: '4px',
                                  overflow: 'hidden',
                                  position: 'relative',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${item.shortRatio}%`,
                                    height: '100%',
                                    backgroundColor: '#94a3b8',
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
                                  fontWeight: 600,
                                  color: 'var(--text-muted)',
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
                              color: isRealizedLoss ? '#ef4444' : '#10b981',
                              backgroundColor: isRealizedLoss
                                ? 'rgba(239, 68, 68, 0.08)'
                                : 'rgba(16, 185, 129, 0.08)',
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
                              backgroundColor: item.highlightLiquidated
                                ? 'rgba(16, 185, 129, 0.12)'
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
                        color: modalTotals.expectedPnL < 0 ? '#ef4444' : '#10b981',
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
                    <td colSpan={2} style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'right',
                        borderRight: '1px solid var(--border-color)',
                        color: modalTotals.realizedPnL < 0 ? '#ef4444' : '#10b981',
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
                  <span>Badge 'Chủ lực': Thuộc 17 mã cốt lõi Ban Giám Đốc theo dõi</span>
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
