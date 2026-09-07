'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import TkgdConfigPanel from '@/components/tkgd/TkgdConfigPanel';
import {
  FileSpreadsheet,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Check,
  X,
  Loader2,
  Users,
  Camera,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  Layers,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  ExternalLink,
  SlidersHorizontal,
  Settings,
  Sun,
  Moon,
  Mail,
  Globe,
  Zap,
  Download,
  RotateCcw,
  RotateCw,
  Maximize2,
  Info,
  HelpCircle,
  Folder,
} from 'lucide-react';
import { useTutorial } from '@/context/TutorialContext';
import { tkgdTutorialSteps } from '@/tutorials/tkgdTutorial';

interface CleanRecord {
  _id: string;
  batchDate: string;
  maTVKD: string;
  maTKGD?: string;
  maTKGDBase?: string;
  accountType?: 'FUTURES' | 'ACM' | 'LME' | 'SPREAD';
  accountTypes?: string[];
  subAccounts?: Array<{
    code: string;
    type: string;
    status: string;
  }>;
  noiDungMail?: {
    maTKGD_Futures?: string;
    maTKGD_ACM?: string;
    maTKGD_LME?: string;
    maTKGD_Spread?: string;
    tenTaiKhoan?: string;
    hasACMRequest?: boolean;
    hasLMERequest?: boolean;
    hasSpreadRequest?: boolean;
  };
  hopDong?: {
    soHopDong?: string;
    soCanCuoc?: string;
    hoVaTen?: string;
    ngaySinh?: string;
    rawNgaySinh?: string;
    ngayCap?: string;
    rawNgayCap?: string;
    noiCap?: string;
    ngayKyHD?: string;
    gioiTinh?: string;
    rawGioiTinh?: string;
    dinhDangLoi?: string[];
    loaiHinhTaiKhoan?: string;
    chuKy?: string;
  };
  phuLuc?: {
    soHopDongGoc?: string;
    soCanCuoc?: string;
    hoVaTen?: string;
    ngaySinh?: string;
    ngayCap?: string;
    noiCap?: string;
    ngayKyHD?: string;
    chuKy?: string;
  };
  canCuoc?: {
    soCanCuoc?: string;
    hoVaTen?: string;
    ngaySinh?: string;
    ngayCap?: string;
    noiCap?: string;
    gioiTinh?: string;
    canhBaoChatLuong?: string[];
    coGiaTriDen?: string;
  };
  ms?: {
    maTKGD?: string;
    tenTKGD?: string;
    hoVaTen?: string;
    soCMND_HoChieu?: string;
    ngaySinh?: string;
    rawNgaySinh?: string;
    ngayCap?: string;
    rawNgayCap?: string;
    noiCap?: string;
    gioiTinh?: string;
    ngayThamGia?: string;
    loaiHinhTaiKhoan?: string;
    trangThai?: string;
    chuKy?: string;
    isFoundOnMS?: boolean;
    cccdMatTruocLocalPath?: string;
    cccdMatSauLocalPath?: string;
    chuKyLocalPath?: string;
    cccdOcr_soCanCuoc?: string;
    cccdOcr_hoVaTen?: string;
    soSanh_CCCD_Mail_vs_MS?: string;
  };
  ketLuan?: {
    trangThai: string;
    danhSachLoi: string[];
    reconciledAt?: string;
  };
  snapshots?: Array<{
    snapshotAt: string;
    action: string;
    previousData: any;
  }>;
}

export default function TkgdDashboardPage() {
  const { user, token, theme, changeTheme } = useAuth();
  const { startTutorial, resetTutorial, isActive: isTutorialActive } = useTutorial();
  const [mainTab, setMainTab] = useState<'RECONCILE' | 'CONFIG'>('RECONCILE');
  const [showAdvancedActions, setShowAdvancedActions] = useState<boolean>(false);

  // Dữ liệu & trạng thái tải
  const [records, setRecords] = useState<CleanRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Bộ lọc & Phân trang
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filter, setFilter] = useState<'ALL' | 'KHOP' | 'CAN_KIEM_TRA' | 'KHOP_TEXT' | 'LECH' | 'FUTURES' | 'ACM' | 'LME' | 'SPREAD'>('ALL');
  const [batchDate, setBatchDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Tùy biến hiển thị & Bật/tắt giao diện
  const [showStats, setShowStats] = useState<boolean>(true);
  const [isCompactView, setIsCompactView] = useState<boolean>(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Modal So sánh trực quan (Visual Diff Inspector)
  const [inspectRecord, setInspectRecord] = useState<CleanRecord | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'DIFF' | 'ATTACHMENTS' | 'AUDIT'>('DIFF');

  // Quản lý tệp hồ sơ đính kèm & ảnh đối chiếu (Manifest)
  const [accountManifest, setAccountManifest] = useState<any>(null);
  const [loadingManifest, setLoadingManifest] = useState<boolean>(false);

  // Modal xem phóng to ảnh (Lightbox Viewer)
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
    source: 'MAIL' | 'MS';
    rotation: number;
  } | null>(null);

  // Modal xem trước file PDF Hợp đồng / Phụ lục (PDF Viewer)
  const [previewPdf, setPreviewPdf] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // Khôi phục tùy chọn từ LocalStorage khi mount
  useEffect(() => {
    try {
      const savedStats = localStorage.getItem('tkgd_show_stats');
      if (savedStats !== null) setShowStats(savedStats === 'true');
      const savedCompact = localStorage.getItem('tkgd_compact_view');
      if (savedCompact !== null) setIsCompactView(savedCompact === 'true');
    } catch {
      // Bỏ qua nếu môi trường không có localStorage
    }
  }, []);

  const toggleStats = () => {
    setShowStats((prev) => {
      const next = !prev;
      localStorage.setItem('tkgd_show_stats', String(next));
      return next;
    });
  };

  const toggleCompactView = () => {
    setIsCompactView((prev) => {
      const next = !prev;
      localStorage.setItem('tkgd_compact_view', String(next));
      return next;
    });
  };

  // Tải danh sách hồ sơ từ API Backend (Tự động nhận diện Auto-Auth khi mở trực tiếp)
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (filter !== 'ALL') params.append('filter', filter);
      if (batchDate) params.append('batchDate', batchDate);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const url = `${API_BASE_URL}/api/v1/tkgd/records?${params.toString()}`;
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || Math.ceil((data.total || 0) / pageSize) || 1);
      }
    } catch (err: any) {
      toast.error('Không thể tải dữ liệu đối soát: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [token, user?.email, page, pageSize, filter, batchDate, searchTerm]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Tải tệp đính kèm và ảnh đối chiếu khi mở Modal xem chi tiết
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
    const manifestUrl = `${API_BASE_URL}/api/v1/tkgd/files/manifest/${encodeURIComponent(code)}${inspectRecord.batchDate ? `?batchDate=${encodeURIComponent(inspectRecord.batchDate)}` : ''
      }`;

    fetch(manifestUrl, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'x-user-email': user?.email || 'hieptruong@mxv.vn',
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && data.success) {
          setAccountManifest(data);
        }
      })
      .catch(() => { })
      .finally(() => {
        if (isMounted) setLoadingManifest(false);
      });

    return () => {
      isMounted = false;
    };
  }, [inspectRecord, token, user?.email]);

  // Đóng modal bằng phím ESC (ưu tiên đóng modal ảnh/PDF con trước)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) {
          setPreviewImage(null);
        } else if (previewPdf) {
          setPreviewPdf(null);
        } else if (inspectRecord) {
          setInspectRecord(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectRecord, previewImage, previewPdf]);

  // Chế độ Sprint: 'FAST' (Sprint 1: Chỉ Text) vs 'FULL' (Sprint 1+2: Kèm Tệp & Ảnh)
  const [sprintMode, setSprintMode] = useState<'FAST' | 'FULL'>('FAST');
  const [tkgdStats, setTkgdStats] = useState<{
    pendingMsCount: number;
    matchedCount: number;
    mismatchedCount: number;
    totalCount: number;
  }>({ pendingMsCount: 0, matchedCount: 0, mismatchedCount: 0, totalCount: 0 });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [syncingRowCode, setSyncingRowCode] = useState<string | null>(null);

  // Tải thống kê số hồ sơ chờ cào MS phục vụ Dynamic Badge
  const fetchStats = useCallback(async () => {
    try {
      const url = `${API_BASE_URL}/api/v1/tkgd/stats${batchDate ? `?batchDate=${batchDate}` : ''}`;
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTkgdStats(data);
      }
    } catch { }
  }, [token, user?.email, batchDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Nút 1: Quét Mail Outlook
  const handleSyncMail = async () => {
    setIsProcessing(true);
    setProcessingStage('Đang đọc email Outlook yêu cầu mở TKGD mới...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/sync-mail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
        body: JSON.stringify({ batchDate }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `Đã nạp thành công ${data.count} email!`);
        await Promise.all([fetchRecords(), fetchStats()]);
      } else {
        toast.error(data.message || 'Quét mail thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi khi quét mail: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  // Nút 2: Cào M-System (Hỗ trợ cào 1 hồ sơ hoặc cào toàn bộ danh sách chờ) + Tự động đối soát
  const handleSyncMSystem = async (investorCode?: string) => {
    setIsProcessing(true);
    if (investorCode) setSyncingRowCode(investorCode);
    setProcessingStage(
      investorCode
        ? `Đang cào dữ liệu M-System cho tài khoản ${investorCode}...`
        : `Đang đăng nhập M-System và cào danh sách hồ sơ...`
    );
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/sync-msystem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
        body: JSON.stringify({
          investorCode,
          downloadImages: sprintMode === 'FULL',
          batchDate,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Đã cào M-System thành công!');
        await Promise.all([fetchRecords(), fetchStats()]);
      } else {
        toast.error(data.message || 'Cào M-System thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi khi cào M-System: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
      setSyncingRowCode(null);
    }
  };

  // Nút 3: Chạy Tổng Hợp Toàn Bộ (All-in-One: Quét Mail -> Cào MS -> Tự động Đối Soát -> Xuất Excel)
  const handleRunPipelineAll = async () => {
    setIsProcessing(true);
    setProcessingStage('Đang khởi chạy chu trình Tổng Hợp Toàn Bộ (A-Z)...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/run-pipeline-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
        body: JSON.stringify({
          downloadImages: sprintMode === 'FULL',
          batchDate,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `Hoàn tất toàn bộ chu trình!`);
        await Promise.all([fetchRecords(), fetchStats()]);
      } else {
        toast.error(data.message || 'Chạy toàn bộ thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi chu trình toàn bộ: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  // Tiện ích: Tải file Excel đối soát mới nhất về máy
  const handleDownloadExcel = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/download-excel`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
      });
      if (!res.ok) {
        toast('Chưa có file sẵn trên máy chủ, đang tự động chạy đối soát để tạo file...', { icon: 'ℹ️' });
        await handleRunReconcile();
        // Sau khi chạy xong, tự động tải lại file
        const retryRes = await fetch(`${API_BASE_URL}/api/v1/tkgd/download-excel`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'x-user-email': user?.email || 'hieptruong@mxv.vn',
          },
        });
        if (!retryRes.ok) {
          throw new Error('Không tìm thấy file Excel sau khi chạy đối soát.');
        }
        const retryBlob = await retryRes.blob();
        const retryUrl = window.URL.createObjectURL(retryBlob);
        const a = document.createElement('a');
        a.href = retryUrl;
        a.download = `Auto_Data_mail_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(retryUrl);
        document.body.removeChild(a);
        toast.success('Đã tạo và tải file Excel kết quả đối soát thành công!');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Auto_Data_mail_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Đã tải file Excel kết quả đối soát thành công!');
    } catch (err: any) {
      toast.error('Lỗi khi tải file Excel: ' + err.message);
    }
  };

  // Kích hoạt chạy đối soát (Legacy / Utility)
  const handleRunReconcile = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/run`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Đối soát thành công! Khớp: ${data.summary?.khopCount || 0}, Lệch: ${data.summary?.lechCount || 0}`);
        await Promise.all([fetchRecords(), fetchStats()]);
      } else {
        toast.error(data.message || 'Chạy đối soát thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi khi chạy đối soát: ' + err.message);
    } finally {
      setRunning(false);
    }
  };

  // Thống kê nhanh từ tập dữ liệu hiện tại
  const khopCount = records.filter((r) => r.ketLuan?.trangThai === 'KHOP').length;
  const khopTextCount = records.filter((r) => r.ketLuan?.trangThai === 'KHOP_TEXT').length;
  const canKiemTraCount = records.filter((r) => r.ketLuan?.trangThai === 'CAN_KIEM_TRA').length;
  const lechCount = records.filter(
    (r) => r.ketLuan?.trangThai && r.ketLuan?.trangThai !== 'KHOP' && r.ketLuan?.trangThai !== 'KHOP_TEXT' && r.ketLuan?.trangThai !== 'CAN_KIEM_TRA' && r.ketLuan?.trangThai !== 'CHUA_XU_LY'
  ).length;
  const chuaXuLyCount = records.length - khopCount - khopTextCount - canKiemTraCount - lechCount;

  // Helper định dạng ngày chuẩn DD/MM/YYYY (đảm bảo pad 2 chữ số cho ngày và tháng)
  const formatDateStr = (val?: any) => {
    if (!val) return '-';
    const str = String(val).trim();
    if (!str || str === '-' || str === 'undefined' || str === 'null') return '-';

    // 1. Dạng chuỗi thuần ngày DD/MM/YYYY hoặc D/M/YYYY hoặc DD-MM-YYYY hoặc D-M-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${day}/${month}/${year}`;
    }

    // 2. Chuỗi có chứa time hoặc ISO (T hoặc Z): Bắt buộc dùng new Date() theo múi giờ client (+7 GMT)
    // Tránh việc regex cắt chuỗi UTC (VD: 2024-08-04T17:00:00.000Z bị cắt thành 04/08/2024 thay vì 05/08/2024)
    if (str.includes('T') || str.includes('Z')) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      }
    }

    // 3. Dạng thuần ngày YYYY-MM-DD hoặc YYYY/MM/DD (không có thành phần giờ T)
    const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      return `${day}/${month}/${year}`;
    }

    try {
      const d = new Date(str);
      if (isNaN(d.getTime())) return str;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return str;
    }
  };

  // Helper lấy Badge phân hệ đơn lẻ
  const getBadgeInfo = (accountType?: string, code?: string) => {
    const target = (accountType || (code?.endsWith('-A') ? 'ACM' : code?.endsWith('-L') ? 'LME' : code?.endsWith('-S') ? 'SPREAD' : 'FUTURES')).toUpperCase();
    switch (target) {
      case 'ACM':
        return { bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)', label: 'ACM (-A)' };
      case 'LME':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)', label: 'LME (-L)' };
      case 'SPREAD':
        return { bg: 'rgba(20, 184, 166, 0.15)', color: '#14b8a6', border: 'rgba(20, 184, 166, 0.3)', label: 'SPREAD (-S)' };
      default:
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)', label: 'FUTURES' };
    }
  };

  // Helper hiển thị danh sách các phân hệ của 1 nhà đầu tư (chuẩn nghiệp vụ MXV: 1 khách hàng mở nhiều phân hệ)
  const renderModuleBadges = (record: CleanRecord) => {
    const types = new Set<string>();
    if (record.accountTypes && record.accountTypes.length > 0) {
      record.accountTypes.forEach((t) => types.add(t.toUpperCase()));
    } else {
      if (record.accountType) types.add(record.accountType.toUpperCase());
      if (record.noiDungMail?.hasACMRequest || record.maTKGD?.includes('-A')) types.add('ACM');
      if (types.size === 0) types.add('FUTURES');
    }

    const typeArr = Array.from(types);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        {typeArr.map((t) => {
          const b = getBadgeInfo(t);
          return (
            <span
              key={t}
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '12px',
                backgroundColor: b.bg,
                color: b.color,
                border: `1px solid ${b.border}`,
              }}
            >
              {b.label}
            </span>
          );
        })}
      </div>
    );
  };

  // Helper làm sạch tên khách hàng từ email, loại bỏ câu từ cam kết thừa và nhiều dòng
  const cleanMailName = (name?: string) => {
    if (!name) return '-';
    let s = name.split(/[\r\n]/)[0].trim();
    s = s.replace(/\s+(TVKD|Tài khoản|Mã TKGD|đã đính kèm|đề nghị|cam kết|kính gửi|HĐ|CCCD)[\s\S]*$/i, '').trim();
    return s.replace(/[;,.\-:]+$/, '').trim() || '-';
  };

  // Helper nhận diện Căn cước cũ (CMND 9 số hoặc CCCD không chip) theo quy định của Sở & TTTT
  const checkIsOldIdCard = (r?: CleanRecord | null) => {
    if (!r) return false;
    const num = (r.ms?.soCMND_HoChieu || r.canCuoc?.soCanCuoc || r.hopDong?.soCanCuoc || '').replace(/\D/g, '');
    if (num && num.length === 9) return true;
    if (r.ketLuan?.danhSachLoi?.some((err) => err.toLowerCase().includes('căn cước cũ'))) return true;
    if (r.canCuoc?.canhBaoChatLuong?.some((w) => w.toLowerCase().includes('căn cước cũ'))) return true;
    return false;
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          minHeight: '100vh',
          color: 'var(--text-primary)',
          padding: '24px 32px',
        }}
        className="animate-fade-in"
      >
        {/* =========================================================================
         * 1. TOP STANDALONE HEADER: Logo MXV, Tên hệ thống, Tab Switcher, Theme & User
         * ========================================================================= */}
        <div
          id="tutorial-tkgd-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '16px',
          }}
        >
          {/* Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Thanh Toán Bù Trừ
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MXV Automation Tool</span>
              </div>
              <h1
                style={{
                  fontSize: '1.3rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: '2px 0 0 0',
                }}
              >
                Đối Soát & Mở Tài Khoản Giao Dịch
              </h1>
            </div>
          </div>

          {/* Center: Tab Switcher (Đối Soát vs Cài Đặt) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '4px',
              gap: '4px',
            }}
          >
            <button
              onClick={() => setMainTab('RECONCILE')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '9px',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mainTab === 'RECONCILE' ? '#3b82f6' : 'transparent',
                color: mainTab === 'RECONCILE' ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: mainTab === 'RECONCILE' ? '0 2px 8px rgba(59, 130, 246, 0.35)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <FileSpreadsheet size={15} />
              <span>Đối Soát Hồ Sơ</span>
            </button>

            <button
              onClick={() => setMainTab('CONFIG')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '9px',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mainTab === 'CONFIG' ? '#10b981' : 'transparent',
                color: mainTab === 'CONFIG' ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: mainTab === 'CONFIG' ? '0 2px 8px rgba(16, 185, 129, 0.35)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Settings size={15} />
              <span>Cài Đặt & Cấu Hình Bot</span>
            </button>
          </div>

          {/* Right: Quick Actions & Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* User profile */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                fontSize: '0.75rem',
              }}
            >
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                }}
              />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.fullName || 'Trương Hoàng Hiệp'}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>(TTBT)</span>
            </div>

            {/* Theme Toggle (Sáng / Tối) */}
            <button
              onClick={() => {
                if (changeTheme) {
                  changeTheme(theme === 'dark' ? 'light' : 'dark');
                } else {
                  const curr = document.documentElement.getAttribute('data-theme');
                  const next = curr === 'dark' ? 'light' : 'dark';
                  document.documentElement.setAttribute('data-theme', next);
                }
              }}
              title="Đổi giao diện Sáng / Tối"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>

            {/* Nút Làm mới */}
            <button
              onClick={fetchRecords}
              disabled={loading}
              title="Làm mới dữ liệu"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-blue-500' : ''} />
            </button>

            {/* Nút Hướng Dẫn Sử Dụng (Tutorial Tour - Zero Raw Emojis) */}
            <button
              onClick={() => {
                setShowStats(true);
                localStorage.setItem('tkgd_show_stats', 'true');
                resetTutorial('tkgd');
                startTutorial('tkgd', tkgdTutorialSteps);
              }}
              title="Xem hướng dẫn sử dụng phân hệ TKGD"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '36px',
                padding: '0 12px',
                borderRadius: '10px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                color: '#3b82f6',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              className="hover:bg-blue-500 hover:text-white"
            >
              <HelpCircle size={15} />
              <span>Hướng Dẫn</span>
            </button>

            {/* If on Reconcile Tab, show Primary 2 buttons + Advanced Actions Dropdown */}
            {mainTab === 'RECONCILE' && (
              <>
                {/* 1. HERO BUTTON: CHẠY TỰ ĐỘNG (All-in-One Pipeline) */}
                <button
                  id="tutorial-tkgd-auto-btn"
                  onClick={handleRunPipelineAll}
                  disabled={isProcessing}
                  title="Chạy toàn bộ quy trình: Quét Mail -> Cào M-System -> Đối Soát Chéo -> Xuất Excel"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    border: 'none',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    transition: 'all 0.2s ease',
                  }}
                  className="hover:scale-105 active:scale-95"
                >
                  {isProcessing ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Zap size={14} fill="#fef08a" color="#fef08a" />
                  )}
                  <span>{isProcessing ? 'Đang chạy...' : 'Chạy Tự Động (All-in-One)'}</span>
                </button>

                {/* 2. TIỆN ÍCH: TẢI FILE EXCEL (Zero Raw Emojis) */}
                <button
                  id="tutorial-tkgd-export-btn"
                  onClick={handleDownloadExcel}
                  disabled={isProcessing}
                  title="Tải file Excel kết quả đối soát mới nhất về máy"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#10b981',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:bg-emerald-500 hover:text-white"
                >
                  <Download size={14} />
                  <span>Tải File Excel</span>
                </button>

                {/* 3. THAO TÁC NÂNG CAO (Dropdown / Menu Popover) */}
                <div style={{ position: 'relative' }}>
                  <button
                    id="tutorial-tkgd-advanced-btn"
                    onClick={() => setShowAdvancedActions((prev) => !prev)}
                    title="Mở các thao tác bổ trợ: Quét mail riêng, Cào MS riêng, Đổi chế độ Nhanh/Đầy đủ"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '7px 12px',
                      borderRadius: '10px',
                      backgroundColor: showAdvancedActions ? 'var(--bg-input)' : 'var(--bg-card)',
                      border: showAdvancedActions ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                      color: showAdvancedActions ? '#3b82f6' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    className="hover:text-blue-500 hover:border-blue-400"
                  >
                    <SlidersHorizontal size={13} />
                    <span>Nâng Cao</span>
                    <ChevronDown
                      size={13}
                      style={{
                        transform: showAdvancedActions ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                  </button>

                  {/* Dropdown Menu Nội Dung Nâng Cao */}
                  {showAdvancedActions && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        zIndex: 50,
                        minWidth: '280px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '14px',
                        padding: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                      className="animate-fade-in"
                    >
                      {/* Section 1: Chế độ chạy */}
                      <div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
                          Chế Độ Bóc Tách
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: 'var(--bg-input)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '3px',
                            gap: '3px',
                          }}
                        >
                          <button
                            onClick={() => setSprintMode('FAST')}
                            style={{
                              flex: 1,
                              padding: '5px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: sprintMode === 'FAST' ? '#3b82f6' : 'transparent',
                              color: sprintMode === 'FAST' ? '#ffffff' : 'var(--text-secondary)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            Nhanh (Text)
                          </button>
                          <button
                            onClick={() => setSprintMode('FULL')}
                            style={{
                              flex: 1,
                              padding: '5px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: sprintMode === 'FULL' ? '#8b5cf6' : 'transparent',
                              color: sprintMode === 'FULL' ? '#ffffff' : 'var(--text-secondary)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            Đầy Đủ (Tệp/Ảnh)
                          </button>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-color)', margin: '2px 0' }} />

                      {/* Section 2: Chạy Thủ Công Từng Bước */}
                      <div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
                          Chạy Thủ Công Từng Bước
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {/* Nút 1: Quét Mail */}
                          <button
                            onClick={() => {
                              setShowAdvancedActions(false);
                              handleSyncMail();
                            }}
                            disabled={isProcessing}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '7px 10px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--bg-input)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease',
                              textAlign: 'left',
                            }}
                            className="hover:border-blue-400 hover:text-blue-500"
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Mail size={13} color="#3b82f6" />
                              <span>1. Quét Mail Riêng</span>
                            </span>
                          </button>

                          {/* Nút 2: Cào M-System */}
                          <button
                            onClick={() => {
                              setShowAdvancedActions(false);
                              handleSyncMSystem();
                            }}
                            disabled={isProcessing}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '7px 10px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--bg-input)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease',
                              textAlign: 'left',
                            }}
                            className="hover:border-purple-400 hover:text-purple-500"
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Globe size={13} color="#8b5cf6" />
                              <span>2. Cào M-System Riêng</span>
                            </span>
                            {tkgdStats.pendingMsCount > 0 ? (
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  backgroundColor: '#f59e0b',
                                  color: '#ffffff',
                                  fontWeight: 800,
                                }}
                              >
                                {tkgdStats.pendingMsCount}
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  padding: '1px 5px',
                                  borderRadius: '10px',
                                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10b981',
                                  fontWeight: 800,
                                }}
                              >
                                ✓
                              </span>
                            )}
                          </button>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-color)', margin: '2px 0' }} />

                      {/* Section 3: Tùy biến hiển thị KPI */}
                      <button
                        onClick={toggleStats}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          textAlign: 'left',
                        }}
                        className="hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span>{showStats ? 'Thu gọn thẻ Thống kê (KPI)' : 'Hiện thẻ Thống kê (KPI)'}</span>
                        {showStats ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* =========================================================================
         * CHUYỂN ĐỔI NỘI DUNG GIỮA 2 TAB (CẤU HÌNH vs ĐỐI SOÁT)
         * ========================================================================= */}
        {mainTab === 'CONFIG' ? (
          <TkgdConfigPanel />
        ) : (
          <>
            {/* =========================================================================
             * LIVE PROGRESS BANNER: Hiển thị trạng thái tiến trình khi đang chạy
             * ========================================================================= */}
            {isProcessing && (
              <div
                className="animate-pulse"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '14px',
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#3b82f6',
                    }}
                  >
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        Hệ Thống Đang Xử Lý
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '20px',
                          backgroundColor: sprintMode === 'FAST' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                          color: sprintMode === 'FAST' ? '#3b82f6' : '#8b5cf6',
                          fontWeight: 700,
                        }}
                      >
                        {sprintMode === 'FAST' ? ' Sprint 1: Nhanh (Text)' : ' Sprint 2: Đầy Đủ (Ảnh & PDF)'}
                      </span>
                    </div>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {processingStage || 'Đang thực thi tác vụ trong nền, vui lòng đợi trong giây lát...'}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Tự động cập nhật bảng khi hoàn tất
                  </span>
                </div>
              </div>
            )}

            {/* =========================================================================
         * 2. STATS CARDS: Có thể thu gọn/ẩn đi để tránh rối mắt
         * ========================================================================= */}
            {(showStats || isTutorialActive) && (
              <div
                id="tutorial-tkgd-stats-cards"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                }}
                className="animate-fade-in"
              >
                {/* Card 1: Tổng */}
                <div
                  className="glass-panel"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '14px',
                    padding: '16px 20px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Tổng Hồ Sơ (Trang này)
                    </span>
                    <Users size={17} color="#3b82f6" />
                  </div>
                  <p style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0 2px 0' }}>
                    {records.length} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {total}</span>
                  </p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Hồ sơ trong database</span>
                </div>

                {/* Card 2: Khớp */}
                <div
                  className="glass-panel"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '14px',
                    padding: '16px 20px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#10b981', textTransform: 'uppercase' }}>
                      Khớp Hoàn Toàn
                    </span>
                    <CheckCircle2 size={17} color="#10b981" />
                  </div>
                  <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#10b981', margin: '6px 0 2px 0' }}>
                    {khopCount}
                    {khopTextCount > 0 && (
                      <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f59e0b', marginLeft: '6px' }}>
                        (+{khopTextCount} text)
                      </span>
                    )}
                  </p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {khopTextCount > 0 ? `${khopCount} đủ CCCD | ${khopTextCount} chờ đính kèm` : 'Tô màu xanh lá trong Excel'}
                  </span>
                </div>

                {/* Card 3: Cần Kiểm Tra Lại */}
                <div
                  className="glass-panel"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '14px',
                    padding: '16px 20px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>
                      Cần Kiểm Tra Lại
                    </span>
                    <AlertTriangle size={17} color="#f59e0b" />
                  </div>
                  <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#f59e0b', margin: '6px 0 2px 0' }}>
                    {canKiemTraCount}
                  </p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Case đặc biệt / HĐ khuyết trường</span>
                </div>

                {/* Card 4: Lệch */}
                <div
                  className="glass-panel"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '14px',
                    padding: '16px 20px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase' }}>
                      Có Sai Lệch
                    </span>
                    <AlertTriangle size={17} color="#ef4444" />
                  </div>
                  <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#ef4444', margin: '6px 0 2px 0' }}>
                    {lechCount}
                  </p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tô màu đỏ/cam trong Excel</span>
                </div>

                {/* Card 4: Chờ đối soát */}
                <div
                  className="glass-panel"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '14px',
                    padding: '16px 20px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>
                      Chờ Đối Soát
                    </span>
                    <Clock size={17} color="#f59e0b" />
                  </div>
                  <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#f59e0b', margin: '6px 0 2px 0' }}>
                    {chuaXuLyCount}
                  </p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cần bấm chạy đối soát</span>
                </div>
              </div>
            )}

            {/* =========================================================================
         * 3. TOOLBAR: Bộ lọc ngày, Tabs, Tìm kiếm & Chế độ xem gọn
         * ========================================================================= */}
            <div
              className="glass-panel"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '12px 18px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Cụm Tabs Lọc Trạng thái & Phân hệ */}
              <div id="tutorial-tkgd-tabs" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                {[
                  { id: 'ALL', label: `Tất Cả (${total})` },
                  { id: 'KHOP', label: `Khớp 100% (${khopCount})`, color: '#10b981' },
                  { id: 'CAN_KIEM_TRA', label: `Cần Ktra (${canKiemTraCount})`, color: '#f59e0b' },
                  ...(khopTextCount > 0 ? [{ id: 'KHOP_TEXT', label: `Khớp Text (${khopTextCount})`, color: '#3b82f6' }] : []),
                  { id: 'LECH', label: `Sai Lệch (${lechCount})`, color: '#ef4444' },
                ].map((t) => {
                  const active = filter === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setFilter(t.id as any);
                        setPage(1);
                      }}
                      style={{
                        padding: '5px 11px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: active ? '1px solid var(--border-focus)' : '1px solid var(--border-color)',
                        backgroundColor: active ? (t.color ? `${t.color}20` : 'var(--bg-input)') : 'transparent',
                        color: active ? (t.color || 'var(--text-primary)') : 'var(--text-secondary)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}

                <span style={{ color: 'var(--border-color)', margin: '0 4px' }}>|</span>

                {[
                  { id: 'FUTURES', label: 'Futures', color: '#3b82f6' },
                  { id: 'ACM', label: 'ACM (-A)', color: '#8b5cf6' },
                  { id: 'LME', label: 'LME (-L)', color: '#f59e0b' },
                  { id: 'SPREAD', label: 'Spread (-S)', color: '#14b8a6' },
                ].map((t) => {
                  const active = filter === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setFilter(t.id as any);
                        setPage(1);
                      }}
                      style={{
                        padding: '5px 11px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: active ? `1px solid ${t.color}` : '1px solid var(--border-color)',
                        backgroundColor: active ? `${t.color}20` : 'transparent',
                        color: active ? t.color : 'var(--text-secondary)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Cụm Tìm kiếm, Lọc ngày & Chế độ xem gọn */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Lọc theo ngày đợt */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} color="var(--text-muted)" />
                  <input
                    type="date"
                    value={batchDate}
                    onChange={(e) => {
                      setBatchDate(e.target.value);
                      setPage(1);
                    }}
                    title="Lọc theo ngày đợt batchDate"
                    style={{
                      padding: '5px 8px',
                      fontSize: '0.75rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  {batchDate && (
                    <button
                      onClick={() => {
                        setBatchDate('');
                        setPage(1);
                      }}
                      title="Xóa lọc ngày"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Tìm kiếm */}
                <div style={{ position: 'relative', width: '230px' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Tìm mã TK, tên KH, CCCD..."
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 32px',
                      fontSize: '0.78rem',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Nút Toggle Chế độ xem gọn (Compact Mode) */}
                <button
                  onClick={toggleCompactView}
                  title={isCompactView ? 'Chuyển sang chế độ xem đầy đủ' : 'Chuyển sang chế độ xem gọn'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: isCompactView ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                    border: isCompactView ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                    color: isCompactView ? '#3b82f6' : 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <SlidersHorizontal size={13} />
                  <span>{isCompactView ? 'Gọn' : 'Đầy đủ'}</span>
                </button>
              </div>
            </div>

            {/* =========================================================================
         * 4. BẢNG DỮ LIỆU: Tích hợp Cột Thao tác (Mắt) & Phân trang
         * ========================================================================= */}
            <div
              id="tutorial-tkgd-table"
              className="glass-panel"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-secondary)',
                        borderBottom: '1px solid var(--border-color)',
                        fontSize: '0.74rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      <th style={{ padding: '12px 14px', width: '45px', textAlign: 'center' }}>STT</th>
                      <th style={{ padding: '12px 14px' }}>Mã TKGD</th>
                      <th style={{ padding: '12px 14px' }}>Phân Hệ</th>
                      <th style={{ padding: '12px 14px' }}>Tên Trên Mail</th>
                      <th style={{ padding: '12px 14px' }}>Họ & Tên Trên MS</th>
                      <th style={{ padding: '12px 14px' }}>Số CCCD / CMT</th>
                      {!isCompactView && <th style={{ padding: '12px 14px' }}>Trạng Thái MS</th>}
                      {!isCompactView && <th style={{ padding: '12px 14px', textAlign: 'center' }}>Snapshot</th>}
                      <th style={{ padding: '12px 14px', textAlign: 'center' }}>Kết Luận</th>
                      <th id="tutorial-tkgd-inspect-col" style={{ padding: '12px 14px', textAlign: 'center', width: '100px' }}>So Sánh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={isCompactView ? 8 : 10} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <Loader2 size={24} className="animate-spin text-emerald-500" style={{ margin: '0 auto 8px auto' }} />
                          <span>Đang tải danh sách hồ sơ...</span>
                        </td>
                      </tr>
                    ) : records.length === 0 ? (
                      <tr>
                        <td colSpan={isCompactView ? 8 : 10} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Không tìm thấy hồ sơ đối soát nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      records.map((r, index) => {
                        const isKhop = r.ketLuan?.trangThai === 'KHOP';
                        const isKhopText = r.ketLuan?.trangThai === 'KHOP_TEXT';
                        const isCanKiemTra = r.ketLuan?.trangThai === 'CAN_KIEM_TRA';
                        const isLech = r.ketLuan?.trangThai && r.ketLuan?.trangThai !== 'KHOP' && r.ketLuan?.trangThai !== 'KHOP_TEXT' && r.ketLuan?.trangThai !== 'CAN_KIEM_TRA' && r.ketLuan?.trangThai !== 'CHUA_XU_LY';
                        // NGHIỆP VỤ MXV: Mã hiển thị là Mã cơ sở (Base Code không đuôi)
                        const targetCode = r.maTKGDBase || (r.maTKGD ? r.maTKGD.split('-')[0] : '') || r.noiDungMail?.maTKGD_Futures || '-';
                        const isExpanded = expandedRowId === r._id;

                        return (
                          <React.Fragment key={r._id}>
                            <tr
                              style={{
                                borderBottom: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                backgroundColor: isExpanded ? 'rgba(59, 130, 246, 0.04)' : undefined,
                              }}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {(page - 1) * pageSize + index + 1}
                              </td>
                              <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6' }}>
                                {targetCode}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {renderModuleBadges(r)}
                              </td>
                              <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                                {cleanMailName(r.noiDungMail?.tenTaiKhoan)}
                              </td>
                              <td style={{ padding: '12px 14px', color: r.ms?.hoVaTen ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                {r.ms?.hoVaTen || <em>Chưa cào MS</em>}
                              </td>
                              <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                <div>{r.ms?.soCMND_HoChieu || r.canCuoc?.soCanCuoc || r.hopDong?.soCanCuoc || '-'}</div>
                                {checkIsOldIdCard(r) && (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      marginTop: '3px',
                                      fontSize: '0.62rem',
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                      color: '#d97706',
                                      border: '1px solid rgba(245, 158, 11, 0.3)',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    ⚠️ Căn cước cũ, ktra lại
                                  </span>
                                )}
                              </td>
                              {!isCompactView && (
                                <td style={{ padding: '12px 14px' }}>
                                  {r.ms?.trangThai ? (
                                    <span
                                      style={{
                                        padding: '2px 7px',
                                        borderRadius: '10px',
                                        backgroundColor: 'var(--bg-input)',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '0.68rem',
                                        color: 'var(--text-secondary)',
                                      }}
                                    >
                                      {r.ms.trangThai}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                                  )}
                                </td>
                              )}
                              {!isCompactView && (
                                <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                  {r.snapshots && r.snapshots.length > 0 ? (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        fontSize: '0.68rem',
                                        fontWeight: 600,
                                        color: '#8b5cf6',
                                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                        border: '1px solid rgba(139, 92, 246, 0.25)',
                                        padding: '2px 7px',
                                        borderRadius: '10px',
                                      }}
                                      title={`Đã chụp ${r.snapshots.length} lần snapshot`}
                                    >
                                      <Camera size={11} /> {r.snapshots.length}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>-</span>
                                  )}
                                </td>
                              )}
                              <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                {isKhop ? (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '2px 8px',
                                      borderRadius: '20px',
                                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                      color: '#10b981',
                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                      fontWeight: 700,
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    <Check size={12} strokeWidth={3} /> KHỚP 100%
                                  </span>
                                ) : isCanKiemTra ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '2px 8px',
                                        borderRadius: '20px',
                                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                        color: '#d97706',
                                        border: '1px solid rgba(245, 158, 11, 0.4)',
                                        fontWeight: 700,
                                        fontSize: '0.7rem',
                                      }}
                                      title={r.ketLuan?.danhSachLoi?.join('\n') || 'Trường hợp đặc biệt cần chuyên viên kiểm tra lại'}
                                    >
                                      <AlertTriangle size={12} strokeWidth={2.5} /> CẦN KIỂM TRA LẠI
                                    </span>
                                    {r.ketLuan?.danhSachLoi && r.ketLuan.danhSachLoi.length > 0 && (
                                      <span
                                        style={{
                                          fontSize: '0.66rem',
                                          color: '#d97706',
                                          fontWeight: 600,
                                          maxWidth: '200px',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          textAlign: 'center',
                                        }}
                                        title={r.ketLuan.danhSachLoi.join('\n')}
                                      >
                                        {r.ketLuan.danhSachLoi[0]}
                                        {r.ketLuan.danhSachLoi.length > 1 ? ` (+${r.ketLuan.danhSachLoi.length - 1})` : ''}
                                      </span>
                                    )}
                                  </div>
                                ) : isKhopText ? (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '2px 8px',
                                      borderRadius: '20px',
                                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                      color: '#f59e0b',
                                      border: '1px solid rgba(245, 158, 11, 0.3)',
                                      fontWeight: 700,
                                      fontSize: '0.7rem',
                                    }}
                                    title="Khớp Mã và Họ tên, chưa có CCCD từ đính kèm"
                                  >
                                    <AlertTriangle size={12} strokeWidth={2.5} /> KHỚP TEXT
                                  </span>
                                ) : isLech ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '2px 8px',
                                        borderRadius: '20px',
                                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                        color: '#ef4444',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        fontWeight: 700,
                                        fontSize: '0.7rem',
                                      }}
                                      title={r.ketLuan?.danhSachLoi?.join('\n') || 'Phát hiện sai lệch dữ liệu đối soát'}
                                    >
                                      <X size={12} strokeWidth={3} /> LỆCH DỮ LIỆU
                                    </span>
                                    {r.ketLuan?.danhSachLoi && r.ketLuan.danhSachLoi.length > 0 && (
                                      <span
                                        style={{
                                          fontSize: '0.66rem',
                                          color: '#ef4444',
                                          fontWeight: 600,
                                          maxWidth: '190px',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          textAlign: 'center',
                                        }}
                                        title={r.ketLuan.danhSachLoi.join('\n')}
                                      >
                                        {r.ketLuan.danhSachLoi[0]}
                                        {r.ketLuan.danhSachLoi.length > 1 ? ` (+${r.ketLuan.danhSachLoi.length - 1})` : ''}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '2px 8px',
                                      borderRadius: '20px',
                                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                      color: '#f59e0b',
                                      border: '1px solid rgba(245, 158, 11, 0.3)',
                                      fontWeight: 700,
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    CHỜ ĐỐI SOÁT
                                  </span>
                                )}
                              </td>

                              {/* Cột Thao Tác: Con mắt, Cào lại & Mũi tên mở rộng */}
                              <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  {/* NÚT CON MẮT: Mở Modal So Sánh Trực Quan */}
                                  <button
                                    id={index === 0 ? 'tutorial-tkgd-inspect-btn' : undefined}
                                    data-tutorial="inspect-btn"
                                    onClick={() => {
                                      setInspectRecord(r);
                                      setActiveModalTab('DIFF');
                                    }}
                                    title="So sánh trực quan Outlook vs M-System"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '8px',
                                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                      color: '#3b82f6',
                                      border: '1px solid rgba(59, 130, 246, 0.3)',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                    className="hover:scale-110 hover:bg-blue-500 hover:text-white"
                                  >
                                    <Eye size={15} />
                                  </button>

                                  {/* NÚT CÀO LẠI MS: Cào riêng lẻ hồ sơ này */}
                                  <button
                                    onClick={() => handleSyncMSystem(targetCode)}
                                    disabled={isProcessing}
                                    title={`Cào lại dữ liệu M-System cho tài khoản ${targetCode}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '8px',
                                      backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                      color: '#8b5cf6',
                                      border: '1px solid rgba(139, 92, 246, 0.3)',
                                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                    className="hover:scale-110 hover:bg-purple-500 hover:text-white"
                                  >
                                    <RotateCcw
                                      size={14}
                                      className={syncingRowCode === targetCode ? 'animate-spin' : ''}
                                    />
                                  </button>

                                  {/* NÚT MŨI TÊN: Mở rộng dòng xem tóm tắt lỗi inline */}
                                  <button
                                    onClick={() => setExpandedRowId(isExpanded ? null : r._id)}
                                    title={isExpanded ? 'Thu gọn dòng' : 'Mở rộng dòng'}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '6px',
                                      backgroundColor: 'transparent',
                                      color: 'var(--text-muted)',
                                      border: '1px solid var(--border-color)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* PANEL MỞ RỘNG INLINE (Nếu được bấm) */}
                            {isExpanded && (
                              <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                                <td colSpan={isCompactView ? 8 : 10} style={{ padding: '14px 20px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <Info size={14} color="#3b82f6" />
                                      <strong style={{ color: 'var(--text-primary)' }}>Tóm tắt tình trạng đối soát:</strong>
                                      <span style={{ color: isKhop ? '#10b981' : isCanKiemTra ? '#d97706' : isLech ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                                        {isKhop ? 'Khớp hoàn toàn 100%' : isCanKiemTra ? 'Cần kiểm tra lại (Trường hợp đặc biệt)' : isLech ? 'Phát hiện sai lệch' : 'Chưa có kết luận'}
                                      </span>
                                    </div>
                                    {r.ketLuan?.danhSachLoi && r.ketLuan.danhSachLoi.length > 0 ? (
                                      <ul style={{ margin: 0, paddingLeft: '24px', color: isCanKiemTra ? '#d97706' : '#ef4444' }}>
                                        {r.ketLuan.danhSachLoi.map((err, errIdx) => (
                                          <li key={errIdx}>{err}</li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <span style={{ color: 'var(--text-secondary)', paddingLeft: '24px' }}>
                                        Tất cả các trường thông tin (Họ tên, CCCD, ngày sinh, ngày cấp) đã khớp chính xác giữa các bên.
                                      </span>
                                    )}
                                    <div style={{ display: 'flex', gap: '12px', paddingLeft: '24px', marginTop: '4px' }}>
                                      <button
                                        onClick={() => {
                                          setInspectRecord(r);
                                          setActiveModalTab('DIFF');
                                        }}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          color: '#3b82f6',
                                          backgroundColor: 'transparent',
                                          border: 'none',
                                          cursor: 'pointer',
                                          fontWeight: 600,
                                          fontSize: '0.75rem',
                                        }}
                                      >
                                        <Eye size={13} /> Mở modal so sánh chi tiết & ảnh CCCD &rarr;
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* =========================================================================
           * THANH PHÂN TRANG (PAGINATION) Ở DƯỚI BẢNG
           * ========================================================================= */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderTop: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                {/* Số dòng trên trang */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Hiển thị</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: '0.75rem',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value={10}>10 dòng / trang</option>
                    <option value={25}>25 dòng / trang</option>
                    <option value={50}>50 dòng / trang</option>
                  </select>
                  <span>
                    (Tổng cộng: <strong>{total}</strong> hồ sơ)
                  </span>
                </div>

                {/* Điều hướng trang */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => setPage(1)}
                    disabled={page <= 1 || loading}
                    title="Trang đầu"
                    style={{
                      padding: '5px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <ChevronsLeft size={13} />
                  </button>

                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    title="Trang trước"
                    style={{
                      padding: '5px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <ChevronLeft size={13} />
                  </button>

                  <span style={{ margin: '0 6px', fontWeight: 600 }}>
                    Trang {page} / {totalPages}
                  </span>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    title="Trang sau"
                    style={{
                      padding: '5px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <ChevronRight size={13} />
                  </button>

                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages || loading}
                    title="Trang cuối"
                    style={{
                      padding: '5px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <ChevronsRight size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* =========================================================================
         * 5. MODAL SO SÁNH TRỰC QUAN 2 CHIỀU (VISUAL DIFF INSPECTOR MODAL)
         * ========================================================================= */}
            {inspectRecord && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  backdropFilter: 'blur(4px)',
                  padding: '20px',
                }}
                onClick={() => setInspectRecord(null)}
              >
                <div
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '20px',
                    width: '100%',
                    maxWidth: '960px',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'var(--shadow-lg)',
                    overflow: 'hidden',
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="animate-fade-in"
                >
                  {/* Modal Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 24px',
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(59, 130, 246, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#3b82f6',
                        }}
                      >
                        <Eye size={20} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                            So Sánh Đối Soát Chi Tiết
                          </h2>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              color: '#3b82f6',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            {inspectRecord.maTKGDBase || (inspectRecord.maTKGD ? inspectRecord.maTKGD.split('-')[0] : '') || inspectRecord.noiDungMail?.maTKGD_Futures || '-'}
                          </span>
                          {renderModuleBadges(inspectRecord)}
                        </div>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Khách hàng: <strong>{cleanMailName(inspectRecord.noiDungMail?.tenTaiKhoan) !== '-' ? cleanMailName(inspectRecord.noiDungMail?.tenTaiKhoan) : (inspectRecord.ms?.hoVaTen || '-')}</strong> | TVKD: <strong>{inspectRecord.maTVKD || '003'}</strong> | Ngày đợt: {inspectRecord.batchDate}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setInspectRecord(null)}
                      title="Đóng (ESC)"
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      className="hover:bg-red-500 hover:text-white transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Modal Tabs */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 24px',
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                    }}
                  >
                    {[
                      { id: 'DIFF', label: 'So Sánh Trường Dữ Liệu', icon: SlidersHorizontal },
                      { id: 'ATTACHMENTS', label: 'Hồ Sơ & Ảnh CCCD', icon: ImageIcon },
                      { id: 'AUDIT', label: 'Lịch Sử Kiểm Toán', icon: ShieldCheck },
                    ].map((tab) => {
                      const active = activeModalTab === tab.id;
                      const IconComponent = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveModalTab(tab.id as any)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: active ? '1px solid var(--border-focus)' : '1px solid transparent',
                            backgroundColor: active ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                            color: active ? '#3b82f6' : 'var(--text-secondary)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <IconComponent size={14} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Modal Body */}
                  <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                    {/* =================================================================
                 * TAB 1: SO SÁNH TRƯỜNG DỮ LIỆU (SIDE-BY-SIDE DIFF)
                 * ================================================================= */}
                    {activeModalTab === 'DIFF' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Bảng so sánh 2 cột */}
                        <div
                          style={{
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            overflow: 'hidden',
                          }}
                        >
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                            <thead>
                              <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '10px 14px', width: '22%', color: 'var(--text-secondary)', fontWeight: 700 }}>
                                  Trường Thông Tin
                                </th>
                                <th style={{ padding: '10px 14px', width: '35%', color: '#3b82f6', fontWeight: 700 }}>
                                  📧 Outlook & Tệp Đính Kèm
                                </th>
                                <th style={{ padding: '10px 14px', width: '35%', color: '#10b981', fontWeight: 700 }}>
                                  🖥️ M-System Web & OCR
                                </th>
                                <th style={{ padding: '10px 14px', width: '8%', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                  Đối Soát
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const baseCode = (
                                  inspectRecord.maTKGDBase ||
                                  (inspectRecord.maTKGD ? inspectRecord.maTKGD.split('-')[0] : '') ||
                                  inspectRecord.noiDungMail?.maTKGD_Futures ||
                                  '-'
                                ).trim();
                                const hasACM =
                                  inspectRecord.accountTypes?.includes('ACM') ||
                                  inspectRecord.noiDungMail?.hasACMRequest ||
                                  !!inspectRecord.phuLuc ||
                                  inspectRecord.subAccounts?.some((s) => s.type === 'ACM');

                                return [
                                  {
                                    label: 'Mã TKGD (Futures)',
                                    left: inspectRecord.noiDungMail?.maTKGD_Futures || baseCode,
                                    right: inspectRecord.ms?.maTKGD ? inspectRecord.ms.maTKGD.split('-')[0] : baseCode,
                                    customMatch: true,
                                  },
                                  ...(hasACM
                                    ? [
                                      {
                                        label: 'Tiểu khoản ACM (-A)',
                                        left: inspectRecord.noiDungMail?.maTKGD_ACM || `${baseCode}-A`,
                                        right: inspectRecord.ms?.maTKGD?.includes('-A') ? inspectRecord.ms.maTKGD : `${baseCode}-A`,
                                        customMatch: true,
                                      },
                                      {
                                        label: 'Phụ lục PL01 (ACM)',
                                        left: inspectRecord.phuLuc?.chuKy ? 'Đã ký (PL01)' : 'Có đính kèm file PL01',
                                        right: inspectRecord.ms?.maTKGD?.includes('-A') || inspectRecord.subAccounts?.some((s) => s.type === 'ACM') ? 'Đã kích hoạt trên MS' : 'Đang xử lý',
                                        customMatch: true,
                                      },
                                    ]
                                    : []),
                                  {
                                    label: 'Họ và tên',
                                    left: cleanMailName(inspectRecord.hopDong?.hoVaTen || inspectRecord.canCuoc?.hoVaTen || inspectRecord.noiDungMail?.tenTaiKhoan),
                                    right: inspectRecord.ms?.hoVaTen || inspectRecord.ms?.tenTKGD || '-',
                                  },
                                  {
                                    label: 'Số CCCD / Hộ chiếu',
                                    left: inspectRecord.hopDong?.soCanCuoc || inspectRecord.canCuoc?.soCanCuoc || '-',
                                    right: inspectRecord.ms?.soCMND_HoChieu || inspectRecord.ms?.cccdOcr_soCanCuoc || '-',
                                  },
                                  {
                                    label: 'Ngày sinh',
                                    left: inspectRecord.hopDong?.rawNgaySinh
                                      ? formatDateStr(inspectRecord.hopDong.rawNgaySinh)
                                      : formatDateStr(inspectRecord.hopDong?.ngaySinh || inspectRecord.canCuoc?.ngaySinh),
                                    right: inspectRecord.ms?.rawNgaySinh
                                      ? formatDateStr(inspectRecord.ms.rawNgaySinh)
                                      : (formatDateStr(inspectRecord.ms?.ngaySinh) || formatDateStr(inspectRecord.canCuoc?.ngaySinh) || '-'),
                                  },
                                  {
                                    label: 'Ngày cấp',
                                    left: inspectRecord.hopDong?.rawNgayCap
                                      ? formatDateStr(inspectRecord.hopDong.rawNgayCap)
                                      : formatDateStr(inspectRecord.hopDong?.ngayCap || inspectRecord.canCuoc?.ngayCap),
                                    right: inspectRecord.ms?.rawNgayCap
                                      ? formatDateStr(inspectRecord.ms.rawNgayCap)
                                      : (formatDateStr(inspectRecord.ms?.ngayCap) || formatDateStr(inspectRecord.canCuoc?.ngayCap) || '-'),
                                  },
                                  {
                                    label: 'Giới tính',
                                    left: inspectRecord.hopDong?.rawGioiTinh || inspectRecord.hopDong?.gioiTinh || inspectRecord.canCuoc?.gioiTinh || '-',
                                    right: inspectRecord.ms?.gioiTinh || inspectRecord.canCuoc?.gioiTinh || '-',
                                  },
                                  {
                                    label: 'Nơi cấp',
                                    left: inspectRecord.hopDong?.noiCap || inspectRecord.canCuoc?.noiCap || '-',
                                    right: inspectRecord.ms?.noiCap || inspectRecord.canCuoc?.noiCap || '-',
                                  },
                                  {
                                    label: 'Ngày ký HĐ / Ngày duyệt MS',
                                    left: formatDateStr(inspectRecord.hopDong?.ngayKyHD),
                                    right: formatDateStr(inspectRecord.ms?.ngayThamGia),
                                    isInfoNotice: true,
                                  },
                                  {
                                    label: 'Chữ ký khách hàng',
                                    left: inspectRecord.hopDong?.chuKy || 'Đã ký (HĐ)',
                                    right: inspectRecord.ms?.chuKy || 'Đã ký',
                                    customMatch: true,
                                  },
                                ];
                              })().map((item: any, rowIdx: number) => {
                                // Chuẩn hóa so khớp (loại bỏ khoảng trắng, dấu)
                                const normalizeStr = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

                                // Chuẩn hóa so khớp ngày tháng, giới tính và text thông thường
                                const normalizeForCompare = (val: string, label: string) => {
                                  if (!val || val === '-') return '';
                                  const s = val.trim();
                                  if (label.toLowerCase().includes('ngày')) {
                                    const clean = s.replace(/\s*\(HĐ\)/i, '').trim();
                                    return formatDateStr(clean);
                                  }
                                  if (label.toLowerCase().includes('giới tính')) {
                                    const clean = s.toLowerCase();
                                    if (['nữ', 'nu', 'female', 'f'].includes(clean)) return 'nu';
                                    if (['nam', 'male', 'm'].includes(clean)) return 'nam';
                                    return clean;
                                  }
                                  return normalizeStr(s);
                                };

                                const isMatch =
                                  item.isInfoNotice
                                    ? true
                                    : item.customMatch !== undefined
                                      ? item.customMatch
                                      : item.left !== '-' &&
                                      item.right !== '-' &&
                                      normalizeForCompare(item.left, item.label) === normalizeForCompare(item.right, item.label);

                                const isMissingAttachment = !item.isInfoNotice && !isMatch && (item.left === '-' || item.right === '-');

                                return (
                                  <tr
                                    key={rowIdx}
                                    style={{
                                      borderBottom: '1px solid var(--border-color)',
                                      backgroundColor: !isMatch && !isMissingAttachment && !item.isInfoNotice ? 'rgba(239, 68, 68, 0.05)' : undefined,
                                    }}
                                  >
                                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                      {item.label}
                                    </td>
                                    <td style={{ padding: '10px 14px', fontFamily: item.label.includes('Số') || item.label.includes('Mã') ? 'monospace' : 'inherit' }}>
                                      {item.left}
                                    </td>
                                    <td style={{ padding: '10px 14px', fontFamily: item.label.includes('Số') || item.label.includes('Mã') ? 'monospace' : 'inherit' }}>
                                      {item.right}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                      {item.isInfoNotice ? (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            padding: '2px 8px',
                                            borderRadius: '10px',
                                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                            color: '#3b82f6',
                                            fontSize: '0.68rem',
                                            fontWeight: 600,
                                          }}
                                          title="Ngày ký HĐ và ngày duyệt trên MS là 2 mốc thời gian độc lập theo quy trình MXV"
                                        >
                                          <Info size={11} /> Thông tin
                                        </span>
                                      ) : isMatch ? (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '50%',
                                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                            color: '#10b981',
                                          }}
                                          title="Khớp hoàn toàn"
                                        >
                                          <Check size={13} strokeWidth={3} />
                                        </span>
                                      ) : isMissingAttachment ? (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '2px 8px',
                                            borderRadius: '10px',
                                            backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                            color: '#f59e0b',
                                            fontSize: '0.68rem',
                                            fontWeight: 600,
                                          }}
                                          title="Chưa quét tệp đính kèm (hoặc chạy chế độ Nhanh Text)"
                                        >
                                          Chưa quét
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '50%',
                                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                            color: '#ef4444',
                                          }}
                                          title="Có sai khác giữa 2 bên"
                                        >
                                          <X size={13} strokeWidth={3} />
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {inspectRecord.ketLuan?.trangThai === 'CAN_KIEM_TRA' && (
                          <div
                            style={{
                              padding: '14px 18px',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(245, 158, 11, 0.08)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <AlertTriangle size={18} color="#d97706" />
                              <strong style={{ color: '#d97706', fontSize: '0.85rem' }}>
                                CẦN KIỂM TRA LẠI (TRƯỜNG HỢP BẤT THƯỜNG / CASE ĐẶC BIỆT)
                              </strong>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                              Hồ sơ này có các đặc điểm kỹ thuật hoặc định dạng đặc thù, cần chuyên viên ca trực đối chiếu mắt để xác nhận:
                            </p>
                            {inspectRecord.ketLuan?.danhSachLoi && inspectRecord.ketLuan.danhSachLoi.length > 0 && (
                              <ul style={{ margin: 0, paddingLeft: '22px', color: '#d97706', fontSize: '0.75rem', fontWeight: 600 }}>
                                {inspectRecord.ketLuan.danhSachLoi.map((err, eIdx) => (
                                  <li key={eIdx}>{err}</li>
                                ))}
                              </ul>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                              <button
                                onClick={() => setActiveModalTab('ATTACHMENTS')}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  backgroundColor: '#d97706',
                                  color: '#fff',
                                  border: 'none',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <ImageIcon size={13} /> Chuyển sang Tab Hồ Sơ & Ảnh CCCD để kiểm tra &rarr;
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* =================================================================
                 * TAB 2: HỒ SƠ & ẢNH CCCD (SIDE-BY-SIDE VISUAL COMPARISON)
                 * ================================================================= */}
                    {activeModalTab === 'ATTACHMENTS' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Đường dẫn thư mục lưu trữ thực tế */}
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg-input)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px',
                            fontSize: '0.75rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Folder size={14} color="#3b82f6" />
                            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Thư mục lưu trữ:</span>
                            <code style={{ color: '#3b82f6', fontSize: '0.72rem' }}>
                              {accountManifest?.directory || inspectRecord.ms?.cccdMatTruocLocalPath || 'HoSo_DinhKem'}
                            </code>
                          </div>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              color: '#3b82f6',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                            }}
                          >
                            {accountManifest?.totalFiles !== undefined ? `${accountManifest.totalFiles} tệp hồ sơ` : 'Đang quét tệp...'}
                          </span>
                        </div>

                        {loadingManifest ? (
                          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Loader2 className="animate-spin" size={28} style={{ margin: '0 auto 10px auto', color: '#3b82f6' }} />
                            <p style={{ margin: 0, fontSize: '0.85rem' }}>Đang nạp hồ sơ đính kèm và kết nối stream ảnh...</p>
                          </div>
                        ) : (
                          <>
                            {/* KHỐI 1: SO SÁNH CCCD MẶT TRƯỚC */}
                            <div
                              style={{
                                borderRadius: '14px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)',
                                overflow: 'hidden',
                              }}
                            >
                              {/* Header Khối 1 */}
                              <div
                                style={{
                                  padding: '12px 18px',
                                  backgroundColor: 'var(--bg-input)',
                                  borderBottom: '1px solid var(--border-color)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '8px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    style={{
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '6px',
                                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                      color: '#3b82f6',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.75rem',
                                      fontWeight: 800,
                                    }}
                                  >
                                    1
                                  </span>
                                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700 }}>
                                    Ảnh CCCD Mặt Trước (Đối chiếu 2 nguồn)
                                  </h4>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
                                  {accountManifest?.ocrSummary?.soCanCuocMail ? (
                                    <span
                                      style={{
                                        padding: '3px 10px',
                                        borderRadius: '12px',
                                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                        color: '#10b981',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <Check size={12} strokeWidth={3} />
                                      Số CCCD: {accountManifest.ocrSummary.soCanCuocMail}
                                    </span>
                                  ) : null}
                                  {accountManifest?.ocrSummary?.canhBaoChatLuong?.length > 0 ? (
                                    <span
                                      style={{
                                        padding: '3px 10px',
                                        borderRadius: '12px',
                                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                        color: '#f59e0b',
                                        fontWeight: 600,
                                      }}
                                    >
                                      ⚠ {accountManifest.ocrSummary.canhBaoChatLuong.join('; ')}
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        padding: '3px 10px',
                                        borderRadius: '12px',
                                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                        color: '#3b82f6',
                                        fontWeight: 600,
                                      }}
                                    >
                                      ✓ Đủ 4 góc viền
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Body: Split View 2 Cột */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', padding: '16px' }}>
                                {/* Cột Trái: Mail */}
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    backgroundColor: 'var(--bg-input)',
                                    borderRadius: '10px',
                                    padding: '12px',
                                    border: '1px solid var(--border-color)',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <Mail size={13} /> 📧 Tệp Đính Kèm Mail (Khách gửi)
                                    </span>
                                    {accountManifest?.files?.mailCccdFront && (
                                      <button
                                        onClick={() =>
                                          setPreviewImage({
                                            url: `${API_BASE_URL}${accountManifest.files.mailCccdFront.url}`,
                                            title: 'CCCD Mặt Trước (Mail đính kèm)',
                                            source: 'MAIL',
                                            rotation: 0,
                                          })
                                        }
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: '#3b82f6',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          fontSize: '0.7rem',
                                          fontWeight: 600,
                                        }}
                                      >
                                        <Maximize2 size={12} /> Phóng to
                                      </button>
                                    )}
                                  </div>

                                  {accountManifest?.files?.mailCccdFront ? (
                                    <div
                                      onClick={() =>
                                        setPreviewImage({
                                          url: `${API_BASE_URL}${accountManifest.files.mailCccdFront.url}`,
                                          title: 'CCCD Mặt Trước (Mail đính kèm)',
                                          source: 'MAIL',
                                          rotation: 0,
                                        })
                                      }
                                      style={{
                                        height: '180px',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        backgroundColor: '#0f172a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'zoom-in',
                                        position: 'relative',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                      }}
                                    >
                                      <img
                                        src={`${API_BASE_URL}${accountManifest.files.mailCccdFront.url}`}
                                        alt="CCCD Mặt Trước (Mail)"
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                      />
                                      <span
                                        style={{
                                          position: 'absolute',
                                          bottom: '6px',
                                          right: '6px',
                                          backgroundColor: 'rgba(0,0,0,0.65)',
                                          color: '#fff',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.65rem',
                                        }}
                                      >
                                        {accountManifest.files.mailCccdFront.fileName}
                                      </span>
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        height: '180px',
                                        borderRadius: '8px',
                                        border: '1px dashed var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.75rem',
                                        textAlign: 'center',
                                        padding: '12px',
                                      }}
                                    >
                                      Chưa có ảnh CCCD mặt trước từ email
                                    </div>
                                  )}
                                </div>

                                {/* Cột Phải: M-System */}
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    backgroundColor: 'var(--bg-input)',
                                    borderRadius: '10px',
                                    padding: '12px',
                                    border: '1px solid var(--border-color)',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <Globe size={13} /> 🖥️ Tải Từ M-System (TVKD up)
                                    </span>
                                    {accountManifest?.files?.msCccdFront && (
                                      <button
                                        onClick={() =>
                                          setPreviewImage({
                                            url: `${API_BASE_URL}${accountManifest.files.msCccdFront.url}`,
                                            title: 'CCCD Mặt Trước (M-System)',
                                            source: 'MS',
                                            rotation: 0,
                                          })
                                        }
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: '#10b981',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          fontSize: '0.7rem',
                                          fontWeight: 600,
                                        }}
                                      >
                                        <Maximize2 size={12} /> Phóng to
                                      </button>
                                    )}
                                  </div>

                                  {accountManifest?.files?.msCccdFront ? (
                                    <div
                                      onClick={() =>
                                        setPreviewImage({
                                          url: `${API_BASE_URL}${accountManifest.files.msCccdFront.url}`,
                                          title: 'CCCD Mặt Trước (M-System)',
                                          source: 'MS',
                                          rotation: 0,
                                        })
                                      }
                                      style={{
                                        height: '180px',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        backgroundColor: '#0f172a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'zoom-in',
                                        position: 'relative',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                      }}
                                    >
                                      <img
                                        src={`${API_BASE_URL}${accountManifest.files.msCccdFront.url}`}
                                        alt="CCCD Mặt Trước (MS)"
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                      />
                                      <span
                                        style={{
                                          position: 'absolute',
                                          bottom: '6px',
                                          right: '6px',
                                          backgroundColor: 'rgba(0,0,0,0.65)',
                                          color: '#fff',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.65rem',
                                        }}
                                      >
                                        {accountManifest.files.msCccdFront.fileName}
                                      </span>
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        height: '180px',
                                        borderRadius: '8px',
                                        border: '1px dashed var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.75rem',
                                        textAlign: 'center',
                                        padding: '12px',
                                      }}
                                    >
                                      Chưa cào được ảnh CCCD mặt trước từ M-System
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* KHỐI 2: SO SÁNH CCCD MẶT SAU */}
                            <div
                              style={{
                                borderRadius: '14px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)',
                                overflow: 'hidden',
                              }}
                            >
                              {/* Header Khối 2 */}
                              <div
                                style={{
                                  padding: '12px 18px',
                                  backgroundColor: 'var(--bg-input)',
                                  borderBottom: '1px solid var(--border-color)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '8px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    style={{
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '6px',
                                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                      color: '#3b82f6',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.75rem',
                                      fontWeight: 800,
                                    }}
                                  >
                                    2
                                  </span>
                                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700 }}>
                                    Ảnh CCCD Mặt Sau (Đối chiếu 2 nguồn)
                                  </h4>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
                                  <span
                                    style={{
                                      padding: '3px 10px',
                                      borderRadius: '12px',
                                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                      color: '#10b981',
                                      fontWeight: 600,
                                    }}
                                  >
                                    ✓ Nhận diện MRZ & Ngày cấp
                                  </span>
                                </div>
                              </div>

                              {/* Body: Split View 2 Cột */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', padding: '16px' }}>
                                {/* Cột Trái: Mail */}
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    backgroundColor: 'var(--bg-input)',
                                    borderRadius: '10px',
                                    padding: '12px',
                                    border: '1px solid var(--border-color)',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <Mail size={13} /> 📧 Tệp Đính Kèm Mail (Khách gửi)
                                    </span>
                                    {accountManifest?.files?.mailCccdBack && (
                                      <button
                                        onClick={() =>
                                          setPreviewImage({
                                            url: `${API_BASE_URL}${accountManifest.files.mailCccdBack.url}`,
                                            title: 'CCCD Mặt Sau (Mail đính kèm)',
                                            source: 'MAIL',
                                            rotation: 0,
                                          })
                                        }
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: '#3b82f6',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          fontSize: '0.7rem',
                                          fontWeight: 600,
                                        }}
                                      >
                                        <Maximize2 size={12} /> Phóng to
                                      </button>
                                    )}
                                  </div>

                                  {accountManifest?.files?.mailCccdBack ? (
                                    <div
                                      onClick={() =>
                                        setPreviewImage({
                                          url: `${API_BASE_URL}${accountManifest.files.mailCccdBack.url}`,
                                          title: 'CCCD Mặt Sau (Mail đính kèm)',
                                          source: 'MAIL',
                                          rotation: 0,
                                        })
                                      }
                                      style={{
                                        height: '180px',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        backgroundColor: '#0f172a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'zoom-in',
                                        position: 'relative',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                      }}
                                    >
                                      <img
                                        src={`${API_BASE_URL}${accountManifest.files.mailCccdBack.url}`}
                                        alt="CCCD Mặt Sau (Mail)"
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                      />
                                      <span
                                        style={{
                                          position: 'absolute',
                                          bottom: '6px',
                                          right: '6px',
                                          backgroundColor: 'rgba(0,0,0,0.65)',
                                          color: '#fff',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.65rem',
                                        }}
                                      >
                                        {accountManifest.files.mailCccdBack.fileName}
                                      </span>
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        height: '180px',
                                        borderRadius: '8px',
                                        border: '1px dashed var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.75rem',
                                        textAlign: 'center',
                                        padding: '12px',
                                      }}
                                    >
                                      Chưa có ảnh CCCD mặt sau từ email
                                    </div>
                                  )}
                                </div>

                                {/* Cột Phải: M-System */}
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    backgroundColor: 'var(--bg-input)',
                                    borderRadius: '10px',
                                    padding: '12px',
                                    border: '1px solid var(--border-color)',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <Globe size={13} /> 🖥️ Tải Từ M-System (TVKD up)
                                    </span>
                                    {accountManifest?.files?.msCccdBack && (
                                      <button
                                        onClick={() =>
                                          setPreviewImage({
                                            url: `${API_BASE_URL}${accountManifest.files.msCccdBack.url}`,
                                            title: 'CCCD Mặt Sau (M-System)',
                                            source: 'MS',
                                            rotation: 0,
                                          })
                                        }
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: '#10b981',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          fontSize: '0.7rem',
                                          fontWeight: 600,
                                        }}
                                      >
                                        <Maximize2 size={12} /> Phóng to
                                      </button>
                                    )}
                                  </div>

                                  {accountManifest?.files?.msCccdBack ? (
                                    <div
                                      onClick={() =>
                                        setPreviewImage({
                                          url: `${API_BASE_URL}${accountManifest.files.msCccdBack.url}`,
                                          title: 'CCCD Mặt Sau (M-System)',
                                          source: 'MS',
                                          rotation: 0,
                                        })
                                      }
                                      style={{
                                        height: '180px',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        backgroundColor: '#0f172a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'zoom-in',
                                        position: 'relative',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                      }}
                                    >
                                      <img
                                        src={`${API_BASE_URL}${accountManifest.files.msCccdBack.url}`}
                                        alt="CCCD Mặt Sau (MS)"
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                      />
                                      <span
                                        style={{
                                          position: 'absolute',
                                          bottom: '6px',
                                          right: '6px',
                                          backgroundColor: 'rgba(0,0,0,0.65)',
                                          color: '#fff',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.65rem',
                                        }}
                                      >
                                        {accountManifest.files.msCccdBack.fileName}
                                      </span>
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        height: '180px',
                                        borderRadius: '8px',
                                        border: '1px dashed var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.75rem',
                                        textAlign: 'center',
                                        padding: '12px',
                                      }}
                                    >
                                      Chưa cào được ảnh CCCD mặt sau từ M-System
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* KHỐI 3: CHỮ KÝ MẪU & HỒ SƠ PHÁP LÝ (PDF) */}
                            <div
                              style={{
                                borderRadius: '14px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)',
                                overflow: 'hidden',
                              }}
                            >
                              {/* Header Khối 3 */}
                              <div
                                style={{
                                  padding: '12px 18px',
                                  backgroundColor: 'var(--bg-input)',
                                  borderBottom: '1px solid var(--border-color)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '8px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    style={{
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '6px',
                                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                      color: '#10b981',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.75rem',
                                      fontWeight: 800,
                                    }}
                                  >
                                    3
                                  </span>
                                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700 }}>
                                    Chữ Ký Mẫu & Hồ Sơ Pháp Lý (PDF Hợp Đồng / Phụ Lục)
                                  </h4>
                                </div>

                                <span
                                  style={{
                                    padding: '3px 10px',
                                    borderRadius: '12px',
                                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                    color: '#10b981',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  Chữ ký: {inspectRecord.hopDong?.chuKy || inspectRecord.ms?.chuKy || 'Đã ký'}
                                </span>
                              </div>

                              {/* Body Khối 3 */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', padding: '16px' }}>
                                {/* Cột Trái: Chữ Ký Mẫu M-System */}
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    backgroundColor: 'var(--bg-input)',
                                    borderRadius: '10px',
                                    padding: '12px',
                                    border: '1px solid var(--border-color)',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      ✍️ Chữ Ký Mẫu (M-System)
                                    </span>
                                    {accountManifest?.files?.msSignature && (
                                      <button
                                        onClick={() =>
                                          setPreviewImage({
                                            url: `${API_BASE_URL}${accountManifest.files.msSignature.url}`,
                                            title: 'Chữ Ký Mẫu (M-System)',
                                            source: 'MS',
                                            rotation: 0,
                                          })
                                        }
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: '#10b981',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          fontSize: '0.7rem',
                                          fontWeight: 600,
                                        }}
                                      >
                                        <Maximize2 size={12} /> Phóng to
                                      </button>
                                    )}
                                  </div>

                                  {accountManifest?.files?.msSignature ? (
                                    <div
                                      onClick={() =>
                                        setPreviewImage({
                                          url: `${API_BASE_URL}${accountManifest.files.msSignature.url}`,
                                          title: 'Chữ Ký Mẫu (M-System)',
                                          source: 'MS',
                                          rotation: 0,
                                        })
                                      }
                                      style={{
                                        height: '140px',
                                        borderRadius: '8px',
                                        backgroundColor: '#ffffff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'zoom-in',
                                        position: 'relative',
                                        border: '1px solid var(--border-color)',
                                        padding: '10px',
                                      }}
                                    >
                                      <img
                                        src={`${API_BASE_URL}${accountManifest.files.msSignature.url}`}
                                        alt="Chữ Ký M-System"
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                      />
                                      <span
                                        style={{
                                          position: 'absolute',
                                          bottom: '6px',
                                          right: '6px',
                                          backgroundColor: 'rgba(0,0,0,0.6)',
                                          color: '#fff',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.65rem',
                                        }}
                                      >
                                        {accountManifest.files.msSignature.fileName}
                                      </span>
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        height: '140px',
                                        borderRadius: '8px',
                                        border: '1px dashed var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.75rem',
                                      }}
                                    >
                                      Chưa có chữ ký mẫu từ M-System
                                    </div>
                                  )}
                                </div>

                                {/* Cột Phải: Hợp Đồng PDF & Phụ Lục PL01 */}
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px',
                                    backgroundColor: 'var(--bg-input)',
                                    borderRadius: '10px',
                                    padding: '12px',
                                    border: '1px solid var(--border-color)',
                                  }}
                                >
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <FileText size={13} color="#ef4444" /> Hồ Sơ Pháp Lý (Văn Bản Ký)
                                  </span>

                                  {/* Thẻ Hợp đồng */}
                                  <div
                                    style={{
                                      padding: '10px 12px',
                                      borderRadius: '8px',
                                      backgroundColor: 'var(--bg-card)',
                                      border: '1px solid var(--border-color)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '8px',
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                                        Hợp Đồng Mở TKGD
                                      </div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        Số: {inspectRecord.hopDong?.soHopDong || 'HĐ-MXV'} | Ký: {formatDateStr(inspectRecord.hopDong?.ngayKyHD) || 'Theo đợt'}
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      {accountManifest?.files?.mailContractPdf ? (
                                        <>
                                          <button
                                            onClick={() =>
                                              setPreviewPdf({
                                                url: `${API_BASE_URL}${accountManifest.files.mailContractPdf.url}`,
                                                title: `Hợp Đồng Mở TKGD (${inspectRecord.maTKGDBase || inspectRecord.maTKGD})`,
                                              })
                                            }
                                            style={{
                                              padding: '5px 10px',
                                              borderRadius: '6px',
                                              backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                              color: '#3b82f6',
                                              border: '1px solid rgba(59, 130, 246, 0.25)',
                                              fontSize: '0.72rem',
                                              fontWeight: 600,
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                            }}
                                          >
                                            <Eye size={12} /> Xem trực tiếp
                                          </button>
                                          <a
                                            href={`${API_BASE_URL}${accountManifest.files.mailContractPdf.url}`}
                                            download
                                            title="Tải file PDF"
                                            style={{
                                              padding: '5px 8px',
                                              borderRadius: '6px',
                                              backgroundColor: 'var(--bg-input)',
                                              color: 'var(--text-secondary)',
                                              border: '1px solid var(--border-color)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              textDecoration: 'none',
                                            }}
                                          >
                                            <Download size={12} />
                                          </a>
                                        </>
                                      ) : (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Chưa có PDF</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Thẻ Phụ lục PL01 (ACM) */}
                                  {(accountManifest?.files?.mailPl01Pdf || inspectRecord.accountTypes?.includes('ACM') || inspectRecord.noiDungMail?.hasACMRequest) && (
                                    <div
                                      style={{
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        backgroundColor: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '8px',
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                                          Phụ Lục PL01 (Tiểu khoản ACM)
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                          Tiểu khoản: {inspectRecord.maTKGDBase ? `${inspectRecord.maTKGDBase}-A` : '-'}
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {accountManifest?.files?.mailPl01Pdf ? (
                                          <>
                                            <button
                                              onClick={() =>
                                                setPreviewPdf({
                                                  url: `${API_BASE_URL}${accountManifest.files.mailPl01Pdf.url}`,
                                                  title: `Phụ Lục PL01 ACM (${inspectRecord.maTKGDBase || inspectRecord.maTKGD}-A)`,
                                                })
                                              }
                                              style={{
                                                padding: '5px 10px',
                                                borderRadius: '6px',
                                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                                color: '#10b981',
                                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                                fontSize: '0.72rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                              }}
                                            >
                                              <Eye size={12} /> Xem PL01
                                            </button>
                                            <a
                                              href={`${API_BASE_URL}${accountManifest.files.mailPl01Pdf.url}`}
                                              download
                                              title="Tải file PL01"
                                              style={{
                                                padding: '5px 8px',
                                                borderRadius: '6px',
                                                backgroundColor: 'var(--bg-input)',
                                                color: 'var(--text-secondary)',
                                                border: '1px solid var(--border-color)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                textDecoration: 'none',
                                              }}
                                            >
                                              <Download size={12} />
                                            </a>
                                          </>
                                        ) : (
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Chưa có PL01</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* =================================================================
                 * TAB 3: AUDIT TRAIL / LỊCH SỬ SNAPSHOT
                 * ================================================================= */}
                    {activeModalTab === 'AUDIT' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.75rem' }}>
                        <div
                          style={{
                            padding: '12px 16px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg-input)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, color: '#3b82f6' }}>Đối soát 3 chiều lần gần nhất</span>
                            <span style={{ color: 'var(--text-muted)' }}>{formatDateStr(inspectRecord.ketLuan?.reconciledAt || new Date().toISOString())}</span>
                          </div>
                          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                            Trạng thái kết luận: <strong style={{ color: inspectRecord.ketLuan?.trangThai === 'KHOP' ? '#10b981' : inspectRecord.ketLuan?.trangThai === 'CAN_KIEM_TRA' ? '#d97706' : '#ef4444' }}>{inspectRecord.ketLuan?.trangThai || 'CHUA_XU_LY'}</strong>
                          </p>
                        </div>

                        {inspectRecord.snapshots && inspectRecord.snapshots.length > 0 ? (
                          inspectRecord.snapshots.map((snap, sIdx) => (
                            <div
                              key={sIdx}
                              style={{
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'transparent',
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>Lần {sIdx + 1} - Hành động: {snap.action}</span>
                              <span style={{ float: 'right', color: 'var(--text-muted)' }}>{formatDateStr(snap.snapshotAt)}</span>
                            </div>
                          ))
                        ) : (
                          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                            Chưa có lịch sử thay đổi snapshot nào được ghi nhận cho tài khoản này.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 24px',
                      borderTop: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Phím tắt: Bấm <kbd style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>ESC</kbd> để đóng
                    </div>
                    <button
                      onClick={() => setInspectRecord(null)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================================
             * LIGHTBOX MODAL: PHÓNG TO & XOAY ẢNH CCCD / CHỮ KÝ
             * ================================================================= */}
            {previewImage && (
              <div
                onClick={() => setPreviewImage(null)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 9999,
                  backgroundColor: 'rgba(0, 0, 0, 0.88)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                }}
              >
                {/* Control Bar */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '30px',
                    padding: '8px 20px',
                    color: '#fff',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{previewImage.title}</span>
                  <button
                    onClick={() => setPreviewImage((prev) => (prev ? { ...prev, rotation: (prev.rotation + 90) % 360 } : null))}
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      border: 'none',
                      color: '#fff',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                    title="Xoay ảnh 90 độ"
                  >
                    <RotateCw size={14} /> Xoay 90°
                  </button>
                  <button
                    onClick={() => setPreviewImage(null)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.25)',
                      border: 'none',
                      color: '#ef4444',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Đóng (ESC)"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Image Container */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    maxWidth: '90vw',
                    maxHeight: '80vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.25s ease',
                    transform: `rotate(${previewImage.rotation}deg)`,
                  }}
                >
                  <img
                    src={previewImage.url}
                    alt={previewImage.title}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '80vh',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* =================================================================
             * PDF PREVIEW MODAL: XEM TRỰC TIẾP HỢP ĐỒNG / PHỤ LỤC PDF
             * ================================================================= */}
            {previewPdf && (
              <div
                onClick={() => setPreviewPdf(null)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 9999,
                  backgroundColor: 'rgba(0, 0, 0, 0.85)',
                  backdropFilter: 'blur(6px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '92vw',
                    height: '92vh',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      padding: '14px 20px',
                      backgroundColor: 'var(--bg-input)',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={18} color="#ef4444" />
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                        {previewPdf.title}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <a
                        href={previewPdf.url}
                        download
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          color: '#3b82f6',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Download size={14} /> Tải file gốc
                      </a>
                      <button
                        onClick={() => setPreviewPdf(null)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Body: Embedded iframe */}
                  <div style={{ flex: 1, backgroundColor: '#525659' }}>
                    <iframe
                      src={`${previewPdf.url}#toolbar=1`}
                      width="100%"
                      height="100%"
                      style={{ border: 'none' }}
                      title={previewPdf.title}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
