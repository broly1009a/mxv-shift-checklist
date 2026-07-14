'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Play,
  RefreshCw,
  Activity,
  Upload,
  FileText,
  Save,
} from 'lucide-react';

interface ReconciliationPanelProps {
  token: string;
  apiBaseUrl: string;
}

export default function ReconciliationPanel({ token, apiBaseUrl }: ReconciliationPanelProps) {
  // Reconciliation states
  const [reconSampleDates, setReconSampleDates] = useState<any[]>([]);
  const [reconSelectedPath, setReconSelectedPath] = useState('');
  const [reconUsdRate, setReconUsdRate] = useState(25220);
  const [reconRunning, setReconRunning] = useState(false);
  const [reconResult, setReconResult] = useState<any>(null);
  const [reconAutoRunning, setReconAutoRunning] = useState(false);
  const [reconAutoResult, setReconAutoResult] = useState<any>(null);
  const [reconTab, setReconTab] = useState<'sample' | 'upload'>('sample');

  const [manualFiles, setManualFiles] = useState<{
    dsgd?: File | null;
    fr1?: File | null;
    fr2?: File | null;
    nano?: File | null;
    ttm?: File | null;
    op1?: File | null;
    op2?: File | null;
    qltkgd?: File | null;
    eod?: File | null;
    tttt?: File | null;
    accountsBalances?: File | null;
  }>({});
  const [reconUploadRunning, setReconUploadRunning] = useState(false);

  // Load sample dates
  const handleLoadReconSampleDates = async () => {
    if (!token) return;
    const toastId = toast.loading('Đang tải danh sách ngày đối chiếu...');
    try {
      const res = await fetch(`${apiBaseUrl}/reconciliation/sample-dates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReconSampleDates(data.dates || []);
        if (data.dates?.length > 0) {
          setReconSelectedPath(data.dates[0].samplePath);
        }
        toast.success('Đã tải danh sách ngày mẫu thành công', { id: toastId });
      } else {
        toast.error(data.message || 'Không tải được danh sách ngày mẫu', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Lỗi tải danh sách ngày mẫu', { id: toastId });
    }
  };

  useEffect(() => {
    // Initial silent load
    fetch(`${apiBaseUrl}/reconciliation/sample-dates`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.dates?.length > 0) {
          setReconSampleDates(data.dates);
          setReconSelectedPath(data.dates[0].samplePath);
        }
      })
      .catch(console.error);
  }, [token]);

  // Run local test with sample path
  const handleRunReconTest = async () => {
    if (!token || !reconSelectedPath) return;
    setReconRunning(true);
    setReconResult(null);
    const toastId = toast.loading('Đang chạy kiểm thử đối chiếu từ file mẫu...');
    try {
      const res = await fetch(`${apiBaseUrl}/reconciliation/run-test-local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ samplePath: reconSelectedPath, usdRate: reconUsdRate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi chạy kiểm thử');
      setReconResult(data);
      const hasErrors = Object.keys(data.errors || {}).length > 0;
      if (data.success) {
        toast.success('Kiểm thử hoàn thành: Tất cả đối chiếu khớp!', { id: toastId, duration: 6000 });
      } else if (hasErrors) {
        toast.error(`Kiểm thử có lỗi: ${Object.values(data.errors || {}).join(', ')}`, { id: toastId, duration: 6000 });
      } else {
        toast('Kiểm thử hoàn thành: Phát hiện chênh lệch dữ liệu', { id: toastId, duration: 6000 });
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kiểm thử', { id: toastId });
    } finally {
      setReconRunning(false);
    }
  };

  // Run auto recon via Bot
  const handleRunAutoRecon = async () => {
    if (!token) return;
    setReconAutoRunning(true);
    setReconAutoResult(null);
    const toastId = toast.loading('Bot đang đăng nhập M-System và tải file đối chiếu... (2-5 phút)');
    try {
      const res = await fetch(`${apiBaseUrl}/reconciliation/run-auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ usdRate: reconUsdRate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Bot đối chiếu thất bại');
      setReconAutoResult(data);
      toast.success(data.message || 'Bot đối chiếu hoàn thành!', { id: toastId, duration: 6000 });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi bot đối chiếu', { id: toastId });
    } finally {
      setReconAutoRunning(false);
    }
  };

  // Run reconciliation from manual file upload
  const handleRunUploadReconTest = async () => {
    if (!token) return;

    const hasKlgd = !!manualFiles.dsgd;
    const hasEod = !!(manualFiles.qltkgd && manualFiles.eod && manualFiles.tttt);
    const hasCqg = !!(manualFiles.qltkgd && manualFiles.accountsBalances);

    if (!hasKlgd && !hasEod && !hasCqg) {
      toast.error('Vui lòng chọn tối thiểu file DSGD (cho KLGD), hoặc QLTKGD+EOD+TTTT (cho EOD), hoặc QLTKGD+Accounts_Balances (cho CQG).');
      return;
    }

    setReconUploadRunning(true);
    setReconResult(null);
    const toastId = toast.loading('Đang upload files và chạy đối chiếu...');

    try {
      const formData = new FormData();
      Object.entries(manualFiles).forEach(([key, file]) => {
        if (file) {
          formData.append(key, file);
        }
      });
      formData.append('usdRate', String(reconUsdRate));

      const res = await fetch(`${apiBaseUrl}/reconciliation/test-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi upload chạy đối chiếu');

      setReconResult(data);
      const hasErrors = Object.keys(data.errors || {}).length > 0;
      if (data.success) {
        toast.success('Đối chiếu thành công: Tất cả dữ liệu khớp!', { id: toastId, duration: 6000 });
      } else if (hasErrors) {
        toast.error(`Đối chiếu xong có lỗi: ${Object.values(data.errors || {}).join(', ')}`, { id: toastId, duration: 6000 });
      } else {
        toast('Đối chiếu hoàn thành: Phát hiện chênh lệch dữ liệu', { id: toastId, duration: 6000 });
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi đối chiếu', { id: toastId });
    } finally {
      setReconUploadRunning(false);
    }
  };

  // Pre-calculate stats
  let klgdStats: any[] = [];
  let eodStats: any[] = [];
  if (reconResult) {
    if (reconResult.results?.klgd) {
      klgdStats = [
        { label: 'Tổng MS', value: `${reconResult.results.klgd.totals?.totalDSGD ?? '—'} lot`, color: 'text-sky-400' },
        { label: 'Tổng CQG', value: `${reconResult.results.klgd.totals?.totalFR ?? '—'} lot`, color: 'text-sky-400' },
        { label: 'Chênh lệch', value: `${reconResult.results.klgd.totals?.differ ?? '—'} lot`, color: reconResult.results.klgd.totals?.differ > 0 ? 'text-red-400' : 'text-emerald-400' },
        { label: 'GD lệch chi tiết', value: `${reconResult.results.klgd.mismatchedTrades?.length ?? 0}`, color: reconResult.results.klgd.mismatchedTrades?.length > 0 ? 'text-red-400' : 'text-emerald-400' },
        { label: 'TK lệch TTM', value: `${reconResult.results.klgd.mismatchedTTM?.length ?? 0}`, color: reconResult.results.klgd.mismatchedTTM?.length > 0 ? 'text-amber-400' : 'text-emerald-400' },
      ];
    }
    if (reconResult.results?.eod) {
      eodStats = [
        { label: 'TK lệch số dư (≥1,000đ)', value: `${reconResult.results.eod.mismatchedEOD?.length ?? 0}`, color: reconResult.results.eod.mismatchedEOD?.length > 0 ? 'text-red-400' : 'text-emerald-400' },
        { label: 'TK âm ký quỹ', value: `${reconResult.results.eod.negativeIMRAcc?.length ?? 0}`, color: reconResult.results.eod.negativeIMRAcc?.length > 0 ? 'text-red-400' : 'text-emerald-400' },
      ];
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Top action row */}
      <div className="flex justify-between items-center flex-wrap gap-4 bg-zinc-900/20 border border-zinc-800 p-4 rounded-lg">
        <div>
          <h4 className="text-sm font-bold text-white">Chạy đối chiếu tự động</h4>
          <p className="text-xs text-zinc-400">Bot tự động đăng nhập, download báo cáo và đối chiếu số liệu.</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleLoadReconSampleDates}
            className="btn btn-secondary flex items-center gap-2 text-xs"
          >
            <RefreshCw size={14} />
            Tải danh sách ngày mẫu
          </button>
          <button
            type="button"
            onClick={handleRunAutoRecon}
            disabled={reconAutoRunning}
            className="btn btn-primary flex items-center gap-2 text-xs font-bold"
          >
            <Activity size={14} className={reconAutoRunning ? 'animate-spin' : ''} />
            {reconAutoRunning ? 'Bot đang xử lý...' : '🤖 Bot tự động đối chiếu'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => { setReconTab('sample'); setReconResult(null); }}
          className={`px-4 py-2 text-xs font-bold rounded-t-md transition ${
            reconTab === 'sample'
              ? 'bg-emerald-500 text-white'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
          }`}
        >
          📂 Chạy từ file mẫu local
        </button>
        <button
          type="button"
          onClick={() => { setReconTab('upload'); setReconResult(null); }}
          className={`px-4 py-2 text-xs font-bold rounded-t-md transition ${
            reconTab === 'upload'
              ? 'bg-emerald-500 text-white'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
          }`}
        >
          📤 Upload file đối chiếu thủ công
        </button>
      </div>

      {/* Tab Contents */}
      {reconTab === 'sample' ? (
        <div className="glass-panel p-6 flex flex-col gap-4">
          <h5 className="text-sm font-bold text-white mb-1">📂 Chọn bộ file mẫu từ Backup MS</h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">Ngày giao dịch mẫu</label>
              <select
                value={reconSelectedPath}
                onChange={(e) => setReconSelectedPath(e.target.value)}
                className="form-input text-xs"
              >
                {reconSampleDates.length === 0 && (
                  <option value="">-- Chưa có dữ liệu mẫu, vui lòng nhấn "Tải danh sách ngày mẫu" --</option>
                )}
                {reconSampleDates.map((dateObj, i) => (
                  <option key={i} value={dateObj.samplePath}>
                    {dateObj.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">Tỷ giá USD/VND</label>
              <input
                type="number"
                value={reconUsdRate}
                onChange={(e) => setReconUsdRate(Number(e.target.value))}
                className="form-input text-xs"
                placeholder="25220"
              />
            </div>
            <button
              type="button"
              onClick={handleRunReconTest}
              disabled={reconRunning || !reconSelectedPath}
              className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold"
            >
              <Play size={14} className={reconRunning ? 'animate-spin' : ''} />
              {reconRunning ? 'Đang chạy đối chiếu...' : 'Chạy kiểm thử'}
            </button>
          </div>
          {reconSelectedPath && (
            <p className="text-[10px] text-zinc-500 font-mono break-all mt-1 bg-zinc-950 p-2 rounded">
              Đường dẫn local: {reconSelectedPath}
            </p>
          )}
        </div>
      ) : (
        /* Manual Upload */
        <div className="glass-panel p-6 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h5 className="text-sm font-bold text-white">📤 Tải lên các file báo cáo cần đối chiếu</h5>
            <div className="w-40">
              <label className="text-[10px] text-zinc-400 block mb-1">Tỷ giá USD/VND</label>
              <input
                type="number"
                value={reconUsdRate}
                onChange={(e) => setReconUsdRate(Number(e.target.value))}
                className="form-input text-xs py-1 px-2.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* KLGD Files */}
            <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg flex flex-col gap-3">
              <span className="text-xs font-bold text-sky-400 border-l-2 border-sky-400 pl-2">
                Đối chiếu khớp lệnh (KLGD)
              </span>
              <div className="flex flex-col gap-2.5 text-xs text-zinc-400">
                <div>
                  <label className="block mb-1">File DSGD.xlsx (MS) <span className="text-red-400">*</span></label>
                  <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, dsgd: e.target.files?.[0] || null }))} className="w-full text-[11px]" />
                </div>
                <div>
                  <label className="block mb-1">File FR1.xlsx (CQG)</label>
                  <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, fr1: e.target.files?.[0] || null }))} className="w-full text-[11px]" />
                </div>
                <div>
                  <label className="block mb-1">File FR2.xlsx (CQG)</label>
                  <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, fr2: e.target.files?.[0] || null }))} className="w-full text-[11px]" />
                </div>
                <div>
                  <label className="block mb-1">File TTM.xlsx (Optional)</label>
                  <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, ttm: e.target.files?.[0] || null }))} className="w-full text-[11px]" />
                </div>
              </div>
            </div>

            {/* EOD & CQG Files */}
            <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-lg flex flex-col gap-3">
              <span className="text-xs font-bold text-sky-400 border-l-2 border-sky-400 pl-2">
                Đối chiếu số dư EOD & CQG
              </span>
              <div className="flex flex-col gap-2.5 text-xs text-zinc-400">
                <div>
                  <label className="block mb-1">File QLTKGD.xlsx (MS Balance) <span className="text-red-400">*</span></label>
                  <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, qltkgd: e.target.files?.[0] || null }))} className="w-full text-[11px]" />
                </div>
                <div>
                  <label className="block mb-1">File TTTT.xlsx (MS Closed Positions) <span className="text-red-400">*</span></label>
                  <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, tttt: e.target.files?.[0] || null }))} className="w-full text-[11px]" />
                </div>
                <div>
                  <label className="block mb-1">File eod.csv (MS EOD Report) <span className="text-red-400">*</span></label>
                  <input type="file" accept=".csv" onChange={e => setManualFiles(prev => ({ ...prev, eod: e.target.files?.[0] || null }))} className="w-full text-[11px]" />
                </div>
                <div>
                  <label className="block mb-1">File Accounts_Balances.xlsx (CQG Balance)</label>
                  <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, accountsBalances: e.target.files?.[0] || null }))} className="w-full text-[11px]" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-zinc-800 pt-4 text-xs">
            <button
              type="button"
              onClick={() => setManualFiles({})}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 px-4 py-2 rounded transition font-semibold"
            >
              Xóa các file đã chọn
            </button>
            <button
              type="button"
              onClick={handleRunUploadReconTest}
              disabled={reconUploadRunning}
              className="btn btn-primary px-6 py-2 flex items-center gap-2 font-bold"
            >
              <Upload size={14} className={reconUploadRunning ? 'animate-spin' : ''} />
              {reconUploadRunning ? 'Đang chạy đối chiếu...' : 'Bắt đầu đối chiếu file upload'}
            </button>
          </div>
        </div>
      )}

      {/* Results Display */}
      {reconResult && (
        <div className="flex flex-col gap-4">
          {/* KLGD Result */}
          {reconResult.errors?.klgd ? (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-xs text-red-400">
              ❌ KLGD - Lỗi đối chiếu: {reconResult.errors.klgd}
            </div>
          ) : reconResult.results?.klgd ? (
            <div className="glass-panel p-5 flex flex-col gap-3">
              <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Activity size={14} className="text-sky-400" />
                Đối chiếu khớp lệnh (KLGD)
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {klgdStats.map((stat, i) => (
                  <div key={i} className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
                    <p className="text-[10px] text-zinc-500 mb-1">{stat.label}</p>
                    <p className={`text-sm font-mono font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* EOD Result */}
          {reconResult.errors?.eod ? (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-xs text-red-400">
              ❌ EOD - Lỗi đối chiếu: {reconResult.errors.eod}
            </div>
          ) : reconResult.results?.eod ? (
            <div className="glass-panel p-5 flex flex-col gap-3">
              <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileText size={14} className="text-sky-400" />
                Đối chiếu số dư EOD
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {eodStats.map((stat, i) => (
                  <div key={i} className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
                    <p className="text-[10px] text-zinc-500 mb-1">{stat.label}</p>
                    <p className={`text-md font-mono font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
              {reconResult.results.eod.negativeIMRAcc?.length > 0 && (
                <div className="bg-red-500/10 border-l-4 border-red-500 p-3 rounded-r text-xs text-red-400 font-mono font-semibold">
                  🚨 Tài khoản âm ký quỹ: {reconResult.results.eod.negativeIMRAcc.join(', ')}
                </div>
              )}
            </div>
          ) : null}

          {/* CQG Result */}
          {reconResult.errors?.cqg ? (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-xs text-red-400">
              ❌ CQG - Lỗi đối chiếu: {reconResult.errors.cqg}
            </div>
          ) : reconResult.results?.cqg !== undefined ? (
            <div className="glass-panel p-5 flex flex-col gap-3">
              <h5 className="text-xs font-bold text-white">🔵 Đối chiếu số dư CQG</h5>
              <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80 w-fit min-w-56 mb-2">
                <p className="text-[10px] text-zinc-500 mb-1">Số TK lệch số dư CQG (&gt;100 USD)</p>
                <p className={`text-lg font-mono font-bold ${
                  reconResult.results.cqg.length > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}>
                  {reconResult.results.cqg.length}
                </p>
              </div>

              {reconResult.results.cqg.length > 0 && (
                <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-900/40 border-b border-zinc-800 text-zinc-400 font-semibold">
                        <th className="p-2.5">Mã TKGD</th>
                        <th className="p-2.5 text-right">MS (USD)</th>
                        <th className="p-2.5 text-right">CQG (USD)</th>
                        <th className="p-2.5 text-right">Chênh lệch</th>
                        <th className="p-2.5 text-right">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconResult.results.cqg.slice(0, 20).map((r: any, i: number) => (
                        <tr key={i} className="border-b border-zinc-900 hover:bg-zinc-900/20 transition">
                          <td className="p-2.5 font-mono font-bold text-white">{r.maTKGD}</td>
                          <td className="p-2.5 text-right font-mono text-zinc-300">{r.calculatedBalance?.toFixed(2)}</td>
                          <td className="p-2.5 text-right font-mono text-zinc-300">{r.cqgBalance?.toFixed(2)}</td>
                          <td className="p-2.5 text-right font-mono text-red-400 font-bold">{r.differ?.toFixed(2)}</td>
                          <td className="p-2.5 text-right text-[10px] text-amber-400 font-semibold">
                            {!r.inCQG ? '⚠️ Thiếu trên CQG' : !r.inMS ? '⚠️ Thiếu trên MS' : '⚠️ Lệch số dư'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {reconResult.results.cqg.length > 20 && (
                    <p className="text-[10px] text-zinc-500 p-2.5">... và {reconResult.results.cqg.length - 20} tài khoản khác.</p>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Auto Reconciliation result display */}
      {reconAutoResult && (
        <div className="glass-panel p-6 flex flex-col gap-4 bg-zinc-950/20 border border-zinc-850">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="text-emerald-400 animate-pulse" size={16} />
            Kết quả Bot tự động hoàn thành
          </h4>
          <p className="text-xs text-zinc-400 font-mono break-all bg-black/40 p-2 rounded border border-zinc-900">
            Thư mục tải báo cáo: {reconAutoResult.downloadDir}
          </p>

          {reconAutoResult.results?.eod && (
            <div className="flex gap-4 flex-wrap text-xs">
              <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800">
                <p className="text-[10px] text-zinc-500 mb-1">Số TK lệch EOD</p>
                <p className={`text-md font-mono font-bold ${
                  reconAutoResult.results.eod.mismatchedEOD?.length > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}>
                  {reconAutoResult.results.eod.mismatchedEOD?.length ?? 0}
                </p>
              </div>
              <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800">
                <p className="text-[10px] text-zinc-500 mb-1">Số TK âm ký quỹ</p>
                <p className={`text-md font-mono font-bold ${
                  reconAutoResult.results.eod.negativeIMRAcc?.length > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}>
                  {reconAutoResult.results.eod.negativeIMRAcc?.length ?? 0}
                </p>
              </div>
            </div>
          )}

          {Object.entries(reconAutoResult.errors || {}).map(([key, errVal]) => (
            <div key={key} className="bg-red-500/10 border border-red-500/20 p-3 rounded text-xs text-red-400 font-mono">
              ❌ Lỗi [{key}]: {String(errVal)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
