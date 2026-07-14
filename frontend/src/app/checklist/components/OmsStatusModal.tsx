'use client';

import React, { useState, useEffect } from 'react';
import { X, Play, AlertCircle, CheckCircle2, XCircle, Clock, Database, RefreshCw, Terminal, Copy, MessageSquare } from 'lucide-react';
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
      const endpoint = taskId === 'ops_open_07'
        ? `${API_BASE_URL}/api/v1/bot-engine/trigger-email-check/${shiftLogId}/${taskId}`
        : `${API_BASE_URL}/api/v1/bot-engine/trigger-oms-check/${shiftLogId}/${taskId}`;

      const res = await fetch(endpoint, {
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

      toast.success(taskId === 'ops_open_07' ? 'Đã kích hoạt xác minh email sao kê trong nền.' : 'Đã kích hoạt quét OMS (CCP/CE) trong nền.');
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
  const emailData = taskId === 'ops_open_07' ? parsedNote?.data : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Database className={`${taskId === 'ops_open_07' ? 'text-blue-500' : 'text-pink-500'} animate-pulse`} size={24} />
            <div>
              <h2 className="text-lg font-bold text-slate-100">{taskName}</h2>
              <p className="text-xs text-slate-400">
                {taskId === 'ops_open_07' 
                  ? 'Xác minh lịch sử gửi email sao kê tự động qua Playwright (07h00)'
                  : 'Kiểm tra kết quả EOD & Lệnh MM tự động qua Playwright (05h00)'}
              </p>
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
                ? taskId === 'ops_open_07'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                  : 'border-pink-500 text-pink-400 bg-pink-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database size={16} />
            {taskId === 'ops_open_07' ? 'Bảng Trạng thái Gửi Email' : 'Bảng Trạng thái EOD & MM'}
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'logs'
                ? taskId === 'ops_open_07'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                  : 'border-pink-500 text-pink-400 bg-pink-500/5'
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
              {parsedNote?.message && !parsedNote.message.startsWith('{') && (
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

              {/* Email Verification Card */}
              {taskId === 'ops_open_07' && emailData ? (
                <div className="bg-slate-950/30 border border-slate-800 rounded-xl overflow-hidden shadow-lg p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <span className="font-bold text-slate-200 text-sm tracking-wide">KẾT QUẢ GỬI EMAIL SAO KÊ</span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      emailData.failedCount === 0
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {emailData.failedCount === 0 ? 'Thành công' : 'Lỗi gửi'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 text-center">
                      <p className="text-xs text-slate-400 font-medium">TỔNG SỐ EMAIL ĐÃ GỬI</p>
                      <p className="text-2xl font-black text-slate-100 mt-1">{emailData.totalCount ?? 0}</p>
                    </div>
                    <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 text-center">
                      <p className="text-xs text-slate-400 font-medium">SỐ EMAIL THẤT BẠI</p>
                      <p className={`text-2xl font-black mt-1 ${emailData.failedCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {emailData.failedCount ?? 0}
                      </p>
                    </div>
                  </div>

                  {emailData.failedCount > 0 && emailData.failedList && (
                    <div className="space-y-2 pt-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Danh sách email gửi thất bại</span>
                      <div className="bg-rose-950/10 border border-rose-900/30 rounded-lg p-4 text-xs text-rose-300 font-mono leading-relaxed break-all">
                        {emailData.failedList}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* CCP and CE Systems side-by-side dashboard */}
              {taskId !== 'ops_open_07' && (ccpData || ceData) ? (
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

                    <div className="p-5 space-y-4">
                      {/* EOD Check */}
                      <div className="bg-slate-900/40 border border-slate-850 rounded-lg p-4 flex justify-between items-center">
                        <div>
                          <p className="text-xs font-semibold text-slate-400">Trạng thái EOD</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Bản ghi quét: {ccpData?.eod?.totalRecords ?? 0}</p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded border ${
                          ccpData?.eod?.success
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {ccpData?.eod?.success ? 'HOÀN TẤT' : 'CHƯA CHỐT'}
                        </span>
                      </div>

                      {/* MM Order Check */}
                      <div className="bg-slate-900/40 border border-slate-850 rounded-lg p-4">
                        <div className="flex justify-between items-center border-b border-slate-800/50 pb-2.5">
                          <p className="text-xs font-semibold text-slate-400">Khớp Lệnh Market Maker</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            ccpData?.mm?.success
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {ccpData?.mm?.success ? 'ĐẠT YÊU CẦU' : 'LỖI'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                          <div className="bg-slate-900/60 p-2 rounded">
                            <p className="text-[10px] text-slate-500 font-medium">Lệnh Active</p>
                            <p className="text-sm font-black text-slate-300 mt-0.5">{ccpData?.mm?.activeOrdersCount ?? 0}</p>
                          </div>
                          <div className="bg-slate-900/60 p-2 rounded">
                            <p className="text-[10px] text-slate-500 font-medium">Lệnh Khớp</p>
                            <p className="text-sm font-black text-slate-300 mt-0.5">{ccpData?.mm?.filledOrdersCount ?? 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CE Card */}
                  <div className="bg-slate-950/30 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-transform hover:-translate-y-0.5">
                    <div className="px-4 py-3 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
                      <span className="font-bold text-slate-200 text-sm tracking-wide">CỔNG BÙ TRỪ (CE)</span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        ceData?.eod?.success && ceData?.mm?.success
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {ceData?.eod?.success && ceData?.mm?.success ? 'Hợp lệ' : 'Cảnh báo'}
                      </span>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* EOD Check */}
                      <div className="bg-slate-900/40 border border-slate-850 rounded-lg p-4 flex justify-between items-center">
                        <div>
                          <p className="text-xs font-semibold text-slate-400">Trạng thái EOD</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Bản ghi quét: {ceData?.eod?.totalRecords ?? 0}</p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded border ${
                          ceData?.eod?.success
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {ceData?.eod?.success ? 'HOÀN TẤT' : 'CHƯA CHỐT'}
                        </span>
                      </div>

                      {/* MM Order Check */}
                      <div className="bg-slate-900/40 border border-slate-850 rounded-lg p-4">
                        <div className="flex justify-between items-center border-b border-slate-800/50 pb-2.5">
                          <p className="text-xs font-semibold text-slate-400">Khớp Lệnh Market Maker</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            ceData?.mm?.success
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {ceData?.mm?.success ? 'ĐẠT YÊU CẦU' : 'LỖI'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                          <div className="bg-slate-900/60 p-2 rounded">
                            <p className="text-[10px] text-slate-500 font-medium">Lệnh Active</p>
                            <p className="text-sm font-black text-slate-300 mt-0.5">{ceData?.mm?.activeOrdersCount ?? 0}</p>
                          </div>
                          <div className="bg-slate-900/60 p-2 rounded">
                            <p className="text-[10px] text-slate-500 font-medium">Lệnh Khớp</p>
                            <p className="text-sm font-black text-slate-300 mt-0.5">{ceData?.mm?.filledOrdersCount ?? 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              ) : taskId === 'ops_open_07' && emailData ? null : (
                <div className="py-12 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-950/10">
                  <AlertCircle className="text-slate-500 mb-3" size={32} />
                  <p className="text-sm text-slate-300 font-semibold">
                    {taskId === 'ops_open_07' ? 'Chưa có thông tin phân tích kết quả gửi email' : 'Chưa có thông tin phân tích kết quả OMS'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
                    {taskId === 'ops_open_07' 
                      ? 'Hãy nhấn nút "Chạy lại kiểm tra" ở dưới để kích hoạt robot quét lịch sử gửi email.'
                      : 'Hãy nhấn nút "Chạy lại kiểm tra" ở dưới để kích hoạt robot quét dữ liệu.'}
                  </p>
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
            {status === 'WAITING' 
              ? 'Đang cập nhật trạng thái liên tục...' 
              : taskId === 'ops_open_07'
              ? 'Hệ thống tự động xác minh lúc 07h00 hàng ngày.'
              : 'Hệ thống tự động quét EOD lúc 05h00 hàng ngày.'}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleTriggerCheck}
              disabled={loading || status === 'WAITING'}
              className={`px-5 py-2.5 disabled:opacity-50 text-slate-100 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] ${
                taskId === 'ops_open_07'
                  ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700'
                  : 'bg-pink-600 hover:bg-pink-500 active:bg-pink-700'
              }`}
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
