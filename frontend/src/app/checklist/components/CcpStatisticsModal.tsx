'use client';

import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Play, Settings, Save, CheckCircle2, AlertCircle } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-emerald-400" size={24} />
            <div>
              <h2 className="text-lg font-bold text-slate-100">Báo cáo & Thống kê CCP</h2>
              <p className="text-xs text-slate-400">Xử lý gom nhóm và kết xuất báo cáo Pilot Bạc Thỏi</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-950/20 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'upload'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play size={16} />
            Xử lý Báo cáo
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'config'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings size={16} />
            Cấu hình Thành viên & MM
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
          {activeTab === 'upload' ? (
            <div className="space-y-6">
              {/* Date Input */}
              <div className="bg-slate-950/40 p-4 border border-slate-800/80 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Ngày đối soát dữ liệu</label>
                  <p className="text-xs text-slate-400">Hệ thống sẽ lấy ngày này để xác định vị trí append hoặc cập nhật</p>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-850 border border-slate-750 text-slate-200 px-3 py-2 rounded-md focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              {/* Grid of upload zones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fileInputs.map(({ key, label, desc }) => (
                  <div
                    key={key}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(key, e)}
                    className={`relative p-4 border-2 border-dashed rounded-lg flex flex-col justify-center items-center text-center transition-all ${
                      files[key]
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-950/20'
                    }`}
                  >
                    <input
                      type="file"
                      id={`file-${key}`}
                      accept=".xlsx,.xls"
                      onChange={(e) => handleFileChange(key, e)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <FileSpreadsheet className={`mb-2 ${files[key] ? 'text-emerald-400' : 'text-slate-500'}`} size={24} />
                    <span className="text-sm font-semibold text-slate-200">{files[key] ? files[key]?.name : label}</span>
                    <span className="text-xs text-slate-400 mt-1">{desc}</span>
                    {files[key] && (
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                        <CheckCircle2 size={10} /> Đã chọn
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-200">Lưu ý cấu hình danh sách</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Phân tách các mã bằng dấu phẩy (ví dụ: <code className="text-amber-300">001, 003, 082</code>). Các tài khoản MM sẽ được gom nhóm riêng chi tiết đến mã TKGD thay vì mã TVKD.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Danh sách Thành viên cố định (FixedMembers)</label>
                  <textarea
                    rows={4}
                    value={fixedMembers}
                    onChange={(e) => setFixedMembers(e.target.value)}
                    placeholder="001, 003, 012, 045, 046, 048, 082, 083, 999"
                    className="w-full bg-slate-850 border border-slate-750 text-slate-250 p-3 rounded-lg focus:outline-none focus:border-emerald-500 text-sm font-mono leading-relaxed"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Danh sách Tài khoản Market Maker (TkMmCodes)</label>
                  <textarea
                    rows={3}
                    value={tkMmCodes}
                    onChange={(e) => setTkMmCodes(e.target.value)}
                    placeholder="082E9999999-M"
                    className="w-full bg-slate-850 border border-slate-750 text-slate-250 p-3 rounded-lg focus:outline-none focus:border-emerald-500 text-sm font-mono leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center">
          <div className="text-xs text-slate-400">
            {activeTab === 'upload' ? 'Đảm bảo dữ liệu các file Excel đúng định dạng báo cáo gốc.' : 'Cấu hình này sẽ được áp dụng cho mọi lượt đối soát tiếp theo.'}
          </div>

          <div className="flex gap-3">
            {activeTab === 'upload' ? (
              <button
                onClick={handleRunProcess}
                disabled={loading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-slate-100 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
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
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-slate-100 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Save size={14} />
                Lưu cấu hình
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 rounded-lg text-sm font-semibold transition-colors"
            >
              Hủy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
