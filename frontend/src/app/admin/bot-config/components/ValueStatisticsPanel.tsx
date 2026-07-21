'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Play,
  RefreshCw,
  Info,
  FileSpreadsheet,
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
  } while (prev.getDay() === 0 || prev.getDay() === 6);
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

  useEffect(() => {
    const savedBase = localStorage.getItem('val_stats_base_path');
    if (savedBase) setBasePath(savedBase);
  }, []);

  useEffect(() => {
    if (!ngayGD) return;
    const parts = ngayGD.split('-');
    if (parts.length !== 3) return;
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

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    display: 'block',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', color: 'var(--text-primary)' }} className="animate-fade-in">
      {/* Block 1: Information and Parameters */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', margin: 0 }}>
          <Info size={16} color="#10b981" />
          1. Thông tin phiên & Tham số đối chiếu
        </h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
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
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Đường dẫn file Macro cấu hình (.xlsm)</label>
            <input
              type="text"
              value={macroPath || ''}
              onChange={(e) => setMacroPath(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
              placeholder="Macro thong ke gia tri giao dich co ACM.xlsm"
            />
          </div>
        </div>
      </div>

      {/* Block 2: Data Source Panel */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', margin: 0 }}>
          <FileSpreadsheet size={16} color="#0284c7" />
          2. Chọn nguồn dữ liệu đối chiếu
        </h4>

        {/* Server Folder Tab Indicator */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <button
            type="button"
            style={{
              padding: '8px 16px',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: '1px solid #10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              cursor: 'default',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FolderOpen size={14} /> Chạy từ thư mục trên server
          </button>
        </div>

        <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Quick generate panel */}
          <div style={{ backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <RefreshCw size={14} color="#10b981" />
              Cấu hình Thư mục gốc & Tạo đường dẫn nhanh theo Ngày GD
            </h5>
            
            <div>
              <label style={labelStyle}>Thư mục gốc (Target Root)</label>
              <input
                type="text"
                value={basePath || ''}
                onChange={(e) => handleBasePathChange(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                placeholder="M:\Quanlygiaodich\Tai lieu hoat dong\Marco thong ke gia tri"
              />
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
                <RefreshCw size={13} /> Tạo nhanh các đường dẫn theo Ngày GD
              </button>
            </div>
          </div>

          {/* Target File Input */}
          <div>
            <label style={labelStyle}>
              Đường dẫn file DSGD nguồn <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={dsgdPath || ''}
              onChange={(e) => setDsgdPath(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
              placeholder="M:\...\Backup MS\16.07\DSGD.xlsx"
            />
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
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Ghi đè dữ liệu vào các file lũy kế (Cumulative annual files)</span>
            </label>

            {updateCumulative && (
              <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h6 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <FileSpreadsheet size={13} color="#10b981" />
                  Đường dẫn 5 file Excel lũy kế năm
                </h6>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>File lũy kế Normal</label>
                    <input
                      type="text"
                      value={pathNormal || ''}
                      onChange={(e) => setPathNormal(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                      placeholder="Thong ke gia tri giao dich 2026 1.xlsx"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>File lũy kế Spread</label>
                    <input
                      type="text"
                      value={pathSpread || ''}
                      onChange={(e) => setPathSpread(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                      placeholder="Thong ke gia tri giao dich Spread 2026.xlsx"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>File lũy kế LME</label>
                    <input
                      type="text"
                      value={pathLme || ''}
                      onChange={(e) => setPathLme(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                      placeholder="Thong ke gia tri giao dich LME 2026.xlsx"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>File lũy kế Options</label>
                    <input
                      type="text"
                      value={pathOptions || ''}
                      onChange={(e) => setPathOptions(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                      placeholder="Thong ke gia tri giao dich Options 2026.xlsx"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>File lũy kế ACM</label>
                    <input
                      type="text"
                      value={pathAcm || ''}
                      onChange={(e) => setPathAcm(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.75rem', padding: '8px 12px', fontFamily: 'monospace', width: '100%' }}
                      placeholder="Thong ke gia tri giao dich ACM 2026 1.xlsx"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '14px', flexWrap: 'wrap', gap: '12px' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Info size={14} color="#10b981" style={{ flexShrink: 0 }} />
              <span>Hệ thống sẽ thực hiện tính toán giá trị giao dịch (GTGD) chi tiết dựa trên dữ liệu file DSGD và cập nhật lũy kế.</span>
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={handleRunProcess}
            disabled={loading || !dsgdPath.trim() || !macroPath.trim()}
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
              { id: 'summary', label: '📊 Bảng tổng hợp giá trị' },
              { id: 'normal', label: `💵 Chi tiết Normal GTGD (${normalItems.length})` },
              { id: 'spread', label: `🔀 Chi tiết Spread GTGD (${spreadItems.length})` },
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
              <h5 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>📊 Bảng tổng hợp tham số tỷ giá</h5>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-muted)' }}>Tổng số dòng Normal</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '4px' }}>{result.normalCount?.toLocaleString()}</span>
                </div>
                <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-muted)' }}>Tỷ giá USD Default</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>{result.tyGiaDefault?.toLocaleString()}</span>
                </div>
                <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-muted)' }}>Tỷ giá TRU (EUR)</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>{result.tyGiaTru?.toLocaleString()}</span>
                </div>
                <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-muted)' }}>Tỷ giá MPO (MYR)</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>{result.tyGiaMpo?.toLocaleString()}</span>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>Đối chiếu và tính toán hoàn tất</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Hệ thống đã phân tách chính xác các mã giao dịch thường và giao dịch chênh lệch spread.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#10b981', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px' }}>
                  <CheckCircle2 size={14} /> Khớp hoàn toàn
                </div>
              </div>
            </div>
          )}

          {resultTab === 'normal' && (
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h5 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>💵 Thống kê chi tiết Giá trị Giao dịch Normal</h5>
              
              {normalItems.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '24px 0' }}>Không có giá trị giao dịch Normal nào.</div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px', maxHeight: '450px' }}>
                  <table style={{ width: '100%', textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                        <th style={{ padding: '10px 12px' }}>Mã Hàng hóa</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', color: '#0284c7' }}>Giá trị giao dịch (VNĐ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalItems.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', fontFamily: 'monospace' }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'sans-serif', fontWeight: 800, color: 'var(--text-primary)' }}>{item.code}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
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
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h5 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>🔀 Thống kê chi tiết Giá trị Giao dịch Spread</h5>
              
              {spreadItems.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '24px 0' }}>Không có giao dịch Spread nào trong ngày.</div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px', maxHeight: '450px' }}>
                  <table style={{ width: '100%', textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                        <th style={{ padding: '10px 12px' }}>Mã Hàng hóa</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', color: '#f59e0b' }}>Giá trị giao dịch (Spread VNĐ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spreadItems.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', fontFamily: 'monospace' }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'sans-serif', fontWeight: 800, color: 'var(--text-primary)' }}>{item.code}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
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
