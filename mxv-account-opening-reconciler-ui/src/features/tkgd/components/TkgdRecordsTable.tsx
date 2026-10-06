import React, { useState, useRef } from 'react';
import {
  Loader2,
  Check,
  AlertTriangle,
  X,
  XCircle,
  Eye,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Camera,
  Info,
  ShieldCheck,
  Mail,
  Clock,
  FileSearch,
  RefreshCw,
  Globe,
  Zap,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { CleanRecord, TkgdColumnKey, TkgdSortField, TkgdSortOrder } from '../types/tkgd.types';
import { cleanMailName, checkIsOldIdCard, getBadgeInfo } from '../utils/tkgd.helpers';
import { tkgdApi } from '../services/tkgd.api';
import { DEFAULT_VISIBLE_COLUMNS } from '../hooks/useTkgdData';

interface TkgdRecordsTableProps {
  records: CleanRecord[];
  loading: boolean;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: (s: number) => void;
  total: number;
  totalPages: number;
  isCompactView: boolean;
  visibleColumns?: Record<TkgdColumnKey, boolean>;
  sortBy?: TkgdSortField;
  sortOrder?: TkgdSortOrder;
  onSort?: (field: TkgdSortField) => void;
  expandedRowId: string | null;
  setExpandedRowId: (id: string | null) => void;
  isProcessing: boolean;
  syncingRowCode: string | null;
  onInspect: (record: CleanRecord) => void;
  onSyncMSystem: (code?: string) => void;
  onReparseAccount?: (recordId: string, accountCode?: string) => void;
  onRefresh?: () => void;
}

export const TkgdRecordsTable: React.FC<TkgdRecordsTableProps> = ({
  records,
  loading,
  page,
  setPage,
  pageSize,
  setPageSize,
  total,
  totalPages,
  isCompactView,
  visibleColumns,
  sortBy,
  sortOrder = 'desc',
  onSort,
  expandedRowId,
  setExpandedRowId,
  isProcessing,
  syncingRowCode,
  onInspect,
  onSyncMSystem,
  onReparseAccount,
  onRefresh,
}) => {
  // Checkbox State quản lý danh sách hồ sơ được chọn
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkStatusMsg, setBulkStatusMsg] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    currentCode?: string;
  } | null>(null);
  const cancelBulkRef = useRef<boolean>(false);

  // Toggle chọn 1 dòng
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Toggle chọn tất cả dòng trên trang hiện tại
  const isAllSelected =
    records.length > 0 && records.every((r) => selectedIds.includes(r._id));
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !records.some((r) => r._id === id)),
      );
    } else {
      const pageIds = records.map((r) => r._id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  // Xử lý chạy lại E2E hàng loạt (Gửi theo từng tài khoản tuần tự kèm thanh tiến trình trực quan)
  const handleBulkRunE2E = async () => {
    if (selectedIds.length === 0 || isBulkRunning) return;
    setIsBulkRunning(true);
    cancelBulkRef.current = false;
    const totalCount = selectedIds.length;
    let successCount = 0;
    let errorCount = 0;

    setBulkProgress({ current: 0, total: totalCount, percent: 0 });
    setBulkStatusMsg(`Đang khởi động kiểm tra ${totalCount} tài khoản...`);

    for (let i = 0; i < totalCount; i++) {
      if (cancelBulkRef.current) {
        setBulkStatusMsg(`Đã dừng kiểm tra. Đã xử lý ${i}/${totalCount} tài khoản.`);
        break;
      }

      const id = selectedIds[i];
      const rec = records.find((r) => r._id === id);
      const code = rec?.maTKGD || rec?.maTKGDBase || id;
      const current = i + 1;
      const percent = Math.round((current / totalCount) * 100);

      setBulkProgress({ current, total: totalCount, percent, currentCode: code });
      setBulkStatusMsg(`Đang kiểm tra [${current}/${totalCount} (${percent}%)]: ${code}...`);

      try {
        await tkgdApi.bulkReRunE2E([id], {
          reparseOcr: true,
          resyncMSystem: true,
          reEvaluate: true,
        });
        successCount++;
      } catch (err: any) {
        console.error(`Lỗi khi check tài khoản ${code}:`, err);
        errorCount++;
      }

      // Tự động làm mới danh sách sau mỗi 2 tài khoản hoặc tài khoản cuối để người dùng thấy trạng thái xanh ngay lập tức
      if (i % 2 === 0 || i === totalCount - 1) {
        onRefresh?.();
      }
    }

    setIsBulkRunning(false);
    setBulkProgress(null);
    if (!cancelBulkRef.current) {
      setBulkStatusMsg(`Hoàn tất kiểm tra ${totalCount} tài khoản (Thành công: ${successCount}, Lỗi: ${errorCount})`);
      setSelectedIds([]);
      onRefresh?.();
      setTimeout(() => setBulkStatusMsg(null), 5000);
    }
  };

  // Xử lý Cào lại M-System hàng loạt
  const handleBulkSyncMS = async () => {
    if (selectedIds.length === 0 || isBulkRunning) return;
    const selectedRecords = records.filter((r) => selectedIds.includes(r._id));
    const codes = Array.from(
      new Set(selectedRecords.map((r) => r.maTKGD || r.maTKGDBase).filter(Boolean)),
    ) as string[];
    if (codes.length === 0) return;

    setIsBulkRunning(true);
    setBulkStatusMsg(`Đang đồng bộ M-System cho ${codes.length} tài khoản...`);
    try {
      const res = await tkgdApi.bulkSyncMSystem(codes);
      setBulkStatusMsg(res.message || 'Đồng bộ M-System hoàn tất!');
      setSelectedIds([]);
      onRefresh?.();
      setTimeout(() => setBulkStatusMsg(null), 4000);
    } catch (err: any) {
      setBulkStatusMsg(`Lỗi: ${err.message}`);
      setTimeout(() => setBulkStatusMsg(null), 5000);
    } finally {
      setIsBulkRunning(false);
    }
  };

  // Xử lý So khớp lại luật mới hàng loạt
  const handleBulkReEvaluate = async () => {
    if (selectedIds.length === 0 || isBulkRunning) return;
    setIsBulkRunning(true);
    setBulkStatusMsg(`Đang so khớp lại ${selectedIds.length} tài khoản...`);
    try {
      const res = await tkgdApi.bulkReEvaluate(selectedIds);
      setBulkStatusMsg(res.message || 'So khớp lại hoàn tất!');
      setSelectedIds([]);
      onRefresh?.();
      setTimeout(() => setBulkStatusMsg(null), 4000);
    } catch (err: any) {
      setBulkStatusMsg(`Lỗi: ${err.message}`);
      setTimeout(() => setBulkStatusMsg(null), 5000);
    } finally {
      setIsBulkRunning(false);
    }
  };
  // Helper render badges phân hệ
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

  const cols = visibleColumns || (isCompactView ? {
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
  } : DEFAULT_VISIBLE_COLUMNS);

  const isColVisible = (key: TkgdColumnKey) => cols[key] !== false;

  const visibleColumnCount = 1 + (
    (isColVisible('stt') ? 1 : 0) +
    (isColVisible('maTKGD') ? 1 : 0) +
    (isColVisible('phanHe') ? 1 : 0) +
    (isColVisible('tenMail') ? 1 : 0) +
    (isColVisible('hoTenMS') ? 1 : 0) +
    (isColVisible('soCCCD') ? 1 : 0) +
    (isColVisible('trangThaiMS') ? 1 : 0) +
    (isColVisible('snapshot') ? 1 : 0) +
    (isColVisible('ketLuan') ? 1 : 0) +
    (isColVisible('thoiGian') ? 1 : 0) +
    (isColVisible('soSanh') ? 1 : 0)
  );

  const renderSortableHeader = (
    field: TkgdSortField,
    label: string,
    textAlign: 'left' | 'center' | 'right' = 'left',
    width?: string
  ) => {
    const isSorted = sortBy === field;
    return (
      <th
        onClick={() => onSort && onSort(field)}
        style={{
          padding: '12px 14px',
          textAlign,
          width,
          cursor: onSort ? 'pointer' : 'default',
          userSelect: 'none',
          color: isSorted ? '#3b82f6' : 'var(--text-secondary)',
          transition: 'color 0.15s ease',
        }}
        className="hover:text-blue-500"
        title={onSort ? `Nhấp để sắp xếp theo ${label} (${isSorted && sortOrder === 'asc' ? 'Giảm dần' : 'Tăng dần'})` : undefined}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: textAlign === 'center' ? 'center' : 'flex-start',
            gap: '4px',
            width: '100%',
          }}
        >
          <span>{label}</span>
          {onSort && (
            isSorted ? (
              sortOrder === 'asc' ? (
                <ArrowUp size={13} style={{ color: '#3b82f6', flexShrink: 0 }} />
              ) : (
                <ArrowDown size={13} style={{ color: '#3b82f6', flexShrink: 0 }} />
              )
            ) : (
              <ArrowUpDown size={12} style={{ opacity: 0.35, flexShrink: 0 }} />
            )
          )}
        </div>
      </th>
    );
  };

  return (
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
              <th style={{ padding: '12px 10px', width: '38px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  title={isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả hồ sơ trên trang hiện tại'}
                  style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#3b82f6' }}
                />
              </th>
              {isColVisible('stt') && (
                <th style={{ padding: '12px 14px', width: '45px', textAlign: 'center' }}>STT</th>
              )}
              {isColVisible('maTKGD') && renderSortableHeader('maTKGD', 'Mã TKGD')}
              {isColVisible('phanHe') && <th style={{ padding: '12px 14px' }}>Phân Hệ</th>}
              {isColVisible('tenMail') && renderSortableHeader('tenMail', 'Tên Trên Mail')}
              {isColVisible('hoTenMS') && renderSortableHeader('hoTenMS', 'Họ & Tên Trên MS')}
              {isColVisible('soCCCD') && renderSortableHeader('soCCCD', 'Số CCCD / CMT')}
              {isColVisible('trangThaiMS') && <th style={{ padding: '12px 14px' }}>Trạng Thái MS</th>}
              {isColVisible('snapshot') && (
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Snapshot</th>
              )}
              {isColVisible('ketLuan') && renderSortableHeader('ketLuan', 'Kết Luận', 'center')}
              {isColVisible('thoiGian') &&
                renderSortableHeader('thoiGian', 'Thời Gian Kiểm Tra', 'center', '140px')}
              {isColVisible('soSanh') && (
                <th
                  id="tutorial-tkgd-inspect-col"
                  style={{ padding: '12px 14px', textAlign: 'center', width: '100px' }}
                >
                  So Sánh
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleColumnCount} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Loader2 size={24} className="animate-spin text-emerald-500" style={{ margin: '0 auto 8px auto' }} />
                  <span>Đang tải danh sách hồ sơ...</span>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnCount} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Không tìm thấy hồ sơ đối soát nào phù hợp.
                </td>
              </tr>
            ) : (
              records.map((r, index) => {
                const isKhop = r.ketLuan?.trangThai === 'KHOP';
                const isKhopText = r.ketLuan?.trangThai === 'KHOP_TEXT';
                const isCanKiemTra = r.ketLuan?.trangThai === 'CAN_KIEM_TRA';
                const isLech =
                  r.ketLuan?.trangThai &&
                  r.ketLuan?.trangThai !== 'KHOP' &&
                  r.ketLuan?.trangThai !== 'KHOP_TEXT' &&
                  r.ketLuan?.trangThai !== 'CAN_KIEM_TRA' &&
                  r.ketLuan?.trangThai !== 'CHUA_XU_LY';
                const targetCode =
                  r.maTKGDBase || (r.maTKGD ? r.maTKGD.split('-')[0] : '') || r.noiDungMail?.maTKGD_Futures || '-';
                const isExpanded = expandedRowId === r._id;

                return (
                  <React.Fragment key={r._id}>
                    <tr
                      onDoubleClick={() => onInspect(r)}
                      title="Nhấp đúp chuột vào dòng để xem chi tiết đối soát"
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        backgroundColor: isExpanded ? 'rgba(59, 130, 246, 0.04)' : undefined,
                        cursor: 'pointer',
                      }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td style={{ padding: '12px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r._id)}
                          onChange={() => toggleSelectOne(r._id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#3b82f6' }}
                        />
                      </td>
                      {isColVisible('stt') && (
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {(page - 1) * pageSize + index + 1}
                        </td>
                      )}
                      {isColVisible('maTKGD') && (
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6' }}>
                          <div>{targetCode}</div>
                          {r.noiDungMail?.receivedDateTime && (
                            <div
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 500,
                                color: 'var(--text-muted)',
                                marginTop: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                              title={`Thời gian nhận email: ${new Date(r.noiDungMail.receivedDateTime).toLocaleString('vi-VN')}`}
                            >
                              <Mail size={11} style={{ opacity: 0.7, flexShrink: 0 }} />
                              <span>
                                {new Date(r.noiDungMail.receivedDateTime).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                                {new Date(r.noiDungMail.receivedDateTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                        </td>
                      )}
                      {isColVisible('phanHe') && (
                        <td style={{ padding: '12px 14px' }}>{renderModuleBadges(r)}</td>
                      )}
                      {isColVisible('tenMail') && (
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                          {cleanMailName(r.hopDong?.hoVaTen || r.canCuoc?.hoVaTen || r.noiDungMail?.tenTaiKhoan)}
                        </td>
                      )}
                      {isColVisible('hoTenMS') && (
                        <td style={{ padding: '12px 14px', color: r.ms?.hoVaTen ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {r.ms?.hoVaTen || <em>Chưa đồng bộ MS</em>}
                        </td>
                      )}
                      {isColVisible('soCCCD') && (
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
                              Căn cước cũ, ktra lại
                            </span>
                          )}
                        </td>
                      )}
                      {isColVisible('trangThaiMS') && (
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
                      {isColVisible('snapshot') && (
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {r.snapshots && r.snapshots.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRowId(isExpanded ? null : r._id);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: isExpanded ? '#ffffff' : '#8b5cf6',
                                backgroundColor: isExpanded ? '#8b5cf6' : 'rgba(139, 92, 246, 0.12)',
                                border: '1px solid rgba(139, 92, 246, 0.35)',
                                padding: '3px 9px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              className="hover:scale-105 hover:bg-purple-600 hover:text-white shadow-sm"
                              title={`Click để xem ${r.snapshots.length} lần snapshot lưu vết`}
                            >
                              <Camera size={12} /> {r.snapshots.length}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>-</span>
                          )}
                        </td>
                      )}
                      {isColVisible('ketLuan') && (
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {r.manualReview?.isOverridden ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 9px',
                                borderRadius: '20px',
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                color: '#059669',
                                border: '1px solid rgba(16, 185, 129, 0.5)',
                                fontWeight: 800,
                                fontSize: '0.7rem',
                              }}
                              title={`Cán bộ ${r.manualReview.approvedBy || ''} duyệt tay:\n${r.manualReview.reason || ''}`}
                            >
                              <ShieldCheck size={12} strokeWidth={2.5} /> ĐÃ DUYỆT TAY
                            </span>
                            {r.manualReview.reason && (
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  color: '#059669',
                                  fontStyle: 'italic',
                                  maxWidth: '180px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={r.manualReview.reason}
                              >
                                {r.manualReview.reason}
                              </span>
                            )}
                          </div>
                        ) : isKhop ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
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
                            {!isCompactView && r.canCuoc?.source === 'VERIFIED_MS_HASH' && (
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  color: '#0d9488',
                                  backgroundColor: 'rgba(13, 148, 136, 0.12)',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  border: '1px solid rgba(13, 148, 136, 0.3)',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  whiteSpace: 'nowrap',
                                }}
                                title="Ảnh đính kèm trong Mail và ảnh tải lên M-System trùng khớp 100% (cùng một tệp gốc)"
                              >
                                <ShieldCheck size={10} /> Ảnh gốc trùng khớp
                              </span>
                            )}
                          </div>
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
                      )}

                      {/* Cột Thời Gian Kiểm Tra */}
                      {isColVisible('thoiGian') && (
                        <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {r.ketLuan?.reconciledAt || r.updatedAt ? (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.72rem',
                                color: 'var(--text-secondary)',
                                backgroundColor: 'var(--bg-input)',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                              }}
                              title={`Thời gian kiểm tra: ${new Date(r.ketLuan?.reconciledAt || r.updatedAt!).toLocaleString('vi-VN')}`}
                            >
                              <Clock size={11} style={{ opacity: 0.7, flexShrink: 0 }} />
                              <span>
                                {new Date(r.ketLuan?.reconciledAt || r.updatedAt!).toLocaleDateString('vi-VN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                })}{' '}
                                {new Date(r.ketLuan?.reconciledAt || r.updatedAt!).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>-</span>
                          )}
                        </td>
                      )}

                      {/* Cột Thao Tác - Tối ưu UX: Gom về 1 nút chính trực quan, comment lại các nút phụ ít dùng */}
                      {isColVisible('soSanh') && (
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* NÚT CỐT LÕI DUY NHẤT: Xem chi tiết & Đối soát hồ sơ */}
                          <button
                            id={index === 0 ? 'tutorial-tkgd-inspect-btn' : undefined}
                            data-tutorial="inspect-btn"
                            onClick={() => onInspect(r)}
                            title="Xem chi tiết hồ sơ & đối chiếu 3 bên (HĐ - CCCD - M-System)"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              backgroundColor: isLech
                                ? 'rgba(239, 68, 68, 0.1)'
                                : isCanKiemTra
                                  ? 'rgba(245, 158, 11, 0.1)'
                                  : 'rgba(59, 130, 246, 0.1)',
                              color: isLech
                                ? '#ef4444'
                                : isCanKiemTra
                                  ? '#d97706'
                                  : '#3b82f6',
                              border: isLech
                                ? '1px solid rgba(239, 68, 68, 0.3)'
                                : isCanKiemTra
                                  ? '1px solid rgba(245, 158, 11, 0.35)'
                                  : '1px solid rgba(59, 130, 246, 0.3)',
                              cursor: 'pointer',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              transition: 'all 0.15s ease',
                            }}
                            className="hover:scale-105 active:scale-95"
                          >
                            <Eye size={14} />
                            <span>Xem đối soát</span>
                          </button>

                          {/* [TẠM ẨN THEO YÊU CẦU TỐI ƯU GIAO DIỆN - DỄ BẤM NHẦM / ÍT DÙNG]
                          Đồng bộ lại dữ liệu M-System riêng cho 1 tài khoản
                          <button
                            onClick={() => onSyncMSystem(targetCode)}
                            disabled={isProcessing}
                            title={`Đồng bộ lại dữ liệu M-System cho tài khoản ${targetCode}`}
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
                          */}

                          {/* [TẠM ẨN THEO YÊU CẦU TỐI ƯU GIAO DIỆN - GỌI PYTHON OCR NẶNG TẢI SERVER]
                          Quét lại email & bóc tách lại file (HĐ, CCCD, PL01)
                          {onReparseAccount && (
                            <button
                              onClick={() => onReparseAccount(r._id, targetCode)}
                              disabled={isProcessing}
                              title={`Quét lại email & bóc tách lại file (HĐ, CCCD, PL01) cho tài khoản ${targetCode}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                color: '#d97706',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              className="hover:scale-110 hover:bg-amber-500 hover:text-white"
                            >
                              <FileSearch
                                size={14}
                                className={syncingRowCode === targetCode ? 'animate-pulse' : ''}
                              />
                            </button>
                          )}
                          */}

                          {/* [TẠM ẨN THEO YÊU CẦU TỐI ƯU GIAO DIỆN - TRÙNG LẶP VỚI MODAL XEM CHI TIẾT]
                          Mở rộng dòng accordion
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
                          */}
                        </div>
                      </td>
                      )}
                    </tr>

                    {/* Inline Panel mở rộng */}
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan={visibleColumnCount} style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Info size={14} color="#3b82f6" />
                              <strong style={{ color: 'var(--text-primary)' }}>Tóm tắt tình trạng đối soát:</strong>
                              <span
                                style={{
                                  color: isKhop ? '#10b981' : isCanKiemTra ? '#d97706' : isLech ? '#ef4444' : '#f59e0b',
                                  fontWeight: 700,
                                }}
                              >
                                {isKhop
                                  ? 'Khớp hoàn toàn 100%'
                                  : isCanKiemTra
                                    ? 'Cần kiểm tra lại (Trường hợp đặc biệt)'
                                    : isLech
                                      ? 'Phát hiện sai lệch'
                                      : 'Chưa có kết luận'}
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

                            {/* Khối xem chi tiết Snapshot nếu có */}
                            {r.snapshots && r.snapshots.length > 0 && (
                              <div
                                style={{
                                  marginTop: '6px',
                                  paddingTop: '8px',
                                  borderTop: '1px dashed var(--border-color)',
                                  paddingLeft: '24px',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    marginBottom: '6px',
                                    fontWeight: 600,
                                    color: '#8b5cf6',
                                  }}
                                >
                                  <Camera size={13} />
                                  <span>Lịch sử Snapshot ({r.snapshots.length} lần lưu vết):</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                  {r.snapshots.map((snap, sIdx) => (
                                    <div
                                      key={sIdx}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        backgroundColor: 'var(--bg-card)',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '0.72rem',
                                        width: 'fit-content',
                                      }}
                                    >
                                      <span style={{ color: 'var(--text-muted)' }}>#{sIdx + 1}</span>
                                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {snap.snapshotAt
                                          ? new Date(snap.snapshotAt).toLocaleString('vi-VN')
                                          : 'Không rõ thời gian'}
                                      </span>
                                      <span
                                        style={{
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          backgroundColor:
                                            snap.action === 'REPARSE_ACCOUNT'
                                              ? 'rgba(59, 130, 246, 0.12)'
                                              : 'rgba(139, 92, 246, 0.12)',
                                          color: snap.action === 'REPARSE_ACCOUNT' ? '#3b82f6' : '#8b5cf6',
                                          fontWeight: 600,
                                          fontSize: '0.68rem',
                                        }}
                                      >
                                        {snap.action || 'UPDATE'}
                                      </span>
                                      <span style={{ color: 'var(--text-secondary)' }}>
                                        (Lưu vết tự động trước khi cập nhật dữ liệu)
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px', paddingLeft: '24px', marginTop: '4px' }}>
                              <button
                                onClick={() => onInspect(r)}
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

      {/* Pagination Footer */}
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

      {/* =========================================================================
       * FLOATING BULK ACTION BAR (THANH CÔNG CỤ NỔI KHI TICK CHỌN CHECKBOX)
       * ========================================================================= */}
      {(selectedIds.length > 0 || isBulkRunning || bulkStatusMsg) && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '16px',
            boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(51, 65, 85, 0.8)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            backdropFilter: 'blur(12px)',
            maxWidth: '90vw',
            flexWrap: 'wrap',
          }}
        >
          {/* Badge đếm số lượng */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingRight: '14px',
              borderRight: '1px solid #334155',
            }}
          >
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#ffffff',
              }}
            >
              {selectedIds.length}
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Tài khoản được chọn</span>
          </div>

          {/* Trạng thái tiến trình */}
          {isBulkRunning && bulkProgress ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '260px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60a5fa' }}>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Đang check: <strong style={{ color: '#ffffff' }}>{bulkProgress.currentCode}</strong> ({bulkProgress.current}/{bulkProgress.total})</span>
                  </div>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{bulkProgress.percent}%</span>
                </div>
                {/* Thanh tiến trình Progress Bar */}
                <div style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '999px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${bulkProgress.percent}%`,
                    background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                    borderRadius: '999px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => { cancelBulkRef.current = true; }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Dừng kiểm tra"
              >
                <XCircle size={13} />
                <span>Dừng</span>
              </button>
            </div>
          ) : isBulkRunning ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', fontSize: '0.8rem', fontWeight: 600 }}>
              <Loader2 size={16} className="animate-spin" />
              <span>{bulkStatusMsg || 'Đang kiểm tra lại...'}</span>
            </div>
          ) : bulkStatusMsg ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '0.8rem', fontWeight: 600 }}>
              <CheckCircle2 size={16} />
              <span>{bulkStatusMsg}</span>
            </div>
          ) : (
            <>
              {/* NÚT DUY NHẤT THÂN THIỆN: CHECK LẠI (Tự động cập nhật & đối soát toàn diện) */}
              <button
                type="button"
                onClick={handleBulkRunE2E}
                disabled={isBulkRunning}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(37, 99, 235, 0.4)',
                }}
                title="Tự động kiểm tra lại các tài khoản đã chọn"
              >
                <RefreshCw size={14} />
                <span>Check lại</span>
              </button>

              {/* Nút 1: So khớp lại (Nhanh 1s theo dữ liệu hiện có trong DB) */}
              <button
                type="button"
                onClick={handleBulkReEvaluate}
                disabled={isBulkRunning}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)',
                }}
                title="So khớp lại tức thì dữ liệu theo các trường thông tin hiện có (không cần cào lại MS)"
              >
                <Zap size={14} />
                <span>So khớp lại</span>
              </button>

              {/* Nút Bỏ chọn */}
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  border: 'none',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
                <span>Bỏ chọn</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
