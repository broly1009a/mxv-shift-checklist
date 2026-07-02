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
  const [startSession, setStartSession] = useState('07:00:00');
  const [endSession, setEndSession] = useState('06:00:00');
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
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
          file ? 'border-emerald-500 bg-emerald-950/10' : 'border-slate-700 bg-slate-800/40 hover:border-slate-500'
        }`}
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
          <div className="flex flex-col items-center gap-1">
            <CheckCircle2 className="text-emerald-400" size={24} />
            <span className="text-xs font-semibold text-emerald-300 truncate max-w-[200px]">{file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="text-[10px] text-red-400 hover:text-red-300 underline mt-1"
            >
              Hủy bỏ
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400">
            <Upload size={22} className="text-slate-500 mb-1" />
            <span className="text-xs font-medium">{placeholder}</span>
            <span className="text-[10px] text-slate-500">Chấp nhận .xlsx, .xls</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-sky-400" size={24} />
            <div>
              <h2 className="text-lg font-bold text-slate-100">Báo cáo & Thống kê Giao dịch</h2>
              <p className="text-xs text-slate-400">Kết xuất báo cáo đối chiếu, doanh thu TVKD & hàng hóa từ WinForms legacy</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-950/30 border-b border-slate-800 overflow-x-auto">
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
              className={`px-6 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
                activeTab === t.id
                  ? 'border-sky-500 text-sky-400 bg-sky-950/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-900/60 text-slate-300">
          {/* TAB 1: Monthly Report */}
          {activeTab === 'month' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Tháng báo cáo</label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>Tháng {m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Năm</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Giờ bắt đầu phiên (startSession)</label>
                  <input
                    type="text"
                    value={startSession}
                    onChange={(e) => setStartSession(e.target.value)}
                    placeholder="07:00:00"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Giờ kết thúc phiên (endSession)</label>
                  <input
                    type="text"
                    value={endSession}
                    onChange={(e) => setEndSession(e.target.value)}
                    placeholder="06:00:00"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Các phân mục báo cáo</label>
                <div className="flex flex-wrap gap-4 bg-slate-950/40 p-3 border border-slate-800/80 rounded-lg">
                  {Object.entries(monthReportTypes).map(([key, val]) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => setMonthReportTypes((prev) => ({ ...prev, [key]: e.target.checked }))}
                        className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-500"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">File Giao dịch Tháng này (T)</label>
                  {fileDropZone(monthDSGDT, setMonthDSGDT, 'Chọn file DSGDT.xlsx', 'monthDSGDT')}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">File Giao dịch Tháng trước (T-1)</label>
                  {fileDropZone(monthDSGDT1, setMonthDSGDT1, 'Chọn file DSGDT1.xlsx', 'monthDSGDT1')}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={handleExportMonth}
                  disabled={loading}
                  className="btn btn-primary px-6 py-2.5 flex items-center gap-2 text-sm font-semibold"
                >
                  <FileDown size={16} />
                  {loading ? 'Đang xử lý...' : 'Xuất Báo Cáo Tháng'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Quarterly Report */}
          {activeTab === 'quarter' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Từ ngày</label>
                  <input
                    type="date"
                    value={qStartDate}
                    onChange={(e) => setQStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={qEndDate}
                    onChange={(e) => setQEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">File Danh sách giao dịch (DSGD)</label>
                  {fileDropZone(quarterDSGD, setQuarterDSGD, 'Chọn file DSGD.xlsx', 'quarterDSGD')}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">File Tất toán (TTTT)</label>
                  {fileDropZone(quarterTTTT, setQuarterTTTT, 'Chọn file TTTT.xlsx', 'quarterTTTT')}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">File Chờ tất toán (Waiting TTTT)</label>
                  {fileDropZone(quarterWaitingTTTT, setQuarterWaitingTTTT, 'Chọn file Waiting_TTTT.xlsx', 'quarterWaitingTTTT')}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">File Tỷ giá quy đổi (Tùy chọn)</label>
                  {fileDropZone(quarterConvertExchange, setQuarterConvertExchange, 'Chọn file Ty_gia.xlsx', 'quarterConvertExchange')}
                  <p className="text-[10px] text-slate-500 mt-1">Nếu để trống, hệ thống sẽ sử dụng tỷ giá quy đổi được cấu hình trong DB.</p>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={handleExportQuarter}
                  disabled={loading}
                  className="btn btn-primary px-6 py-2.5 flex items-center gap-2 text-sm font-semibold"
                >
                  <FileDown size={16} />
                  {loading ? 'Đang xử lý...' : 'Xuất Báo Cáo Quý'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: TTTT Report */}
          {activeTab === 'tttt' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Các phân mục đối chiếu</label>
                <div className="flex gap-4 bg-slate-950/40 p-3 border border-slate-800/80 rounded-lg">
                  {Object.entries(ttttReportTypes).map(([key, val]) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => setTtttReportTypes((prev) => ({ ...prev, [key]: e.target.checked }))}
                        className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-500"
                      />
                      <span>
                        {key === 'Member' && 'Đối chiếu theo TVKD'}
                        {key === 'Commodity' && 'Đối chiếu theo Mặt hàng'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">File Tất toán Tháng này (T)</label>
                  {fileDropZone(ttttT, setTtttT, 'Chọn file TTTT_T.xlsx', 'ttttT')}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">File Tất toán Tháng trước (T-1)</label>
                  {fileDropZone(ttttT1, setTtttT1, 'Chọn file TTTT_T1.xlsx', 'ttttT1')}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={handleExportTttt}
                  disabled={loading}
                  className="btn btn-primary px-6 py-2.5 flex items-center gap-2 text-sm font-semibold"
                >
                  <FileDown size={16} />
                  {loading ? 'Đang xử lý...' : 'Xuất Báo Cáo Tất Toán'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Exchange Rates */}
          {activeTab === 'rates' && (
            <div className="space-y-6">
              {/* Import Section & Single Form */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
                {/* List Exchange Rates */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <Calendar size={16} className="text-sky-400" />
                    Danh sách tỷ giá hiệu lực
                  </h3>
                  <div className="overflow-x-auto max-h-[350px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/50">
                          <th className="py-2 px-3">Từ tệ</th>
                          <th className="py-2 px-3">Sang tệ</th>
                          <th className="py-2 px-3 text-right">Tỷ giá quy đổi</th>
                          <th className="py-2 px-3">Ngày bắt đầu</th>
                          <th className="py-2 px-3">Ngày kết thúc</th>
                          <th className="py-2 px-3 text-center">Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rates.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-500">Chưa có cấu hình tỷ giá. Vui lòng thêm thủ công hoặc import.</td>
                          </tr>
                        ) : (
                          rates.map((rate) => (
                            <tr key={rate._id} className="border-b border-slate-900/60 hover:bg-slate-800/20">
                              <td className="py-2 px-3 font-semibold text-slate-200">{rate.fromCurrency}</td>
                              <td className="py-2 px-3 text-slate-400">{rate.toCurrency}</td>
                              <td className="py-2 px-3 text-right font-bold text-emerald-400">{rate.rate.toLocaleString()}</td>
                              <td className="py-2 px-3 text-slate-400">{new Date(rate.effectiveFrom).toLocaleDateString('vi-VN')}</td>
                              <td className="py-2 px-3 text-slate-500">
                                {rate.effectiveTo ? new Date(rate.effectiveTo).toLocaleDateString('vi-VN') : 'Đến nay'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => handleDeleteRate(rate._id)}
                                  className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-950/20 transition-colors"
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
                <div className="space-y-4">
                  {/* Add rate manual */}
                  <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-slate-200 uppercase mb-3 flex items-center gap-1.5">
                      <Plus size={14} className="text-emerald-400" />
                      Thêm tỷ giá thủ công
                    </h4>
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Mã đồng tiền (fromCurrency)</label>
                        <input
                          type="text"
                          value={newRate.fromCurrency}
                          onChange={(e) => setNewRate((prev) => ({ ...prev, fromCurrency: e.target.value.toUpperCase() }))}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Tỷ giá quy đổi sang VNĐ</label>
                        <input
                          type="number"
                          placeholder="ví dụ: 25450"
                          value={newRate.rate}
                          onChange={(e) => setNewRate((prev) => ({ ...prev, rate: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Ngày phiên hiệu lực</label>
                        <input
                          type="date"
                          value={newRate.effectiveFrom}
                          onChange={(e) => setNewRate((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={handleCreateRate}
                        className="w-full btn btn-primary py-2 font-semibold text-xs mt-2"
                      >
                        Thêm tỷ giá
                      </button>
                    </div>
                  </div>

                  {/* Upload excel rate sheet */}
                  <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-slate-200 uppercase mb-3 flex items-center gap-1.5">
                      <Upload size={14} className="text-sky-400" />
                      Nhập tỷ giá từ Excel
                    </h4>
                    <div className="space-y-3">
                      {fileDropZone(ratesFile, setRatesFile, 'Chọn file tỷ giá Excel', 'ratesFile')}
                      <button
                        onClick={handleImportRates}
                        disabled={isRatesUploading || !ratesFile}
                        className="w-full btn btn-secondary py-2 font-semibold text-xs text-slate-200"
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
            <div className="space-y-4 flex flex-col h-full min-h-[450px]">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Cấu hình danh mục hệ thống</h3>
                  <p className="text-xs text-slate-500">Cho phép cập nhật danh mục TVKD, danh sách hàng hóa và ánh xạ mã LME/Tháng</p>
                </div>
                <button
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  className="btn btn-primary px-5 py-2 flex items-center gap-2 text-sm font-semibold"
                >
                  <Save size={15} />
                  {isSavingConfig ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
              </div>

              <div className="flex-1 min-h-[380px] relative">
                <textarea
                  value={systemConfigText}
                  onChange={(e) => setSystemConfigText(e.target.value)}
                  className="w-full h-full min-h-[380px] bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-100 focus:outline-none focus:border-sky-500"
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
