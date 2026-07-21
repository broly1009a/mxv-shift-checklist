'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Play,
  RefreshCw,
  Upload,
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
  } while (prev.getDay() === 0 || prev.getDay() === 6);
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
  const [deadline, setDeadline] = useState('46217.208333');

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
    if (savedMs) setBasePathMs(savedMs);
    const savedCqg = localStorage.getItem('lot_stats_base_path_cqg');
    if (savedCqg) setBasePathCqg(savedCqg);
  }, []);

  // Automatically compute and sync paths when ngayGD or base paths change
  useEffect(() => {
    if (!ngayGD) return;
    const parts = ngayGD.split('-');
    if (parts.length !== 3) return;
    const [year, month, day] = parts;
    
    const cleanBaseMs = basePathMs.trim().replace(/\/$/, '').replace(/\\$/, '');
    const computedMs = `${cleanBaseMs}\\${year}\\T${month}.${year}\\${day}.${month}`;
    setFolderPathMs(computedMs);

    const cleanBaseCqg = basePathCqg.trim().replace(/\/$/, '').replace(/\\$/, '');
    const computedCqg = `${cleanBaseCqg}\\${year}\\T${month}.${year}\\${day}.${month}`;
    setFolderPathCqg(computedCqg);

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
    
    const cleanBaseMs = basePathMs.trim().replace(/\/$/, '').replace(/\\$/, '');
    const computedMs = `${cleanBaseMs}\\${year}\\T${month}.${year}\\${day}.${month}`;
    setFolderPathMs(computedMs);

    const cleanBaseCqg = basePathCqg.trim().replace(/\/$/, '').replace(/\\$/, '');
    const computedCqg = `${cleanBaseCqg}\\${year}\\T${month}.${year}\\${day}.${month}`;
    setFolderPathCqg(computedCqg);

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

  useEffect(() => {
    if (!token) return;
    fetch(`${apiBaseUrl}/lot-statistics/config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.defaultLmeKyHan) setFilterLmeKyHan(data.defaultLmeKyHan);
          if (data.defaultPathDsgd) {
            const lastSlash = Math.max(data.defaultPathDsgd.lastIndexOf('\\'), data.defaultPathDsgd.lastIndexOf('/'));
            if (lastSlash > 0) setFolderPathMs(data.defaultPathDsgd.substring(0, lastSlash));
          }
          if (data.defaultPathFr) {
            const lastSlash = Math.max(data.defaultPathFr.lastIndexOf('\\'), data.defaultPathFr.lastIndexOf('/'));
            if (lastSlash > 0) setFolderPathCqg(data.defaultPathFr.substring(0, lastSlash));
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

  const handleFileChange = (key: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const parseDates = (str: string) => {
    const dates = str.split(',').map((d) => d.trim()).filter(Boolean);
    return JSON.stringify(dates);
  };

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

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    display: 'block',
  };

  const renderFileZone = (key: string, label: string, required = false) => {
    const file = files[key as keyof typeof files];
    return (
      <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</span>
          {file && <span style={{ fontSize: '0.65rem', color: '#10b981', fontFamily: 'monospace' }}>Đã chọn</span>}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFileChange(key, e.target.files?.[0] || null)}
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
          />
          {file && (
            <button
              type="button"
              onClick={() => handleFileChange(key, null)}
              style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Xóa
            </button>
          )}
        </div>
      </div>
    );
  };

  const getSummaryRow = (label: string, dsgd: number, fr: number, tttt: number, ttm: number, op: number, ps: number) => (
    <tr style={{ borderBottom: '1px solid var(--border-color)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
      <td style={{ padding: '10px 12px', fontFamily: 'sans-serif', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>{dsgd.toLocaleString()}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#6366f1' }}>{fr.toLocaleString()}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{tttt.toLocaleString()}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{ttm.toLocaleString()}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{op.toLocaleString()}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{ps.toLocaleString()}</td>
    </tr>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', color: 'var(--text-primary)' }} className="animate-fade-in">
      {/* Configuration Form */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', margin: 0 }}>
          <Info size={16} color="#10b981" />
          1. Thông tin phiên & Tham số đối chiếu
        </h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Ngày giao dịch</label>
            <input
              type="date"
              value={ngayGD || ''}
              onChange={(e) => setNgayGD(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '8px 12px' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Kỳ hạn LME hết hạn</label>
            <input
              type="text"
              value={filterLmeKyHan || ''}
              onChange={(e) => setFilterLmeKyHan(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace' }}
              placeholder="U26"
            />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Ngày TRU loại trừ (FR)</label>
            <input
              type="text"
              value={truDates || ''}
              onChange={(e) => setTruDates(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace' }}
              placeholder="comma-separated dates"
            />
          </div>
          <div>
            <label style={labelStyle}>Ngày FEF loại trừ</label>
            <input
              type="text"
              value={fefDates || ''}
              onChange={(e) => setFefDates(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace' }}
              placeholder="comma-separated dates"
            />
          </div>
          <div>
            <label style={labelStyle}>Ngày ZFT loại trừ</label>
            <input
              type="text"
              value={zftDates || ''}
              onChange={(e) => setZftDates(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace' }}
              placeholder="comma-separated dates"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', alignItems: 'center' }}>
          <div>
            <label style={labelStyle}>Deadline QO/QP/BM/MPO (Excel Serial)</label>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Tương đương Sheet2!Y1 (Ví dụ: 46217.208333 cho ngày 06/07/2026 05:00:00)</span>
            <input
              type="text"
              value={deadline || ''}
              onChange={(e) => setDeadline(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace' }}
              placeholder="46217.208333"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-input)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
              <Info size={16} color="#10b981" style={{ flexShrink: 0 }} />
              <span>Chuyển đổi hoàn toàn in-memory thay thế 30 sheet trung gian của Excel VBA Macro.</span>
            </span>
          </div>
        </div>
      </div>

      {/* File Source Panel */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', margin: 0 }}>
          <FileSpreadsheet size={16} color="#0284c7" />
          2. Chọn nguồn dữ liệu đối chiếu
        </h4>

        {/* Tab Selector */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <button
            type="button"
            onClick={() => setRunMode('folder')}
            style={{
              padding: '8px 16px',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: runMode === 'folder' ? '1px solid #10b981' : '1px solid var(--border-color)',
              backgroundColor: runMode === 'folder' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-input)',
              color: runMode === 'folder' ? '#10b981' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FolderOpen size={14} /> Chạy từ thư mục trên server
          </button>
          <button
            type="button"
            onClick={() => setRunMode('upload')}
            style={{
              padding: '8px 16px',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: runMode === 'upload' ? '1px solid #10b981' : '1px solid var(--border-color)',
              backgroundColor: runMode === 'upload' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-input)',
              color: runMode === 'upload' ? '#10b981' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Upload size={14} /> Tải file lên từ máy local
          </button>
        </div>

        {/* Form content based on selected Mode */}
        {runMode === 'folder' ? (
          <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Quick generate panel */}
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <RefreshCw size={14} color="#10b981" />
                Cấu hình Thư mục gốc & Tạo đường dẫn nhanh theo Ngày GD
              </h5>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Thư mục gốc MS (Backup MS)</label>
                  <input
                    type="text"
                    value={basePathMs || ''}
                    onChange={(e) => handleBasePathMsChange(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                    placeholder="M:\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Thư mục gốc CQG (Backup CQG)</label>
                  <input
                    type="text"
                    value={basePathCqg || ''}
                    onChange={(e) => handleBasePathCqgChange(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                    placeholder="M:\Quanlygiaodich\Tai lieu hoat dong\Backup CQG\Futures"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={applyQuickPaths}
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RefreshCw size={13} /> Tạo nhanh cả 2 thư mục theo Ngày GD
                </button>
              </div>
            </div>

            {/* Target Folder Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              <div>
                <label style={labelStyle}>
                  Thư mục M-System (Chứa DSGD, TTM, TTTT) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={folderPathMs || ''}
                  onChange={(e) => setFolderPathMs(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                  placeholder="M:\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures\2026\T07.2026\16.07"
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Thư mục CQG (Chứa FR, OP, PS) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={folderPathCqg || ''}
                  onChange={(e) => setFolderPathCqg(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                  placeholder="M:\Quanlygiaodich\Tai lieu hoat dong\Backup CQG\Futures\2026\T07.2026\16.07"
                />
              </div>
            </div>

            {/* Cumulative Update Panel */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={updateCumulative}
                  onChange={(e) => setUpdateCumulative(e.target.checked)}
                  style={{ accentColor: '#10b981' }}
                />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Cập nhật dữ liệu lũy kế năm</span>
              </label>

              {updateCumulative && (
                <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h6 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                    <FileSpreadsheet size={13} color="#10b981" />
                    Đường dẫn 6 file Excel lũy kế năm
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    <div>
                      <label style={labelStyle}>File DSGD lũy kế tháng</label>
                      <input
                        type="text"
                        value={pathDsgdCumulative || ''}
                        onChange={(e) => setPathDsgdCumulative(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                        placeholder="M:\...\Backup MS\Futures\2026\DSGD T07.2026.xlsx"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Tracker Standard Futures</label>
                      <input
                        type="text"
                        value={pathNormal || ''}
                        onChange={(e) => setPathNormal(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                        placeholder="M:\...\Thong ke so lot giao dich 2026 2.xlsx"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Tracker ACM</label>
                      <input
                        type="text"
                        value={pathAcm || ''}
                        onChange={(e) => setPathAcm(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                        placeholder="M:\...\Thong ke so lot giao dich ACM 2026 2.xlsx"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Tracker LME</label>
                      <input
                        type="text"
                        value={pathLme || ''}
                        onChange={(e) => setPathLme(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                        placeholder="M:\...\Thong ke so lot giao dich LME 2026.xlsx"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Tracker Options</label>
                      <input
                        type="text"
                        value={pathOptions || ''}
                        onChange={(e) => setPathOptions(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                        placeholder="M:\...\Thong ke so lot giao dich Options 2026.xlsx"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Tracker Spread</label>
                      <input
                        type="text"
                        value={pathSpread || ''}
                        onChange={(e) => setPathSpread(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                        placeholder="M:\...\Thong ke so lot giao dich Spread 2026.xlsx"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '14px', flexWrap: 'wrap', gap: '12px' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <Info size={14} color="#10b981" style={{ flexShrink: 0 }} />
                <span>Hệ thống sẽ quét độc lập thư mục MS (đọc DSGD, TTM, TTTT) và thư mục CQG (đọc FR, OP, PS) để tự động nạp dữ liệu.</span>
              </p>
              
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '8px 16px' }}
              >
                <RefreshCw size={12} className={savingConfig ? 'animate-spin' : ''} />
                Lưu cấu hình mặc định
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {renderFileZone('fileDsgd', 'File M-System DSGD (DSGD.xlsx)', true)}
            {renderFileZone('fileFr', 'File CQG FR (FR.xlsx)', true)}
            {renderFileZone('fileTtm', 'File M-System TTM (TTM.xlsx)')}
            {renderFileZone('fileTttt', 'File M-System TTTT (TTTT.xlsx)')}
            {renderFileZone('fileOp', 'File CQG OP (OP.xlsx)')}
            {renderFileZone('filePs', 'File CQG PS (PS.xlsx)')}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          {runMode === 'upload' && (
            <button
              type="button"
              onClick={() => setFiles({})}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '8px 16px' }}
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
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '8px 18px', fontWeight: 700 }}
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
            className="btn btn-primary"
            style={{ fontSize: '0.75rem', padding: '8px 22px', fontWeight: 700 }}
          >
            <Play size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Đang đối chiếu...' : 'Chạy kiểm thử trực tuyến'}
          </button>
        </div>
      </div>

      {/* Results View */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
          {/* Tabs bar */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', flexWrap: 'wrap' }}>
            {[
              { id: 'summary', label: '📊 Bảng tổng hợp số lot' },
              { id: 'validations', label: `🔎 Kiểm tra đối chiếu validations (${result.validations?.length ?? 0})` },
              { id: 'product', label: `📦 Chi tiết theo sản phẩm (${result.byProduct?.length ?? 0})` },
              { id: 'tvkd', label: `🏢 Chi tiết theo TVKD (${result.byTvkd?.length ?? 0})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setResultTab(t.id as any)}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderRadius: '6px 6px 0 0',
                  border: 'none',
                  borderBottom: resultTab === t.id ? '2px solid #10b981' : '2px solid transparent',
                  color: resultTab === t.id ? '#10b981' : 'var(--text-secondary)',
                  backgroundColor: resultTab === t.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Result content */}
          {resultTab === 'summary' && (
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h5 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>📊 Bảng đối chiếu số lot giữa các báo cáo</h5>
              
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <table style={{ width: '100%', textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      <th style={{ padding: '10px 12px' }}>Loại phân loại lot</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#0284c7' }}>DSGD (M-System)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#6366f1' }}>FR (CQG)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>TTTT</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>TTM</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>OP</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>PS</th>
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
              <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>Tổng số lot tự doanh ACM (Tài khoản -A)</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Được trích lọc tự động từ danh sách tài khoản ACM.</p>
                </div>
                <p style={{ fontSize: '1.2rem', fontFamily: 'monospace', fontWeight: 800, color: '#10b981', margin: 0 }}>
                  {result.summary.acmLot?.toLocaleString() ?? 0} <span style={{ fontSize: '0.75rem', fontFamily: 'sans-serif', color: 'var(--text-muted)' }}>lot</span>
                </p>
              </div>
            </div>
          )}

          {resultTab === 'validations' && (
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h5 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>🔎 Kết quả kiểm tra đối chiếu (Validations)</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {result.validations?.map((item: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: item.passed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                      backgroundColor: item.passed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      fontSize: '0.75rem',
                    }}
                  >
                    {item.passed ? (
                      <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : (
                      <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <strong style={{ fontWeight: 800, textTransform: 'uppercase', color: item.passed ? '#10b981' : '#ef4444' }}>{item.field}</strong>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          Kỳ vọng: {item.expected} | Thực tế: {item.actual}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>{item.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultTab === 'product' && (
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h5 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>📦 Thống kê chi tiết theo Mã Sản Phẩm</h5>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px', maxHeight: '450px' }}>
                <table style={{ width: '100%', textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      <th style={{ padding: '10px 12px' }}>Mã Sản phẩm</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tổng DSGD</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Spread DSGD</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>LME DSGD</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#0284c7' }}>Product DSGD</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tổng FR</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#6366f1' }}>Product FR</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#ef4444' }}>Lệch Product</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.byProduct?.map((item: any, i: number) => {
                      const diff = (item.dsgdProduct ?? 0) - (item.frProduct ?? 0);
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', fontFamily: 'monospace' }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'sans-serif', fontWeight: 800, color: 'var(--text-primary)' }}>{item.productCode}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{(item.dsgdTotal ?? 0).toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{(item.dsgdSpread ?? 0).toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{(item.dsgdLme ?? 0).toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>{(item.dsgdProduct ?? 0).toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{(item.frTotal ?? 0).toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#6366f1' }}>{(item.frProduct ?? 0).toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: diff !== 0 ? '#ef4444' : 'var(--text-muted)' }}>
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
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h5 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>🏢 Thống kê chi tiết theo TVKD</h5>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px', maxHeight: '450px' }}>
                <table style={{ width: '100%', textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      <th style={{ padding: '10px 12px' }}>Mã TVKD</th>
                      <th style={{ padding: '10px 12px' }}>Tên Thành Viên</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tổng DSGD</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Spread DSGD</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>LME DSGD</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Options DSGD</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#0284c7' }}>Product DSGD</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#10b981' }}>ACM Lot (-A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.byTvkd?.map((item: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', fontFamily: 'monospace' }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'sans-serif', fontWeight: 800, color: '#10b981' }}>{item.tvkdCode}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'sans-serif', color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.tvkdName || 'N/A'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{(item.dsgdTotal ?? 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{(item.dsgdSpread ?? 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{(item.dsgdLme ?? 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{(item.dsgdOptions ?? 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>{(item.dsgdProduct ?? 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>{(item.acmLot ?? 0).toLocaleString()}</td>
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
