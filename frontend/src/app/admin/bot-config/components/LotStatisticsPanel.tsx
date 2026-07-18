'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Play,
  RefreshCw,
  Upload,
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  Info,
  FileSpreadsheet,
  FolderOpen,
} from 'lucide-react';

interface LotStatisticsPanelProps {
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

export default function LotStatisticsPanel({ token, apiBaseUrl }: LotStatisticsPanelProps) {
  // Mode Selection: 'folder' (scan server folder) vs 'upload' (upload local files)
  const [runMode, setRunMode] = useState<'folder' | 'upload'>('folder');
  const [folderPathMs, setFolderPathMs] = useState('M:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures\\2026\\T07.2026\\16.07');
  const [folderPathCqg, setFolderPathCqg] = useState('M:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures\\2026\\T07.2026\\16.07');

  // Config & Parameters States
  const [ngayGD, setNgayGD] = useState(() => {
    const prevWorkday = getPreviousWorkday();
    return prevWorkday.toISOString().split('T')[0];
  });
  const [truDates, setTruDates] = useState('2026-07-03, 2026-07-02, 2026-07-01, 2026-06-30');
  const [fefDates, setFefDates] = useState('2026-07-03, 2026-07-02');
  const [zftDates, setZftDates] = useState('2026-07-03, 2026-07-02');
  const [filterLmeKyHan, setFilterLmeKyHan] = useState('U26');
  const [deadline, setDeadline] = useState('46217.208333'); // Default VBA Y1 deadline serial

  // Cumulative annual states
  const [updateCumulative, setUpdateCumulative] = useState(false);
  const [pathDsgdCumulative, setPathDsgdCumulative] = useState('');
  const [pathNormal, setPathNormal] = useState('');
  const [pathAcm, setPathAcm] = useState('');
  const [pathLme, setPathLme] = useState('');
  const [pathOptions, setPathOptions] = useState('');
  const [pathSpread, setPathSpread] = useState('');

  // File Upload States
  const [files, setFiles] = useState<{
    fileDsgd?: File | null;
    fileFr?: File | null;
    fileTtm?: File | null;
    fileTttt?: File | null;
    fileOp?: File | null;
    filePs?: File | null;
  }>({});

  // Execution States
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [resultTab, setResultTab] = useState<'summary' | 'validations' | 'product' | 'tvkd'>('summary');
  const [savingConfig, setSavingConfig] = useState(false);
  const [basePathMs, setBasePathMs] = useState('M:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures');
  const [basePathCqg, setBasePathCqg] = useState('M:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures');

  // Load basePaths from localStorage on mount
  useEffect(() => {
    const savedMs = localStorage.getItem('lot_stats_base_path_ms');
    if (savedMs) {
      setBasePathMs(savedMs);
    }
    const savedCqg = localStorage.getItem('lot_stats_base_path_cqg');
    if (savedCqg) {
      setBasePathCqg(savedCqg);
    }
  }, []);

  // Automatically compute and sync paths when ngayGD or base paths change
  useEffect(() => {
    if (!ngayGD) return;
    const parts = ngayGD.split('-');
    if (parts.length !== 3) return;
    const [year, month, day] = parts;
    
    // MS
    const cleanBaseMs = basePathMs.trim().replace(/\/$/, '').replace(/\\$/, '');
    const computedMs = `${cleanBaseMs}\\${year}\\T${month}.${year}\\${day}.${month}`;
    setFolderPathMs(computedMs);

    // CQG
    const cleanBaseCqg = basePathCqg.trim().replace(/\/$/, '').replace(/\\$/, '');
    const computedCqg = `${cleanBaseCqg}\\${year}\\T${month}.${year}\\${day}.${month}`;
    setFolderPathCqg(computedCqg);

    // Cumulative paths auto-computation (inside the daily folder)
    const lastPartCqgIdx = cleanBaseCqg.lastIndexOf('\\');
    const parentBaseCqg = lastPartCqgIdx > 0 ? cleanBaseCqg.substring(0, lastPartCqgIdx) : cleanBaseCqg;

    setPathDsgdCumulative(`${computedMs}\\DSGD T${month}.${year}.xlsx`);
    setPathNormal(`${computedCqg}\\Thong ke so lot giao dich ${year} 2.xlsx`);
    setPathAcm(`${parentBaseCqg}\\ACM\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich ACM ${year} 2.xlsx`);
    setPathLme(`${parentBaseCqg}\\LME\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich LME ${year}.xlsx`);
    setPathOptions(`${parentBaseCqg}\\Options\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich Options ${year}.xlsx`);
    setPathSpread(`${parentBaseCqg}\\Spread\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich Spread ${year}.xlsx`);
  }, [ngayGD, basePathMs, basePathCqg]);

  const handleBasePathMsChange = (val: string) => {
    setBasePathMs(val);
    localStorage.setItem('lot_stats_base_path_ms', val);
  };

  const handleBasePathCqgChange = (val: string) => {
    setBasePathCqg(val);
    localStorage.setItem('lot_stats_base_path_cqg', val);
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
    
    // MS
    const cleanBaseMs = basePathMs.trim().replace(/\/$/, '').replace(/\\$/, '');
    const computedMs = `${cleanBaseMs}\\${year}\\T${month}.${year}\\${day}.${month}`;
    setFolderPathMs(computedMs);

    // CQG
    const cleanBaseCqg = basePathCqg.trim().replace(/\/$/, '').replace(/\\$/, '');
    const computedCqg = `${cleanBaseCqg}\\${year}\\T${month}.${year}\\${day}.${month}`;
    setFolderPathCqg(computedCqg);

    // Cumulative paths auto-computation
    const lastPartCqgIdx = cleanBaseCqg.lastIndexOf('\\');
    const parentBaseCqg = lastPartCqgIdx > 0 ? cleanBaseCqg.substring(0, lastPartCqgIdx) : cleanBaseCqg;

    setPathDsgdCumulative(`${cleanBaseMs}\\${year}\\DSGD T${month}.${year}.xlsx`);
    setPathNormal(`${cleanBaseCqg}\\${year}\\Thong ke so lot giao dich ${year} 2.xlsx`);
    setPathAcm(`${parentBaseCqg}\\ACM\\${year}\\Thong ke so lot giao dich ACM ${year} 2.xlsx`);
    setPathLme(`${parentBaseCqg}\\LME\\${year}\\Thong ke so lot giao dich LME ${year}.xlsx`);
    setPathOptions(`${parentBaseCqg}\\Options\\${year}\\Thong ke so lot giao dich Options ${year}.xlsx`);
    setPathSpread(`${parentBaseCqg}\\Spread\\${year}\\Thong ke so lot giao dich Spread ${year}.xlsx`);

    toast.success('Đã tự động tính toán & điền toàn bộ đường dẫn MS, CQG và 6 file lũy kế!');
  };

  const handleSaveConfig = async () => {
    if (!folderPathMs.trim() || !folderPathCqg.trim()) {
      toast.error('Vui lòng nhập cả thư mục MS và CQG trước khi lưu.');
      return;
    }
    setSavingConfig(true);
    const toastId = toast.loading('Đang lưu cấu hình mặc định lên server...');
    try {
      const cleanMs = folderPathMs.trim().replace(/\/$/, '').replace(/\\$/, '');
      const cleanCqg = folderPathCqg.trim().replace(/\/$/, '').replace(/\\$/, '');
      const payload = {
        defaultPathDsgd: `${cleanMs}\\DSGD.xlsx`,
        defaultPathFr: `${cleanCqg}\\FR.xlsx`,
        defaultPathTtm: `${cleanMs}\\TTM.xlsx`,
        defaultPathTttt: `${cleanMs}\\TTTT.xlsx`,
        defaultPathOp: `${cleanCqg}\\OP.xlsx`,
        defaultPathPs: `${cleanCqg}\\PS.xlsx`,
        defaultLmeKyHan: filterLmeKyHan,
        defaultPathDsgdCumulative: pathDsgdCumulative.trim(),
        defaultPathNormal: pathNormal.trim(),
        defaultPathAcm: pathAcm.trim(),
        defaultPathLme: pathLme.trim(),
        defaultPathOptions: pathOptions.trim(),
        defaultPathSpread: pathSpread.trim(),
      };

      const res = await fetch(`${apiBaseUrl}/lot-statistics/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Không thể lưu cấu hình');
      toast.success('Lưu cấu hình mặc định thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình', { id: toastId });
    } finally {
      setSavingConfig(false);
    }
  };

  // Load configuration from backend if available
  useEffect(() => {
    if (!token) return;
    fetch(`${apiBaseUrl}/lot-statistics/config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.defaultLmeKyHan) {
            setFilterLmeKyHan(data.defaultLmeKyHan);
          }
          // Pre-fill paths if configured on the server
          if (data.defaultPathDsgd) {
            const lastSlash = Math.max(data.defaultPathDsgd.lastIndexOf('\\'), data.defaultPathDsgd.lastIndexOf('/'));
            if (lastSlash > 0) {
              setFolderPathMs(data.defaultPathDsgd.substring(0, lastSlash));
            }
          }
          if (data.defaultPathFr) {
            const lastSlash = Math.max(data.defaultPathFr.lastIndexOf('\\'), data.defaultPathFr.lastIndexOf('/'));
            if (lastSlash > 0) {
              setFolderPathCqg(data.defaultPathFr.substring(0, lastSlash));
            }
          }
          if (data.defaultPathDsgdCumulative) setPathDsgdCumulative(data.defaultPathDsgdCumulative);
          if (data.defaultPathNormal) setPathNormal(data.defaultPathNormal);
          if (data.defaultPathAcm) setPathAcm(data.defaultPathAcm);
          if (data.defaultPathLme) setPathLme(data.defaultPathLme);
          if (data.defaultPathOptions) setPathOptions(data.defaultPathOptions);
          if (data.defaultPathSpread) setPathSpread(data.defaultPathSpread);
        }
      })
      .catch((err) => console.error('Error fetching lot statistics config:', err));
  }, [token, apiBaseUrl]);

  // Handle file input changes
  const handleFileChange = (key: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  // Helper to parse dates into JSON arrays
  const parseDates = (str: string) => {
    const dates = str.split(',').map((d) => d.trim()).filter(Boolean);
    return JSON.stringify(dates);
  };

  // Helper to construct FormData (for file uploads)
  const buildFormData = () => {
    const formData = new FormData();
    if (files.fileDsgd) formData.append('fileDsgd', files.fileDsgd);
    if (files.fileFr) formData.append('fileFr', files.fileFr);
    if (files.fileTtm) formData.append('fileTtm', files.fileTtm);
    if (files.fileTttt) formData.append('fileTttt', files.fileTttt);
    if (files.fileOp) formData.append('fileOp', files.fileOp);
    if (files.filePs) formData.append('filePs', files.filePs);

    formData.append('ngayGD', ngayGD);
    formData.append('truDates', parseDates(truDates));
    formData.append('fefDates', parseDates(fefDates));
    formData.append('zftDates', parseDates(zftDates));
    formData.append('filterLmeKyHan', filterLmeKyHan);
    formData.append('deadline', deadline);

    return formData;
  };

  // Helper to construct JSON payload (for server folder scan)
  const buildJsonPayload = () => {
    return {
      folderPathMs,
      folderPathCqg,
      ngayGD,
      truDates: parseDates(truDates),
      fefDates: parseDates(fefDates),
      zftDates: parseDates(zftDates),
      filterLmeKyHan,
      deadline,
      updateCumulative,
      pathDsgdCumulative: updateCumulative ? pathDsgdCumulative : undefined,
      pathNormal: updateCumulative ? pathNormal : undefined,
      pathAcm: updateCumulative ? pathAcm : undefined,
      pathLme: updateCumulative ? pathLme : undefined,
      pathOptions: updateCumulative ? pathOptions : undefined,
      pathSpread: updateCumulative ? pathSpread : undefined,
    };
  };

  // Run lot statistics process (JSON results)
  const handleRunProcess = async () => {
    if (runMode === 'upload' && (!files.fileDsgd || !files.fileFr)) {
      toast.error('Vui lòng chọn tối thiểu File DSGD và File FR.');
      return;
    }
    if (runMode === 'folder' && (!folderPathMs.trim() || !folderPathCqg.trim())) {
      toast.error('Vui lòng nhập đầy đủ cả đường dẫn thư mục MS và CQG.');
      return;
    }

    setLoading(true);
    setResult(null);
    const toastId = toast.loading('Đang xử lý thống kê số lot...');

    try {
      let res: Response;
      if (runMode === 'upload') {
        const formData = buildFormData();
        res = await fetch(`${apiBaseUrl}/lot-statistics/process`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        const payload = buildJsonPayload();
        res = await fetch(`${apiBaseUrl}/lot-statistics/process-local`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi chạy xử lý thống kê');

      setResult(data);
      const allPassed = data.validations?.every((v: any) => v.passed) ?? true;
      if (allPassed) {
        toast.success('Xử lý thống kê thành công! Tất cả chỉ số đối chiếu khớp.', { id: toastId, duration: 5000 });
      } else {
        toast('Xử lý hoàn thành: Phát hiện chênh lệch đối chiếu.', { id: toastId, icon: '⚠️', duration: 5000 });
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xử lý', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Process and download Excel workbook
  const handleDownloadExcel = async () => {
    if (runMode === 'upload' && (!files.fileDsgd || !files.fileFr)) {
      toast.error('Vui lòng chọn tối thiểu File DSGD và File FR.');
      return;
    }
    if (runMode === 'folder' && (!folderPathMs.trim() || !folderPathCqg.trim())) {
      toast.error('Vui lòng nhập đầy đủ cả đường dẫn thư mục MS và CQG.');
      return;
    }

    setDownloading(true);
    const toastId = toast.loading('Đang khởi tạo và xuất file Excel báo cáo...');

    try {
      let res: Response;
      if (runMode === 'upload') {
        const formData = buildFormData();
        res = await fetch(`${apiBaseUrl}/lot-statistics/process/download`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        const payload = buildJsonPayload();
        res = await fetch(`${apiBaseUrl}/lot-statistics/process-local/download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Lỗi khi xuất file Excel');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateClean = ngayGD.replace(/-/g, '');
      a.download = `Thong_ke_so_lot_${dateClean}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Tải báo cáo Excel thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tải báo cáo Excel', { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  const renderFileZone = (key: string, label: string, required = false) => {
    const file = files[key as keyof typeof files];
    return (
      <div className="bg-zinc-900/30 border border-zinc-800 p-3 rounded-lg flex flex-col gap-1.5 relative hover:border-zinc-700 transition">
        <label className="text-[11px] font-bold text-zinc-400 flex justify-between items-center">
          <span>{label} {required && <span className="text-red-400">*</span>}</span>
          {file && <span className="text-[10px] text-emerald-400 font-mono">Đã chọn</span>}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFileChange(key, e.target.files?.[0] || null)}
            className="w-full text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 file:cursor-pointer"
          />
          {file && (
            <button
              type="button"
              onClick={() => handleFileChange(key, null)}
              className="text-[10px] text-red-400 hover:text-red-300 font-semibold px-1"
            >
              Xóa
            </button>
          )}
        </div>
      </div>
    );
  };

  // Summarize results stats helper
  const getSummaryRow = (label: string, dsgd: number, fr: number, tttt: number, ttm: number, op: number, ps: number) => (
    <tr className="border-b border-zinc-900 hover:bg-zinc-900/10 font-mono text-xs">
      <td className="p-2.5 font-sans font-semibold text-zinc-300 text-left">{label}</td>
      <td className="p-2.5 text-right font-bold text-sky-400">{dsgd.toLocaleString()}</td>
      <td className="p-2.5 text-right font-bold text-indigo-400">{fr.toLocaleString()}</td>
      <td className="p-2.5 text-right text-zinc-400">{tttt.toLocaleString()}</td>
      <td className="p-2.5 text-right text-zinc-400">{ttm.toLocaleString()}</td>
      <td className="p-2.5 text-right text-zinc-400">{op.toLocaleString()}</td>
      <td className="p-2.5 text-right text-zinc-400">{ps.toLocaleString()}</td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-zinc-300">
      {/* Configuration Form */}
      <div className="glass-panel p-6 flex flex-col gap-5">
        <h4 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-3">
          <Info size={16} className="text-emerald-500" />
          1. Thông tin phiên & Tham số đối chiếu
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Ngày giao dịch</label>
            <input
              type="date"
              value={ngayGD || ''}
              onChange={(e) => setNgayGD(e.target.value)}
              className="form-input text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Kỳ hạn LME hết hạn</label>
            <input
              type="text"
              value={filterLmeKyHan || ''}
              onChange={(e) => setFilterLmeKyHan(e.target.value)}
              className="form-input text-xs font-mono"
              placeholder="U26"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Ngày TRU loại trừ (FR)</label>
            <input
              type="text"
              value={truDates || ''}
              onChange={(e) => setTruDates(e.target.value)}
              className="form-input text-xs font-mono"
              placeholder="comma-separated dates"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Ngày FEF loại trừ</label>
            <input
              type="text"
              value={fefDates || ''}
              onChange={(e) => setFefDates(e.target.value)}
              className="form-input text-xs font-mono"
              placeholder="comma-separated dates"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1">Ngày ZFT loại trừ</label>
            <input
              type="text"
              value={zftDates || ''}
              onChange={(e) => setZftDates(e.target.value)}
              className="form-input text-xs font-mono"
              placeholder="comma-separated dates"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-800/60 pt-4 items-center">
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-0.5">Deadline QO/QP/BM/MPO (Excel Serial)</label>
            <span className="text-[10px] text-zinc-500 block mb-1">Tương đương Sheet2!Y1 (Ví dụ: 46217.208333 cho ngày 06/07/2026 05:00:00)</span>
            <input
              type="text"
              value={deadline || ''}
              onChange={(e) => setDeadline(e.target.value)}
              className="form-input text-xs font-mono"
              placeholder="46217.208333"
            />
          </div>
          <div className="flex items-end justify-start h-full pb-1">
            <span className="text-xs text-zinc-500 bg-zinc-950/40 p-2.5 rounded border border-zinc-900 leading-normal flex items-start gap-1.5">
              <Info size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>Chuyển đổi hoàn toàn in-memory thay thế 30 sheet trung gian của Excel VBA Macro.</span>
            </span>
          </div>
        </div>
      </div>

      {/* File Source Panel */}
      <div className="glass-panel p-6 flex flex-col gap-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-zinc-800 pb-3">
          <FileSpreadsheet size={16} className="text-sky-400" />
          2. Chọn nguồn dữ liệu đối chiếu
        </h4>

        {/* Tab Selector */}
        <div className="flex gap-2 border-b border-zinc-800 pb-2">
          <button
            type="button"
            onClick={() => setRunMode('folder')}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition flex items-center gap-1.5 ${
              runMode === 'folder'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FolderOpen size={14} /> Chạy từ thư mục trên server
          </button>
          <button
            type="button"
            onClick={() => setRunMode('upload')}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition flex items-center gap-1.5 ${
              runMode === 'upload'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Upload size={14} /> Tải file lên từ máy local
          </button>
        </div>

        {/* Form content based on selected Mode */}
        {runMode === 'folder' ? (
          <div className="bg-zinc-900/30 border border-zinc-850 p-5 rounded-lg flex flex-col gap-4">
            
            {/* Quick generate panel */}
            <div className="bg-zinc-950/40 p-4 rounded border border-zinc-850 flex flex-col gap-3">
              <h5 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <RefreshCw size={13} className="text-emerald-500 animate-pulse" />
                Cấu hình Thư mục gốc & Tạo đường dẫn nhanh theo Ngày GD
              </h5>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                    Thư mục gốc MS (Backup MS)
                  </label>
                  <input
                    type="text"
                    value={basePathMs || ''}
                    onChange={(e) => handleBasePathMsChange(e.target.value)}
                    className="form-input text-xs font-mono w-full"
                    placeholder="M:\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                    Thư mục gốc CQG (Backup CQG)
                  </label>
                  <input
                    type="text"
                    value={basePathCqg || ''}
                    onChange={(e) => handleBasePathCqgChange(e.target.value)}
                    className="form-input text-xs font-mono w-full"
                    placeholder="M:\Quanlygiaodich\Tai lieu hoat dong\Backup CQG\Futures"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={applyQuickPaths}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-6 py-2 rounded text-xs transition font-bold flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={13} /> Tạo nhanh cả 2 thư mục theo Ngày GD
                </button>
              </div>
            </div>

            {/* Target Folder Inputs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Thư mục M-System (Chứa DSGD, TTM, TTTT) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={folderPathMs || ''}
                  onChange={(e) => setFolderPathMs(e.target.value)}
                  className="form-input text-xs font-mono w-full"
                  placeholder="M:\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T07.2026\16.07"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Thư mục CQG (Chứa FR, OP, PS) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={folderPathCqg || ''}
                  onChange={(e) => setFolderPathCqg(e.target.value)}
                  className="form-input text-xs font-mono w-full"
                  placeholder="M:\Quanlygiaodich\Tai lieu hoat dong\Backup CQG\Futures\2026\T07.2026\16.07"
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
                <span className="text-xs font-bold text-white">Cập nhật dữ liệu lũy kế năm</span>
              </label>

              {updateCumulative && (
                <div className="bg-zinc-950/20 border border-zinc-850/60 p-4 rounded-lg flex flex-col gap-4 animate-fade-in">
                  <h6 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 mb-1">
                    <FileSpreadsheet size={13} className="text-emerald-500" />
                    Đường dẫn 6 file Excel lũy kế năm
                  </h6>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                        File DSGD lũy kế tháng
                      </label>
                      <input
                        type="text"
                        value={pathDsgdCumulative || ''}
                        onChange={(e) => setPathDsgdCumulative(e.target.value)}
                        className="form-input text-xs font-mono w-full text-zinc-300 bg-zinc-900/50 border-zinc-800"
                        placeholder="M:\...\Backup MS\Futures\2026\DSGD T07.2026.xlsx"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                        Tracker Standard Futures
                      </label>
                      <input
                        type="text"
                        value={pathNormal || ''}
                        onChange={(e) => setPathNormal(e.target.value)}
                        className="form-input text-xs font-mono w-full text-zinc-300 bg-zinc-900/50 border-zinc-800"
                        placeholder="M:\...\Thong ke so lot giao dich 2026 2.xlsx"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                        Tracker ACM
                      </label>
                      <input
                        type="text"
                        value={pathAcm || ''}
                        onChange={(e) => setPathAcm(e.target.value)}
                        className="form-input text-xs font-mono w-full text-zinc-300 bg-zinc-900/50 border-zinc-800"
                        placeholder="M:\...\Thong ke so lot giao dich ACM 2026 2.xlsx"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                        Tracker LME
                      </label>
                      <input
                        type="text"
                        value={pathLme || ''}
                        onChange={(e) => setPathLme(e.target.value)}
                        className="form-input text-xs font-mono w-full text-zinc-300 bg-zinc-900/50 border-zinc-800"
                        placeholder="M:\...\Thong ke so lot giao dich LME 2026.xlsx"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                        Tracker Options
                      </label>
                      <input
                        type="text"
                        value={pathOptions || ''}
                        onChange={(e) => setPathOptions(e.target.value)}
                        className="form-input text-xs font-mono w-full text-zinc-300 bg-zinc-900/50 border-zinc-800"
                        placeholder="M:\...\Thong ke so lot giao dich Options 2026.xlsx"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                        Tracker Spread
                      </label>
                      <input
                        type="text"
                        value={pathSpread || ''}
                        onChange={(e) => setPathSpread(e.target.value)}
                        className="form-input text-xs font-mono w-full text-zinc-300 bg-zinc-900/50 border-zinc-800"
                        placeholder="M:\...\Thong ke so lot giao dich Spread 2026.xlsx"
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
                  Hệ thống sẽ quét độc lập thư mục MS (đọc DSGD, TTM, TTTT) và thư mục CQG (đọc FR, OP, PS) để tự động nạp dữ liệu.
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
            {renderFileZone('fileDsgd', 'File M-System DSGD (DSGD.xlsx)', true)}
            {renderFileZone('fileFr', 'File CQG FR (FR.xlsx)', true)}
            {renderFileZone('fileTtm', 'File M-System TTM (TTM.xlsx)')}
            {renderFileZone('fileTttt', 'File M-System TTTT (TTTT.xlsx)')}
            {renderFileZone('fileOp', 'File CQG OP (OP.xlsx)')}
            {renderFileZone('filePs', 'File CQG PS (PS.xlsx)')}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-4 border-t border-zinc-800/80 pt-4">
          {runMode === 'upload' && (
            <button
              type="button"
              onClick={() => setFiles({})}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 px-4 py-2 rounded text-xs transition font-semibold"
            >
              Reset Files
            </button>
          )}
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={
              downloading || 
              loading || 
              (runMode === 'upload' && (!files.fileDsgd || !files.fileFr)) ||
              (runMode === 'folder' && (!folderPathMs.trim() || !folderPathCqg.trim()))
            }
            className="btn btn-secondary px-5 py-2 flex items-center gap-1.5 text-xs font-bold"
          >
            <Download size={14} className={downloading ? 'animate-bounce' : ''} />
            {downloading ? 'Đang xuất Excel...' : 'Tải Excel Báo cáo'}
          </button>
          <button
            type="button"
            onClick={handleRunProcess}
            disabled={
              loading || 
              downloading || 
              (runMode === 'upload' && (!files.fileDsgd || !files.fileFr)) ||
              (runMode === 'folder' && (!folderPathMs.trim() || !folderPathCqg.trim()))
            }
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
              📊 Bảng tổng hợp số lot
            </button>
            <button
              type="button"
              onClick={() => setResultTab('validations')}
              className={`px-4 py-2 text-xs font-bold rounded-t-md transition ${
                resultTab === 'validations'
                  ? 'bg-zinc-800 text-white border-b-2 border-emerald-500'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🔎 Kiểm tra đối chiếu validations ({result.validations?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setResultTab('product')}
              className={`px-4 py-2 text-xs font-bold rounded-t-md transition ${
                resultTab === 'product'
                  ? 'bg-zinc-800 text-white border-b-2 border-emerald-500'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              📦 Chi tiết theo sản phẩm ({result.byProduct?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setResultTab('tvkd')}
              className={`px-4 py-2 text-xs font-bold rounded-t-md transition ${
                resultTab === 'tvkd'
                  ? 'bg-zinc-800 text-white border-b-2 border-emerald-500'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🏢 Chi tiết theo TVKD ({result.byTvkd?.length ?? 0})
            </button>
          </div>

          {/* Result content */}
          {resultTab === 'summary' && (
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h5 className="text-sm font-bold text-white mb-2">📊 Bảng đối chiếu số lot giữa các báo cáo</h5>
              
              <div className="overflow-x-auto border border-zinc-800 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-900/50 border-b border-zinc-850 text-zinc-400 font-bold">
                      <th className="p-2.5">Loại phân loại lot</th>
                      <th className="p-2.5 text-right text-sky-400">DSGD (M-System)</th>
                      <th className="p-2.5 text-right text-indigo-400">FR (CQG)</th>
                      <th className="p-2.5 text-right">TTTT</th>
                      <th className="p-2.5 text-right">TTM</th>
                      <th className="p-2.5 text-right">OP</th>
                      <th className="p-2.5 text-right">PS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSummaryRow(
                      'Lot Product (Thường)',
                      result.summary.dsgdProduct,
                      result.summary.frProduct,
                      result.summary.ttttProduct,
                      result.summary.ttmProduct,
                      result.summary.opProduct,
                      result.summary.psProduct
                    )}
                    {getSummaryRow(
                      'Lot Spread (Tài khoản -S)',
                      result.summary.dsgdSpread,
                      result.summary.frSpread,
                      result.summary.ttttSpread,
                      result.summary.ttmSpread,
                      result.summary.opSpread,
                      result.summary.psSpread
                    )}
                    {getSummaryRow(
                      'Lot LME (Tài khoản -L / LME)',
                      result.summary.dsgdLme,
                      result.summary.frLme,
                      result.summary.ttttLme,
                      result.summary.ttmLme,
                      result.summary.opLme,
                      result.summary.psLme
                    )}
                    {getSummaryRow(
                      'Lot Options (HĐ Option C.* / P.*)',
                      result.summary.dsgdOptions,
                      result.summary.frOptions,
                      result.summary.ttttOptions,
                      result.summary.ttmOptions,
                      result.summary.opOptions,
                      result.summary.psOptions
                    )}
                  </tbody>
                </table>
              </div>

              {/* ACM summary */}
              <div className="bg-zinc-950/50 border border-zinc-900 p-4 rounded-lg flex items-center justify-between flex-wrap gap-4 mt-2">
                <div>
                  <p className="text-xs font-bold text-white">Tổng số lot tự doanh ACM (Tài khoản -A)</p>
                  <p className="text-[10px] text-zinc-500">Được trích lọc tự động từ danh sách tài khoản ACM.</p>
                </div>
                <p className="text-lg font-mono font-extrabold text-emerald-400">
                  {result.summary.acmLot?.toLocaleString() ?? 0} <span className="text-xs font-sans text-zinc-500 font-semibold">lot</span>
                </p>
              </div>
            </div>
          )}

          {resultTab === 'validations' && (
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h5 className="text-sm font-bold text-white mb-2">🔎 Kết quả kiểm tra đối chiếu (Validations)</h5>
              <div className="flex flex-col gap-3">
                {result.validations?.map((item: any, i: number) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-xs font-medium ${
                      item.passed
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/5 border-red-500/20 text-red-400'
                    }`}
                  >
                    {item.passed ? (
                      <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
                    )}
                    <div className="flex-1">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <strong className="font-bold uppercase text-[11px] tracking-wider text-zinc-300">{item.field}</strong>
                        <span className="font-mono text-zinc-400">
                          Kỳ vọng: {item.expected} | Thực tế: {item.actual}
                        </span>
                      </div>
                      <p className="text-zinc-400 mt-1 text-[11px] font-sans">{item.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultTab === 'product' && (
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h5 className="text-sm font-bold text-white mb-2">📦 Thống kê chi tiết theo Mã Sản Phẩm</h5>
              <div className="overflow-x-auto border border-zinc-800 rounded-lg max-h-[450px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-900/60 sticky top-0 border-b border-zinc-800 z-10">
                    <tr className="text-zinc-400 font-bold">
                      <th className="p-2.5">Mã Sản phẩm</th>
                      <th className="p-2.5 text-right">Tổng DSGD</th>
                      <th className="p-2.5 text-right">Spread DSGD</th>
                      <th className="p-2.5 text-right">LME DSGD</th>
                      <th className="p-2.5 text-right font-bold text-sky-400">Product DSGD</th>
                      <th className="p-2.5 text-right">Tổng FR</th>
                      <th className="p-2.5 text-right font-bold text-indigo-400">Product FR</th>
                      <th className="p-2.5 text-right text-red-400">Lệch Product</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.byProduct?.map((item: any, i: number) => {
                      const diff = (item.dsgdProduct ?? 0) - (item.frProduct ?? 0);
                      return (
                        <tr key={i} className="border-b border-zinc-900 hover:bg-zinc-900/10 font-mono">
                          <td className="p-2.5 font-sans font-bold text-white text-left">{item.productCode}</td>
                          <td className="p-2.5 text-right text-zinc-400">{(item.dsgdTotal ?? 0).toLocaleString()}</td>
                          <td className="p-2.5 text-right text-zinc-500">{(item.dsgdSpread ?? 0).toLocaleString()}</td>
                          <td className="p-2.5 text-right text-zinc-500">{(item.dsgdLme ?? 0).toLocaleString()}</td>
                          <td className="p-2.5 text-right font-bold text-sky-400">{(item.dsgdProduct ?? 0).toLocaleString()}</td>
                          <td className="p-2.5 text-right text-zinc-400">{(item.frTotal ?? 0).toLocaleString()}</td>
                          <td className="p-2.5 text-right font-bold text-indigo-400">{(item.frProduct ?? 0).toLocaleString()}</td>
                          <td className={`p-2.5 text-right font-bold ${diff !== 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                            {diff.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {resultTab === 'tvkd' && (
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h5 className="text-sm font-bold text-white mb-2">🏢 Thống kê chi tiết theo TVKD</h5>
              <div className="overflow-x-auto border border-zinc-800 rounded-lg max-h-[450px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-900/60 sticky top-0 border-b border-zinc-800 z-10">
                    <tr className="text-zinc-400 font-bold font-sans">
                      <th className="p-2.5">Mã TVKD</th>
                      <th className="p-2.5">Tên Thành Viên</th>
                      <th className="p-2.5 text-right">Tổng DSGD</th>
                      <th className="p-2.5 text-right">Spread DSGD</th>
                      <th className="p-2.5 text-right">LME DSGD</th>
                      <th className="p-2.5 text-right">Options DSGD</th>
                      <th className="p-2.5 text-right font-bold text-sky-400">Product DSGD</th>
                      <th className="p-2.5 text-right">ACM Lot (-A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.byTvkd?.map((item: any, i: number) => (
                      <tr key={i} className="border-b border-zinc-900 hover:bg-zinc-900/10 font-mono">
                        <td className="p-2.5 font-sans font-bold text-emerald-400 text-left">{item.tvkdCode}</td>
                        <td className="p-2.5 font-sans text-zinc-400 text-left truncate max-w-48">{item.tvkdName || 'N/A'}</td>
                        <td className="p-2.5 text-right text-zinc-400">{(item.dsgdTotal ?? 0).toLocaleString()}</td>
                        <td className="p-2.5 text-right text-zinc-500">{(item.dsgdSpread ?? 0).toLocaleString()}</td>
                        <td className="p-2.5 text-right text-zinc-500">{(item.dsgdLme ?? 0).toLocaleString()}</td>
                        <td className="p-2.5 text-right text-zinc-500">{(item.dsgdOptions ?? 0).toLocaleString()}</td>
                        <td className="p-2.5 text-right font-bold text-sky-400">{(item.dsgdProduct ?? 0).toLocaleString()}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-400">{(item.acmLot ?? 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
