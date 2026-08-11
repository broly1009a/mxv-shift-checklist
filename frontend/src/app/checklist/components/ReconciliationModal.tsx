'use client';

import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Play, AlertTriangle, CheckCircle2, Info, Download, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftLogId: string;
  taskId: string;
  taskName?: string;
  token: string;
  onSuccess: () => void;
}

export default function ReconciliationModal({
  isOpen,
  onClose,
  shiftLogId,
  taskId,
  taskName = '',
  token,
  onSuccess
}: ReconciliationModalProps) {
  // Determine mode based on taskId and taskName
  const taskNameUpper = taskName.toUpperCase();
  const taskIdUpper = taskId.toUpperCase();
  
  let mode: 'KLGD' | 'EOD' | 'CQG' | 'PRE_EOD' = 'KLGD';
  
  if (taskIdUpper === 'TASK_CHECK_KLGD') {
    mode = 'KLGD';
  } else if (taskIdUpper === 'TASK_CHECK_EOD') {
    mode = 'PRE_EOD';
  } else if (taskIdUpper === 'TASK_CHECK_CQG') {
    mode = 'CQG';
  } else {
    const isCQGMode = taskNameUpper.includes('CQG') || taskIdUpper.includes('CQG');
    const isEODMode = (taskNameUpper.includes('EOD') || taskIdUpper.includes('EOD')) && !isCQGMode;
    const isPreEODMode = taskIdUpper.includes('PRE_EOD') || taskNameUpper.includes('PRE_EOD');
    
    if (isPreEODMode) {
      mode = 'PRE_EOD';
    } else if (isCQGMode) {
      mode = 'CQG';
    } else if (isEODMode) {
      mode = 'EOD';
    } else {
      mode = 'KLGD';
    }
  }


  const [files, setFiles] = useState<Record<string, File | null>>({
    dsgd: null,
    fr: null,
    fr1: null,
    fr2: null,
    nano: null,
    ttm: null,
    op: null,
    op1: null,
    op2: null,
    // EOD / CQG files
    qltkgd: null,
    eod: null,
    tttt: null,
    accountsBalances: null,
    // Pre-EOD files
    acmTrades: null,
    cqgFr: null,
    cqgPs: null,
    // TTTT / PS files for KLGD
    ps: null,
    ps1: null,
    ps2: null
  });

  const [usdRate, setUsdRate] = useState<number>(25220);
  const [syncingRate, setSyncingRate] = useState<boolean>(false);

  const handleSyncUsdRate = async () => {
    setSyncingRate(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/reconciliation/sync-usd-rate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Lỗi đồng bộ tỷ giá');
      }

      const data = await response.json();
      if (data.success && data.rate) {
        setUsdRate(data.rate);
        toast.success(`Đồng bộ tỷ giá USD thành công: ${data.rate.toLocaleString('vi-VN')} VND`);
      } else {
        throw new Error('Không nhận được tỷ giá từ server');
      }
    } catch (error: any) {
      console.error('Error syncing exchange rate:', error);
      toast.error(`Lỗi đồng bộ tỷ giá: ${error.message}`);
    } finally {
      setSyncingRate(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const fetchUsdRate = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/reconciliation/usd-rate`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.rate) {
              setUsdRate(data.rate);
            }
          }
        } catch (error) {
          console.error('Error fetching stored USD rate:', error);
        }
      };

      const fetchSessionStart = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/system-settings/session_start_time`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            if (data && data.value) {
              setSessionStart(data.value);
            }
          }
        } catch (error) {
          console.error('Error fetching stored session start time:', error);
        }
      };

      fetchUsdRate();
      fetchSessionStart();
    }
  }, [isOpen, token]);
  
  const [tradingDate, setTradingDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [sessionStart, setSessionStart] = useState<string>('05:00');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [resultType, setResultType] = useState<'KLGD' | 'EOD' | 'CQG' | 'PRE_EOD'>('KLGD');

  if (!isOpen) return null;

  const handleFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFiles(prev => ({ ...prev, [key]: selectedFile }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (key: string, e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0] || null;
    setFiles(prev => ({ ...prev, [key]: droppedFile }));
  };

  const handleRunReconciliation = async () => {
    const formData = new FormData();
    formData.append('shiftLogId', shiftLogId);
    formData.append('taskId', taskId);
    formData.append('tradingDate', tradingDate);
    formData.append('sessionStart', sessionStart);

    let endpoint = `${API_BASE_URL}/api/v1/reconciliation/upload-klgd`;

    if (mode === 'PRE_EOD') {
      if (!files.dsgd) {
        toast.error('File DSGD.xlsx là bắt buộc!');
        return;
      }
      if (!files.acmTrades) {
        toast.error('File Straits CSV (EOD FO trades...) là bắt buộc!');
        return;
      }
      if (!files.cqgFr) {
        toast.error('File FR.xlsx là bắt buộc!');
        return;
      }
      if (!files.tttt) {
        toast.error('File TTTT.xlsx là bắt buộc!');
        return;
      }
      if (!files.cqgPs) {
        toast.error('File PS.xlsx là bắt buộc!');
        return;
      }
      formData.append('dsgd', files.dsgd);
      formData.append('acmTrades', files.acmTrades);
      formData.append('cqgFr', files.cqgFr);
      formData.append('tttt', files.tttt);
      formData.append('cqgPs', files.cqgPs);
      endpoint = `${API_BASE_URL}/api/v1/reconciliation/upload-pre-eod`;
    } else if (mode === 'EOD') {
      if (!files.qltkgd) {
        toast.error('File QLTKGD.xlsx là bắt buộc!');
        return;
      }
      formData.append('qltkgd', files.qltkgd);
      if (files.eod) {
        formData.append('eod', files.eod);
      }
      endpoint = `${API_BASE_URL}/api/v1/reconciliation/upload-eod`;
    } else if (mode === 'CQG') {
      if (!files.qltkgd) {
        toast.error('File QLTKGD.xlsx là bắt buộc!');
        return;
      }
      if (!files.accountsBalances) {
        toast.error('File Accounts_Balances.xlsx là bắt buộc!');
        return;
      }
      formData.append('qltkgd', files.qltkgd);
      formData.append('accountsBalances', files.accountsBalances);
      formData.append('usdRate', usdRate.toString());
      endpoint = `${API_BASE_URL}/api/v1/reconciliation/upload-eod`;
    } else {
      if (!files.dsgd) {
        toast.error('File dsgd (M-System) là bắt buộc!');
        return;
      }
      Object.entries(files).forEach(([key, file]) => {
        if (file && ['dsgd', 'fr', 'fr1', 'fr2', 'nano', 'ttm', 'op', 'op1', 'op2', 'tttt', 'ps', 'ps1', 'ps2'].includes(key)) {
          formData.append(key, file);
        }
      });
    }

    setLoading(true);
    setResult(null);
    setResultType(mode);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Lỗi đối chiếu dữ liệu');
      }

      const data = await res.json();
      setResult(data.result);
      if (mode === 'PRE_EOD') {
        if (data.result.passed) {
          toast.success('Đối chiếu trước EOD thành công: Khớp hoàn toàn!');
        } else {
          toast.error('Đối chiếu trước EOD hoàn thành: Phát hiện chênh lệch!');
        }
      } else {
        if (data.success) {
          toast.success(mode === 'EOD' ? 'Đối chiếu EOD thành công: Không phát hiện tài khoản âm!' : 'Đối chiếu thành công: Dữ liệu khớp hoàn toàn!');
        } else {
          toast.error(mode === 'EOD' ? 'Đối chiếu EOD hoàn thành: Phát hiện tài khoản âm ký quỹ/âm số dư!' : 'Đối chiếu hoàn thành: Phát hiện chênh lệch dữ liệu!');
        }
      }
      onSuccess();
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!result || !result.excelBase64) return;
    const binaryStr = window.atob(result.excelBase64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = 'NegativeAccounts.xlsx';
    link.click();
  };

  const renderFileDropzone = (key: string, label: string, required = false) => {
    const file = files[key];
    const isCsv = key === 'eod' || key === 'acmTrades';
    const acceptTypes = isCsv ? '.csv,.xlsx,.xls' : '.xlsx,.xls';
    return (
      <div 
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(key, e)}
        style={{
          border: '1px dashed var(--border-color)',
          borderRadius: '10px',
          padding: '12px',
          background: 'rgba(255,255,255,0.01)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          position: 'relative',
          cursor: 'pointer',
          minHeight: '80px',
          transition: 'all 0.2s ease',
          borderColor: file ? 'var(--color-primary)' : 'var(--border-color)'
        }}
      >
        <input 
          type="file" 
          accept={acceptTypes}
          onChange={(e) => handleFileChange(key, e)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0,
            cursor: 'pointer'
          }}
        />
        <FileSpreadsheet size={20} color={file ? 'var(--color-primary)' : 'var(--text-muted)'} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {label} {required && <span style={{ color: 'red' }}>*</span>}
        </span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center', wordBreak: 'break-all' }}>
          {file ? file.name : `Kéo thả hoặc click để chọn file ${key === 'acmTrades' ? 'CSV/Excel' : isCsv ? 'CSV' : 'Excel'}`}
        </span>
      </div>
    );
  };

  const getRunButtonDisabled = () => {
    if (loading) return true;
    if (mode === 'PRE_EOD') {
      return !files.dsgd || !files.acmTrades || !files.cqgFr || !files.tttt || !files.cqgPs;
    }
    if (mode === 'EOD') return !files.qltkgd;
    if (mode === 'CQG') return !files.qltkgd || !files.accountsBalances;
    return !files.dsgd;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--glass-shadow)',
        animation: 'scaleIn 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.01)',
          flexShrink: 0
        }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet color="var(--color-accent)" size={22} />
            {mode === 'PRE_EOD' ? 'Đối Chiếu Trước EOD Tự Động' : mode === 'EOD' ? 'Lọc Tài Khoản Âm Ký Quỹ' : mode === 'CQG' ? 'Đối Chiếu Số Dư CQG Tự Động' : 'Đối Chiếu Khớp Lệnh & Trạng Thái Mở'}
          </h2>
          <button 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', flex: 1 }}>
          
          {/* Form input row */}
          <div className={mode === 'CQG' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'grid grid-cols-1 md:grid-cols-3 gap-4'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Ngày phiên giao dịch</label>
              <input 
                type="date" 
                value={tradingDate}
                onChange={(e) => setTradingDate(e.target.value)}
                className="form-input"
                style={{ height: '38px', fontSize: '0.85rem' }}
              />
            </div>

            {mode !== 'CQG' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Giờ bắt đầu phiên</label>
                <input 
                  type="time" 
                  value={sessionStart}
                  onChange={(e) => setSessionStart(e.target.value)}
                  className="form-input"
                  style={{ height: '38px', fontSize: '0.85rem' }}
                />
              </div>
            )}
            
            {mode === 'CQG' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Tỷ giá USD/VND đối chiếu</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="number" 
                    value={usdRate}
                    onChange={(e) => setUsdRate(parseFloat(e.target.value) || 0)}
                    className="form-input"
                    style={{ height: '38px', fontSize: '0.85rem', flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleSyncUsdRate}
                    disabled={syncingRate}
                    style={{
                      height: '38px',
                      padding: '0 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#ffffff',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      opacity: syncingRate ? 0.6 : 1
                    }}
                  >
                    <RefreshCw size={14} className={syncingRate ? 'animate-spin' : ''} />
                    {syncingRate ? 'Đang đồng bộ...' : 'Đồng bộ'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(59,130,246,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.1)' }}>
                  <Info size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
                  {mode === 'PRE_EOD'
                    ? 'Hệ thống đối chiếu trước EOD: xác thực ngày T-1 và đối chiếu khớp lệnh tự doanh/thường & vị thế mở (net position).'
                    : mode === 'EOD' 
                      ? 'Hệ thống đối chiếu tính toán số dư EOD của từng tài khoản dựa trên nộp rút, phí, và P/L thực tế (chuyển đổi tỷ giá động).' 
                      : 'Hệ thống đối chiếu chi tiết khớp lệnh của ca trực giữa M-System, CQG và ACM (Nano).'}
                </span>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0' }}></div>

          {/* Dynamic File selection based on mode */}
          {mode === 'PRE_EOD' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Group 1: 3 Files for trade volume reconciliation */}
              <div style={{ padding: '16px', background: 'rgba(128,128,128,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: '0.75rem', fontWeight: 800 }}>1</span>
                  Đối chiếu Khớp lệnh giao dịch (3 file: MS - ACM - CQG)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px' }}>
                  {renderFileDropzone('dsgd', 'File M-System (DSGD.xlsx)', true)}
                  {renderFileDropzone('acmTrades', 'File Straits CSV (ACM)', true)}
                  {renderFileDropzone('cqgFr', 'File CQG (FR.xlsx)', true)}
                </div>
              </div>

              {/* Group 2: 2 Files for Net Position reconciliation */}
              <div style={{ padding: '16px', background: 'rgba(128,128,128,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: '0.75rem', fontWeight: 800 }}>2</span>
                  Đối chiếu Vị thế mở ròng (2 file: MS - CQG)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px' }}>
                  {renderFileDropzone('tttt', 'File M-System (TTTT.xlsx)', true)}
                  {renderFileDropzone('cqgPs', 'File CQG (PS.xlsx)', true)}
                </div>
              </div>
            </div>
          )}

          {mode === 'KLGD' && (
            <>
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  1. Chọn File Đối Chiếu Khớp Lệnh (KLGD) & Trạng Thái Mở (TTM)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px' }}>
                  {renderFileDropzone('dsgd', 'File M-System (DSGD.xlsx)', true)}
                  {renderFileDropzone('fr', 'File CQG (FR.xlsx)')}
                  {renderFileDropzone('nano', 'File ACM (Nano.xlsx / .xls)')}
                </div>
              </div>

              <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0' }}></div>

              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  2. Chọn File Đối Chiếu Trạng Thái Mở (TTM) Bổ Sung (Tùy chọn)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px' }}>
                  {renderFileDropzone('ttm', 'File M-System (TTM.xlsx)')}
                  {renderFileDropzone('op', 'File CQG (OP.xlsx)')}
                </div>
              </div>

              <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0' }}></div>

              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  3. Chọn File Đối Chiếu Khớp Lệnh Thanh Toán (TTTT) (Tùy chọn)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px' }}>
                  {renderFileDropzone('tttt', 'File M-System (TTTT.xlsx)')}
                  {renderFileDropzone('ps', 'File CQG (PS.xlsx)')}
                </div>
              </div>
            </>
          )}

          {mode === 'EOD' && (
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                Chọn File Lọc Tài Khoản Âm Ký Quỹ
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px' }}>
                {renderFileDropzone('qltkgd', 'File QLTKGD.xlsx', true)}
                {renderFileDropzone('eod', 'File eod.csv (Tùy chọn)')}
              </div>
            </div>
          )}

          {mode === 'CQG' && (
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                Chọn File Đối Chiếu Số Dư CQG
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px' }}>
                {renderFileDropzone('qltkgd', 'File QLTKGD.xlsx', true)}
                {renderFileDropzone('accountsBalances', 'File Accounts_Balances.xlsx', true)}
              </div>
            </div>
          )}

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={loading}
              style={{ padding: '10px 20px', fontSize: '0.85rem' }}
            >
              Hủy bỏ
            </button>
            <button 
              className="btn btn-success" 
              onClick={handleRunReconciliation}
              disabled={getRunButtonDisabled()}
              style={{ padding: '10px 24px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {loading ? (
                <span>Đang xử lý đối chiếu...</span>
              ) : (
                <>
                  <Play size={15} /> Chạy đối chiếu
                </>
              )}
            </button>
          </div>

          {/* Result view */}
          {result && (
            <div style={{
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '16px',
              marginTop: '12px'
            }}>
              
              {/* KLGD Result Display */}
              {resultType === 'KLGD' && (
                <>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {result.totals.differ > 0 ||
                    result.totals.differACM > 0 ||
                    result.mismatchedTrades.length > 0 ||
                    result.mismatchedTTM.length > 0 ||
                    (result.totals.differTTTT !== undefined && result.totals.differTTTT > 0) ||
                    (result.mismatchedTTTT && result.mismatchedTTTT.length > 0) ? (
                      <>
                        <AlertTriangle color="var(--color-critical)" size={18} />
                        Kết Quả: Phát hiện chênh lệch dữ liệu
                      </>
                    ) : (
                      <>
                        <CheckCircle2 color="var(--color-primary)" size={18} />
                        Kết Quả: Dữ liệu khớp hoàn toàn
                      </>
                    )}
                  </h3>

                  {/* Totals Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ padding: '10px', background: 'rgba(128,128,128,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>TỔNG LOT M-SYSTEM</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{result.totals.totalDSGD}</div>
                    </div>
                    <div style={{ padding: '10px', background: 'rgba(128,128,128,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>TỔNG LOT CQG</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{result.totals.totalFR}</div>
                    </div>
                    <div style={{ padding: '10px', background: 'rgba(128,128,128,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>TỔNG LOT ACM</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{result.totals.totalACM}</div>
                    </div>
                    <div style={{ padding: '10px', background: 'rgba(128,128,128,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>TỔNG LOT NANO</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{result.totals.totalNano}</div>
                    </div>
                  </div>

                  {result.totals.totalTTTT !== undefined && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
                      <div style={{ padding: '10px', background: 'rgba(128,128,128,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>TỔNG LOT TẤT TOÁN M-SYSTEM (TTTT)</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{result.totals.totalTTTT}</div>
                      </div>
                      <div style={{ padding: '10px', background: 'rgba(128,128,128,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>TỔNG LOT PS CQG (S VALUE)</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{result.totals.totalPS}</div>
                      </div>
                    </div>
                  )}

                  {/* Differences row */}
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: result.totals.differ > 0 ? 'var(--color-critical)' : 'var(--color-primary)' }}>
                      <span>Chênh lệch MS vs CQG:</span>
                      <strong>{result.totals.differ} lot</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: result.totals.differACM > 0 ? 'var(--color-critical)' : 'var(--color-primary)' }}>
                      <span>Chênh lệch ACM vs Nano:</span>
                      <strong>{result.totals.differACM} lot</strong>
                    </div>
                    {result.totals.differTTTT !== undefined && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: result.totals.differTTTT > 0 ? 'var(--color-critical)' : 'var(--color-primary)' }}>
                        <span>Chênh lệch TTTT vs PS:</span>
                        <strong>{result.totals.differTTTT} lot</strong>
                      </div>
                    )}
                  </div>

                  {/* Detail mismatch tables */}
                  {result.mismatchedTrades.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} color="var(--color-critical)" />
                        Danh sách khớp lệnh chênh lệch chi tiết ({result.mismatchedTrades.length})
                      </h4>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                          <thead style={{ background: 'rgba(128,128,128,0.05)', position: 'sticky', top: 0 }}>
                            <tr>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Nguồn</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Mã lệnh</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Tài khoản</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Hợp đồng</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Giá khớp</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Số lượng</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Chi tiết lỗi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.mismatchedTrades.map((m: any, idx: number) => (
                              <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>{m.source}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.maLenh || '-'}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--color-accent)' }}>{m.maTKGD}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.maHD}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.giaKhop}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>{m.klGiaoDich}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--color-critical)' }}>{m.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {result.mismatchedTTM.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} color="var(--color-critical)" />
                        Danh sách chênh lệch Trạng Thái Mở (TTM) tài khoản ({result.mismatchedTTM.length})
                      </h4>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                          <thead style={{ background: 'rgba(128,128,128,0.05)', position: 'sticky', top: 0 }}>
                            <tr>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Tài khoản</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Tổng Lot M-System</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Tổng Lot CQG</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Chênh lệch</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.mismatchedTTM.map((m: any, idx: number) => (
                              <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', fontWeight: 700, color: 'var(--color-accent)' }}>{m.maTKGD}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.ttmValue}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.opValue}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--color-critical)', fontWeight: 700 }}>{m.differ}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {result.mismatchedTTTT && result.mismatchedTTTT.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} color="var(--color-critical)" />
                        Danh sách chênh lệch Khớp Lệnh Thanh Toán (TTTT vs PS) tài khoản ({result.mismatchedTTTT.length})
                      </h4>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                          <thead style={{ background: 'rgba(128,128,128,0.05)', position: 'sticky', top: 0 }}>
                            <tr>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Tài khoản</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Tổng Lot TTTT M-System</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Tổng Lot PS CQG</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Chênh lệch</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.mismatchedTTTT.map((m: any, idx: number) => (
                              <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', fontWeight: 700, color: 'var(--color-accent)' }}>{m.maTKGD}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.ttttValue}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.psValue}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--color-critical)', fontWeight: 700 }}>{m.differ}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* EOD Mode Results */}
              {resultType === 'EOD' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 color="var(--color-primary)" size={18} />
                    Kết Quả Lọc: Hoàn thành kiểm tra tài khoản âm ký quỹ
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.02)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#ef4444', marginBottom: '4px' }}>TÀI KHOẢN ÂM SỐ DƯ TKKQ HIỆN TẠI (QLTKGD)</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>
                        {result.negativeBalanceAccs?.length || 0} tài khoản
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.02)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#ef4444', marginBottom: '4px' }}>TÀI KHOẢN ÂM KÝ QUỸ KHẢ DỤNG (EOD IMR)</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>
                        {result.negativeIMRAcc?.length || 0} tài khoản
                      </div>
                    </div>
                  </div>

                  {result.negativeBalanceAccs?.length > 0 && (
                    <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} /> Danh sách tài khoản âm số dư hiện tại (QLTKGD):
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {result.negativeBalanceAccs.map((acc: string) => (
                          <span key={acc} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                            {acc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.negativeIMRAcc?.length > 0 && (
                    <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} /> Danh sách tài khoản âm ký quỹ khả dụng (EOD):
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {result.negativeIMRAcc.map((acc: string) => (
                          <span key={acc} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                            {acc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.excelBase64 && (
                    <div style={{ marginTop: '8px' }}>
                      <button
                        onClick={handleDownloadExcel}
                        className="btn btn-primary"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '12px 20px',
                          fontSize: '0.85rem',
                          width: '100%',
                          background: 'var(--color-primary)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Download size={16} /> Tải file Excel NegativeAccounts.xlsx
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* PRE_EOD Mode Results */}
              {resultType === 'PRE_EOD' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {result.passed ? (
                      <>
                        <CheckCircle2 color="var(--color-primary)" size={18} />
                        Kết Quả: Khớp hoàn toàn
                      </>
                    ) : (
                      <>
                        <AlertTriangle color="var(--color-critical)" size={18} />
                        Kết Quả: Phát hiện chênh lệch dữ liệu trước EOD
                      </>
                    )}
                  </h3>

                  {/* Totals Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ padding: '10px', background: 'rgba(128,128,128,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>KHỚP LỆNH TỰ DOANH (MS vs Straits)</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800 }}>
                        {result.totals.totalACM_MS} vs {result.totals.totalACM_Straits} lot
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: result.totals.differACM > 0 ? 'var(--color-critical)' : 'var(--color-primary)', marginTop: '4px' }}>
                        Chênh lệch: {result.totals.differACM} lot
                      </div>
                    </div>
                    <div style={{ padding: '10px', background: 'rgba(128,128,128,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>KHỚP LỆNH THƯỜNG (MS vs CQG)</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800 }}>
                        {result.totals.totalCQG_MS} vs {result.totals.totalCQG_FR} lot
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: result.totals.differCQG > 0 ? 'var(--color-critical)' : 'var(--color-primary)', marginTop: '4px' }}>
                        Chênh lệch: {result.totals.differCQG} lot
                      </div>
                    </div>
                  </div>

                  {/* Detail mismatch tables */}
                  {result.mismatchedTrades.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} color="var(--color-critical)" />
                        Danh sách khớp lệnh chênh lệch chi tiết ({result.mismatchedTrades.length})
                      </h4>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                          <thead style={{ background: 'rgba(128,128,128,0.05)', position: 'sticky', top: 0 }}>
                            <tr>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Nguồn</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Mã lệnh</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Tài khoản</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Hợp đồng</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Giá khớp</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Số lượng</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Chi tiết lỗi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.mismatchedTrades.map((m: any, idx: number) => (
                              <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>{m.source}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.maLenh || '-'}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--color-accent)' }}>{m.maTKGD}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.maHD}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.giaKhop}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>{m.klGiaoDich}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--color-critical)' }}>{m.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {result.mismatchedPositions.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} color="var(--color-critical)" />
                        Danh sách chênh lệch Vị Thế Ròng (Net Position) ({result.mismatchedPositions.length})
                      </h4>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                          <thead style={{ background: 'rgba(128,128,128,0.05)', position: 'sticky', top: 0 }}>
                            <tr>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Tài khoản</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Hợp đồng</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Vị thế M-System</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Vị thế CQG</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Chênh lệch</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.mismatchedPositions.map((m: any, idx: number) => (
                              <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', fontWeight: 700, color: 'var(--color-accent)' }}>{m.account}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.symbol}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.msPosition}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.cqgPosition}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--color-critical)', fontWeight: 700 }}>{m.differ}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {!result.mismatchedTrades.length && !result.mismatchedPositions.length && result.passed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: 'var(--color-primary)', fontSize: '0.8rem' }}>
                      <CheckCircle2 size={16} /> Đối chiếu thành công. Không phát hiện chênh lệch trước EOD!
                    </div>
                  )}
                </div>
              )}

              {/* CQG Mode Results */}
              {resultType === 'CQG' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {result.length > 0 ? (
                      <>
                        <AlertTriangle color="var(--color-critical)" size={18} />
                        Kết Quả CQG: Phát hiện chênh lệch dữ liệu
                      </>
                    ) : (
                      <>
                        <CheckCircle2 color="var(--color-primary)" size={18} />
                        Kết Quả CQG: Số dư khớp hoàn toàn
                      </>
                    )}
                  </h3>

                  <div style={{ padding: '12px', background: 'rgba(128,128,128,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>TÀI KHOẢN LỆCH SỐ DƯ CQG</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: result.length > 0 ? 'var(--color-critical)' : 'var(--color-primary)' }}>
                      {result.length} tài khoản
                    </div>
                  </div>

                  {result.length > 0 ? (
                    <div>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} color="var(--color-critical)" />
                        Danh sách tài khoản chênh lệch số dư CQG (Chênh lệch {'>'} 100 USD)
                      </h4>
                      <div style={{ maxHeight: '250px', overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                          <thead style={{ background: 'rgba(128,128,128,0.05)', position: 'sticky', top: 0 }}>
                            <tr>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Mã TKGD</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Số dư M-System (USD)</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Số dư CQG (USD)</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Chênh lệch</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.map((m: any, idx: number) => (
                              <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', fontWeight: 700, color: 'var(--color-accent)' }}>{m.maTKGD}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.inMS ? `$${m.calculatedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.inCQG ? `$${m.cqgBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--color-critical)', fontWeight: 700 }}>
                                  ${m.differ.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
                                  {!m.inMS && <span style={{ color: '#ef4444', fontWeight: 600 }}>Chỉ có CQG</span>}
                                  {!m.inCQG && <span style={{ color: '#f59e0b', fontWeight: 600 }}>Chỉ có MS</span>}
                                  {m.inMS && m.inCQG && <span style={{ color: 'var(--color-critical)' }}>Lệch số dư</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: 'var(--color-primary)', fontSize: '0.8rem' }}>
                      <CheckCircle2 size={16} /> Không phát hiện lệch số dư CQG. Tất cả tài khoản khớp 100%!
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
