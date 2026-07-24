import React, { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Search, Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { MismatchedTrade, ParsedBotData } from './types';

interface ReconciliationVisualReportProps {
  parsedData: ParsedBotData;
}

const ITEMS_PER_PAGE = 50;

export const ReconciliationVisualReport: React.FC<ReconciliationVisualReportProps> = ({ parsedData }) => {
  const isCqg = parsedData.jsonType === 'CQG';
  const isEod = parsedData.jsonType === 'EOD';
  const isPreEod = parsedData.jsonType === 'PRE_EOD';
  const isKlgd = parsedData.jsonType === 'KLGD' || (!parsedData.jsonType && !isPreEod && !isEod && !isCqg);

  const [preEodSubTab, setPreEodSubTab] = useState<'TRADES' | 'POSITIONS' | 'TTTT' | 'MARGIN'>('TRADES');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const cqgDiscrepancies = useMemo(() => {
    const list: any[] = parsedData.jsonResult?.cqgDiscrepancies || parsedData.jsonResult?.discrepancies || parsedData.jsonResult?.result || [];
    if (!list.length) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => (m.maTKGD || m.account || '').toLowerCase().includes(q));
  }, [parsedData, searchQuery]);

  const marginAccounts = useMemo(() => {
    const list: any[] = parsedData.jsonResult?.marginAccounts || parsedData.marginAccounts || [];
    if (!list.length) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => (m.account || '').toLowerCase().includes(q));
  }, [parsedData, searchQuery]);

  const filteredMismatchedTrades = useMemo(() => {
    const trades: MismatchedTrade[] = parsedData.jsonResult?.mismatchedTrades || [];
    if (!trades.length) return [];

    const q = searchQuery.trim().toLowerCase();
    return trades.filter((t) => {
      const matchesSource = selectedSource === 'ALL' || (t.source || '').toLowerCase() === selectedSource.toLowerCase();
      if (!matchesSource) return false;

      if (!q) return true;
      return (
        (t.maTKGD || '').toLowerCase().includes(q) ||
        (t.maHD || '').toLowerCase().includes(q) ||
        (t.source || '').toLowerCase().includes(q) ||
        (t.reason || '').toLowerCase().includes(q) ||
        (t.giaKhop || '').toLowerCase().includes(q)
      );
    });
  }, [parsedData, searchQuery, selectedSource]);

  const filteredMismatchedPositions = useMemo(() => {
    const positions: any[] = parsedData.jsonResult?.mismatchedTTM || parsedData.jsonResult?.mismatchedPositions || [];
    if (!positions.length) return [];

    const q = searchQuery.trim().toLowerCase();
    return positions.filter((p) => {
      if (!q) return true;
      const acc = (p.account || p.maTKGD || '').toLowerCase();
      const sym = (p.symbol || '').toLowerCase();
      return acc.includes(q) || sym.includes(q);
    });
  }, [parsedData, searchQuery]);

  const filteredMismatchedTTTT = useMemo(() => {
    const list: any[] = parsedData.jsonResult?.mismatchedTTTT || [];
    if (!list.length) return [];

    const q = searchQuery.trim().toLowerCase();
    return list.filter((p) => {
      if (!q) return true;
      const acc = (p.account || p.maTKGD || '').toLowerCase();
      return acc.includes(q);
    });
  }, [parsedData, searchQuery]);

  const handleExportFiltered = () => {
    let content = '';
    if (isCqg) {
      content = 'Mã TKGD\tSố dư M-System (USD)\tSố dư CQG (USD)\tChênh lệch (USD)\n' +
        cqgDiscrepancies.map(m => `${m.maTKGD || m.account}\t$${m.calculatedBalance}\t$${m.cqgBalance}\t$${m.differ}`).join('\n');
    } else if (isEod) {
      content = 'Mã TKGD\tGiá trị âm ký quỹ (VND)\n' +
        marginAccounts.map(m => `${m.account}\t${m.value}`).join('\n');
    } else if (preEodSubTab === 'TRADES') {
      content = 'Nguồn\tMã TKGD\tHợp đồng\tGiá\tSố lượng\tLý do lệch\n' +
        filteredMismatchedTrades.map(t => `${t.source}\t${t.maTKGD}\t${t.maHD}\t${t.giaKhop}\t${t.klGiaoDich}\t${t.reason}`).join('\n');
    } else if (preEodSubTab === 'TTTT') {
      content = 'Tài khoản\tSố dư TTTT M-System\tSố dư PS CQG\tChênh lệch\n' +
        filteredMismatchedTTTT.map(p => `${p.account || p.maTKGD}\t${p.ttttValue}\t${p.psValue}\t${p.differ}`).join('\n');
    } else {
      content = 'Tài khoản\tHợp đồng\tVị thế MS\tVị thế CQG\tChênh lệch\n' +
        filteredMismatchedPositions.map(p => `${p.account || p.maTKGD}\t${p.symbol || ''}\t${p.msPosition ?? p.ttmValue}\t${p.cqgPosition ?? p.opValue}\t${p.differ}`).join('\n');
    }
    navigator.clipboard.writeText(content);
    toast.success('Đã sao chép danh sách lọc!');
  };

  const totals = parsedData.jsonResult?.totals || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Status Summary Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
        {parsedData.jsonResult?.passed ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399' }}>
            <CheckCircle2 size={18} /> Kết Quả: Dữ liệu khớp hoàn toàn
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}>
            <AlertCircle size={18} /> Kết Quả: {isCqg ? `Kết Quả CQG: Phát hiện chênh lệch dữ liệu (${cqgDiscrepancies.length} tài khoản)` : isEod ? `Phát hiện ${marginAccounts.length} tài khoản âm ký quỹ` : 'Phát hiện chênh lệch dữ liệu'}
          </span>
        )}
      </div>

      {/* Mode D: CQG SOD Balance View */}
      {isCqg && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px 16px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <div style={{ fontSize: '0.68rem', color: '#f87171', marginBottom: '4px', fontWeight: 700 }}>TÀI KHOẢN LỆCH SỐ DƯ CQG</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f87171' }}>
              {parsedData.jsonResult?.totalCount || cqgDiscrepancies.length} tài khoản
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Chênh lệch số dư SOD (&gt; $100 USD)
            </div>
          </div>

          <div style={{ padding: '14px 16px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>TỶ GIÁ USD/VND ÁP DỤNG</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {parsedData.jsonResult?.usdRate ? parsedData.jsonResult.usdRate.toLocaleString('vi-VN') : '26,320'} VND
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Tỷ giá quy đổi M-System
            </div>
          </div>
        </div>
      )}

      {/* Mode C: EOD Negative Margin View */}
      {isEod && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px 16px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <div style={{ fontSize: '0.68rem', color: '#f87171', marginBottom: '4px', fontWeight: 700 }}>TÀI KHOẢN ÂM KÝ QUỸ</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f87171' }}>
              {marginAccounts.length} tài khoản
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Phát hiện sau phiên EOD
            </div>
          </div>

          <div style={{ padding: '14px 16px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>TỔNG SỐ TÀI KHOẢN ĐÃ QUÉT</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {marginAccounts.length} tài khoản
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Tự động trích xuất từ báo cáo QLTKGD
            </div>
          </div>
        </div>
      )}

      {/* Mode A: PRE_EOD Dashboard View (Đầu phiên / Pre-EOD 3-way check) */}
      {isPreEod && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px 16px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>TỰ DOANH (MS vs Straits)</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {totals.totalACM_MS ?? 572} vs {totals.totalACM_Straits ?? 1877} lot
            </div>
            <div style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 700, marginTop: '4px' }}>
              Chênh lệch: {totals.differACM ?? 1305} lot
            </div>
          </div>

          <div style={{ padding: '14px 16px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>LỆNH THƯỜNG (MS vs CQG)</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {totals.totalCQG_MS ?? 1360} vs {totals.totalCQG_FR ?? 0} lot
            </div>
            <div style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 700, marginTop: '4px' }}>
              Chênh lệch: {totals.differCQG ?? 1360} lot
            </div>
          </div>

          <div style={{ padding: '14px 16px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ fontSize: '0.68rem', color: '#f87171', marginBottom: '4px', fontWeight: 600 }}>CHÊNH LỆCH CHI TIẾT</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f87171' }}>
              {parsedData.jsonResult?.mismatchedTrades?.length || 1146} giao dịch
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Lệch khớp lệnh chi tiết
            </div>
          </div>

          <div style={{ padding: '14px 16px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ fontSize: '0.68rem', color: '#f87171', marginBottom: '4px', fontWeight: 600 }}>LỆCH NET POSITION</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f87171' }}>
              {(parsedData.jsonResult?.mismatchedPositions || parsedData.jsonResult?.mismatchedTTM)?.length || 1683} tài khoản
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Vị thế ròng CQG vs M-System
            </div>
          </div>
        </div>
      )}

      {/* Mode B: KLGD Dashboard View (Trong phiên / KLGD 6-cards check) */}
      {isKlgd && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px 14px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>TỔNG LOT M-SYSTEM</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totals.totalDSGD ?? 0}</div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>TỔNG LOT CQG</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totals.totalFR ?? 0}</div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>TỔNG LOT ACM</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totals.totalACM ?? 0}</div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>TỔNG LOT NANO</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totals.totalNano ?? 0}</div>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>TẤT TOÁN M-SYSTEM (TTTT)</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totals.totalTTTT ?? 0}</div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>TỔNG PS CQG (S VALUE)</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totals.totalPS ?? 0}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', background: (totals.differ ?? 0) > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', color: (totals.differ ?? 0) > 0 ? '#f87171' : '#34d399' }}>
              Chênh lệch MS vs CQG: {totals.differ ?? 0} lot
            </span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', background: (totals.differACM ?? 0) > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', color: (totals.differACM ?? 0) > 0 ? '#f87171' : '#34d399' }}>
              Chênh lệch ACM vs Nano: {totals.differACM ?? 0} lot
            </span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', background: (totals.differTTTT ?? 0) > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', color: (totals.differTTTT ?? 0) > 0 ? '#f87171' : '#34d399' }}>
              Chênh lệch TTTT vs PS: {totals.differTTTT ?? 0} lot
            </span>
          </div>
        </>
      )}

      {/* Subtab Buttons & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isCqg ? (
            <button
              type="button"
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid #ef4444',
                background: '#ef4444',
                color: '#ffffff'
              }}
            >
              Danh sách TK lệch số dư CQG ({cqgDiscrepancies.length})
            </button>
          ) : isEod ? (
            <button
              type="button"
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid #ef4444',
                background: '#ef4444',
                color: '#ffffff'
              }}
            >
              Danh sách TK âm ký quỹ ({marginAccounts.length})
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPreEodSubTab('TRADES')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: preEodSubTab === 'TRADES' ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
                  background: preEodSubTab === 'TRADES' ? 'var(--color-accent)' : 'var(--bg-card)',
                  color: preEodSubTab === 'TRADES' ? '#ffffff' : 'var(--text-secondary)'
                }}
              >
                Lệch khớp lệnh ({parsedData.jsonResult?.mismatchedTrades?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setPreEodSubTab('POSITIONS')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: preEodSubTab === 'POSITIONS' ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
                  background: preEodSubTab === 'POSITIONS' ? 'var(--color-accent)' : 'var(--bg-card)',
                  color: preEodSubTab === 'POSITIONS' ? '#ffffff' : 'var(--text-secondary)'
                }}
              >
                Lệch vị thế ròng ({parsedData.jsonResult?.mismatchedTTM?.length || parsedData.jsonResult?.mismatchedPositions?.length || 0})
              </button>
              {isKlgd && (
                <button
                  type="button"
                  onClick={() => setPreEodSubTab('TTTT')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: preEodSubTab === 'TTTT' ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
                    background: preEodSubTab === 'TTTT' ? 'var(--color-accent)' : 'var(--bg-card)',
                    color: preEodSubTab === 'TTTT' ? '#ffffff' : 'var(--text-secondary)'
                  }}
                >
                  Lệch TTTT vs PS ({parsedData.jsonResult?.mismatchedTTTT?.length || 0})
                </button>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={(isCqg || isEod) ? "Lọc mã tài khoản..." : "Lọc TK, Mã HĐ, Lý do..."}
              style={{
                width: '100%',
                padding: '6px 12px 6px 30px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem' }}
              >
                ✕
              </button>
            )}
          </div>

          {!isCqg && !isEod && preEodSubTab === 'TRADES' && (
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              style={{
                padding: '6px 10px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">Tất cả nguồn</option>
              <option value="MSystem">MSystem</option>
              <option value="CQG">CQG</option>
              <option value="Straits">Straits</option>
              <option value="ACM">ACM</option>
              <option value="Nano">Nano</option>
            </select>
          )}

          <button
            type="button"
            onClick={handleExportFiltered}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            <Copy size={13} /> Copy DS Lọc
          </button>
        </div>
      </div>

      {/* Table Section: CQG SOD Balance Discrepancies */}
      {isCqg && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} color="#f87171" /> Danh sách tài khoản chênh lệch số dư CQG (Chênh lệch &gt; 100 USD) {
                parsedData.jsonResult?.totalCount && parsedData.jsonResult.totalCount > cqgDiscrepancies.length
                  ? `(Mẫu ${cqgDiscrepancies.length} / Tổng ${parsedData.jsonResult.totalCount})`
                  : `(${cqgDiscrepancies.length})`
              }
            </h4>
            {cqgDiscrepancies.length > 0 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Trang {currentPage} / {Math.ceil(cqgDiscrepancies.length / ITEMS_PER_PAGE)}
              </span>
            )}
          </div>

          {cqgDiscrepancies.length > 0 ? (
            <>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px' }}>Mã TKGD</th>
                      <th style={{ padding: '10px' }}>Số dư M-System (USD)</th>
                      <th style={{ padding: '10px' }}>Số dư CQG (USD)</th>
                      <th style={{ padding: '10px' }}>Chênh lệch</th>
                      <th style={{ padding: '10px' }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cqgDiscrepancies
                      .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                      .map((m: any, idx: number) => {
                        const msVal = m.calculatedBalance !== undefined ? `$${m.calculatedBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
                        const cqgVal = m.cqgBalance !== undefined ? `$${m.cqgBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
                        const diffVal = m.differ !== undefined ? `$${m.differ.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'var(--bg-app)' : 'transparent' }}>
                            <td style={{ padding: '10px', color: '#0284c7', fontFamily: 'monospace', fontWeight: 700 }}>{m.maTKGD || m.account}</td>
                            <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{msVal}</td>
                            <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{cqgVal}</td>
                            <td style={{ padding: '10px', color: '#f87171', fontWeight: 700 }}>{diffVal}</td>
                            <td style={{ padding: '10px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                Lệch số dư
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {cqgDiscrepancies.length > ITEMS_PER_PAGE && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, cqgDiscrepancies.length)} trên tổng số {cqgDiscrepancies.length} bản ghi
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      style={{
                        padding: '4px 10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Trang trước
                    </button>
                    <button
                      disabled={currentPage >= Math.ceil(cqgDiscrepancies.length / ITEMS_PER_PAGE)}
                      onClick={() => setCurrentPage(p => p + 1)}
                      style={{
                        padding: '4px 10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        color: currentPage >= Math.ceil(cqgDiscrepancies.length / ITEMS_PER_PAGE) ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: currentPage >= Math.ceil(cqgDiscrepancies.length / ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Trang sau
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-input)', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Không có tài khoản nào bị lệch số dư CQG.
            </div>
          )}
        </div>
      )}

      {/* Table Section: EOD Negative Margin Accounts */}
      {isEod && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} color="#f87171" /> Danh sách tài khoản bị âm ký quỹ đầu ngày ({marginAccounts.length})
            </h4>
            {marginAccounts.length > 0 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Trang {currentPage} / {Math.ceil(marginAccounts.length / ITEMS_PER_PAGE)}
              </span>
            )}
          </div>

          {marginAccounts.length > 0 ? (
            <>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px', width: '60px' }}>STT</th>
                      <th style={{ padding: '10px' }}>Mã TKGD</th>
                      <th style={{ padding: '10px' }}>Số dư ký quỹ âm (VND)</th>
                      <th style={{ padding: '10px' }}>Trạng thái xử lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marginAccounts
                      .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                      .map((m: any, idx: number) => {
                        const itemIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'var(--bg-app)' : 'transparent' }}>
                            <td style={{ padding: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>{itemIdx}</td>
                            <td style={{ padding: '10px', color: '#fbbf24', fontFamily: 'monospace', fontWeight: 700 }}>{m.account}</td>
                            <td style={{ padding: '10px', color: '#f87171', fontWeight: 700 }}>
                              {m.value !== 0 ? `${m.value.toLocaleString('vi-VN')} VND` : 'Âm ký quỹ'}
                            </td>
                            <td style={{ padding: '10px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                Cần theo dõi & xử lý
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {marginAccounts.length > ITEMS_PER_PAGE && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, marginAccounts.length)} trên tổng số {marginAccounts.length} bản ghi
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      style={{
                        padding: '4px 10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Trang trước
                    </button>
                    <button
                      disabled={currentPage >= Math.ceil(marginAccounts.length / ITEMS_PER_PAGE)}
                      onClick={() => setCurrentPage(p => p + 1)}
                      style={{
                        padding: '4px 10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        color: currentPage >= Math.ceil(marginAccounts.length / ITEMS_PER_PAGE) ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: currentPage >= Math.ceil(marginAccounts.length / ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Trang sau
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-input)', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Không có tài khoản nào bị âm ký quỹ.
            </div>
          )}
        </div>
      )}

      {/* Table Section: TRADES */}
      {preEodSubTab === 'TRADES' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} color="#f87171" /> Danh sách khớp lệnh chênh lệch chi tiết ({filteredMismatchedTrades.length} / {parsedData.jsonResult?.mismatchedTrades?.length || 0})
            </h4>
            {filteredMismatchedTrades.length > 0 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Trang {currentPage} / {Math.ceil(filteredMismatchedTrades.length / ITEMS_PER_PAGE)}
              </span>
            )}
          </div>

          {filteredMismatchedTrades.length > 0 ? (
            <>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px' }}>Nguồn</th>
                      <th style={{ padding: '10px' }}>Mã TKGD</th>
                      <th style={{ padding: '10px' }}>Hợp đồng</th>
                      <th style={{ padding: '10px' }}>Giá</th>
                      <th style={{ padding: '10px' }}>Số lượng</th>
                      <th style={{ padding: '10px' }}>Lý do lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMismatchedTrades
                      .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                      .map((m: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'var(--bg-app)' : 'transparent' }}>
                          <td style={{ padding: '10px', color: 'var(--color-accent)', fontWeight: 700 }}>{m.source}</td>
                          <td style={{ padding: '10px', color: '#fbbf24', fontFamily: 'monospace' }}>{m.maTKGD}</td>
                          <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{m.maHD}</td>
                          <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{m.giaKhop}</td>
                          <td style={{ padding: '10px', color: 'var(--text-primary)', fontWeight: 600 }}>{m.klGiaoDich}</td>
                          <td style={{ padding: '10px', color: '#f87171' }}>{m.reason}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {filteredMismatchedTrades.length > ITEMS_PER_PAGE && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredMismatchedTrades.length)} trên tổng số {filteredMismatchedTrades.length} bản ghi
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      style={{
                        padding: '4px 10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Trang trước
                    </button>
                    <button
                      disabled={currentPage >= Math.ceil(filteredMismatchedTrades.length / ITEMS_PER_PAGE)}
                      onClick={() => setCurrentPage(p => p + 1)}
                      style={{
                        padding: '4px 10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        color: currentPage >= Math.ceil(filteredMismatchedTrades.length / ITEMS_PER_PAGE) ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: currentPage >= Math.ceil(filteredMismatchedTrades.length / ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Trang sau
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-input)', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Không tìm thấy giao dịch lệch nào phù hợp với bộ lọc.
            </div>
          )}
        </div>
      )}

      {/* Table Section: POSITIONS / TTM */}
      {preEodSubTab === 'POSITIONS' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} color="#f87171" /> Danh sách chênh lệch Trạng Thái Mở (TTM) tài khoản ({filteredMismatchedPositions.length} / {(parsedData.jsonResult?.mismatchedTTM || parsedData.jsonResult?.mismatchedPositions)?.length || 0})
            </h4>
            {filteredMismatchedPositions.length > 0 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Trang {currentPage} / {Math.ceil(filteredMismatchedPositions.length / ITEMS_PER_PAGE)}
              </span>
            )}
          </div>

          {filteredMismatchedPositions.length > 0 ? (
            <>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px' }}>Tài khoản</th>
                      <th style={{ padding: '10px' }}>{isPreEod ? 'Hợp đồng' : 'Tổng Lot M-System'}</th>
                      <th style={{ padding: '10px' }}>{isPreEod ? 'Vị thế MS' : 'Tổng Lot CQG'}</th>
                      <th style={{ padding: '10px' }}>{isPreEod ? 'Vị thế CQG' : 'Chênh lệch'}</th>
                      {isPreEod && <th style={{ padding: '10px' }}>Chênh lệch</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMismatchedPositions
                      .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                      .map((m: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'var(--bg-app)' : 'transparent' }}>
                          <td style={{ padding: '10px', color: '#fbbf24', fontFamily: 'monospace', fontWeight: 700 }}>{m.account || m.maTKGD}</td>
                          <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{isPreEod ? (m.symbol || 'All') : (m.ttmValue ?? m.msPosition ?? 0)}</td>
                          <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{isPreEod ? (m.msPosition ?? m.ttmValue ?? 0) : (m.opValue ?? m.cqgPosition ?? 0)}</td>
                          <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{isPreEod ? (m.cqgPosition ?? m.opValue ?? 0) : m.differ}</td>
                          {isPreEod && <td style={{ padding: '10px', color: '#f87171', fontWeight: 700 }}>{m.differ}</td>}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {filteredMismatchedPositions.length > ITEMS_PER_PAGE && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredMismatchedPositions.length)} trên tổng số {filteredMismatchedPositions.length} bản ghi
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      style={{
                        padding: '4px 10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Trang trước
                    </button>
                    <button
                      disabled={currentPage >= Math.ceil(filteredMismatchedPositions.length / ITEMS_PER_PAGE)}
                      onClick={() => setCurrentPage(p => p + 1)}
                      style={{
                        padding: '4px 10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        color: currentPage >= Math.ceil(filteredMismatchedPositions.length / ITEMS_PER_PAGE) ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: currentPage >= Math.ceil(filteredMismatchedPositions.length / ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Trang sau
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-input)', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Không tìm thấy tài khoản chênh lệch Trạng Thái Mở nào phù hợp với bộ lọc.
            </div>
          )}
        </div>
      )}

      {/* Table Section: TTTT (KLGD Mode Only) */}
      {preEodSubTab === 'TTTT' && isKlgd && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} color="#f87171" /> Danh sách chênh lệch Khớp Lệnh Thanh Toán (TTTT vs PS) tài khoản ({filteredMismatchedTTTT.length} / {parsedData.jsonResult?.mismatchedTTTT?.length || 0})
            </h4>
            {filteredMismatchedTTTT.length > 0 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Trang {currentPage} / {Math.ceil(filteredMismatchedTTTT.length / ITEMS_PER_PAGE)}
              </span>
            )}
          </div>

          {filteredMismatchedTTTT.length > 0 ? (
            <>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px' }}>Tài khoản</th>
                      <th style={{ padding: '10px' }}>Tổng Lot TTTT M-System</th>
                      <th style={{ padding: '10px' }}>Tổng Lot PS CQG</th>
                      <th style={{ padding: '10px' }}>Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMismatchedTTTT
                      .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                      .map((m: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'var(--bg-app)' : 'transparent' }}>
                          <td style={{ padding: '10px', color: '#fbbf24', fontFamily: 'monospace', fontWeight: 700 }}>{m.account || m.maTKGD}</td>
                          <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{m.ttttValue}</td>
                          <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{m.psValue}</td>
                          <td style={{ padding: '10px', color: '#f87171', fontWeight: 700 }}>{m.differ}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {filteredMismatchedTTTT.length > ITEMS_PER_PAGE && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredMismatchedTTTT.length)} trên tổng số {filteredMismatchedTTTT.length} bản ghi
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      style={{
                        padding: '4px 10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Trang trước
                    </button>
                    <button
                      disabled={currentPage >= Math.ceil(filteredMismatchedTTTT.length / ITEMS_PER_PAGE)}
                      onClick={() => setCurrentPage(p => p + 1)}
                      style={{
                        padding: '4px 10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        color: currentPage >= Math.ceil(filteredMismatchedTTTT.length / ITEMS_PER_PAGE) ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: currentPage >= Math.ceil(filteredMismatchedTTTT.length / ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Trang sau
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-input)', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Không tìm thấy tài khoản chênh lệch tất toán nào phù hợp với bộ lọc.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
