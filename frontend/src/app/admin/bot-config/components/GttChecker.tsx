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

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* File Upload Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GTT.xlsx Upload */}
        <div className="glass-panel p-5 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
              <FileText size={16} className="text-emerald-500" />
              File GTT.xlsx
            </h4>
            <p className="text-xs text-zinc-400 mb-4">
              Chứa danh sách các hợp đồng mở cần kiểm tra đối chiếu.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <input
              id="gtt-file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setGttFile(e.target.files?.[0] || null)}
              className="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
            />
            <button
              type="button"
              onClick={handleUploadGtt}
              disabled={!gttFile || uploadingGtt}
              className="btn btn-secondary w-full text-xs py-2 flex items-center justify-center gap-2"
            >
              <Upload size={12} />
              {uploadingGtt ? 'Đang upload...' : 'Upload GTT.xlsx'}
            </button>
          </div>
        </div>

        {/* market.csv Upload */}
        <div className="glass-panel p-5 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
              <Download size={16} className="text-amber-500" />
              File market.csv (Bảng Giá MS)
            </h4>
            <p className="text-xs text-zinc-400 mb-4">
              Tải trực tiếp bảng giá từ M-System hoặc tải lên file thủ công.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 mb-2">
              <input
                type="checkbox"
                checked={downloadMarketCsv}
                onChange={(e) => setDownloadMarketCsv(e.target.checked)}
                className="rounded border-zinc-800 text-emerald-500 bg-zinc-950"
              />
              Bot tự động tải từ M-System
            </label>
            {!downloadMarketCsv && (
              <div className="flex flex-col gap-2">
                <input
                  id="market-csv-input"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setMarketCsvFile(e.target.files?.[0] || null)}
                  className="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
                />
                <button
                  type="button"
                  onClick={handleUploadMarketCsv}
                  disabled={!marketCsvFile || uploadingMarketCsv}
                  className="btn btn-secondary w-full text-xs py-2 flex items-center justify-center gap-2"
                >
                  <Upload size={12} />
                  {uploadingMarketCsv ? 'Đang upload...' : 'Upload market.csv'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* hang_hoa.xlsx Upload */}
        <div className="glass-panel p-5 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
              <Settings size={16} className="text-sky-500" />
              File Hàng Hóa (hang_hoa.xlsx)
            </h4>
            <p className="text-xs text-zinc-400 mb-4">
              Cung cấp bước giá tối thiểu (Tick Size) của từng mặt hàng.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <input
              id="commodity-file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setCommodityFile(e.target.files?.[0] || null)}
              className="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
            />
            <button
              type="button"
              onClick={handleUploadCommodity}
              disabled={!commodityFile || uploadingCommodity}
              className="btn btn-secondary w-full text-xs py-2 flex items-center justify-center gap-2"
            >
              <Upload size={12} />
              {uploadingCommodity ? 'Đang upload...' : 'Upload file hàng hóa'}
            </button>
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="flex justify-between items-center gap-4 flex-wrap bg-zinc-900/20 border border-zinc-800/80 p-4 rounded-lg">
        <div>
          <h4 className="text-sm font-bold text-white">Chạy quy trình so khớp giá GTT</h4>
          <p className="text-xs text-zinc-400">Tự động đối chiếu thông tin GTT giữa M-System và CQG.</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleLoadGttReport}
            disabled={loadingGttReport}
            className="btn btn-secondary flex items-center gap-2 text-xs"
          >
            <RefreshCw size={14} className={loadingGttReport ? 'animate-spin' : ''} />
            Báo cáo gần nhất
          </button>
          <button
            type="button"
            onClick={handleRunGttCheck}
            disabled={runningGttCheck || uploadingGtt || uploadingMarketCsv}
            className="btn btn-primary flex items-center gap-2 text-xs font-bold"
          >
            <Play size={14} className={runningGttCheck ? 'animate-pulse' : ''} />
            {runningGttCheck ? 'Đang chạy pipeline...' : 'Bắt đầu kiểm tra GTT'}
          </button>
        </div>
      </div>

      {/* Report results display */}
      {gttReport ? (
        <div className="glass-panel p-6 flex flex-col gap-6">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-4 flex-wrap gap-3">
            <div>
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <BarChart2 size={18} className="text-sky-500" />
                Kết quả đối chiếu giá GTT
                <span className="text-xs font-normal text-zinc-500">
                  ({new Date(gttReport.runAt).toLocaleString('vi-VN')})
                </span>
              </h3>
            </div>
            {/* Status Summary badges */}
            <div className="flex gap-2 flex-wrap text-[10px] font-semibold">
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                Khớp: {gttReport.matched}
              </span>
              {gttReport.diffCount > 0 && (
                <>
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full">
                    Lệch ít: {gttReport.rows.filter((r: any) => r.status === 'DIFF' && (r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length}
                  </span>
                  <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full">
                    Lệch nhiều: {gttReport.rows.filter((r: any) => r.status === 'DIFF' && !(r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length}
                  </span>
                </>
              )}
              {(gttReport.msOnlyCount + gttReport.cqgOnlyCount) > 0 && (
                <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-full">
                  Chỉ có 1 bên: {gttReport.msOnlyCount + gttReport.cqgOnlyCount}
                </span>
              )}
            </div>
          </div>

          {/* Action on discrepancies */}
          {gttReport.diffCount > 0 && (
            <div className="bg-red-500/5 border border-red-500/15 p-4 rounded-lg flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-400 shrink-0" size={18} />
                <span className="text-xs text-red-200">
                  Phát hiện {gttReport.rows.filter((r: any) => r.status === 'DIFF' && !(r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length} hợp đồng bị lệch nhiều. Chọn hành động:
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handlePushToMSystem}
                  disabled={pushingToMs}
                  className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs px-3 py-1.5 rounded font-bold transition"
                >
                  {pushingToMs ? 'Đang đẩy...' : 'Đẩy trực tiếp lên M-System'}
                </button>
                <button
                  onClick={() => handleDownloadCorrection('settlement')}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs px-3 py-1.5 rounded font-medium transition"
                >
                  Tải file sửa GTT (.xlsx)
                </button>
                <button
                  onClick={() => handleDownloadCorrection('first_match')}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs px-3 py-1.5 rounded font-medium transition"
                >
                  Tải file sửa Giá Khớp Đầu
                </button>
              </div>
            </div>
          )}

          {/* Preview CSV block */}
          {gttCsvContent && (
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <FileText size={14} className="text-sky-400" />
                  Xem trước tệp sửa giá (CSV - Chỉ các hợp đồng lệch nhiều)
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(gttCsvContent);
                    toast.success('Đã copy nội dung CSV!');
                  }}
                  className="text-xs text-sky-400 hover:underline"
                >
                  Copy CSV
                </button>
              </div>
              <pre className="text-xs font-mono bg-black/60 p-3 rounded text-sky-500 overflow-x-auto max-h-40 border border-zinc-900">
                {gttCsvContent}
              </pre>
            </div>
          )}

          {/* Filters Tab */}
          <div className="flex gap-2 flex-wrap border-b border-zinc-800/40 pb-3 text-xs">
            {[
              { id: 'ALL', label: `Tất cả (${gttReport.rows.length})`, color: 'bg-zinc-800 text-zinc-300' },
              { id: 'DIFF', label: `Tổng chênh lệch (${gttReport.rows.filter((r: any) => r.status === 'DIFF').length})`, color: 'bg-zinc-800 text-zinc-300' },
              { id: 'DIFF_MINOR', label: `Lệch ít (${gttReport.rows.filter((r: any) => r.status === 'DIFF' && (r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length})`, color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
              { id: 'DIFF_MAJOR', label: `Lệch nhiều (${gttReport.rows.filter((r: any) => r.status === 'DIFF' && !(r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length})`, color: 'bg-red-500/10 text-red-400 border border-red-500/20' },
              { id: 'MATCH', label: `Khớp (${gttReport.rows.filter((r: any) => r.status === 'MATCH').length})`, color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
              { id: 'MISSING', label: `Thiếu/1 bên (${gttReport.rows.filter((r: any) => r.status === 'MS_ONLY' || r.status === 'CQG_ONLY').length})`, color: 'bg-sky-500/10 text-sky-400 border border-sky-500/20' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGttFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-md font-semibold transition ${
                  gttFilter === tab.id
                    ? 'bg-emerald-500 text-white font-bold'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-900/40 border-b border-zinc-800 text-zinc-400 font-semibold">
                  <th className="p-3">Mã HĐ</th>
                  <th className="p-3 text-right">GTT M-System</th>
                  <th className="p-3 text-right">GTT CQG</th>
                  <th className="p-3 text-right">Bước giá</th>
                  <th className="p-3 text-right">Chênh lệch</th>
                  <th className="p-3 text-center">Trạng thái</th>
                  <th className="p-3">Ghi chú</th>
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
                        className={`border-b border-zinc-900 transition hover:bg-zinc-900/25 ${
                          idx % 2 === 0 ? 'bg-transparent' : 'bg-zinc-900/10'
                        }`}
                      >
                        <td className="p-3 font-mono font-bold text-white">{row.symbol}</td>
                        <td className="p-3 text-right font-mono text-zinc-300">
                          {row.gttMs !== null ? row.gttMs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                        </td>
                        <td className="p-3 text-right font-mono text-zinc-300">
                          {row.gttCqg !== null ? row.gttCqg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                        </td>
                        <td className="p-3 text-right font-mono text-zinc-500">
                          {row.tickSize !== undefined && row.tickSize !== null ? row.tickSize.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 }) : '0.05'}
                        </td>
                        <td className={`p-3 text-right font-mono font-bold ${
                          row.diff && Math.abs(row.diff) > 0 ? (isMinorDiff ? 'text-amber-400' : 'text-red-400') : 'text-zinc-500'
                        }`}>
                          {row.diff !== null ? row.diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                        </td>
                        <td className="p-3 text-center">
                          {row.status === 'MATCH' && <span className="text-emerald-400 font-semibold text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/10">✅ Khợp</span>}
                          {row.status === 'DIFF' && (
                            <span className={`${isMinorDiff ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10'} font-semibold text-[10px] px-2 py-0.5 rounded border border-zinc-800`}>
                              {isMinorDiff ? '⚠️ Lệch ít' : '🚨 Lệch nhiều'}
                            </span>
                          )}
                          {row.status === 'MS_ONLY' && <span className="text-amber-400 font-semibold text-[10px] bg-amber-500/10 px-2 py-0.5 rounded border border-zinc-800">📋 Chỉ có MS</span>}
                          {row.status === 'CQG_ONLY' && <span className="text-sky-400 font-semibold text-[10px] bg-sky-500/10 px-2 py-0.5 rounded border border-zinc-800">📊 Chỉ có CQG</span>}
                          {row.status === 'NO_PRICE' && <span className="text-zinc-500 text-[10px]">❓ Không có giá</span>}
                        </td>
                        <td className="p-3 text-zinc-400 text-[11px]">
                          {row.status === 'MATCH' && <span>Khớp hoàn toàn.</span>}
                          {row.status === 'DIFF' && (
                            isMinorDiff ? (
                              <span className="text-amber-400/90">Lệch nhỏ hơn hoặc bằng bước giá tối thiểu ({row.tickSize ?? 0.05}). Chênh lệch do làm tròn.</span>
                            ) : (
                              <span className="text-red-400/90">Lệch lớn hơn bước giá tối thiểu. Cần đẩy sửa giá!</span>
                            )
                          )}
                          {row.status === 'MS_ONLY' && <span className="text-amber-400/80">Chỉ có trên MS. Kiểm tra xem hợp đồng đã hoạt động bên CQG chưa.</span>}
                          {row.status === 'CQG_ONLY' && <span className="text-sky-400/80">Chỉ có trên CQG. Kiểm tra cấu hình hợp đồng trên MS.</span>}
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
        <div className="glass-panel p-8 text-center text-zinc-500">
          Chưa có báo cáo đối chiếu GTT nào khả dụng. Hãy nhấn "Bắt đầu kiểm tra GTT" để thực hiện.
        </div>
      )}
    </div>
  );
}
