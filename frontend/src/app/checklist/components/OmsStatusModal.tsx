'use client';

import React, { useState, useEffect } from 'react';
import { X, Play, AlertCircle, CheckCircle2, XCircle, Clock, Database, RefreshCw, Terminal, Copy } from 'lucide-react';
import { API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface OmsStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  shiftLogId: string;
  taskId: string;
  taskName: string;
  resultNote: string | null;
  status: string;
  onTaskUpdated?: () => void;
}

export default function OmsStatusModal({
  isOpen,
  onClose,
  token,
  shiftLogId,
  taskId,
  taskName,
  resultNote,
  status,
  onTaskUpdated,
}: OmsStatusModalProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'logs'>('status');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Parse resultNote
  let parsedNote: any = null;
  let isJson = false;
  if (resultNote) {
    try {
      parsedNote = JSON.parse(resultNote);
      isJson = true;
    } catch {
      parsedNote = { message: resultNote };
    }
  }

  // Poll for status updates if bot is WAITING
  useEffect(() => {
    let intervalId: any;
    if (isOpen && status === 'WAITING' && onTaskUpdated) {
      intervalId = setInterval(() => {
        onTaskUpdated();
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen, status, onTaskUpdated]);

  if (!isOpen) return null;

  const handleTriggerCheck = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-oms-check/${shiftLogId}/${taskId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Không thể kích hoạt bot kiểm tra');
      }

      toast.success('Đã kích hoạt quét OMS (CCP/CE) trong nền.');
      if (onTaskUpdated) {
        onTaskUpdated();
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi gọi bot');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(resultNote || '');
    setCopied(true);
    toast.success('Đã sao chép vào bộ nhớ tạm');
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to parse dates/times
  const checkTime = parsedNote?.timestamp 
    ? new Date(parsedNote.timestamp).toLocaleTimeString('vi-VN') 
    : null;

  // Extracted system details
  const ccpData = parsedNote?.data?.ccp;
  const ceData = parsedNote?.data?.ce;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Database className="text-pink-500 animate-pulse" size={24} />
            <div>
              <h2 className="text-lg font-bold text-slate-100">{taskName}</h2>
              <p className="text-xs text-slate-400">Kiểm tra kết quả EOD & Lệnh MM tự động qua Playwright (05h00)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Status Alert Banner */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trạng thái Tác vụ:</span>
            {status === 'PASSED' && (
              <span className="inline-flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-semibold">
                <CheckCircle2 size={12} /> ĐẠT (PASSED)
              </span>
            )}
            {status === 'FAILED' && (
              <span className="inline-flex items-center gap-1 text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2.5 py-1 rounded-full font-semibold">
                <XCircle size={12} /> KHÔNG ĐẠT (FAILED)
              </span>
            )}
            {status === 'WAITING' && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-full font-semibold animate-pulse">
                <RefreshCw size={12} className="animate-spin" /> ĐANG KIỂM TRA (WAITING)
              </span>
            )}
            {status === 'PENDING' && (
              <span className="inline-flex items-center gap-1 text-xs bg-slate-500/20 text-slate-400 border border-slate-500/30 px-2.5 py-1 rounded-full font-semibold">
                <Clock size={12} /> CHƯA THỰC HIỆN
              </span>
            )}
          </div>

          {checkTime && (
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <Clock size={13} />
              <span>Cập nhật cuối lúc: <strong>{checkTime}</strong></span>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-950/20 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'status'
                ? 'border-pink-500 text-pink-400 bg-pink-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database size={16} />
            Bảng Trạng thái EOD & MM
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'border-pink-500 text-pink-400 bg-pink-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal size={16} />
            Raw Log / JSON Kết quả
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50 min-h-[300px]">
          {activeTab === 'status' ? (
            <div className="space-y-6">
              
              {/* Message from bot check */}
              {parsedNote?.message && (
                <div className={`p-4 border rounded-lg flex items-start gap-3 ${
                  status === 'PASSED' 
                    ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-200' 
                    : status === 'FAILED'
                    ? 'bg-rose-950/20 border-rose-900/50 text-rose-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-300'
                }`}>
                  <AlertCircle className={`shrink-0 mt-0.5 ${status === 'PASSED' ? 'text-emerald-400' : status === 'FAILED' ? 'text-rose-400' : 'text-blue-400'}`} size={18} />
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">Thông điệp kiểm tra</h4>
                    <p className="text-xs leading-relaxed opacity-90">{parsedNote.message}</p>
                  </div>
                </div>
              )}

              {/* CCP and CE Systems side-by-side dashboard */}
              {(ccpData || ceData) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* CCP Card */}
                  <div className="bg-slate-950/30 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-transform hover:-translate-y-0.5">
                    <div className="px-4 py-3 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
                      <span className="font-bold text-slate-200 text-sm tracking-wide">CỔNG THANH TOÁN (CCP)</span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        ccpData?.eod?.success && ccpData?.mm?.success
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {ccpData?.eod?.success && ccpData?.mm?.success ? 'Hợp lệ' : 'Cảnh báo'}
                      </span>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* EOD Check section */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trạng thái EOD</span>
                        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                          <div>
                            <p className="text-xs text-slate-400">Ngày chạy EOD: <strong className="text-slate-250">{ccpData?.eod?.date || 'N/A'}</strong></p>
                            <p className="text-xs text-slate-400 mt-0.5">Thời gian: <strong className="text-slate-250">{ccpData?.eod?.time || 'N/A'}</strong></p>
                          </div>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                            ccpData?.eod?.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {ccpData?.eod?.status === 'COMPLETED' ? 'Đã thành công' : ccpData?.eod?.status || 'Chưa hoàn thành'}
                          </span>
                        </div>
                      </div>

                      {/* MM check section */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trạng thái Lệnh MM</span>
                        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Tổng số lệnh MM:</span>
                            <span className="text-sm font-extrabold text-pink-400">{ccpData?.mm?.totalOrders ?? 0}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Trạng thái lệnh:</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              ccpData?.mm?.status === 'OK'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {ccpData?.mm?.status === 'OK' ? 'OK (Đã lên lệnh)' : ccpData?.mm?.status || 'Không tìm thấy'}
                            </span>
                          </div>

                          {ccpData?.mm?.activeAccounts && ccpData.mm.activeAccounts.length > 0 && (
                            <div className="pt-2 border-t border-slate-800/80">
                              <p className="text-[10px] text-slate-400 font-semibold mb-1.5 uppercase">Tài khoản MM đã đặt lệnh:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {ccpData.mm.activeAccounts.map((acc: string) => (
                                  <span key={acc} className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                                    {acc}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CE Card */}
                  <div className="bg-slate-950/30 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-transform hover:-translate-y-0.5">
                    <div className="px-4 py-3 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
                      <span className="font-bold text-slate-200 text-sm tracking-wide">CỔNG KHỚP LỆNH (CE)</span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        ceData?.eod?.success && ceData?.mm?.success
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {ceData?.eod?.success && ceData?.mm?.success ? 'Hợp lệ' : 'Cảnh báo'}
                      </span>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* EOD Check section */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trạng thái EOD</span>
                        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                          <div>
                            <p className="text-xs text-slate-400">Ngày chạy EOD: <strong className="text-slate-250">{ceData?.eod?.date || 'N/A'}</strong></p>
                            <p className="text-xs text-slate-400 mt-0.5">Thời gian: <strong className="text-slate-250">{ceData?.eod?.time || 'N/A'}</strong></p>
                          </div>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                            ceData?.eod?.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {ceData?.eod?.status === 'COMPLETED' ? 'Đã thành công' : ceData?.eod?.status || 'Chưa hoàn thành'}
                          </span>
                        </div>
                      </div>

                      {/* MM check section */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trạng thái Lệnh MM</span>
                        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Tổng số lệnh MM:</span>
                            <span className="text-sm font-extrabold text-pink-400">{ceData?.mm?.totalOrders ?? 0}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Trạng thái lệnh:</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              ceData?.mm?.status === 'OK'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {ceData?.mm?.status === 'OK' ? 'OK (Đã lên lệnh)' : ceData?.mm?.status || 'Không tìm thấy'}
                            </span>
                          </div>

                          {ceData?.mm?.activeAccounts && ceData.mm.activeAccounts.length > 0 && (
                            <div className="pt-2 border-t border-slate-800/80">
                              <p className="text-[10px] text-slate-400 font-semibold mb-1.5 uppercase">Tài khoản MM đã đặt lệnh:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {ceData.mm.activeAccounts.map((acc: string) => (
                                  <span key={acc} className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                                    {acc}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-950/10">
                  <AlertCircle className="text-slate-500 mb-3" size={32} />
                  <p className="text-sm text-slate-300 font-semibold">Chưa có thông tin phân tích kết quả OMS</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">Hãy nhấn nút "Chạy lại kiểm tra" ở dưới để kích hoạt robot quét dữ liệu.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <div className="absolute right-4 top-4 z-10 flex gap-2">
                <button
                  onClick={handleCopyLogs}
                  className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-slate-100 rounded border border-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                >
                  <Copy size={13} />
                  {copied ? 'Đã chép!' : 'Chép JSON'}
                </button>
              </div>
              <pre className="bg-slate-950 text-emerald-400 p-5 rounded-lg border border-slate-850 font-mono text-xs overflow-x-auto leading-relaxed shadow-inner max-h-[500px]">
                {resultNote ? (isJson ? JSON.stringify(parsedNote, null, 2) : resultNote) : '// Không có log dữ liệu.'}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center">
          <div className="text-xs text-slate-400">
            {status === 'WAITING' ? 'Đang cập nhật trạng thái liên tục...' : 'Hệ thống tự động quét EOD lúc 05h00 hàng ngày.'}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleTriggerCheck}
              disabled={loading || status === 'WAITING'}
              className="px-5 py-2.5 bg-pink-600 hover:bg-pink-500 active:bg-pink-700 disabled:opacity-50 text-slate-100 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading || status === 'WAITING' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {status === 'WAITING' ? 'Đang chạy quét (RPA)...' : 'Đang kích hoạt...'}
                </>
              ) : (
                <>
                  <Play size={14} fill="currentColor" />
                  Chạy lại kiểm tra (RPA)
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 active:bg-slate-900 text-slate-300 rounded-lg text-sm font-semibold transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
