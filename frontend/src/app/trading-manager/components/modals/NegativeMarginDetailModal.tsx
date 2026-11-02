'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  AlertCircle,
  Trash2,
  Download,
  ShieldAlert,
  Layers,
  ArrowUpDown,
  CheckCircle2,
} from 'lucide-react';

export interface MonitoredNegativeAccount {
  account: string;
  negativeType?: 'IMR' | 'BALANCE' | 'BOTH' | 'MANUAL';
  currentBalance?: number | null;
  availableMargin?: number | null;
  additionalMargin?: number | null;
  initialRequiredMargin?: number | null;
  recordedSessionDate?: string | null;
  system?: 'MS' | 'CCP';
  updatedAt?: string | null;
  note?: string;
}

export interface NegativeMarginDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  system: 'MS' | 'CCP';
  systemTitle: string;
  accounts: (MonitoredNegativeAccount | string | any)[];
  onRemoveAccount?: (accountCode: string) => void;
}

export default function NegativeMarginDetailModal({
  isOpen,
  onClose,
  system,
  systemTitle,
  accounts,
  onRemoveAccount,
}: NegativeMarginDetailModalProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'account' | 'additionalMargin' | 'currentBalance'>('additionalMargin');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Chuẩn hóa danh sách đầu vào
  const normalizedAccounts = useMemo(() => {
    return (accounts || []).map((item) => {
      if (typeof item === 'string') {
        return {
          account: item.trim().toUpperCase(),
          negativeType: 'MANUAL' as const,
          currentBalance: null,
          availableMargin: null,
          additionalMargin: null,
          initialRequiredMargin: null,
          system,
          recordedSessionDate: null,
          updatedAt: null,
          note: 'Chờ phiên EOD quét đối soát số liệu',
        };
      }
      return {
        ...item,
        currentBalance: item.currentBalance !== undefined && item.currentBalance !== null ? Number(item.currentBalance) : null,
        availableMargin: item.availableMargin !== undefined && item.availableMargin !== null ? Number(item.availableMargin) : null,
        additionalMargin: item.additionalMargin !== undefined && item.additionalMargin !== null ? Number(item.additionalMargin) : null,
        initialRequiredMargin: item.initialRequiredMargin !== undefined && item.initialRequiredMargin !== null ? Number(item.initialRequiredMargin) : null,
        recordedSessionDate: item.recordedSessionDate || null,
        updatedAt: item.updatedAt || null,
      };
    });
  }, [accounts, system]);

  // Bộ lọc tìm kiếm & loại âm
  const filteredAccounts = useMemo(() => {
    let list = normalizedAccounts;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((a) => a.account.toLowerCase().includes(q));
    }

    if (filterType !== 'ALL') {
      list = list.filter((a) => (a.negativeType || 'MANUAL') === filterType);
    }

    return list.sort((a, b) => {
      let valA: any = a[sortField] ?? 0;
      let valB: any = b[sortField] ?? 0;
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
  }, [normalizedAccounts, searchQuery, filterType, sortField, sortAsc]);

  // Thống kê tổng hợp
  const stats = useMemo(() => {
    let totalAdditional = 0;
    let countImr = 0;
    let countBalance = 0;
    let countPending = 0;

    for (const a of normalizedAccounts) {
      if (a.additionalMargin !== null && a.additionalMargin !== undefined) {
        totalAdditional += Math.abs(a.additionalMargin);
      } else {
        countPending++;
      }
      if (a.negativeType === 'IMR' || a.negativeType === 'BOTH') countImr++;
      if (a.negativeType === 'BALANCE' || a.negativeType === 'BOTH') countBalance++;
    }

    return {
      totalAccounts: normalizedAccounts.length,
      countImr,
      countBalance,
      totalAdditional,
      countPending,
    };
  }, [normalizedAccounts]);

  const handleExportCsv = () => {
    if (filteredAccounts.length === 0) return;
    const headers = [
      'STT',
      'Ma TKGD',
      'Phan he',
      'Loai am',
      'So du hien tai (VND)',
      'Ky quy kha dung (VND)',
      'Muc bo sung ky quy (VND)',
      'Phien ghi nhan',
    ];

    const rows = filteredAccounts.map((a, idx) => [
      idx + 1,
      a.account,
      a.system || system,
      a.negativeType || 'MANUAL',
      a.currentBalance !== null && a.currentBalance !== undefined ? a.currentBalance : 'N/A',
      a.availableMargin !== null && a.availableMargin !== undefined ? a.availableMargin : 'N/A',
      a.additionalMargin !== null && a.additionalMargin !== undefined ? a.additionalMargin : 'N/A',
      a.recordedSessionDate || 'Chờ quét EOD',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DS_TKGD_AM_KQ_${system}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
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
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '12px',
          border: '1px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: system === 'CCP' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(59, 130, 246, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={20} color={system === 'CCP' ? '#10b981' : '#3b82f6'} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Chi Tiết Danh Sách TKGD Âm Ký Quỹ & Số Dư ({systemTitle})
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Cơ chế tự động: Máy tự động ghi nhận TK âm mới sau EOD; TK đã nạp tiền hết âm sẽ tự động dọn dẹp.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleExportCsv}
              disabled={filteredAccounts.length === 0}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              <Download size={14} />
              <span>Xuất CSV</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: 'var(--text-muted)',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* STATS BANNER */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: stats.countPending > 0 ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)',
            gap: '12px',
            padding: '14px 24px',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
          }}
        >
          <div style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tổng TK Theo Dõi</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {stats.totalAccounts}
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
            <div style={{ fontSize: '0.72rem', color: '#ef4444' }}>Âm Ký Quỹ (IMR)</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ef4444' }}>
              {stats.countImr}
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(245, 158, 11, 0.05)' }}>
            <div style={{ fontSize: '0.72rem', color: '#f59e0b' }}>Âm Số Dư Tiền</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f59e0b' }}>
              {stats.countBalance}
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tổng Bổ Sung KQ</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ef4444', fontFamily: 'monospace' }}>
              {stats.totalAdditional.toLocaleString('vi-VN')} đ
            </div>
          </div>
          {stats.countPending > 0 && (
            <div style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.08)' }}>
              <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700 }}>Chờ Quét EOD (N/A)</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f59e0b' }}>
                {stats.countPending}
              </div>
            </div>
          )}
        </div>

        {/* CONTROLS (SEARCH & FILTER) */}
        <div
          style={{
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ position: 'relative', width: '280px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Tìm kiếm mã TKGD..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ width: '100%', paddingLeft: '32px', fontSize: '0.82rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={15} color="var(--text-muted)" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.8rem', padding: '6px 10px' }}
            >
              <option value="ALL">Tất cả loại âm</option>
              <option value="IMR">Âm Ký quỹ (IMR)</option>
              <option value="BALANCE">Âm Số dư</option>
              <option value="BOTH">Âm cả hai</option>
              <option value="MANUAL">Nhập thủ công</option>
            </select>
          </div>
        </div>

        {/* TABLE BODY */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px 24px' }}>
          {filteredAccounts.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 8px auto', display: 'block' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Không có tài khoản âm nào cần xử lý</div>
              <div style={{ fontSize: '0.76rem' }}>Tất cả tài khoản đều đáp ứng đủ số dư và mức ký quỹ yêu cầu.</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-subtle)' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'center', width: '40px' }}>STT</th>
                  <th
                    onClick={() => {
                      if (sortField === 'account') setSortAsc(!sortAsc);
                      else { setSortField('account'); setSortAsc(true); }
                    }}
                    style={{ padding: '10px 8px', textAlign: 'left', cursor: 'pointer', width: '130px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Mã TKGD</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', width: '120px' }}>Phân Loại</th>
                  <th
                    onClick={() => {
                      if (sortField === 'currentBalance') setSortAsc(!sortAsc);
                      else { setSortField('currentBalance'); setSortAsc(true); }
                    }}
                    style={{ padding: '10px 8px', textAlign: 'right', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Số Dư TKKQ (VND)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Ký Quỹ Khả Dụng (VND)</th>
                  <th
                    onClick={() => {
                      if (sortField === 'additionalMargin') setSortAsc(!sortAsc);
                      else { setSortField('additionalMargin'); setSortAsc(false); }
                    }}
                    style={{ padding: '10px 8px', textAlign: 'right', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Mức Bổ Sung KQ (VND)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', width: '150px' }}>Lịch Sử Ghi Nhận</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', width: '60px' }}>Gỡ Bỏ</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((acc, idx) => {
                  const isImr = acc.negativeType === 'IMR' || acc.negativeType === 'BOTH';
                  const isBal = acc.negativeType === 'BALANCE' || acc.negativeType === 'BOTH';

                  return (
                    <tr
                      key={acc.account + idx}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.15s',
                      }}
                    >
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {acc.account}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {acc.negativeType === 'BOTH' ? (
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 700 }}>
                            Âm IMR & Số Dư
                          </span>
                        ) : isImr ? (
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 700 }}>
                            Âm IMR
                          </span>
                        ) : isBal ? (
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 700 }}>
                            Âm Số Dư
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(100, 116, 139, 0.15)', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Nhập Tay
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          color: acc.currentBalance === null || acc.currentBalance === undefined
                            ? 'var(--text-muted)'
                            : acc.currentBalance < 0
                            ? '#ef4444'
                            : 'var(--text-primary)',
                        }}
                      >
                        {acc.currentBalance !== null && acc.currentBalance !== undefined
                          ? acc.currentBalance.toLocaleString('vi-VN')
                          : <span style={{ fontStyle: 'italic', fontSize: '0.74rem', color: 'var(--text-muted)' }}>N/A (Chờ EOD)</span>}
                      </td>
                      <td
                        style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          color: acc.availableMargin === null || acc.availableMargin === undefined
                            ? 'var(--text-muted)'
                            : acc.availableMargin < 0
                            ? '#ef4444'
                            : 'var(--text-primary)',
                        }}
                      >
                        {acc.availableMargin !== null && acc.availableMargin !== undefined
                          ? acc.availableMargin.toLocaleString('vi-VN')
                          : <span style={{ fontStyle: 'italic', fontSize: '0.74rem', color: 'var(--text-muted)' }}>N/A (Chờ EOD)</span>}
                      </td>
                      <td
                        style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: acc.additionalMargin === null || acc.additionalMargin === undefined
                            ? 'var(--text-muted)'
                            : acc.additionalMargin > 0
                            ? '#ef4444'
                            : 'var(--text-muted)',
                        }}
                      >
                        {acc.additionalMargin !== null && acc.additionalMargin !== undefined
                          ? acc.additionalMargin.toLocaleString('vi-VN')
                          : <span style={{ fontStyle: 'italic', fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400 }}>N/A (Chờ EOD)</span>}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '0.76rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {acc.recordedSessionDate || '--'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {acc.negativeType === 'MANUAL' ? 'Cán bộ nhập tay' : 'Bot tự thêm sau EOD'}
                          {acc.updatedAt && !isNaN(new Date(acc.updatedAt).getTime()) && ` • ${new Date(acc.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <button
                          title="Gỡ bỏ tài khoản này khỏi danh sách theo dõi"
                          onClick={() => onRemoveAccount?.(acc.account)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            padding: '4px',
                            borderRadius: '4px',
                          }}
                        >
                          <Trash2 size={14} color="#ef4444" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-subtle)',
          }}
        >
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Hiển thị {filteredAccounts.length} / {normalizedAccounts.length} tài khoản đang theo dõi
          </span>
          <button
            onClick={onClose}
            className="btn-primary"
            style={{ padding: '6px 18px', fontSize: '0.82rem', cursor: 'pointer' }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

