'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Play,
  RefreshCw,
  Info,
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react';

interface ValueStatisticsPanelProps {
  token: string;
  apiBaseUrl: string;
}

function getPreviousWorkday(d: Date = new Date()): Date {
  const prev = new Date(d);
  do {
    prev.setDate(prev.getDate() - 1);
  } while (prev.getDay() === 0 || prev.getDay() === 6); // 0 = Sunday, 6 = Saturday
  return prev;
}

export default function ValueStatisticsPanel({ token, apiBaseUrl }: ValueStatisticsPanelProps) {
  const [basePath, setBasePath] = useState('c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke gia tri');
  const [ngayGD, setNgayGD] = useState(() => {
    const prevWorkday = getPreviousWorkday();
    return prevWorkday.toISOString().split('T')[0];
  });

  const [folderPathMs, setFolderPathMs] = useState('');
  const [dsgdPath, setDsgdPath] = useState('');
  const [macroPath, setMacroPath] = useState('');
  const [updateCumulative, setUpdateCumulative] = useState(false);

  // Cumulative paths
  const [pathNormal, setPathNormal] = useState('');
  const [pathAcm, setPathAcm] = useState('');
  const [pathLme, setPathLme] = useState('');
  const [pathOptions, setPathOptions] = useState('');
  const [pathSpread, setPathSpread] = useState('');

  // States
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [resultTab, setResultTab] = useState<'summary' | 'normal' | 'spread'>('summary');
  const [savingConfig, setSavingConfig] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedBase = localStorage.getItem('val_stats_base_path');
    if (savedBase) {
      setBasePath(savedBase);
    }
  }, []);

  // Compute paths automatically when date or basePath changes
  useEffect(() => {
    if (!ngayGD) return;
    const parts = ngayGD.split('-');
    if (parts.length !== 3) return;
    const [year, month, day] = parts;

    const cleanBase = basePath.trim().replace(/\/$/, '').replace(/\\$/, '');
    
    // Default folder structure for Backup MS
    const msFolder = `${cleanBase}\\Backup MS\\${day}.${month}`;
    setFolderPathMs(msFolder);
    setDsgdPath(`${msFolder}\\DSGD.xlsx`);

    // Macro template defaults to the workspace root's macro directory or custom macro path
    const idx = cleanBase.toLowerCase().indexOf('marco thong ke gia tri');
    const wsRoot = idx > 0 ? cleanBase.substring(0, idx) : cleanBase;
    const defaultMacro = `${wsRoot.replace(/\/$/, '').replace(/\\$/, '')}\\marco\\Thong ke gia tri giao dich có ACM\\Macro thong ke gia tri giao dich có ACM.xlsm`;
    setMacroPath(defaultMacro);

    // Cumulative files
    setPathNormal(`${cleanBase}\\Thong ke gia tri giao dich ${year} 1.xlsx`);
    setPathAcm(`${cleanBase}\\Thong ke gia tri giao dich ACM ${year} 1.xlsx`);
    setPathLme(`${cleanBase}\\Thong ke gia tri giao dich LME ${year}.xlsx`);
    setPathOptions(`${cleanBase}\\Thong ke gia tri giao dich Options ${year}.xlsx`);
    setPathSpread(`${cleanBase}\\Thong ke gia tri giao dich Spread ${year}.xlsx`);
  }, [ngayGD, basePath]);

  const handleBasePathChange = (val: string) => {
    setBasePath(val);
    localStorage.setItem('val_stats_base_path', val);
  };

  const applyQuickPaths = () => {
    if (!ngayGD) {
      toast.error('Vui lòng chọn ngày giao dịch.');
      return;
    }
    const parts = ngayGD.split('-');
    if (parts.length !== 3) {
      toast.error('Ngày giao dịch không đúng định dạng YYYY-MM-DD.');
      return;
    }
    const [year, month, day] = parts;
    const cleanBase = basePath.trim().replace(/\/$/, '').replace(/\\$/, '');
    
    const msFolder = `${cleanBase}\\Backup MS\\${day}.${month}`;
    setFolderPathMs(msFolder);
    setDsgdPath(`${msFolder}\\DSGD.xlsx`);

    const idx = cleanBase.toLowerCase().indexOf('marco thong ke gia tri');
    const wsRoot = idx > 0 ? cleanBase.substring(0, idx) : cleanBase;
    const defaultMacro = `${wsRoot.replace(/\/$/, '').replace(/\\$/, '')}\\marco\\Thong ke gia tri giao dich có ACM\\Macro thong ke gia tri giao dich có ACM.xlsm`;
    setMacroPath(defaultMacro);

    setPathNormal(`${cleanBase}\\Thong ke gia tri giao dich ${year} 1.xlsx`);
    setPathAcm(`${cleanBase}\\Thong ke gia tri giao dich ACM ${year} 1.xlsx`);
    setPathLme(`${cleanBase}\\Thong ke gia tri giao dich LME ${year}.xlsx`);
    setPathOptions(`${cleanBase}\\Thong ke gia tri giao dich Options ${year}.xlsx`);
    setPathSpread(`${cleanBase}\\Thong ke gia tri giao dich Spread ${year}.xlsx`);

    toast.success('Đã tự động tính toán & điền toàn bộ đường dẫn nguồn và 5 file lũy kế!');
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    const toastId = toast.loading('Đang lưu cấu hình tỷ giá & macro path...');
    try {
      const res = await fetch(`${apiBaseUrl}/value-statistics/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          macroPath,
          targetRoot: basePath,
        }),
      });
      if (!res.ok) throw new Error('Không thể lưu cấu hình');
      toast.success('Lưu cấu hình thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình', { id: toastId });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunProcess = async () => {
    setLoading(true);
    setResult(null);
    const toastId = toast.loading('Đang xử lý thống kê giá trị giao dịch...');

    try {
      const payload = {
        ngayGD,
        macroPath,
        targetRoot: basePath,
        dsgdPath,
        updateCumulative,
        pathNormal,
        pathAcm,
        pathLme,
        pathOptions,
        pathSpread,
      };

      const res = await fetch(`${apiBaseUrl}/value-statistics/process-local`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi chạy thống kê giá trị');

      setResult(data);
      toast.success('Xử lý tính toán thống kê giá trị giao dịch thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xử lý', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Load configuration from backend if available
  useEffect(() => {
    if (!token) return;
    fetch(`${apiBaseUrl}/value-statistics/config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.macroPath) setMacroPath(data.macroPath);
          if (data.targetRoot) setBasePath(data.targetRoot);
        }
      })
      .catch((err) => console.error('Error fetching value statistics config:', err));
  }, [token, apiBaseUrl]);

  // Extract non-zero breakdown records
  const normalItems = result?.normalGtgdBreakdown
    ? Object.entries(result.normalGtgdBreakdown)
        .map(([k, v]: any) => ({ code: k, val: v }))
        .filter((i) => i.val > 0)
        .sort((a, b) => b.val - a.val)
    : [];

  const spreadItems = result?.spreadGtgdBreakdown
    ? Object.entries(result.spreadGtgdBreakdown)
        .map(([k, v]: any) => ({ code: k, val: v }))
        .filter((i) => i.val > 0)
        .sort((a, b) => b.val - a.val)
    : [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-zinc-300">
      {/* Block 1: Information and Parameters */}
      <div className="glass-panel p-6 flex flex-col gap-5">
        <h4 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-3">
          <Info size={16} className="text-emerald-500" />
          1. Thông tin phiên & Tham số đối chiếu
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Ngày giao dịch</label>
            <input
              type="date"
              value={ngayGD || ''}
              onChange={(e) => setNgayGD(e.target.value)}
              className="form-input text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Đường dẫn file Macro cấu hình (.xlsm)</label>
            <input
              type="text"
              value={macroPath || ''}
              onChange={(e) => setMacroPath(e.target.value)}
              className="form-input text-xs font-mono w-full"
              placeholder="Macro thong ke gia tri giao dich co ACM.xlsm"
            />
          </div>
        </div>
      </div>

      {/* Block 2: Data Source Panel */}
      <div className="glass-panel p-6 flex flex-col gap-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-3">
          <FileSpreadsheet size={16} className="text-sky-400" />
          2. Chọn nguồn dữ liệu đối chiếu
        </h4>

        {/* Server Folder Tab Indicator */}
        <div className="flex gap-2 border-b border-zinc-800 pb-2">
          <button
            type="button"
            className="px-4 py-1.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 cursor-default"
          >
            <FolderOpen size={14} /> Chạy từ thư mục trên server
          </button>
        </div>

        <div className="bg-zinc-900/30 border border-zinc-850 p-5 rounded-lg flex flex-col gap-4">
          
          {/* Quick generate panel */}
          <div className="bg-zinc-950/40 p-4 rounded border border-zinc-850 flex flex-col gap-3">
            <h5 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <RefreshCw size={13} className="text-emerald-500 animate-pulse" />
              Cấu hình Thư mục gốc & Tạo đường dẫn nhanh theo Ngày GD
            </h5>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                  Thư mục gốc (Target Root)
                </label>
                <input
                  type="text"
                  value={basePath || ''}
                  onChange={(e) => handleBasePathChange(e.target.value)}
                  className="form-input text-xs font-mono w-full"
                  placeholder="M:\Quanlygiaodich\Tai lieu hoat dong\Marco thong ke gia tri"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={applyQuickPaths}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-6 py-2 rounded text-xs transition font-bold flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={13} /> Tạo nhanh các đường dẫn theo Ngày GD
              </button>
            </div>
          </div>

          {/* Target File Input */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Đường dẫn file DSGD nguồn <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={dsgdPath || ''}
                onChange={(e) => setDsgdPath(e.target.value)}
                className="form-input text-xs font-mono w-full"
                placeholder="M:\...\Backup MS\16.07\DSGD.xlsx"
              />
            </div>
          </div>

          {/* Cumulative Update Panel */}
          <div className="border-t border-zinc-850 pt-4 mt-2">
            <label className="flex items-center gap-2 cursor-pointer mb-3 select-none">
              <input
                type="checkbox"
                checked={updateCumulative}
                onChange={(e) => setUpdateCumulative(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/20"
              />
              <span className="text-xs font-bold text-white">Ghi đè dữ liệu vào các file lũy kế (Cumulative annual files)</span>
            </label>

            {updateCumulative && (
              <div className="bg-zinc-950/20 border border-zinc-850/60 p-4 rounded-lg flex flex-col gap-4 animate-fade-in">
                <h6 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 mb-1">
                  <FileSpreadsheet size={13} className="text-emerald-500" />
                  Đường dẫn 5 file Excel lũy kế năm
                </h6>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                      File lũy kế Normal
                    </label>
                    <input
                      type="text"
                      value={pathNormal || ''}
                      onChange={(e) => setPathNormal(e.target.value)}
                      className="form-input text-xs font-mono w-full text-zinc-300 bg-zinc-900/50 border-zinc-800"
                      placeholder="Thong ke gia tri giao dich 2026 1.xlsx"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                      File lũy kế Spread
                    </label>
                    <input
                      type="text"
                      value={pathSpread || ''}
                      onChange={(e) => setPathSpread(e.target.value)}
                      className="form-input text-xs font-mono w-full text-zinc-300 bg-zinc-900/50 border-zinc-800"
                      placeholder="Thong ke gia tri giao dich Spread 2026.xlsx"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                      File lũy kế LME
                    </label>
                    <input
                      type="text"
                      value={pathLme || ''}
                      onChange={(e) => setPathLme(e.target.value)}
                      className="form-input text-xs font-mono w-full text-zinc-300 bg-zinc-900/50 border-zinc-800"
                      placeholder="Thong ke gia tri giao dich LME 2026.xlsx"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                      File lũy kế Options
                    </label>
                    <input
                      type="text"
                      value={pathOptions || ''}
                      onChange={(e) => setPathOptions(e.target.value)}
                      className="form-input text-xs font-mono w-full text-zinc-300 bg-zinc-900/50 border-zinc-800"
                      placeholder="Thong ke gia tri giao dich Options 2026.xlsx"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                      File lũy kế ACM
                    </label>
                    <input
                      type="text"
                      value={pathAcm || ''}
                      onChange={(e) => setPathAcm(e.target.value)}
                      className="form-input text-xs font-mono w-full text-zinc-300 bg-zinc-900/50 border-zinc-800"
                      placeholder="Thong ke gia tri giao dich ACM 2026 1.xlsx"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-t border-zinc-850 pt-3 mt-1 gap-3">
            <p className="text-[11px] text-zinc-500 flex items-start gap-1.5 leading-normal max-w-2/3">
              <Info size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>
                Hệ thống sẽ thực hiện tính toán giá trị giao dịch (GTGD) chi tiết dựa trên dữ liệu file DSGD và cập nhật lũy kế.
              </span>
            </p>
            
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 px-5 py-2 rounded text-xs transition font-semibold flex items-center gap-1.5 flex-shrink-0"
            >
              <RefreshCw size={12} className={savingConfig ? 'animate-spin' : ''} />
              Lưu cấu hình mặc định
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4 border-t border-zinc-800/80 pt-4">
          <button
            type="button"
            onClick={handleRunProcess}
            disabled={loading || !dsgdPath.trim() || !macroPath.trim()}
            className="btn btn-primary px-6 py-2 flex items-center gap-1.5 text-xs font-bold"
          >
            <Play size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Đang đối chiếu...' : 'Chạy kiểm thử trực tuyến'}
          </button>
        </div>
      </div>

      {/* Results View */}
      {result && (
        <div className="flex flex-col gap-4 animate-fade-in">
          {/* Tabs bar */}
          <div className="flex gap-2 border-b border-zinc-800 pb-1 flex-wrap">
            <button
              type="button"
              onClick={() => setResultTab('summary')}
              className={`px-4 py-2 text-xs font-bold rounded-t-md transition ${
                resultTab === 'summary'
                  ? 'bg-zinc-800 text-white border-b-2 border-emerald-500'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              📊 Bảng tổng hợp giá trị
            </button>
            <button
              type="button"
              onClick={() => setResultTab('normal')}
              className={`px-4 py-2 text-xs font-bold rounded-t-md transition ${
                resultTab === 'normal'
                  ? 'bg-zinc-800 text-white border-b-2 border-emerald-500'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              💵 Chi tiết Normal GTGD ({normalItems.length})
            </button>
            <button
              type="button"
              onClick={() => setResultTab('spread')}
              className={`px-4 py-2 text-xs font-bold rounded-t-md transition ${
                resultTab === 'spread'
                  ? 'bg-zinc-800 text-white border-b-2 border-emerald-500'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🔀 Chi tiết Spread GTGD ({spreadItems.length})
            </button>
          </div>

          {/* Result content */}
          {resultTab === 'summary' && (
            <div className="glass-panel p-6 flex flex-col gap-4 animate-fade-in">
              <h5 className="text-sm font-bold text-white mb-2">📊 Bảng tổng hợp tham số tỷ giá</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-zinc-950/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-extrabold text-zinc-500 tracking-wider">Tổng số dòng Normal</span>
                  <span className="text-xl font-black text-white mt-1">{result.normalCount?.toLocaleString()}</span>
                </div>
                <div className="bg-zinc-950/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-extrabold text-zinc-500 tracking-wider">Tỷ giá USD Default</span>
                  <span className="text-xl font-black text-emerald-400 mt-1">{result.tyGiaDefault?.toLocaleString()}</span>
                </div>
                <div className="bg-zinc-950/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-extrabold text-zinc-500 tracking-wider">Tỷ giá TRU (EUR)</span>
                  <span className="text-xl font-black text-emerald-400 mt-1">{result.tyGiaTru?.toLocaleString()}</span>
                </div>
                <div className="bg-zinc-950/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-extrabold text-zinc-500 tracking-wider">Tỷ giá MPO (MYR)</span>
                  <span className="text-xl font-black text-emerald-400 mt-1">{result.tyGiaMpo?.toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-zinc-950/50 border border-zinc-900 p-4 rounded-lg flex items-center justify-between flex-wrap gap-4 mt-2">
                <div>
                  <p className="text-xs font-bold text-white">Đối chiếu và tính toán hoàn tất</p>
                  <p className="text-[10px] text-zinc-500 font-sans">
                    Hệ thống đã phân tách chính xác các mã giao dịch thường và giao dịch chênh lệch spread.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/5 px-3 py-1.5 border border-emerald-500/20 rounded-md">
                  <CheckCircle2 size={14} /> Khớp hoàn toàn
                </div>
              </div>
            </div>
          )}

          {resultTab === 'normal' && (
            <div className="glass-panel p-6 flex flex-col gap-4 animate-fade-in">
              <h5 className="text-sm font-bold text-white mb-2">💵 Thống kê chi tiết Giá trị Giao dịch Normal</h5>
              
              {normalItems.length === 0 ? (
                <div className="text-zinc-500 text-xs text-center py-6">Không có giá trị giao dịch Normal nào.</div>
              ) : (
                <div className="overflow-x-auto border border-zinc-800 rounded-lg max-h-[450px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-zinc-900/60 sticky top-0 border-b border-zinc-800 z-10">
                      <tr className="text-zinc-400 font-bold">
                        <th className="p-2.5">Mã Hàng hóa</th>
                        <th className="p-2.5 text-right font-bold text-sky-400">Giá trị giao dịch (VNĐ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalItems.map((item, i) => (
                        <tr key={i} className="border-b border-zinc-900 hover:bg-zinc-900/10 font-mono">
                          <td className="p-2.5 font-sans font-bold text-white text-left">{item.code}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">
                            {item.val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {resultTab === 'spread' && (
            <div className="glass-panel p-6 flex flex-col gap-4 animate-fade-in">
              <h5 className="text-sm font-bold text-white mb-2">🔀 Thống kê chi tiết Giá trị Giao dịch Spread</h5>
              
              {spreadItems.length === 0 ? (
                <div className="text-zinc-500 text-xs text-center py-6">Không có giao dịch Spread nào trong ngày.</div>
              ) : (
                <div className="overflow-x-auto border border-zinc-800 rounded-lg max-h-[450px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-zinc-900/60 sticky top-0 border-b border-zinc-800 z-10">
                      <tr className="text-zinc-400 font-bold">
                        <th className="p-2.5">Mã Hàng hóa</th>
                        <th className="p-2.5 text-right font-bold text-amber-500">Giá trị giao dịch (Spread VNĐ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spreadItems.map((item, i) => (
                        <tr key={i} className="border-b border-zinc-900 hover:bg-zinc-900/10 font-mono">
                          <td className="p-2.5 font-sans font-bold text-white text-left">{item.code}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">
                            {item.val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
