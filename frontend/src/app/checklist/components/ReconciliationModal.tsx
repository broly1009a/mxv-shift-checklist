'use client';

import React, { useState } from 'react';
import { X, FileSpreadsheet, Play, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
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
  const isCQGMode = taskNameUpper.includes('CQG') || taskIdUpper.includes('CQG');
  const isEODMode = (taskNameUpper.includes('EOD') || taskIdUpper.includes('EOD')) && !isCQGMode;
  const mode: 'KLGD' | 'EOD' | 'CQG' = isCQGMode ? 'CQG' : (isEODMode ? 'EOD' : 'KLGD');

  const [files, setFiles] = useState<Record<string, File | null>>({
    dsgd: null,
    fr1: null,
    fr2: null,
    nano: null,
    ttm: null,
    op1: null,
    op2: null,
    // EOD / CQG files
    qltkgd: null,
    eod: null,
    tttt: null,
    accountsBalances: null
  });

  const [usdRate, setUsdRate] = useState<number>(25220);
  
  const [tradingDate, setTradingDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [resultType, setResultType] = useState<'KLGD' | 'EOD' | 'CQG'>('KLGD');

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

    let endpoint = `${API_BASE_URL}/reconciliation/upload-klgd`;

    if (mode === 'EOD') {
      if (!files.qltkgd) {
        toast.error('File QLTKGD.xlsx là bắt buộc!');
        return;
      }
      if (!files.tttt) {
        toast.error('File TTTT.xlsx là bắt buộc!');
        return;
      }
      if (!files.eod) {
        toast.error('File eod.csv là bắt buộc!');
        return;
      }
      formData.append('qltkgd', files.qltkgd);
      formData.append('tttt', files.tttt);
      formData.append('eod', files.eod);
      endpoint = `${API_BASE_URL}/reconciliation/upload-eod`;
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
      endpoint = `${API_BASE_URL}/reconciliation/upload-eod`;
    } else {
      if (!files.dsgd) {
        toast.error('File dsgd (M-System) là bắt buộc!');
        return;
      }
      Object.entries(files).forEach(([key, file]) => {
        if (file && ['dsgd', 'fr1', 'fr2', 'nano', 'ttm', 'op1', 'op2'].includes(key)) {
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
      if (data.success) {
        toast.success('Đối chiếu thành công: Dữ liệu khớp hoàn toàn!');
      } else {
        toast.error('Đối chiếu hoàn thành: Phát hiện chênh lệch dữ liệu!');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderFileDropzone = (key: string, label: string, required = false) => {
    const file = files[key];
    const isCsv = key === 'eod';
    const acceptTypes = isCsv ? '.csv' : '.xlsx,.xls';
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
          {file ? file.name : `Kéo thả hoặc click để chọn file ${isCsv ? 'CSV' : 'Excel'}`}
        </span>
      </div>
    );
  };

  const getRunButtonDisabled = () => {
    if (loading) return true;
    if (mode === 'EOD') return !files.qltkgd || !files.tttt || !files.eod;
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
        borderRadius: '16px',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        overflowY: 'auto',
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
          background: 'rgba(255,255,255,0.01)'
        }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet color="var(--color-accent)" size={22} />
            {mode === 'EOD' ? 'Đối Chiếu Số Dư EOD Tự Động' : mode === 'CQG' ? 'Đối Chiếu Số Dư CQG Tự Động' : 'Đối Chiếu Khớp Lệnh & Trạng Thái Mở'}
          </h2>
          <button 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Form input row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
            
            {mode === 'CQG' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Tỷ giá USD/VND đối chiếu</label>
                <input 
                  type="number" 
                  value={usdRate}
                  onChange={(e) => setUsdRate(parseFloat(e.target.value) || 0)}
                  className="form-input"
                  style={{ height: '38px', fontSize: '0.85rem' }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(59,130,246,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.1)' }}>
                  <Info size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
                  {mode === 'EOD' 
                    ? 'Hệ thống đối chiếu tính toán số dư EOD của từng tài khoản dựa trên nộp rút, phí, và P/L thực tế (chuyển đổi tỷ giá động).' 
                    : 'Hệ thống đối chiếu chi tiết khớp lệnh của ca trực giữa M-System, CQG và ACM (Nano).'}
                </span>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0' }}></div>

          {/* Dynamic File selection based on mode */}
          {mode === 'KLGD' && (
            <>
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  1. Chọn File Đối Chiếu Khớp Lệnh (KLGD) & Trạng Thái Mở (TTM)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px' }}>
                  {renderFileDropzone('dsgd', 'File M-System (DSGD.xlsx)', true)}
                  {renderFileDropzone('fr1', 'File CQG (FR1.xlsx)')}
                  {renderFileDropzone('fr2', 'File CQG (FR2.xlsx)')}
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
                  {renderFileDropzone('op1', 'File CQG (OP1.xlsx)')}
                  {renderFileDropzone('op2', 'File CQG (OP2.xlsx)')}
                </div>
              </div>
            </>
          )}

          {mode === 'EOD' && (
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                Chọn File Đối Chiếu Số Dư EOD
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px' }}>
                {renderFileDropzone('qltkgd', 'File QLTKGD.xlsx', true)}
                {renderFileDropzone('tttt', 'File TTTT.xlsx', true)}
                {renderFileDropzone('eod', 'File eod.csv', true)}
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
                    {result.totals.differ > 0 || result.totals.differACM > 0 || result.mismatchedTrades.length > 0 || result.mismatchedTTM.length > 0 ? (
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

                  {/* Differences row */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: result.totals.differ > 0 ? 'var(--color-critical)' : 'var(--color-primary)' }}>
                      <span>Chênh lệch MS vs CQG:</span>
                      <strong>{result.totals.differ} lot</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: result.totals.differACM > 0 ? 'var(--color-critical)' : 'var(--color-primary)' }}>
                      <span>Chênh lệch ACM vs Nano:</span>
                      <strong>{result.totals.differACM} lot</strong>
                    </div>
                  </div>

                  {/* Detail mismatch tables */}
                  {result.mismatchedTrades.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} color="var(--color-critical)" />
                        Danh sách khớp lệnh chênh lệch chi tiết ({result.mismatchedTrades.length})
                      </h4>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
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
                    <div>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} color="var(--color-critical)" />
                        Danh sách chênh lệch Trạng Thái Mở (TTM) tài khoản ({result.mismatchedTTM.length})
                      </h4>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
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
                </>
              )}

              {/* EOD Mode Results */}
              {resultType === 'EOD' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {result.mismatchedEOD.length > 0 ? (
                      <>
                        <AlertTriangle color="var(--color-critical)" size={18} />
                        Kết Quả EOD: Phát hiện chênh lệch dữ liệu
                      </>
                    ) : (
                      <>
                        <CheckCircle2 color="var(--color-primary)" size={18} />
                        Kết Quả EOD: Số dư khớp hoàn toàn
                      </>
                    )}
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(128,128,128,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>TÀI KHOẢN LỆCH SỐ DƯ EOD</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: result.mismatchedEOD.length > 0 ? 'var(--color-critical)' : 'var(--color-primary)' }}>
                        {result.mismatchedEOD.length} tài khoản
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.02)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#ef4444', marginBottom: '4px' }}>TÀI KHOẢN ÂM KÝ QUỸ (NEGATIVE IMR)</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>
                        {result.negativeIMRAcc.length} tài khoản
                      </div>
                    </div>
                  </div>

                  {result.negativeIMRAcc.length > 0 && (
                    <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} /> Danh sách tài khoản âm ký quỹ khả dụng mới:
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

                  {result.mismatchedEOD.length > 0 ? (
                    <div>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} color="var(--color-critical)" />
                        Danh sách tài khoản lệch số dư EOD chi tiết (Chênh lệch {'>'}= 1,000 VNĐ)
                      </h4>
                      <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                          <thead style={{ background: 'rgba(128,128,128,0.05)', position: 'sticky', top: 0 }}>
                            <tr>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Mã TKGD</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Số dư Tính toán</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Số dư EOD thực tế</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Chênh lệch</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.mismatchedEOD.map((m: any, idx: number) => (
                              <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', fontWeight: 700, color: 'var(--color-accent)' }}>{m.maTKGD}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.calculatedBalance.toLocaleString()} VNĐ</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{m.eodBalance.toLocaleString()} VNĐ</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--color-critical)', fontWeight: 700 }}>
                                  {m.differ.toLocaleString()} VNĐ
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: 'var(--color-primary)', fontSize: '0.8rem' }}>
                      <CheckCircle2 size={16} /> Không phát hiện lệch số dư EOD. Tất cả tài khoản khớp 100%!
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
                      <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
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
