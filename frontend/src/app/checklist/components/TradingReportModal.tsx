'use client';

import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Play, Settings, Save, CheckCircle2, AlertCircle, Plus, Trash2, Calendar, FileDown, Upload } from 'lucide-react';
import { API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface TradingReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export default function TradingReportModal({ isOpen, onClose, token }: TradingReportModalProps) {
  const [activeTab, setActiveTab] = useState<'month' | 'quarter' | 'tttt' | 'rates' | 'config'>('month');
  const [loading, setLoading] = useState(false);

  // --- Monthly Report State ---
  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [startSession, setStartSession] = useState('05:00:00');
  const [endSession, setEndSession] = useState('05:00:00');
  const [monthDSGDT, setMonthDSGDT] = useState<File | null>(null);
  const [monthDSGDT1, setMonthDSGDT1] = useState<File | null>(null);
  const [monthReportTypes, setMonthReportTypes] = useState({
    Member: true,
    Commodity: true,
    Spread: true,
    LME: true,
    Option: true,
  });

  // --- Quarterly Report State ---
  const [qStartDate, setQStartDate] = useState('');
  const [qEndDate, setQEndDate] = useState('');
  const [quarterDSGD, setQuarterDSGD] = useState<File | null>(null);
  const [quarterTTTT, setQuarterTTTT] = useState<File | null>(null);
  const [quarterWaitingTTTT, setQuarterWaitingTTTT] = useState<File | null>(null);
  const [quarterConvertExchange, setQuarterConvertExchange] = useState<File | null>(null);

  // --- TTTT Report State ---
  const [ttttT, setTtttT] = useState<File | null>(null);
  const [ttttT1, setTtttT1] = useState<File | null>(null);
  const [ttttReportTypes, setTtttReportTypes] = useState({
    Member: true,
    Commodity: true,
  });

  // --- Exchange Rates State ---
  const [rates, setRates] = useState<any[]>([]);
  const [newRate, setNewRate] = useState({
    fromCurrency: 'USD',
    toCurrency: 'VND',
    rate: '',
    effectiveFrom: '',
  });
  const [ratesFile, setRatesFile] = useState<File | null>(null);
  const [isRatesUploading, setIsRatesUploading] = useState(false);

  // --- System Config State ---
  const [systemConfigText, setSystemConfigText] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchExchangeRates();
      fetchSystemConfig();
    }
  }, [isOpen]);

  const fetchExchangeRates = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/trading-report/exchange-rates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRates(data);
      }
    } catch (err) {
      console.error('Error fetching exchange rates:', err);
    }
  };

  const fetchSystemConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/trading-report/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSystemConfigText(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  if (!isOpen) return null;

  // --- Handle Monthly Report Export ---
  const handleExportMonth = async () => {
    if (!monthDSGDT || !monthDSGDT1) {
      toast.error('Vui lòng tải lên đầy đủ file giao dịch tháng này và tháng trước!');
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('monthDSGDT', monthDSGDT);
    formData.append('monthDSGDT1', monthDSGDT1);
    formData.append('month', String(month));
    formData.append('year', String(year));
    formData.append('startSession', startSession);
    formData.append('endSession', endSession);
    formData.append('reportTypes', JSON.stringify(monthReportTypes));

    try {
      const res = await fetch(`${API_BASE_URL}/trading-report/process-month`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Lỗi xuất báo cáo.' }));
        throw new Error(errData.message || 'Lỗi xử lý báo cáo tháng');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bao_cao_giao_dich_thang_${month}_${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Xuất báo cáo tháng thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // --- Handle Quarterly Report Export ---
  const handleExportQuarter = async () => {
    if (!quarterDSGD || !quarterTTTT || !quarterWaitingTTTT) {
      toast.error('Vui lòng tải lên đầy đủ các file giao dịch, tất toán và chờ tất toán!');
      return;
    }
    if (!qStartDate || !qEndDate) {
      toast.error('Vui lòng chọn ngày bắt đầu và ngày kết thúc!');
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('quarterDSGD', quarterDSGD);
    formData.append('quarterTTTT', quarterTTTT);
    formData.append('quarterWaitingTTTT', quarterWaitingTTTT);
    if (quarterConvertExchange) {
      formData.append('quarterConvertExchange', quarterConvertExchange);
    }
    formData.append('startDate', qStartDate);
    formData.append('endDate', qEndDate);

    try {
      const res = await fetch(`${API_BASE_URL}/trading-report/process-quarter`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Lỗi xuất báo cáo.' }));
        throw new Error(errData.message || 'Lỗi xử lý báo cáo quý');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bao_cao_doanh_thu_quy_${qStartDate}_den_${qEndDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Xuất báo cáo doanh thu quý thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // --- Handle TTTT Report Export ---
  const handleExportTttt = async () => {
    if (!ttttT || !ttttT1) {
      toast.error('Vui lòng tải lên đầy đủ file tất toán tháng này và tháng trước!');
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('ttttT', ttttT);
    formData.append('ttttT1', ttttT1);
    formData.append('reportTypes', JSON.stringify(ttttReportTypes));

    try {
      const res = await fetch(`${API_BASE_URL}/trading-report/process-tttt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Lỗi xuất báo cáo.' }));
        throw new Error(errData.message || 'Lỗi xử lý báo cáo tất toán');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bao_cao_tat_toan_doi_chieu.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Xuất báo cáo tất toán thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // --- Exchange Rates Actions ---
  const handleCreateRate = async () => {
    if (!newRate.rate || !newRate.effectiveFrom) {
      toast.error('Vui lòng nhập đầy đủ tỷ giá và ngày hiệu lực!');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/trading-report/exchange-rates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromCurrency: newRate.fromCurrency,
          toCurrency: newRate.toCurrency,
          rate: parseFloat(newRate.rate),
          effectiveFrom: new Date(newRate.effectiveFrom),
        }),
      });

      if (res.ok) {
        toast.success('Thêm tỷ giá thành công!');
        setNewRate({ fromCurrency: 'USD', toCurrency: 'VND', rate: '', effectiveFrom: '' });
        fetchExchangeRates();
      } else {
        throw new Error('Lỗi thêm tỷ giá');
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể tạo tỷ giá');
    }
  };

  const handleDeleteRate = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tỷ giá này?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/trading-report/exchange-rates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success('Xóa tỷ giá thành công!');
        fetchExchangeRates();
      } else {
        throw new Error('Lỗi xóa tỷ giá');
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể xóa tỷ giá');
    }
  };

  const handleImportRates = async () => {
    if (!ratesFile) {
      toast.error('Vui lòng chọn file tỷ giá trước!');
      return;
    }
    setIsRatesUploading(true);
    const formData = new FormData();
    formData.append('file', ratesFile);

    try {
      const res = await fetch(`${API_BASE_URL}/trading-report/import-exchange-rates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Nhập thành công ${data.count} bản ghi tỷ giá!`);
        setRatesFile(null);
        fetchExchangeRates();
      } else {
        const errText = await res.json().catch(() => ({ message: 'Lỗi tải lên.' }));
        throw new Error(errText.message || 'Lỗi nhập tỷ giá');
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể tải lên file tỷ giá');
    } finally {
      setIsRatesUploading(false);
    }
  };

  // --- Save Config Action ---
  const handleSaveConfig = async () => {
    try {
      const parsed = JSON.parse(systemConfigText);
      setIsSavingConfig(true);
      const res = await fetch(`${API_BASE_URL}/trading-report/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(parsed),
      });

      if (res.ok) {
        toast.success('Lưu cấu hình hệ thống thành công!');
        fetchSystemConfig();
      } else {
        throw new Error('Lỗi lưu cấu hình');
      }
    } catch (err: any) {
      toast.error(err.message || 'Định dạng JSON không hợp lệ!');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const fileDropZone = (
    file: File | null,
    setFile: (f: File | null) => void,
    placeholder: string,
    id: string
  ) => {
    return (
      <div
        style={{
          border: file ? '2px dashed var(--color-primary)' : '2px dashed var(--border-color)',
          borderRadius: '8px',
          padding: '16px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: file ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-input)',
          transition: 'all 0.2s',
        }}
        onClick={() => document.getElementById(id)?.click()}
      >
        <input
          type="file"
          id={id}
          className="hidden"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        {file ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 style={{ color: 'var(--color-primary)' }} size={24} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>{file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '0.7rem',
                color: 'var(--color-critical)',
                textDecoration: 'underline',
                marginTop: '4px',
                cursor: 'pointer',
              }}
            >
              Hủy bỏ
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
            <Upload size={22} style={{ color: 'var(--text-muted)', marginBottom: '4px' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{placeholder}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Chấp nhận .xlsx, .xls</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px',
    }}>
      <div className="glass-panel" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '960px',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--glass-shadow)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 28px',
          backgroundColor: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div style={{
              padding: '10px',
              borderRadius: '12px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              color: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <FileSpreadsheet size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                lineHeight: 1.4,
              }}>
                Báo cáo & Thống kê Giao dịch
              </h2>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                margin: '2px 0 0 0',
                lineHeight: 1.3,
              }}>
                Kết xuất báo cáo đối chiếu, doanh thu TVKD & hàng hóa từ WinForms legacy
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-input)',
          borderBottom: '1px solid var(--border-color)',
          padding: '0 28px',
          overflowX: 'auto',
          flexShrink: 0,
        }}>
          {[
            { id: 'month', label: 'Báo cáo Tháng' },
            { id: 'quarter', label: 'Báo cáo Quý' },
            { id: 'tttt', label: 'Báo cáo Tất toán (TTTT)' },
            { id: 'rates', label: 'Tỷ giá Quy đổi' },
            { id: 'config', label: 'Cấu hình TVKD & HH' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                padding: '12px 20px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                borderBottom: activeTab === t.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                color: activeTab === t.id ? 'var(--color-accent)' : 'var(--text-secondary)',
                backgroundColor: activeTab === t.id ? 'rgba(var(--color-accent-rgb), 0.08)' : 'transparent',
                marginBottom: '-1px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1,
          backgroundColor: 'transparent',
          color: 'var(--text-primary)',
        }}>
          {/* TAB 1: Monthly Report */}
          {activeTab === 'month' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '768px', margin: '0 auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Tháng báo cáo</label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>Tháng {m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Năm</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Giờ bắt đầu phiên (startSession)</label>
                  <input
                    type="text"
                    value={startSession}
                    onChange={(e) => setStartSession(e.target.value)}
                    placeholder="07:00:00"
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Giờ kết thúc phiên (endSession)</label>
                  <input
                    type="text"
                    value={endSession}
                    onChange={(e) => setEndSession(e.target.value)}
                    placeholder="06:00:00"
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Các phân mục báo cáo</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-input)', padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  {Object.entries(monthReportTypes).map(([key, val]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => setMonthReportTypes((prev) => ({ ...prev, [key]: e.target.checked }))}
                        style={{ accentColor: 'var(--color-accent)', width: '15px', height: '15px' }}
                      />
                      <span>
                        {key === 'Member' && 'Báo cáo TVKD'}
                        {key === 'Commodity' && 'Báo cáo Mặt hàng'}
                        {key === 'Spread' && 'Giao dịch Spread'}
                        {key === 'LME' && 'Giao dịch LME'}
                        {key === 'Option' && 'Giao dịch Option'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>File Giao dịch Tháng này (T)</label>
                  {fileDropZone(monthDSGDT, setMonthDSGDT, 'Chọn file DSGDT.xlsx', 'monthDSGDT')}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>File Giao dịch Tháng trước (T-1)</label>
                  {fileDropZone(monthDSGDT1, setMonthDSGDT1, 'Chọn file DSGDT1.xlsx', 'monthDSGDT1')}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  onClick={handleExportMonth}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  <FileDown size={16} />
                  {loading ? 'Đang xử lý...' : 'Xuất Báo Cáo Tháng'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Quarterly Report */}
          {activeTab === 'quarter' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '768px', margin: '0 auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Từ ngày</label>
                  <input
                    type="date"
                    value={qStartDate}
                    onChange={(e) => setQStartDate(e.target.value)}
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Đến ngày</label>
                  <input
                    type="date"
                    value={qEndDate}
                    onChange={(e) => setQEndDate(e.target.value)}
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>File Danh sách giao dịch (DSGD)</label>
                  {fileDropZone(quarterDSGD, setQuarterDSGD, 'Chọn file DSGD.xlsx', 'quarterDSGD')}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>File Tất toán (TTTT)</label>
                  {fileDropZone(quarterTTTT, setQuarterTTTT, 'Chọn file TTTT.xlsx', 'quarterTTTT')}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>File Chờ tất toán (Waiting TTTT)</label>
                  {fileDropZone(quarterWaitingTTTT, setQuarterWaitingTTTT, 'Chọn file Waiting_TTTT.xlsx', 'quarterWaitingTTTT')}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>File Tỷ giá quy đổi (Tùy chọn)</label>
                  {fileDropZone(quarterConvertExchange, setQuarterConvertExchange, 'Chọn file Ty_gia.xlsx', 'quarterConvertExchange')}
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', margin: '4px 0 0 0' }}>Nếu để trống, hệ thống sẽ sử dụng tỷ giá quy đổi được cấu hình trong DB.</p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  onClick={handleExportQuarter}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  <FileDown size={16} />
                  {loading ? 'Đang xử lý...' : 'Xuất Báo Cáo Quý'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: TTTT Report */}
          {activeTab === 'tttt' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '768px', margin: '0 auto' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Các phân mục đối chiếu</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-input)', padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  {Object.entries(ttttReportTypes).map(([key, val]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => setTtttReportTypes((prev) => ({ ...prev, [key]: e.target.checked }))}
                        style={{ accentColor: 'var(--color-accent)', width: '15px', height: '15px' }}
                      />
                      <span>
                        {key === 'Member' && 'Đối chiếu theo TVKD'}
                        {key === 'Commodity' && 'Đối chiếu theo Mặt hàng'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>File Tất toán Tháng này (T)</label>
                  {fileDropZone(ttttT, setTtttT, 'Chọn file TTTT_T.xlsx', 'ttttT')}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>File Tất toán Tháng trước (T-1)</label>
                  {fileDropZone(ttttT1, setTtttT1, 'Chọn file TTTT_T1.xlsx', 'ttttT1')}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  onClick={handleExportTttt}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  <FileDown size={16} />
                  {loading ? 'Đang xử lý...' : 'Xuất Báo Cáo Tất Toán'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Exchange Rates */}
          {activeTab === 'rates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Import Section & Single Form */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
                {/* List Exchange Rates */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-sidebar)' }}>
                  <h3 style={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderBottom: '1px solid var(--border-color)',
                    paddingBottom: '10px',
                    margin: 0,
                  }}>
                    <Calendar size={16} style={{ color: 'var(--color-accent)' }} />
                    Danh sách tỷ giá hiệu lực
                  </h3>
                  <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-input)' }}>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Từ tệ</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Sang tệ</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Tỷ giá quy đổi</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Ngày bắt đầu</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Ngày kết thúc</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center' }}>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rates.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có cấu hình tỷ giá. Vui lòng thêm thủ công hoặc import.</td>
                          </tr>
                        ) : (
                          rates.map((rate) => (
                            <tr key={rate._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>{rate.fromCurrency}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{rate.toCurrency}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>{rate.rate.toLocaleString()}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{new Date(rate.effectiveFrom).toLocaleDateString('vi-VN')}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                                {rate.effectiveTo ? new Date(rate.effectiveTo).toLocaleDateString('vi-VN') : 'Đến nay'}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <button
                                  onClick={() => handleDeleteRate(rate._id)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '4px',
                                    cursor: 'pointer',
                                    color: 'var(--color-critical)',
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Operations side panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Add rate manual */}
                  <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-sidebar)' }}>
                    <h4 style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      margin: '0 0 12px 0',
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '8px',
                    }}>
                      <Plus size={14} style={{ color: 'var(--color-primary)' }} />
                      Thêm tỷ giá thủ công
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Mã đồng tiền (fromCurrency)
                        </label>
                        <input
                          type="text"
                          value={newRate.fromCurrency}
                          onChange={(e) => setNewRate((prev) => ({ ...prev, fromCurrency: e.target.value.toUpperCase() }))}
                          className="form-input"
                          style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Tỷ giá quy đổi sang VNĐ
                        </label>
                        <input
                          type="number"
                          placeholder="ví dụ: 25450"
                          value={newRate.rate}
                          onChange={(e) => setNewRate((prev) => ({ ...prev, rate: e.target.value }))}
                          className="form-input"
                          style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Ngày phiên hiệu lực
                        </label>
                        <input
                          type="date"
                          value={newRate.effectiveFrom}
                          onChange={(e) => setNewRate((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                          className="form-input"
                          style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
                        />
                      </div>
                      <button
                        onClick={handleCreateRate}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '10px', fontSize: '0.78rem', fontWeight: 600, marginTop: '4px' }}
                      >
                        Thêm tỷ giá
                      </button>
                    </div>
                  </div>

                  {/* Upload excel rate sheet */}
                  <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-sidebar)' }}>
                    <h4 style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      margin: '0 0 12px 0',
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '8px',
                    }}>
                      <Upload size={14} style={{ color: 'var(--color-accent)' }} />
                      Nhập tỷ giá từ Excel
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {fileDropZone(ratesFile, setRatesFile, 'Chọn file tỷ giá Excel', 'ratesFile')}
                      <button
                        onClick={handleImportRates}
                        disabled={isRatesUploading || !ratesFile}
                        className="btn btn-secondary"
                        style={{ width: '100%', padding: '10px', fontSize: '0.78rem', fontWeight: 600 }}
                      >
                        {isRatesUploading ? 'Đang xử lý...' : 'Tải lên & Import'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: System Configuration */}
          {activeTab === 'config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '450px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cấu hình danh mục hệ thống</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Cho phép cập nhật danh mục TVKD, danh sách hàng hóa và ánh xạ mã LME/Tháng</p>
                </div>
                <button
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  className="btn btn-primary"
                  style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}
                >
                  <Save size={15} />
                  {isSavingConfig ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
              </div>

              <div style={{ flex: 1, minHeight: '380px', position: 'relative' }}>
                <textarea
                  value={systemConfigText}
                  onChange={(e) => setSystemConfigText(e.target.value)}
                  className="form-input font-mono"
                  style={{ minHeight: '380px', height: '100%', width: '100%', fontSize: '0.75rem', lineHeight: '1.4' }}
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
