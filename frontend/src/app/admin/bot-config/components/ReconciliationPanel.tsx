'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Play,
  RefreshCw,
  Activity,
  Upload,
  FileText,
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
    const toastId = toast.loading('Bot đang đăng nhập M-System và tải file đối chiếu... (2-5 phút)');
    try {
      const res = await fetch(`${apiBaseUrl}/reconciliation/run-auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ usdRate: reconUsdRate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Bot đối chiếu thất bại');
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
        { label: 'Tổng MS', value: `${reconResult.results.klgd.totals?.totalDSGD ?? '—'} lot`, color: '#0284c7' },
        { label: 'Tổng CQG', value: `${reconResult.results.klgd.totals?.totalFR ?? '—'} lot`, color: '#0284c7' },
        { label: 'Chênh lệch', value: `${reconResult.results.klgd.totals?.differ ?? '—'} lot`, color: reconResult.results.klgd.totals?.differ > 0 ? '#ef4444' : '#10b981' },
        { label: 'GD lệch chi tiết', value: `${reconResult.results.klgd.mismatchedTrades?.length ?? 0}`, color: reconResult.results.klgd.mismatchedTrades?.length > 0 ? '#ef4444' : '#10b981' },
        { label: 'TK lệch TTM', value: `${reconResult.results.klgd.mismatchedTTM?.length ?? 0}`, color: reconResult.results.klgd.mismatchedTTM?.length > 0 ? '#f59e0b' : '#10b981' },
      ];
    }
    if (reconResult.results?.eod) {
      eodStats = [
        { label: 'TK lệch số dư (≥1,000đ)', value: `${reconResult.results.eod.mismatchedEOD?.length ?? 0}`, color: reconResult.results.eod.mismatchedEOD?.length > 0 ? '#ef4444' : '#10b981' },
        { label: 'TK âm ký quỹ', value: `${reconResult.results.eod.negativeIMRAcc?.length ?? 0}`, color: reconResult.results.eod.negativeIMRAcc?.length > 0 ? '#ef4444' : '#10b981' },
      ];
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', color: 'var(--text-primary)' }} className="animate-fade-in">
      {/* Top action row */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>Chạy đối chiếu tự động</h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Bot tự động đăng nhập, download báo cáo và đối chiếu số liệu.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={handleLoadReconSampleDates}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '8px 16px' }}
          >
            <RefreshCw size={14} />
            Tải danh sách ngày mẫu
          </button>
          <button
            type="button"
            onClick={handleRunAutoRecon}
            disabled={reconAutoRunning}
            className="btn btn-primary"
            style={{ fontSize: '0.75rem', padding: '8px 20px', fontWeight: 700 }}
          >
            <Activity size={14} className={reconAutoRunning ? 'animate-spin' : ''} />
            {reconAutoRunning ? 'Bot đang xử lý...' : '🤖 Bot tự động đối chiếu'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
        <button
          type="button"
          onClick={() => { setReconTab('sample'); setReconResult(null); }}
          style={{
            padding: '8px 16px',
            fontSize: '0.75rem',
            fontWeight: 700,
            borderRadius: '6px 6px 0 0',
            border: 'none',
            borderBottom: reconTab === 'sample' ? '2px solid #10b981' : '2px solid transparent',
            color: reconTab === 'sample' ? '#10b981' : 'var(--text-secondary)',
            backgroundColor: reconTab === 'sample' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
            cursor: 'pointer',
          }}
        >
          📂 Chạy từ file mẫu local
        </button>
        <button
          type="button"
          onClick={() => { setReconTab('upload'); setReconResult(null); }}
          style={{
            padding: '8px 16px',
            fontSize: '0.75rem',
            fontWeight: 700,
            borderRadius: '6px 6px 0 0',
            border: 'none',
            borderBottom: reconTab === 'upload' ? '2px solid #10b981' : '2px solid transparent',
            color: reconTab === 'upload' ? '#10b981' : 'var(--text-secondary)',
            backgroundColor: reconTab === 'upload' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
            cursor: 'pointer',
          }}
        >
          📤 Upload file đối chiếu thủ công
        </button>
      </div>

      {/* Tab Contents */}
      {reconTab === 'sample' ? (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h5 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>📂 Chọn bộ file mẫu từ Backup MS</h5>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Ngày giao dịch mẫu</label>
              <select
                value={reconSelectedPath}
                onChange={(e) => setReconSelectedPath(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.75rem', padding: '8px 12px' }}
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
              <label style={labelStyle}>Tỷ giá USD/VND</label>
              <input
                type="number"
                value={reconUsdRate}
                onChange={(e) => setReconUsdRate(Number(e.target.value))}
                className="form-input"
                style={{ fontSize: '0.75rem', padding: '8px 12px' }}
                placeholder="25220"
              />
            </div>
            <button
              type="button"
              onClick={handleRunReconTest}
              disabled={reconRunning || !reconSelectedPath}
              className="btn btn-primary"
              style={{ fontSize: '0.75rem', padding: '10px 16px', width: '100%', fontWeight: 700 }}
            >
              <Play size={14} className={reconRunning ? 'animate-spin' : ''} />
              {reconRunning ? 'Đang chạy đối chiếu...' : 'Chạy kiểm thử'}
            </button>
          </div>
          {reconSelectedPath && (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all', margin: '6px 0 0 0', backgroundColor: 'var(--bg-input)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              Đường dẫn local: {reconSelectedPath}
            </p>
          )}
        </div>
      ) : (
        /* Manual Upload */
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h5 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>📤 Tải lên các file báo cáo cần đối chiếu</h5>
            <div style={{ width: '160px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tỷ giá USD/VND</label>
              <input
                type="number"
                value={reconUsdRate}
                onChange={(e) => setReconUsdRate(Number(e.target.value))}
                className="form-input"
                style={{ fontSize: '0.75rem', padding: '6px 10px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* KLGD Files */}
            <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', borderLeft: '3px solid #0284c7', paddingLeft: '8px' }}>
                Đối chiếu khớp lệnh (KLGD)
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <div>
                  <label style={labelStyle}>File DSGD.xlsx (MS) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, dsgd: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <label style={labelStyle}>File FR1.xlsx (CQG)</label>
                  <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, fr1: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <label style={labelStyle}>File FR2.xlsx (CQG)</label>
                  <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, fr2: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <label style={labelStyle}>File TTM.xlsx (Optional)</label>
                  <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, ttm: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} />
                </div>
              </div>
            </div>

            {/* EOD & CQG Files */}
            <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', borderLeft: '3px solid #0284c7', paddingLeft: '8px' }}>
                Đối chiếu số dư EOD & CQG
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <div>
                  <label style={labelStyle}>File QLTKGD.xlsx (MS Balance) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, qltkgd: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <label style={labelStyle}>File TTTT.xlsx (MS Closed Positions) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, tttt: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <label style={labelStyle}>File eod.csv (MS EOD Report) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="file" accept=".csv" onChange={e => setManualFiles(prev => ({ ...prev, eod: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <label style={labelStyle}>File Accounts_Balances.xlsx (CQG Balance)</label>
                  <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, accountsBalances: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={() => setManualFiles({})}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '8px 16px' }}
            >
              Xóa các file đã chọn
            </button>
            <button
              type="button"
              onClick={handleRunUploadReconTest}
              disabled={reconUploadRunning}
              className="btn btn-primary"
              style={{ fontSize: '0.75rem', padding: '8px 20px', fontWeight: 700 }}
            >
              <Upload size={14} className={reconUploadRunning ? 'animate-spin' : ''} />
              {reconUploadRunning ? 'Đang chạy đối chiếu...' : 'Bắt đầu đối chiếu file upload'}
            </button>
          </div>
        </div>
      )}

      {/* Results Display */}
      {reconResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* KLGD Result */}
          {reconResult.errors?.klgd ? (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.75rem', color: '#ef4444' }}>
              ❌ KLGD - Lỗi đối chiếu: {reconResult.errors.klgd}
            </div>
          ) : reconResult.results?.klgd ? (
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <Activity size={14} color="#0284c7" />
                Đối chiếu khớp lệnh (KLGD)
              </h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                {klgdStats.map((stat, i) => (
                  <div key={i} style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>{stat.label}</p>
                    <p style={{ fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 800, color: stat.color, margin: 0 }}>{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* EOD Result */}
          {reconResult.errors?.eod ? (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.75rem', color: '#ef4444' }}>
              ❌ EOD - Lỗi đối chiếu: {reconResult.errors.eod}
            </div>
          ) : reconResult.results?.eod ? (
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <FileText size={14} color="#0284c7" />
                Đối chiếu số dư EOD
              </h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {eodStats.map((stat, i) => (
                  <div key={i} style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>{stat.label}</p>
                    <p style={{ fontSize: '1rem', fontFamily: 'monospace', fontWeight: 800, color: stat.color, margin: 0 }}>{stat.value}</p>
                  </div>
                ))}
              </div>
              {reconResult.results.eod.negativeIMRAcc?.length > 0 && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', padding: '10px 14px', borderRadius: '0 6px 6px 0', fontSize: '0.75rem', color: '#ef4444', fontFamily: 'monospace', fontWeight: 700 }}>
                  🚨 Tài khoản âm ký quỹ: {reconResult.results.eod.negativeIMRAcc.join(', ')}
                </div>
              )}
            </div>
          ) : null}

          {/* CQG Result */}
          {reconResult.errors?.cqg ? (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.75rem', color: '#ef4444' }}>
              ❌ CQG - Lỗi đối chiếu: {reconResult.errors.cqg}
            </div>
          ) : reconResult.results?.cqg !== undefined ? (
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>🔵 Đối chiếu số dư CQG</h5>
              <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', width: 'fit-content', minWidth: '220px' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>Số TK lệch số dư CQG (&gt;100 USD)</p>
                <p style={{ fontSize: '1.2rem', fontFamily: 'monospace', fontWeight: 800, color: reconResult.results.cqg.length > 0 ? '#ef4444' : '#10b981', margin: 0 }}>
                  {reconResult.results.cqg.length}
                </p>
              </div>

              {reconResult.results.cqg.length > 0 && (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                        <th style={{ padding: '10px 12px' }}>Mã TKGD</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>MS (USD)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>CQG (USD)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Chênh lệch</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconResult.results.cqg.slice(0, 20).map((r: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>{r.maTKGD}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{r.calculatedBalance?.toFixed(2)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{r.cqgBalance?.toFixed(2)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#ef4444', fontWeight: 800 }}>{r.differ?.toFixed(2)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.65rem', color: '#f59e0b', fontWeight: 700 }}>
                            {!r.inCQG ? '⚠️ Thiếu trên CQG' : !r.inMS ? '⚠️ Thiếu trên MS' : '⚠️ Lệch số dư'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
