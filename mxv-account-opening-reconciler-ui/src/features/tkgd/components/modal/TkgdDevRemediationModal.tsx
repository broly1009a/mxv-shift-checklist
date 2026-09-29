'use client';

import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  X,
  Terminal,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Upload,
  Layers,
  Copy,
  Trash2,
  Loader2,
  Database,
  Search,
  Check,
  Globe,
  Camera,
} from 'lucide-react';
import { tkgdApi } from '../../services/tkgd.api';

interface RemediationLogItem {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  message: string;
}

interface RemediationResultItem {
  accountCode: string;
  customerName: string;
  previousStatus: string;
  newStatus: string;
  previousErrors: string[];
  newErrors: string[];
  statusChanged: boolean;
}

interface RemediationSessionData {
  sessionId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  finishedAt?: string;
  total: number;
  current: number;
  currentCode?: string;
  options: {
    crawlMSystem: boolean;
    reparseOcr: boolean;
    reconcileRules: boolean;
    batchDate?: string;
  };
  summary: {
    total: number;
    fixedToKhop: number;
    stillAnomalies: number;
    failed: number;
  };
  logs: RemediationLogItem[];
  results: RemediationResultItem[];
}

interface TkgdDevRemediationModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string | null;
  userEmail?: string;
  batchDate?: string;
  onRefreshData?: () => void;
}

export const TkgdDevRemediationModal: React.FC<TkgdDevRemediationModalProps> = ({
  isOpen,
  onClose,
  token,
  userEmail,
  batchDate,
  onRefreshData,
}) => {
  const [inputMode, setInputMode] = useState<'PASTE' | 'FILE' | 'ALL_ANOMALIES'>('ALL_ANOMALIES');
  const [rawTextCodes, setRawTextCodes] = useState<string>('');
  const [parsedCodes, setParsedCodes] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');

  // Tùy chọn chu trình End-to-End
  const [crawlMSystem, setCrawlMSystem] = useState<boolean>(true);
  const [reparseOcr, setReparseOcr] = useState<boolean>(true);
  const [reconcileRules, setReconcileRules] = useState<boolean>(true);

  // Trạng thái phiên xử lý
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [sessionData, setSessionData] = useState<RemediationSessionData | null>(null);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState<boolean>(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Tự động phân tích các mã TKGD từ text dán vào
  useEffect(() => {
    if (inputMode === 'PASTE') {
      const regex = /\b\d{3}C\d{6,10}(?:-[A-Za-z0-9]+)?\b/g;
      const matches = rawTextCodes.toUpperCase().match(regex) || [];
      const unique = Array.from(new Set(matches));
      setParsedCodes(unique);
    }
  }, [rawTextCodes, inputMode]);

  // Cuộn log xuống cuối mỗi khi có log mới
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionData?.logs]);

  // Polling lấy tiến trình và Live Logs mỗi 1 giây
  useEffect(() => {
    if (isProcessing && sessionId) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await tkgdApi.getDevRemediationStatus(sessionId, token, userEmail);
          if (res.success && res.session) {
            setSessionData(res.session);
            if (res.session.status === 'COMPLETED' || res.session.status === 'FAILED') {
              setIsProcessing(false);
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              if (res.session.status === 'COMPLETED') {
                toast.success(
                  `Hoàn tất tái thẩm định! Đã fix ${res.session.summary.fixedToKhop} ca sang KHỚP.`,
                );
                if (onRefreshData) onRefreshData();
              } else {
                toast.error('Phiên tái thẩm định gặp lỗi hệ thống.');
              }
            }
          }
        } catch (err) {
          console.error('Lỗi khi lấy tiến trình remediation:', err);
        }
      }, 1000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isProcessing, sessionId, token, userEmail, onRefreshData]);

  // Đóng modal khi bấm ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  // Xử lý nạp file Excel/CSV/TXT từ máy tính
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = String(event.target?.result || '');
      const regex = /\b\d{3}C\d{6,10}(?:-[A-Za-z0-9]+)?\b/g;
      const matches = text.toUpperCase().match(regex) || [];
      const unique = Array.from(new Set(matches));

      if (unique.length === 0) {
        toast.error('Không tìm thấy mã TKGD hợp lệ nào trong file (định dạng chuẩn: 012Cxxxxxxx)');
      } else {
        toast.success(`Đã trích xuất thành công ${unique.length} mã tài khoản từ file.`);
      }
      setParsedCodes(unique);
    };

    reader.readAsText(file);
  };

  // Kích hoạt phiên tái xử lý E2E
  const handleStartRemediation = async () => {
    if (inputMode !== 'ALL_ANOMALIES' && parsedCodes.length === 0) {
      toast.error('Vui lòng nạp ít nhất một mã tài khoản để bắt đầu.');
      return;
    }

    try {
      setIsProcessing(true);
      setSessionData(null);

      const payload = {
        accountCodes: inputMode === 'ALL_ANOMALIES' ? undefined : parsedCodes,
        targetAllAnomalies: inputMode === 'ALL_ANOMALIES',
        options: {
          crawlMSystem,
          reparseOcr,
          reconcileRules,
          batchDate,
        },
      };

      const res = await tkgdApi.startDevRemediation(payload, token, userEmail);
      if (res?.sessionId) {
        setSessionId(res.sessionId);
        toast.success('Đã khởi tạo phiên tái xử lý E2E. Đang truyền phát log...');
      }
    } catch (err: any) {
      setIsProcessing(false);
      toast.error(`Không thể bắt đầu: ${err.message}`);
    }
  };

  // Tải file Excel danh sách các ca lỗi mẫu
  const handleDownloadExcel = async () => {
    try {
      setIsDownloadingExcel(true);
      await tkgdApi.downloadAnomaliesExcel(batchDate, token, userEmail);
      toast.success('Tải danh sách lỗi thành công!');
    } catch (err: any) {
      toast.error(`Lỗi tải file: ${err.message}`);
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        padding: '16px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0d1117',
          color: '#e6edf3',
          border: '1px solid #30363d',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #30363d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#161b22',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Terminal size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#f0f6fc' }}>
                  Công Cụ Kỹ Thuật: Tái Xử Lý Hồi Tố & Khắc Phục Bug (Dev Console)
                </h3>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                  }}
                >
                  INTERNAL DEV ONLY
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#8b949e' }}>
                Áp dụng mã nguồn mới cho các tài khoản cũ: Tự động bóc tách lại file gốc, cào lại MS và cập nhật trực tiếp MongoDB Ubuntu.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleDownloadExcel}
              disabled={isDownloadingExcel}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: '#21262d',
                color: '#c9d1d9',
                border: '1px solid #30363d',
                cursor: 'pointer',
              }}
              className="hover:bg-slate-700"
              title="Xuất toàn bộ các tài khoản đang mang trạng thái Lệch ra file Excel làm mẫu test"
            >
              {isDownloadingExcel ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Xuất DS Lỗi (Excel)
            </button>

            <button
              onClick={onClose}
              disabled={isProcessing}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                padding: '4px',
                borderRadius: '6px',
              }}
              className="hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MODAL BODY (CUỘN ĐƯỢC) */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* KHỐI 1: CHỌN NGUỒN DANH SÁCH MỤC TIÊU */}
          <div
            style={{
              backgroundColor: '#161b22',
              borderRadius: '12px',
              border: '1px solid #30363d',
              padding: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} color="#38bdf8" />
                1. Chọn danh sách tài khoản cần tái xử lý
              </span>

              {/* TABS CHỌN NGUỒN */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { id: 'ALL_ANOMALIES', label: 'Tất cả ca LỆCH trong CSDL', icon: Database },
                  { id: 'PASTE', label: 'Dán mã trực tiếp', icon: Copy },
                  { id: 'FILE', label: 'Tải file Excel / Text', icon: Upload },
                ].map((t) => {
                  const active = inputMode === t.id;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setInputMode(t.id as any)}
                      disabled={isProcessing}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.73rem',
                        fontWeight: 600,
                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                        border: active ? '1px solid #38bdf8' : '1px solid #30363d',
                        backgroundColor: active ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                        color: active ? '#38bdf8' : '#8b949e',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Icon size={12} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* NỘI DUNG TỪNG TAB */}
            {inputMode === 'ALL_ANOMALIES' && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#0d1117',
                  border: '1px dashed #30363d',
                  fontSize: '0.78rem',
                  color: '#8b949e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  Hệ thống sẽ tự động quét CSDL MongoDB lấy <strong style={{ color: '#f87171' }}>toàn bộ các tài khoản đang mang trạng thái LECH hoặc CAN_KIEM_TRA</strong> để chạy lại qua mã nguồn logic mới nhất.
                </span>
                <span style={{ fontSize: '0.72rem', color: '#58a6ff', fontWeight: 600 }}>Tự động lọc thông minh</span>
              </div>
            )}

            {inputMode === 'PASTE' && (
              <div>
                <textarea
                  value={rawTextCodes}
                  onChange={(e) => setRawTextCodes(e.target.value)}
                  disabled={isProcessing}
                  placeholder="Dán danh sách mã tài khoản vào đây (ví dụ: 012C4242408, 003C123456, 085C8518713... phân cách bằng dấu phẩy hoặc xuống dòng)"
                  rows={3}
                  style={{
                    width: '100%',
                    backgroundColor: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#c9d1d9',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
                <div style={{ marginTop: '6px', fontSize: '0.72rem', color: '#8b949e', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tự động nhận diện regex mã tài khoản chuẩn: <code>0xxCxxxxxxx</code></span>
                  <span style={{ color: parsedCodes.length > 0 ? '#38bdf8' : '#8b949e', fontWeight: 700 }}>
                    Đã nhận diện: {parsedCodes.length} tài khoản
                  </span>
                </div>
              </div>
            )}

            {inputMode === 'FILE' && (
              <div>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: '#0d1117',
                    border: '1px dashed #30363d',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                  }}
                  className="hover:border-sky-500"
                >
                  <Upload size={20} color="#38bdf8" style={{ marginBottom: '6px' }} />
                  <span style={{ fontSize: '0.78rem', color: '#c9d1d9', fontWeight: 600 }}>
                    {fileName ? `File đã chọn: ${fileName}` : 'Bấm vào đây để chọn file Excel (.xlsx, .csv) hoặc File Text (.txt)'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#8b949e', marginTop: '2px' }}>
                    Hệ thống sẽ tự động quét cột Mã TKGD hoặc trích xuất chuỗi mã từ file
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                    style={{ display: 'none' }}
                  />
                </label>
                {parsedCodes.length > 0 && (
                  <div style={{ marginTop: '6px', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, textAlign: 'right' }}>
                    Đã trích xuất thành công: {parsedCodes.length} tài khoản từ file
                  </div>
                )}
              </div>
            )}
          </div>

          {/* KHỐI 2: TÙY CHỌN END-TO-END VÀ NÚT KÍCH HOẠT */}
          <div
            style={{
              backgroundColor: '#161b22',
              borderRadius: '12px',
              border: '1px solid #30363d',
              padding: '14px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c9d1d9', display: 'block', marginBottom: '8px' }}>
                2. Cấu hình chu trình thực thi End-to-End:
              </span>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#c9d1d9', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={crawlMSystem}
                    onChange={(e) => setCrawlMSystem(e.target.checked)}
                    disabled={isProcessing}
                    style={{ accentColor: '#38bdf8' }}
                  />
                  <Globe size={13} color="#38bdf8" />
                  Cào lại M-System mới nhất
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#c9d1d9', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={reparseOcr}
                    onChange={(e) => setReparseOcr(e.target.checked)}
                    disabled={isProcessing}
                    style={{ accentColor: '#38bdf8' }}
                  />
                  <Camera size={13} color="#eab308" />
                  Bóc tách lại File gốc (Python OCR)
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#c9d1d9', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={reconcileRules}
                    disabled={true}
                    style={{ accentColor: '#10b981' }}
                  />
                  <CheckCircle2 size={13} color="#10b981" />
                  Áp dụng bộ luật đối soát mới (Bắt buộc)
                </label>
              </div>
            </div>

            <button
              onClick={handleStartRemediation}
              disabled={isProcessing}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                backgroundColor: isProcessing ? '#21262d' : '#238636',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isProcessing ? 'none' : '0 0 15px rgba(35, 134, 54, 0.4)',
                transition: 'all 0.2s ease',
              }}
              className="hover:brightness-110 active:scale-95"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Đang tái xử lý ({sessionData?.current || 0}/{sessionData?.total || 0})...
                </>
              ) : (
                <>
                  <Play size={15} fill="#fff" />
                  ⚡ BẮT ĐẦU TÁI XỬ LÝ E2E
                </>
              )}
            </button>
          </div>

          {/* KHỐI 3: TERMINAL LIVE LOGS (HỘP ĐEN CONSOLE TRUYỀN PHÁT THỜI GIAN THỰC) */}
          <div
            style={{
              backgroundColor: '#090d16',
              borderRadius: '12px',
              border: '1px solid #30363d',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              height: '240px',
            }}
          >
            {/* Header Terminal */}
            <div
              style={{
                padding: '6px 14px',
                backgroundColor: '#161b22',
                borderBottom: '1px solid #30363d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isProcessing ? '#10b981' : '#8b949e',
                    boxShadow: isProcessing ? '0 0 8px #10b981' : 'none',
                    display: 'inline-block',
                  }}
                  className={isProcessing ? 'animate-pulse' : ''}
                />
                <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 700, color: '#8b949e' }}>
                  TERMINAL LIVE STREAM {sessionId ? `[${sessionId}]` : ''}
                </span>
                {sessionData?.currentCode && (
                  <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontFamily: 'monospace' }}>
                    &gt; Đang xử lý: {sessionData.currentCode} ({sessionData.current}/{sessionData.total})
                  </span>
                )}
              </div>

              {sessionData?.logs && sessionData.logs.length > 0 && (
                <button
                  onClick={() => {
                    const fullText = sessionData.logs.map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
                    navigator.clipboard.writeText(fullText);
                    toast.success('Đã sao chép toàn bộ log vào clipboard');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#8b949e',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  className="hover:text-white"
                >
                  <Copy size={11} />
                  Copy Log
                </button>
              )}
            </div>

            {/* Nội dung dòng Log cuộn tự động */}
            <div
              style={{
                padding: '10px 14px',
                overflowY: 'auto',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '0.74rem',
                lineHeight: 1.6,
                flex: 1,
                color: '#c9d1d9',
              }}
            >
              {(!sessionData?.logs || sessionData.logs.length === 0) && (
                <div style={{ color: '#484f58', textAlign: 'center', marginTop: '60px' }}>
                  Chưa có tiến trình nào đang chạy. Nhấn &quot;Bắt Đầu Tái Xử Lý E2E&quot; để quan sát Live Logs tại đây.
                </div>
              )}

              {sessionData?.logs?.map((log, idx) => {
                let color = '#c9d1d9';
                if (log.level === 'SUCCESS') color = '#3fb950';
                else if (log.level === 'WARN') color = '#d29922';
                else if (log.level === 'ERROR') color = '#f85149';
                else if (log.level === 'INFO' && log.message.includes('---')) color = '#58a6ff';

                return (
                  <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#6e7681', flexShrink: 0 }}>[{log.timestamp}]</span>
                    <span style={{ color, wordBreak: 'break-word' }}>{log.message}</span>
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* KHỐI 4: THỐNG KÊ VÀ BẢNG ĐỐI CHIẾU TRƯỚC VS SAU (BEFORE / AFTER) */}
          {sessionData?.summary && sessionData.summary.total > 0 && (
            <div
              style={{
                backgroundColor: '#161b22',
                borderRadius: '12px',
                border: '1px solid #30363d',
                padding: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} color="#10b981" />
                  3. Báo cáo kết quả tái thẩm định (Before vs After)
                </span>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#21262d', color: '#8b949e' }}>
                    Tổng: <strong>{sessionData.summary.total}</strong>
                  </span>
                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                    Đã Khớp: <strong>{sessionData.summary.fixedToKhop}</strong>
                  </span>
                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                    Còn lệch: <strong>{sessionData.summary.stillAnomalies}</strong>
                  </span>
                </div>
              </div>

              {/* BẢNG DANH SÁCH CHI TIẾT */}
              <div style={{ maxHeight: '200px', overflowY: 'auto', borderRadius: '8px', border: '1px solid #30363d' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#21262d', borderBottom: '1px solid #30363d', color: '#8b949e' }}>
                      <th style={{ padding: '6px 10px' }}>Mã TKGD</th>
                      <th style={{ padding: '6px 10px' }}>Họ Tên</th>
                      <th style={{ padding: '6px 10px' }}>Trạng Thái Cũ</th>
                      <th style={{ padding: '6px 10px' }}>Trạng Thái Mới</th>
                      <th style={{ padding: '6px 10px' }}>Chi Tiết Thay Đổi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionData.results.map((r, i) => {
                      const isFixed = r.previousStatus !== 'KHOP' && r.newStatus === 'KHOP';
                      return (
                        <tr
                          key={i}
                          style={{
                            borderBottom: '1px solid #21262d',
                            backgroundColor: isFixed ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#f0f6fc' }}>
                            {r.accountCode}
                          </td>
                          <td style={{ padding: '6px 10px', color: '#c9d1d9' }}>{r.customerName}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                backgroundColor: r.previousStatus === 'LECH' ? 'rgba(239, 68, 68, 0.2)' : '#30363d',
                                color: r.previousStatus === 'LECH' ? '#f87171' : '#8b949e',
                              }}
                            >
                              {r.previousStatus}
                            </span>
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                backgroundColor: r.newStatus === 'KHOP' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: r.newStatus === 'KHOP' ? '#10b981' : '#f87171',
                                border: r.newStatus === 'KHOP' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                              }}
                            >
                              {r.newStatus}
                            </span>
                          </td>
                          <td style={{ padding: '6px 10px', color: isFixed ? '#10b981' : '#8b949e' }}>
                            {isFixed
                              ? `Đã xóa ${r.previousErrors.length} lỗi cũ`
                              : r.newErrors.join('; ') || 'Không thay đổi'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid #30363d',
            backgroundColor: '#161b22',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: '#8b949e',
          }}
        >
          <span>
            Tiến trình tự động cập nhật trực tiếp vào CSDL MongoDB trên Ubuntu <code>10.0.0.26</code>.
          </span>
          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{
              padding: '5px 14px',
              borderRadius: '6px',
              backgroundColor: '#21262d',
              border: '1px solid #30363d',
              color: '#c9d1d9',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
            className="hover:bg-slate-700"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
