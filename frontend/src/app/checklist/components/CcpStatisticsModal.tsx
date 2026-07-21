'use client';

import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Play, Settings, Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface CcpStatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export default function CcpStatisticsModal({
  isOpen,
  onClose,
  token,
}: CcpStatisticsModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'config'>('upload');
  
  // Files State
  const [files, setFiles] = useState<Record<string, File | null>>({
    dsgdCcp: null,
    dsgdMmCcp: null,
    dstkgd: null,
    nr: null,
    ttm: null,
    tttt: null,
  });

  // Date State
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Configuration State
  const [fixedMembers, setFixedMembers] = useState<string>('');
  const [tkMmCodes, setTkMmCodes] = useState<string>('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load config when open or when activeTab is config
  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/ccp-statistics/config`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setFixedMembers((data.fixedMembers || []).join(', '));
        setTkMmCodes((data.tkMmCodes || []).join(', '));
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFiles((prev) => ({ ...prev, [key]: selectedFile }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (key: string, e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0] || null;
    setFiles((prev) => ({ ...prev, [key]: droppedFile }));
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const payload = {
        fixedMembers: fixedMembers
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
        tkMmCodes: tkMmCodes
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      };

      const res = await fetch(`${API_BASE_URL}/ccp-statistics/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Không thể lưu cấu hình');
      }

      toast.success('Lưu cấu hình CCP thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleRunProcess = async () => {
    // Validate files
    const missing = Object.entries(files).filter(([_, file]) => !file);
    if (missing.length > 0) {
      toast.error('Vui lòng tải lên đầy đủ 6 file Excel trước khi thực hiện!');
      return;
    }

    const formData = new FormData();
    formData.append('date', selectedDate);
    Object.entries(files).forEach(([key, file]) => {
      if (file) {
        formData.append(key, file);
      }
    });

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/ccp-statistics/process`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.json().catch(() => ({ message: 'Lỗi không xác định khi xuất báo cáo.' }));
        throw new Error(errText.message || 'Lỗi xuất báo cáo thống kê CCP');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Thong_ke_kich_ban_Pilot_Bac_${selectedDate.replace(/-/g, '')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Xuất báo cáo Thống kê CCP thành công!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const fileInputs = [
    { key: 'dsgdCcp', label: 'DSGD CCP.xlsx', desc: 'Báo cáo giao dịch CCP' },
    { key: 'dsgdMmCcp', label: 'DSGD MM CCP.xlsx', desc: 'Báo cáo giao dịch Market Maker' },
    { key: 'dstkgd', label: 'DSTKGD.xlsx', desc: 'Danh sách tài khoản giao dịch' },
    { key: 'nr', label: 'NR.xlsx', desc: 'Báo cáo nộp rút tiền thành viên' },
    { key: 'ttm', label: 'TTM.xlsx', desc: 'Báo cáo trạng thái mở' },
    { key: 'tttt', label: 'TTTT.xlsx', desc: 'Báo cáo tất toán hợp đồng' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0f172a] border border-slate-800/90 rounded-xl w-full max-w-5xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 sm:px-8 py-4 bg-slate-900/90 border-b border-slate-800 flex justify-between items-center gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <FileSpreadsheet className="animate-pulse" size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-100 truncate leading-snug">Báo cáo & Thống kê CCP</h2>
              <p className="text-xs text-slate-400 truncate mt-1">Xử lý gom nhóm và kết xuất báo cáo Pilot Bạc Thỏi</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-100 transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs - with shrink-0 and -mb-px to align active tab border perfectly */}
        <div className="flex bg-slate-900/40 border-b border-slate-800/80 px-6 sm:px-8 pt-1 shrink-0">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-all flex items-center gap-2 rounded-t-lg ${
              activeTab === 'upload'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Play size={16} />
            Xử lý Báo cáo
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-all flex items-center gap-2 rounded-t-lg ${
              activeTab === 'config'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Settings size={16} />
            Cấu hình Thành viên & MM
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/20 min-h-[340px]">
          {activeTab === 'upload' ? (
            <div className="space-y-6">
              {/* Date Input */}
              <div className="bg-slate-900/60 p-4 border border-slate-800/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">Ngày đối soát dữ liệu</label>
                  <p className="text-xs text-slate-400">Hệ thống sẽ lấy ngày này để xác định vị trí append hoặc cập nhật</p>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 px-3.5 py-2 rounded-xl focus:outline-none focus:border-emerald-500 text-xs font-medium"
                />
              </div>

              {/* Grid of upload zones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fileInputs.map(({ key, label, desc }) => (
                  <div
                    key={key}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(key, e)}
                    className={`relative p-5 border-2 border-dashed rounded-xl flex flex-col justify-center items-center text-center transition-all ${
                      files[key]
                        ? 'border-emerald-500/60 bg-emerald-500/10'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                    }`}
                  >
                    <input
                      type="file"
                      id={`file-${key}`}
                      accept=".xlsx,.xls"
                      onChange={(e) => handleFileChange(key, e)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <FileSpreadsheet className={`mb-2 ${files[key] ? 'text-emerald-400' : 'text-slate-500'}`} size={26} />
                    <span className="text-xs font-bold text-slate-100">{files[key] ? files[key]?.name : label}</span>
                    <span className="text-[11px] text-slate-400 mt-1">{desc}</span>
                    {files[key] && (
                      <span className="mt-2.5 inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
                        <CheckCircle2 size={11} /> Đã chọn
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-2xl mx-auto py-2">
              <div className="bg-slate-900/80 p-4 border border-slate-800/80 rounded-xl flex items-start gap-3.5">
                <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={20} />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-200">Lưu ý cấu hình danh sách</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Phân tách các mã bằng dấu phẩy (ví dụ: <code className="text-amber-300 font-mono">001, 003, 082</code>). Các tài khoản MM sẽ được gom nhóm riêng chi tiết đến mã TKGD thay vì mã TVKD.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Danh sách Thành viên cố định (FixedMembers)</label>
                  <textarea
                    rows={4}
                    value={fixedMembers}
                    onChange={(e) => setFixedMembers(e.target.value)}
                    placeholder="001, 003, 012, 045, 046, 048, 082, 083, 999"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-3.5 rounded-xl focus:outline-none focus:border-emerald-500 text-xs font-mono leading-relaxed"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Danh sách Tài khoản Market Maker (TkMmCodes)</label>
                  <textarea
                    rows={3}
                    value={tkMmCodes}
                    onChange={(e) => setTkMmCodes(e.target.value)}
                    placeholder="082E9999999-M"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-3.5 rounded-xl focus:outline-none focus:border-emerald-500 text-xs font-mono leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-8 py-4 bg-slate-900/90 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          <div className="text-xs text-slate-400 font-medium shrink-0">
            {activeTab === 'upload' ? 'Đảm bảo dữ liệu các file Excel đúng định dạng báo cáo gốc.' : 'Cấu hình này sẽ được áp dụng cho mọi lượt đối soát tiếp theo.'}
          </div>

          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
            {activeTab === 'upload' ? (
              <button
                onClick={handleRunProcess}
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98] shadow-emerald-500/20"
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <Play size={14} fill="currentColor" />
                    Xuất Báo cáo Excel
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98] shadow-emerald-500/20"
              >
                <Save size={14} />
                Lưu cấu hình
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 rounded-xl text-xs font-bold transition-colors border border-slate-700/60"
            >
              Hủy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
