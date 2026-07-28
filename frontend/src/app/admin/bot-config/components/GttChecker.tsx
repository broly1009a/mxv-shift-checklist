'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Upload,
  Download,
  Play,
  RefreshCw,
  BarChart2,
  FileText,
  AlertTriangle,
  Settings,
} from 'lucide-react';

interface GttCheckerProps {
  token: string;
  apiBaseUrl: string;
}

export default function GttChecker({ token, apiBaseUrl }: GttCheckerProps) {
  // File uploads state
  const [gttFile, setGttFile] = useState<File | null>(null);
  const [marketCsvFile, setMarketCsvFile] = useState<File | null>(null);
  const [commodityFile, setCommodityFile] = useState<File | null>(null);

  const [uploadingGtt, setUploadingGtt] = useState(false);
  const [uploadingMarketCsv, setUploadingMarketCsv] = useState(false);
  const [uploadingCommodity, setUploadingCommodity] = useState(false);
  const [downloadMarketCsv, setDownloadMarketCsv] = useState(true);

  // GTT results report state
  const [gttReport, setGttReport] = useState<any>(null);
  const [loadingGttReport, setLoadingGttReport] = useState(false);
  const [runningGttCheck, setRunningGttCheck] = useState(false);
  const [gttFilter, setGttFilter] = useState<'ALL' | 'DIFF' | 'DIFF_MINOR' | 'DIFF_MAJOR' | 'MATCH' | 'MISSING'>('ALL');
  const [pushingToMs, setPushingToMs] = useState(false);

  // Load existing GTT report
  const handleLoadGttReport = async () => {
    if (!token) return;
    setLoadingGttReport(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/gtt-report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGttReport(data.report);
      } else {
        toast.error(data.message || 'Chưa có báo cáo GTT');
      }
    } catch (err: any) {
      toast.error('Lỗi tải báo cáo GTT');
    } finally {
      setLoadingGttReport(false);
    }
  };

  useEffect(() => {
    handleLoadGttReport();
  }, [token]);

  // Upload GTT.xlsx
  const handleUploadGtt = async () => {
    if (!token || !gttFile) return;
    setUploadingGtt(true);
    const toastId = toast.loading('Đang tải lên file GTT.xlsx...');
    try {
      const buffer = await gttFile.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/gtt-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base64, filename: gttFile.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload thất bại');
      toast.success('Upload GTT.xlsx thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi upload', { id: toastId });
    } finally {
      setUploadingGtt(false);
    }
  };

  // Upload market.csv
  const handleUploadMarketCsv = async () => {
    if (!token || !marketCsvFile) return;
    setUploadingMarketCsv(true);
    const toastId = toast.loading('Đang tải lên file market.csv...');
    try {
      const buffer = await marketCsvFile.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/market-csv-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base64, filename: marketCsvFile.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload thất bại');
      toast.success('Upload market.csv thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi upload', { id: toastId });
    } finally {
      setUploadingMarketCsv(false);
    }
  };

  // Upload hang_hoa.xlsx
  const handleUploadCommodity = async () => {
    if (!token || !commodityFile) return;
    setUploadingCommodity(true);
    const toastId = toast.loading('Đang tải lên file hàng hóa...');
    try {
      const buffer = await commodityFile.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/commodity-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base64, filename: commodityFile.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload thất bại');
      toast.success('Upload file hàng hóa thành công!', { id: toastId });
      handleLoadGttReport();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi upload', { id: toastId });
    } finally {
      setUploadingCommodity(false);
    }
  };

  // Run GTT Check Pipeline
  const handleRunGttCheck = async () => {
    if (!token) return;
    setRunningGttCheck(true);
    const toastId = toast.loading('Đang chạy pipeline kiểm tra GTT... (có thể mất 2-3 phút)');
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/run-gtt-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ downloadMarketCsv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Kiểm tra GTT thất bại');
      setGttReport(data.report);
      const { matched, diffCount, msOnlyCount, cqgOnlyCount } = data.report;
      toast.success(`GTT Check hoàn tất! ✅ ${matched} khớp, ⚠️ ${diffCount} chênh lệch, ${msOnlyCount + cqgOnlyCount} thiếu`, { id: toastId, duration: 8000 });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kiểm tra GTT', { id: toastId });
    } finally {
      setRunningGttCheck(false);
    }
  };

  // Push corrections directly to M-System
  const handlePushToMSystem = async () => {
    if (!token) return;
    if (!window.confirm('Bạn có chắc chắn muốn đẩy trực tiếp giá sửa đổi của các hợp đồng lệch nhiều lên M-System không?')) {
      return;
    }
    setPushingToMs(true);
    const toastId = toast.loading('Đang gửi yêu cầu cập nhật giá lên M-System...');
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/gtt-report/push-to-ms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Lỗi không rõ từ M-System');
      }
      toast.success(data.message || 'Cập nhật giá lên M-System thành công!', { id: toastId, duration: 5000 });
    } catch (err: any) {
      toast.error(err.message || 'Gửi yêu cầu cập nhật giá thất bại', { id: toastId, duration: 6000 });
    } finally {
      setPushingToMs(false);
    }
  };

  // Download correction files
  const handleDownloadCorrection = async (type: 'settlement' | 'first_match') => {
    if (!token) return;
    const toastId = toast.loading('Đang khởi tạo file sửa giá...');
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/gtt-report/export-correction?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorText = await res.json().catch(() => ({ message: 'Không thể xuất file' }));
        throw new Error(errorText.message || 'Xuất file thất bại');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sua-gia-${type === 'settlement' ? 'gtt' : 'first-match'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Tải xuống file sửa giá thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tải xuống file sửa giá', { id: toastId });
    }
  };

  // Pre-calculate GTT CSV preview content
  let gttCsvContent = '';
  if (gttReport && gttReport.diffCount > 0) {
    const majorDiffRows = gttReport.rows.filter(
      (r: any) => r.status === 'DIFF' && !(r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))
    );
    if (majorDiffRows.length > 0) {
      const csvHeaders = 'contractCode,settlePrice';
      const csvRows = majorDiffRows.map((r: any) => `${r.symbol},${r.gttCqg}`);
      gttCsvContent = [csvHeaders, ...csvRows].join('\n');
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    display: 'block',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
      {/* File Upload Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* GTT.xlsx Upload */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px 0' }}>
              <FileText size={16} color="#10b981" />
              File GTT.xlsx
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              Chứa danh sách các hợp đồng mở cần kiểm tra đối chiếu.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              id="gtt-file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setGttFile(e.target.files?.[0] || null)}
              style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
            />
            <button
              type="button"
              onClick={handleUploadGtt}
              disabled={!gttFile || uploadingGtt}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '8px 14px', width: '100%' }}
            >
              <Upload size={13} />
              {uploadingGtt ? 'Đang upload...' : 'Upload GTT.xlsx'}
            </button>
          </div>
        </div>

        {/* market.csv Upload */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px 0' }}>
              <Download size={16} color="#f59e0b" />
              File market.csv (Bảng Giá MS)
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              Tải trực tiếp bảng giá từ M-System hoặc tải lên file thủ công.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={downloadMarketCsv}
                onChange={(e) => setDownloadMarketCsv(e.target.checked)}
                style={{ accentColor: '#10b981' }}
              />
              Bot tự động tải từ M-System
            </label>
            {!downloadMarketCsv && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  id="market-csv-input"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setMarketCsvFile(e.target.files?.[0] || null)}
                  style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                />
                <button
                  type="button"
                  onClick={handleUploadMarketCsv}
                  disabled={!marketCsvFile || uploadingMarketCsv}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '8px 14px', width: '100%' }}
                >
                  <Upload size={13} />
                  {uploadingMarketCsv ? 'Đang upload...' : 'Upload market.csv'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* hang_hoa.xlsx Upload */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px 0' }}>
              <Settings size={16} color="#0284c7" />
              File Hàng Hóa (hang_hoa.xlsx)
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              Cung cấp bước giá tối thiểu (Tick Size) của từng mặt hàng.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              id="commodity-file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setCommodityFile(e.target.files?.[0] || null)}
              style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
            />
            <button
              type="button"
              onClick={handleUploadCommodity}
              disabled={!commodityFile || uploadingCommodity}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '8px 14px', width: '100%' }}
            >
              <Upload size={13} />
              {uploadingCommodity ? 'Đang upload...' : 'Upload file hàng hóa'}
            </button>
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>
            Chạy quy trình so khớp giá GTT
          </h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            Tự động đối chiếu thông tin GTT giữa M-System và CQG.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleLoadGttReport}
            disabled={loadingGttReport}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '8px 14px' }}
          >
            <RefreshCw size={14} className={loadingGttReport ? 'animate-spin' : ''} />
            Báo cáo gần nhất
          </button>
          <button
            type="button"
            onClick={handleRunGttCheck}
            disabled={runningGttCheck || uploadingGtt || uploadingMarketCsv}
            className="btn btn-primary"
            style={{ fontSize: '0.75rem', padding: '8px 18px', fontWeight: 700 }}
          >
            <Play size={14} className={runningGttCheck ? 'animate-pulse' : ''} />
            {runningGttCheck ? 'Đang chạy pipeline...' : 'Bắt đầu kiểm tra GTT'}
          </button>
        </div>
      </div>

      {/* Report results display */}
      {gttReport ? (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <BarChart2 size={18} color="#0284c7" />
                Kết quả đối chiếu giá GTT
                <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                  ({new Date(gttReport.runAt).toLocaleString('vi-VN')})
                </span>
              </h3>
            </div>

            {/* Status Summary badges */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.7rem', fontWeight: 700 }}>
              <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 10px', borderRadius: '20px' }}>
                Khớp: {gttReport.matched}
              </span>
              {gttReport.diffCount > 0 && (
                <>
                  <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '4px 10px', borderRadius: '20px' }}>
                    Lệch ít: {gttReport.rows.filter((r: any) => r.status === 'DIFF' && (r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length}
                  </span>
                  <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 10px', borderRadius: '20px' }}>
                    Lệch nhiều: {gttReport.rows.filter((r: any) => r.status === 'DIFF' && !(r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length}
                  </span>
                </>
              )}
              {(gttReport.msOnlyCount + gttReport.cqgOnlyCount) > 0 && (
                <span style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '4px 10px', borderRadius: '20px' }}>
                  Chỉ có 1 bên: {gttReport.msOnlyCount + gttReport.cqgOnlyCount}
                </span>
              )}
            </div>
          </div>

          {/* Action on discrepancies */}
          {gttReport.diffCount > 0 && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '14px 18px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle style={{ color: '#ef4444', flexShrink: 0 }} size={18} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Phát hiện {gttReport.rows.filter((r: any) => r.status === 'DIFF' && !(r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length} hợp đồng bị lệch nhiều. Chọn hành động:
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={handlePushToMSystem}
                  disabled={pushingToMs}
                  style={{
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    color: '#0284c7',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    fontSize: '0.75rem',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {pushingToMs ? 'Đang đẩy...' : 'Đẩy trực tiếp lên M-System'}
                </button>
                <button
                  onClick={() => handleDownloadCorrection('settlement')}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                >
                  Tải file sửa GTT (.xlsx)
                </button>
                <button
                  onClick={() => handleDownloadCorrection('first_match')}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                >
                  Tải file sửa Giá Khớp Đầu
                </button>
              </div>
            </div>
          )}

          {/* Preview CSV block */}
          {gttCsvContent && (
            <div style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              padding: '14px',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} color="#0284c7" />
                  Xem trước tệp sửa giá (CSV - Chỉ các hợp đồng lệch nhiều)
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(gttCsvContent);
                    toast.success('Đã copy nội dung CSV!');
                  }}
                  style={{ fontSize: '0.75rem', color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  Copy CSV
                </button>
              </div>
              <pre style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-primary)',
                padding: '12px 14px',
                borderRadius: '6px',
                overflowX: 'auto',
                maxHeight: '160px',
                margin: 0,
                border: '1px solid var(--border-color)',
              }}>
                {gttCsvContent}
              </pre>
            </div>
          )}

          {/* Filters Tab */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', fontSize: '0.75rem' }}>
            {[
              { id: 'ALL', label: `Tất cả (${gttReport.rows.length})` },
              { id: 'DIFF', label: `Tổng chênh lệch (${gttReport.rows.filter((r: any) => r.status === 'DIFF').length})` },
              { id: 'DIFF_MINOR', label: `Lệch ít (${gttReport.rows.filter((r: any) => r.status === 'DIFF' && (r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length})` },
              { id: 'DIFF_MAJOR', label: `Lệch nhiều (${gttReport.rows.filter((r: any) => r.status === 'DIFF' && !(r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length})` },
              { id: 'MATCH', label: `Khớp (${gttReport.rows.filter((r: any) => r.status === 'MATCH').length})` },
              { id: 'MISSING', label: `Thiếu/1 bên (${gttReport.rows.filter((r: any) => r.status === 'MS_ONLY' || r.status === 'CQG_ONLY').length})` },
            ].map((tab) => {
              const isSelected = gttFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setGttFilter(tab.id as any)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    border: isSelected ? '1px solid #10b981' : '1px solid var(--border-color)',
                    backgroundColor: isSelected ? '#10b981' : 'var(--bg-input)',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Results Table */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <table style={{ width: '100%', textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  <th style={{ padding: '12px 14px' }}>Mã HĐ</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>GTT M-System</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>GTT CQG</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Bước giá</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Chênh lệch</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Trạng thái</th>
                  <th style={{ padding: '12px 14px' }}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {gttReport.rows
                  .filter((row: any) => {
                    if (gttFilter === 'ALL') return true;
                    if (gttFilter === 'DIFF') return row.status === 'DIFF';
                    if (gttFilter === 'DIFF_MINOR') return row.status === 'DIFF' && (row.isMinorDiff ?? (row.diff !== null && Math.abs(row.diff) <= (row.tickSize ?? 0.05)));
                    if (gttFilter === 'DIFF_MAJOR') return row.status === 'DIFF' && !(row.isMinorDiff ?? (row.diff !== null && Math.abs(row.diff) <= (row.tickSize ?? 0.05)));
                    if (gttFilter === 'MATCH') return row.status === 'MATCH';
                    if (gttFilter === 'MISSING') return row.status === 'MS_ONLY' || row.status === 'CQG_ONLY';
                    return true;
                  })
                  .map((row: any, idx: number) => {
                    const isMinorDiff = row.isMinorDiff ?? (row.diff !== null && Math.abs(row.diff) <= (row.tickSize ?? 0.05));
                    return (
                      <tr
                        key={row.symbol}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.02)',
                        }}
                      >
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>{row.symbol}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                          {row.gttMs !== null ? row.gttMs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                          {row.gttCqg !== null ? row.gttCqg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {row.tickSize !== undefined && row.tickSize !== null ? row.tickSize.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 }) : '0.05'}
                        </td>
                        <td style={{
                          padding: '12px 14px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: row.diff && Math.abs(row.diff) > 0 ? (isMinorDiff ? '#d97706' : '#dc2626') : 'var(--text-muted)',
                        }}>
                          {row.diff !== null ? row.diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {row.status === 'MATCH' && (
                            <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.65rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                              Khớp
                            </span>
                          )}
                          {row.status === 'DIFF' && (
                            <span style={{
                              color: isMinorDiff ? '#d97706' : '#dc2626',
                              fontWeight: 700,
                              fontSize: '0.65rem',
                              backgroundColor: isMinorDiff ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: isMinorDiff ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                            }}>
                              {isMinorDiff ? 'Lệch ít' : 'Lệch nhiều'}
                            </span>
                          )}
                          {row.status === 'MS_ONLY' && (
                            <span style={{ color: '#d97706', fontWeight: 700, fontSize: '0.65rem', backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                              Chỉ có MS
                            </span>
                          )}
                          {row.status === 'CQG_ONLY' && (
                            <span style={{ color: '#0284c7', fontWeight: 700, fontSize: '0.65rem', backgroundColor: 'rgba(56, 189, 248, 0.15)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                              Chỉ có CQG
                            </span>
                          )}
                          {row.status === 'NO_PRICE' && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Không có giá</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                          {row.status === 'MATCH' && <span>Khớp hoàn toàn.</span>}
                          {row.status === 'DIFF' && (
                            isMinorDiff ? (
                              <span style={{ color: '#d97706', fontWeight: 500 }}>Lệch nhỏ hơn hoặc bằng bước giá tối thiểu ({row.tickSize ?? 0.05}). Chênh lệch do làm tròn.</span>
                            ) : (
                              <span style={{ color: '#dc2626', fontWeight: 600 }}>Lệch lớn hơn bước giá tối thiểu. Cần đẩy sửa giá!</span>
                            )
                          )}
                          {row.status === 'MS_ONLY' && <span style={{ color: '#d97706' }}>Chỉ có trên MS. Kiểm tra xem hợp đồng đã hoạt động bên CQG chưa.</span>}
                          {row.status === 'CQG_ONLY' && <span style={{ color: '#0284c7' }}>Chỉ có trên CQG. Kiểm tra cấu hình hợp đồng trên MS.</span>}
                          {row.status === 'NO_PRICE' && <span>Không tìm thấy giá ở cả 2 bên.</span>}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Chưa có báo cáo đối chiếu GTT nào khả dụng. Hãy nhấn "Bắt đầu kiểm tra GTT" để thực hiện.
        </div>
      )}
    </div>
  );
}
