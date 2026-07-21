'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Search, RefreshCw, AlertCircle, MessageSquare, Clock, FileText, Play } from 'lucide-react';
import { API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface MaturityTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  shiftLogId: string;
  taskId: string;
}

interface MessageItem {
  memberCode: string;
  account: string;
  contractCode: string;
  contractName: string;
  side: string;
  openSide: string;
  openVolume: number;
  pendingSide: string;
  pendingVolume: number;
  deadline: string;
  messageText: string;
}

export default function MaturityTemplateModal({
  isOpen,
  onClose,
  token,
  shiftLogId,
  taskId,
}: MaturityTemplateModalProps) {
  const [activeTab, setActiveTab] = useState<'cards' | 'raw'>('cards');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [jsonContent, setJsonContent] = useState<MessageItem[]>([]);
  const [shiftDate, setShiftDate] = useState('');
  const [triggering, setTriggering] = useState(false);

  const handleTriggerCheck = async () => {
    setTriggering(true);
    toast.loading('Đang khởi chạy robot đối chiếu tất toán hợp đồng...', { id: 'maturity-trigger' });
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-maturity-check/${shiftLogId}/${taskId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Lỗi khi kích hoạt bot đối chiếu');
      }

      toast.success('Đã kích hoạt quét kiểm tra đáo hạn hợp đồng thành công. Vui lòng chờ 5-10s để dữ liệu được tạo.', { id: 'maturity-trigger' });
      
      // Auto-reload data after 8 seconds
      setTimeout(() => {
        fetchTemplates();
      }, 8000);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi kích hoạt kiểm tra', { id: 'maturity-trigger' });
    } finally {
      setTriggering(false);
    }
  };

  const fetchTemplates = async () => {
    if (!shiftLogId) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/reconciliation/maturity-manual-messages?shiftLogId=${shiftLogId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Không thể tải danh sách template tin nhắn');
      }

      const data = await response.json();
      setTextContent(data.textContent || '');
      setJsonContent(data.jsonContent || []);
      setShiftDate(data.shiftDate || '');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tải templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, shiftLogId]);

  if (!isOpen) return null;

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Đã sao chép tin nhắn vào bộ nhớ tạm');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(textContent);
    setCopiedAll(true);
    toast.success('Đã sao chép toàn bộ template');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Filter parsed cards
  const filteredMessages = jsonContent.filter((msg) => {
    const term = searchTerm.toLowerCase();
    return (
      msg.memberCode.toLowerCase().includes(term) ||
      msg.account.toLowerCase().includes(term) ||
      msg.contractCode.toLowerCase().includes(term) ||
      (msg.contractName && msg.contractName.toLowerCase().includes(term))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0f172a] border border-slate-800/90 rounded-xl w-full max-w-5xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 sm:px-8 py-4 bg-slate-900/90 border-b border-slate-800 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl shrink-0">
              <MessageSquare className="animate-pulse" size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-100 truncate">Templates Tin nhắn Đáo hạn Hợp đồng</h2>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Sao chép các tin nhắn thông báo thủ công gửi thành viên QLGD (ngày {shiftDate || 'hiện tại'})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchTemplates}
              disabled={loading}
              title="Tải lại dữ liệu"
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Selectors */}
        <div className="flex bg-slate-900/40 border-b border-slate-800/80 px-6 pt-1">
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-all flex items-center gap-2 rounded-t-lg ${
              activeTab === 'cards'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <MessageSquare size={16} />
            Danh sách Templates ({jsonContent.length})
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-all flex items-center gap-2 rounded-t-lg ${
              activeTab === 'raw'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <FileText size={16} />
            Văn bản tổng hợp (Gửi nhanh)
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/20 min-h-[340px] flex flex-col">
          
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <RefreshCw className="animate-spin h-8 w-8 text-indigo-400 mb-3" />
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Đang tải danh sách tin nhắn...</p>
            </div>
          ) : activeTab === 'cards' ? (
            <div className="space-y-4 flex-1 flex flex-col">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Tìm kiếm nhanh theo mã TV, tài khoản, mã hợp đồng..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40 transition-all text-xs font-medium"
                />
              </div>

              {/* Message Cards List */}
              {filteredMessages.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 overflow-y-auto flex-1 max-h-[50vh] pr-1">
                  {filteredMessages.map((msg, index) => {
                    const uniqueId = `${msg.memberCode}-${msg.account}-${msg.contractCode}-${index}`;
                    const isCopied = copiedId === uniqueId;
                    
                    return (
                      <div
                        key={uniqueId}
                        className="bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 rounded-xl overflow-hidden shadow-md transition-all flex flex-col"
                      >
                        {/* Card Header */}
                        <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800/70 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold px-2.5 py-1 bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 rounded-lg shadow-sm">
                              TVKD: {msg.memberCode}
                            </span>
                            <span className="text-xs font-bold px-2.5 py-1 bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg font-mono">
                              TK: {msg.account}
                            </span>
                            <span className="text-xs font-bold px-2.5 py-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-lg font-mono">
                              HĐ: {msg.contractCode}
                            </span>
                          </div>
                          
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 font-semibold bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                            <Clock size={12} className="text-slate-500" />
                            Hạn tất toán: <strong className="text-slate-200">{msg.deadline}</strong>
                          </div>
                        </div>

                        {/* Card Body & Action */}
                        <div className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                          <div className="flex-1 text-slate-200 text-xs leading-relaxed whitespace-pre-wrap font-mono bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 select-all shadow-inner">
                            {msg.messageText}
                          </div>
                          
                          <button
                            onClick={() => handleCopyText(msg.messageText, uniqueId)}
                            className={`shrink-0 w-full md:w-auto px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                              isCopied
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check size={14} />
                                Đã copy!
                              </>
                            ) : (
                              <>
                                <Copy size={14} />
                                Copy tin nhắn
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 py-14 px-6 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/30 text-center shadow-inner">
                  <div className="p-4 rounded-full bg-slate-800/50 border border-slate-700/50 text-slate-400 mb-4 shadow-md">
                    <AlertCircle size={36} />
                  </div>
                  <h3 className="text-base text-slate-200 font-bold mb-1">Không tìm thấy mẫu tin nhắn nào</h3>
                  <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                    {searchTerm 
                      ? 'Thử thay đổi từ khóa tìm kiếm của bạn.'
                      : 'Có thể tệp đối chiếu đáo hạn hợp đồng chưa được chạy hoặc không có vị thế/lệnh đáo hạn nào.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-4">
              {textContent ? (
                <div className="relative flex-1 flex flex-col min-h-[300px]">
                  <div className="absolute right-4 top-4 z-10">
                    <button
                      onClick={handleCopyAll}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border shadow ${
                        copiedAll
                          ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500/30 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-indigo-400 hover:text-indigo-300'
                      }`}
                    >
                      {copiedAll ? <Check size={13} /> : <Copy size={13} />}
                      {copiedAll ? 'Đã copy tất cả!' : 'Sao chép toàn bộ'}
                    </button>
                  </div>
                  <pre className="flex-1 bg-slate-950 text-indigo-300 p-6 rounded-xl border border-slate-850 font-mono text-xs overflow-auto leading-relaxed shadow-inner max-h-[460px]">
                    {textContent}
                  </pre>
                </div>
              ) : (
                <div className="flex-1 py-14 px-6 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/30 text-center shadow-inner">
                  <div className="p-4 rounded-full bg-slate-800/50 border border-slate-700/50 text-slate-400 mb-4 shadow-md">
                    <AlertCircle size={36} />
                  </div>
                  <h3 className="text-base text-slate-200 font-bold mb-1">Tệp tin nhắn trống</h3>
                  <p className="text-xs text-slate-400">
                    Tệp teams_manual_messages.txt hiện chưa có dữ liệu.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer - Clear non-overlapping layout */}
        <div className="px-6 sm:px-8 py-4 bg-slate-900/90 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-slate-400 font-medium shrink-0">
            Tổng cộng: <strong className="text-slate-200 font-extrabold">{jsonContent.length}</strong> template tin nhắn.
          </div>
          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
            <button
              onClick={handleTriggerCheck}
              disabled={triggering || loading}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                triggering
                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/20 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-500/20'
              }`}
            >
              {triggering ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4 text-amber-300" />
                  Đang chạy bot...
                </>
              ) : (
                <>
                  <Play size={14} fill="currentColor" />
                  Chạy lại đối chiếu (RPA)
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={triggering}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 rounded-xl text-xs font-bold transition-colors border border-slate-700/60 disabled:opacity-50"
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
