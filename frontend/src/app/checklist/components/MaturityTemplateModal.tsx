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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <MessageSquare className="text-indigo-500 animate-pulse" size={24} />
            <div>
              <h2 className="text-lg font-bold text-slate-100">Templates Tin nhắn Đáo hạn Hợp đồng</h2>
              <p className="text-xs text-slate-400">
                Sao chép các tin nhắn thông báo thủ công gửi thành viên QLGD (ngày {shiftDate || 'hiện tại'})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchTemplates}
              disabled={loading}
              title="Tải lại dữ liệu"
              className="p-1.5 hover:bg-slate-850 rounded-md text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-850 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Selectors */}
        <div className="flex bg-slate-950/20 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'cards'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare size={16} />
            Mẫu Copy Nhanh (Thành viên)
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'raw'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText size={16} />
            Xem File Thô (Full Text)
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50 min-h-[350px] flex flex-col">
          
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-indigo-500 mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-slate-400 font-semibold">Đang tải danh sách tin nhắn...</p>
            </div>
          ) : activeTab === 'cards' ? (
            <div className="space-y-4 flex-1 flex flex-col">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3 text-slate-500" size={18} />
                <input
                  type="text"
                  placeholder="Tìm kiếm nhanh theo mã TV, tài khoản, mã hợp đồng..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/40 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all text-sm"
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
                        className="bg-slate-950/30 border border-slate-850 hover:border-slate-800 rounded-xl overflow-hidden shadow-md transition-all flex flex-col"
                      >
                        {/* Card Header */}
                        <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-850/60 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">
                              TVKD: {msg.memberCode}
                            </span>
                            <span className="text-xs font-bold px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-mono">
                              TK: {msg.account}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-mono">
                              HĐ: {msg.contractCode}
                            </span>
                          </div>
                          
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                            <Clock size={11} />
                            Hạn tất toán: {msg.deadline}
                          </div>
                        </div>

                        {/* Card Body & Action */}
                        <div className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                          <div className="flex-1 text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-slate-950/20 p-3 rounded-lg border border-slate-900/60 select-all">
                            {msg.messageText}
                          </div>
                          
                          <button
                            onClick={() => handleCopyText(msg.messageText, uniqueId)}
                            className={`shrink-0 w-full md:w-auto px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md ${
                              isCopied
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-100'
                                : 'bg-slate-800 hover:bg-slate-750 text-indigo-400 border border-indigo-500/20'
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check size={13} />
                                Đã copy!
                              </>
                            ) : (
                              <>
                                <Copy size={13} />
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
                <div className="flex-1 py-12 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-950/10">
                  <AlertCircle className="text-slate-600 mb-3" size={32} />
                  <p className="text-sm text-slate-300 font-semibold">Không tìm thấy mẫu tin nhắn nào</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
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
                      className={`px-3 py-1.5 rounded text-xs font-semibold transition-all flex items-center gap-1.5 border shadow ${
                        copiedAll
                          ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500/30 text-white'
                          : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-indigo-400 hover:text-indigo-300'
                      }`}
                    >
                      {copiedAll ? <Check size={13} /> : <Copy size={13} />}
                      {copiedAll ? 'Đã copy tất cả!' : 'Sao chép toàn bộ'}
                    </button>
                  </div>
                  <pre className="flex-1 bg-slate-950 text-indigo-300 p-5 rounded-lg border border-slate-850 font-mono text-xs overflow-auto leading-relaxed shadow-inner max-h-[480px]">
                    {textContent}
                  </pre>
                </div>
              ) : (
                <div className="flex-1 py-12 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-950/10">
                  <AlertCircle className="text-slate-600 mb-3" size={32} />
                  <p className="text-sm text-slate-300 font-semibold">Tệp tin nhắn trống</p>
                  <p className="text-xs text-slate-500 mt-1 text-center">
                    Tệp teams_manual_messages.txt hiện chưa có dữ liệu.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center">
          <div className="text-xs text-slate-400">
            Tổng cộng: <strong>{jsonContent.length}</strong> template tin nhắn.
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleTriggerCheck}
              disabled={triggering || loading}
              className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-md ${
                triggering
                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/20 cursor-not-allowed'
                  : 'bg-indigo-650 hover:bg-indigo-600 text-slate-100 hover:shadow-indigo-500/10'
              }`}
            >
              {triggering ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-amber-450" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
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
              className="px-5 py-2 bg-slate-800 hover:bg-slate-750 active:bg-slate-900 text-slate-300 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
