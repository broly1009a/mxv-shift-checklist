import React, { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Search, Copy, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { MismatchedTrade, ParsedBotData } from './types';

interface PreEodReconciliationVisualReportProps {
  parsedData: ParsedBotData;
  activeStatus: string;
}

const ITEMS_PER_PAGE = 50;

export const PreEodReconciliationVisualReport: React.FC<PreEodReconciliationVisualReportProps> = ({ parsedData, activeStatus }) => {
  const [preEodSubTab, setPreEodSubTab] = useState<'TRADES' | 'POSITIONS'>('TRADES');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const preEodMismatchedTradesCount = parsedData.jsonResult?.mismatchedTrades?.length ?? 0;
  const preEodMismatchedPositionsCount = (parsedData.jsonResult?.mismatchedPositions || parsedData.jsonResult?.mismatchedTTM)?.length ?? 0;

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

  if (activeStatus === 'PENDING' || activeStatus === 'PROCESSING' || activeStatus === 'AWAITING_CAPTCHA') {
    return (
      <div style={{
        padding: '30px',
        textAlign: 'center',
        background: 'var(--bg-input)',
        border: '1px dashed var(--border-color)',
        borderRadius: '12px',
        color: 'var(--text-muted)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        margin: '20px 0'
      }}>
        <Clock 
          size={28} 
          className="animate-pulse" 
          style={{ 
            color: activeStatus === 'PROCESSING' 
              ? '#60a5fa' 
              : activeStatus === 'AWAITING_CAPTCHA' 
              ? '#f59e0b' 
              : '#9ca3af' 
          }} 
        />
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {activeStatus === 'PROCESSING' 
            ? 'Tác vụ đang chạy đối chiếu...' 
            : activeStatus === 'AWAITING_CAPTCHA'
            ? 'Tác vụ đang chờ nhập mã Captcha...'
            : 'Tác vụ đang xếp hàng chờ chạy...'}
        </h4>
        <p style={{ fontSize: '0.78rem', maxWidth: '400px', margin: 0, lineHeight: 1.4 }}>
          {activeStatus === 'PROCESSING' 
            ? 'Bot đang thực hiện tải file và tính toán đối chiếu dữ liệu. Báo cáo trực quan sẽ hiển thị đầy đủ ngay sau khi tác vụ hoàn tất.'
            : activeStatus === 'AWAITING_CAPTCHA'
            ? 'Vui lòng gõ mã Captcha trong thông báo phía trên để Bot có thể tiếp tục tự động đăng nhập và tải dữ liệu báo cáo.'
            : 'Hàng đợi đang bận xử lý tác vụ khác. Bot sẽ tự động thực hiện đối chiếu này ngay khi đến lượt.'}
        </p>
      </div>
    );
  }

  if (activeStatus === 'FAILED' && !parsedData.jsonResult) {
    return (
      <div style={{
        padding: '30px',
        textAlign: 'center',
        background: 'rgba(239, 68, 68, 0.02)',
        border: '1px dashed rgba(239, 68, 68, 0.25)',
        borderRadius: '12px',
        color: 'var(--text-muted)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        margin: '20px 0'
      }}>
        <AlertCircle size={28} style={{ color: '#ef4444' }} />
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f87171', margin: 0 }}>
          Tác vụ thất bại do lỗi kỹ thuật
        </h4>
        <p style={{ fontSize: '0.78rem', maxWidth: '450px', margin: 0, lineHeight: 1.4, color: 'var(--text-secondary)' }}>
          Hệ thống gặp sự cố khi đang tải file hoặc đăng nhập (ví dụ: lỗi Captcha, hết hạn quota Gemini, thiếu file nguồn...).
          Vui lòng bấm vào tab <strong>"Log chi tiết (Raw Logs)"</strong> ở phía trên để kiểm tra nguyên nhân cụ thể.
        </p>
      </div>
    );
  }

  const handleExportFiltered = () => {
    let content = '';
    if (preEodSubTab === 'TRADES') {
      content = 'Nguồn\tMã TKGD\tHợp đồng\tGiá\tSố lượng\tLý do lệch\n' +
        filteredMismatchedTrades.map(t => `${t.source}\t${t.maTKGD}\t${t.maHD}\t${t.giaKhop}\t${t.klGiaoDich}\t${t.reason}`).join('\n');
    } else {
      content = 'Tài khoản\tHợp đồng\tVị thế MS\tVị thế CQG\tChênh lệch\n' +
        filteredMismatchedPositions.map(p => `${p.account || p.maTKGD}\t${p.symbol || ''}\t${p.msPosition ?? p.ttmValue}\t${p.cqgPosition ?? p.opValue}\t${p.differ}`).join('\n');
    }
    navigator.clipboard.writeText(content);
    toast.success('Đã sao chép danh sách lọc!');
  };

  const totals = parsedData.jsonResult?.totals || {};
  const isWaitingFiles = parsedData.jsonResult?.isWaitingFiles;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Status Summary Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
        {isWaitingFiles ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24' }}>
            <AlertCircle size={18} /> Trạng Thái: Đang chờ tệp đối chiếu từ CQG/Straits
          </span>
        ) : parsedData.jsonResult?.passed ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399' }}>
            <CheckCircle2 size={18} /> Kết Quả: Dữ liệu khớp hoàn toàn
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}>
            <AlertCircle size={18} /> Kết Quả: Phát hiện chênh lệch dữ liệu
          </span>
        )}
      </div>

      {isWaitingFiles && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(251, 191, 36, 0.08)',
          border: '1px solid rgba(251, 191, 36, 0.25)',
          borderRadius: '8px',
          color: '#fbbf24',
          fontSize: '0.82rem',
          fontWeight: 600,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
            <AlertCircle size={16} /> Đang chờ dữ liệu đầu vào:
          </div>
          <div style={{ fontWeight: 500, fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
            {parsedData.jsonResult?.message || 'Thư mục backup đang chờ cập nhật đầy đủ file đối chiếu.'}
          </div>
        </div>
      )}

      {/* PRE_EOD Dashboard View (Đầu phiên / Pre-EOD 3-way check) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div style={{ padding: '14px 16px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>TỰ DOANH (MS vs Straits)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {totals.totalACM_MS ?? 0} vs {totals.totalACM_Straits ?? 0} lot
          </div>
          <div style={{ fontSize: '0.72rem', color: (totals.differACM ?? 0) > 0 ? '#f87171' : '#34d399', fontWeight: 700, marginTop: '4px' }}>
            Chênh lệch: {totals.differACM ?? 0} lot
          </div>
        </div>

        <div style={{ padding: '14px 16px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>LỆNH THƯỜNG (MS vs CQG)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {totals.totalCQG_MS ?? 0} vs {totals.totalCQG_FR ?? 0} lot
          </div>
          <div style={{ fontSize: '0.72rem', color: (totals.differCQG ?? 0) > 0 ? '#f87171' : '#34d399', fontWeight: 700, marginTop: '4px' }}>
            Chênh lệch: {totals.differCQG ?? 0} lot
          </div>
        </div>

        <div style={{ 
          padding: '14px 16px', 
          background: preEodMismatchedTradesCount > 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)', 
          borderRadius: '10px', 
          border: preEodMismatchedTradesCount > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)' 
        }}>
          <div style={{ fontSize: '0.68rem', color: preEodMismatchedTradesCount > 0 ? '#f87171' : '#34d399', marginBottom: '4px', fontWeight: 600 }}>CHÊNH LỆCH CHI TIẾT</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: preEodMismatchedTradesCount > 0 ? '#f87171' : '#34d399' }}>
            {preEodMismatchedTradesCount} giao dịch
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Lệch khớp lệnh chi tiết
          </div>
        </div>

        <div style={{ 
          padding: '14px 16px', 
          background: preEodMismatchedPositionsCount > 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)', 
          borderRadius: '10px', 
          border: preEodMismatchedPositionsCount > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)' 
        }}>
          <div style={{ fontSize: '0.68rem', color: preEodMismatchedPositionsCount > 0 ? '#f87171' : '#34d399', marginBottom: '4px', fontWeight: 600 }}>LỆCH NET POSITION</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: preEodMismatchedPositionsCount > 0 ? '#f87171' : '#34d399' }}>
            {preEodMismatchedPositionsCount} tài khoản
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Vị thế ròng CQG vs M-System
          </div>
        </div>
      </div>

      {/* Subtab Buttons & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              setPreEodSubTab('TRADES');
              setCurrentPage(1);
            }}
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
            onClick={() => {
              setPreEodSubTab('POSITIONS');
              setCurrentPage(1);
            }}
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Lọc TK, Mã HĐ, Lý do..."
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
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem' }}
              >
                ✕
              </button>
            )}
          </div>

          {preEodSubTab === 'TRADES' && (
            <select
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value);
                setCurrentPage(1);
              }}
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

      {/* Table Section: POSITIONS */}
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
                      <th style={{ padding: '10px' }}>Hợp đồng</th>
                      <th style={{ padding: '10px' }}>Vị thế MS</th>
                      <th style={{ padding: '10px' }}>Vị thế CQG</th>
                      <th style={{ padding: '10px' }}>Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMismatchedPositions
                      .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                      .map((m: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'var(--bg-app)' : 'transparent' }}>
                          <td style={{ padding: '10px', color: '#fbbf24', fontFamily: 'monospace', fontWeight: 700 }}>{m.account || m.maTKGD}</td>
                          <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{m.symbol || 'All'}</td>
                          <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{m.msPosition ?? m.ttmValue ?? 0}</td>
                          <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{m.cqgPosition ?? m.opValue ?? 0}</td>
                          <td style={{ padding: '10px', color: '#f87171', fontWeight: 700 }}>{m.differ}</td>
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
    </div>
  );
};
