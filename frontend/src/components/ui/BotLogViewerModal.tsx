'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  FileText,
  Copy,
  FolderCheck,
  Server,
  FileSpreadsheet,
  Cpu,
  MailCheck,
  MailWarning,
  RefreshCw,
  Terminal,
  BarChart2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface BotLogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  resultNote: string;
  status?: string;
  checkedAt?: string;
}

interface MismatchedItem {
  id: number;
  system: string;
  account: string;
  contract: string;
  price: string;
  qty: string;
  reason: string;
  raw: string;
}

interface FileAuditItem {
  id: number;
  filename: string;
  status: 'OK' | 'MISSING' | 'OUTDATED' | 'DOWNLOADED';
  detail: string;
}

export default function BotLogViewerModal({
  isOpen,
  onClose,
  taskTitle,
  resultNote,
  status = 'PASSED',
  checkedAt,
}: BotLogViewerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [marginSearch, setMarginSearch] = useState('');
  const [showRawLog, setShowRawLog] = useState(false);

  const parsedMarginAccounts = useMemo(() => {
    if (!resultNote) return null;
    let text = resultNote;
    try {
      const json = JSON.parse(resultNote);
      text = json.message || resultNote;
    } catch (e) {}

    if (!text.includes('âm ký quỹ')) return null;

    // Extract the accounts string after the colon
    const match = text.match(/(?:âm ký quỹ(?: đầu ngày)?):\s*([\s\S]+)$/i);
    if (!match) return null;

    const accountsStr = match[1].trim();
    const rawTokens = accountsStr.split(',');
    const list: { account: string; value: number }[] = [];

    rawTokens.forEach((token) => {
      const trimmedToken = token.trim();
      if (!trimmedToken) return;

      const tokenMatch = trimmedToken.match(/^([a-zA-Z0-9-]+)\s*\(([^)]+)\)/);
      if (tokenMatch) {
        const account = tokenMatch[1].trim();
        const valueStr = tokenMatch[2].replace(/[^\d.-]/g, '');
        const value = parseFloat(valueStr) || 0;
        list.push({ account, value });
      } else {
        list.push({ account: trimmedToken, value: 0 });
      }
    });

    return list;
  }, [resultNote]);

  const filteredMarginAccounts = useMemo(() => {
    if (!parsedMarginAccounts) return [];
    return parsedMarginAccounts.filter((acc) =>
      acc.account.toLowerCase().includes(marginSearch.toLowerCase())
    );
  }, [parsedMarginAccounts, marginSearch]);

  const isGeneralSystemTask = useMemo(() => {
    const titleUpper = (taskTitle || '').toUpperCase();
    return (
      titleUpper.includes('KÝ QUỸ') ||
      titleUpper.includes('ÂM KÝ QUỸ') ||
      titleUpper.includes('TELEGRAM') ||
      titleUpper.includes('CẢNH BÁO') ||
      titleUpper.includes('THÔNG BÁO') ||
      titleUpper.includes('GỬI')
    );
  }, [taskTitle]);

  // Parse structured data first
  const parsedData = useMemo(() => {
    if (!resultNote) {
      return { summaryCards: [], mismatchedItems: [], fileItems: [], rawText: '' };
    }

    let text = resultNote;
    try {
      const json = JSON.parse(resultNote);
      text = json.message || resultNote;
    } catch (e) {}

    // Extract summary bullet points (split by •)
    const bullets = text.split('•').map((b) => b.trim()).filter(Boolean);
    const summaryCards: { label: string; value: string; isWarning?: boolean }[] = [];

    bullets.forEach((bullet) => {
      const trimmed = bullet.trim();
      if (trimmed.startsWith('[20') || /^\[\d{4}/.test(trimmed)) {
        return;
      }
      if (bullet.includes(':')) {
        const parts = bullet.split(':');
        const label = parts[0].trim().replace(/^\[.*?\]\s*/, '');
        const val = parts.slice(1).join(':').trim();
        if (!val.includes('Phát hiện') && val.length < 80) {
          const isWarning =
            val.toLowerCase().includes('lệch') &&
            !val.includes('0 lot') &&
            !val.includes('Chênh lệch: 0');
          summaryCards.push({ label, value: val, isWarning });
        }
      }
    });

    // Parse Mismatched Trades & Net Position Discrepancies
    const mismatchedItems: MismatchedItem[] = [];
    const rawLines = text.split(/\n|(?=\s*-\s*TK|\s*-\s*\[)/);

    rawLines.forEach((line, idx) => {
      const trimmed = line.trim().replace(/^[-–•]\s*/, '');
      if (!trimmed) return;

      // Type A: [CQG] TK 012C1189215, HĐ SILU26, Giá 61.48, Qty 1: Lệnh CQG không tìm thấy...
      const matchA = trimmed.match(
        /^\[(.*?)\]\s*(?:TK\s*([^,:]+))?,?\s*(?:HĐ\s*([^,]+))?,?\s*(?:Giá\s*([^,]+))?,?\s*(?:Qty\s*([^:]+))?:\s*(.*)/i
      );

      // Type B: TK 009C0268369, HĐ LRCU26: MS 780 vs CQG 810 (Chênh lệch: -30)
      const matchB = trimmed.match(
        /^(?:TK\s*([^,]+)),?\s*(?:HĐ\s*([^:]+)):\s*(.*)/i
      );

      if (matchA) {
        const sysTag = (matchA[1] || '').trim().toUpperCase();
        const hasTradeDetails = Boolean(matchA[2] || matchA[3] || matchA[4] || matchA[5]);
        const isKnownTradeSystem = ['MSYSTEM', 'CQG', 'STRAITS', 'ACM', 'EOD', 'NKTHT', 'MS', 'SOD'].some((s) => sysTag.includes(s));

        if (hasTradeDetails || isKnownTradeSystem) {
          mismatchedItems.push({
            id: idx,
            system: matchA[1] || 'Hệ thống',
            account: matchA[2] || '—',
            contract: matchA[3] || '—',
            price: matchA[4] || '—',
            qty: matchA[5] || '—',
            reason: matchA[6] || trimmed,
            raw: trimmed,
          });
        }
      } else if (matchB) {
        mismatchedItems.push({
          id: idx,
          system: 'Net Position',
          account: matchB[1]?.trim() || '—',
          contract: matchB[2]?.trim() || '—',
          price: '—',
          qty: '—',
          reason: matchB[3]?.trim() || trimmed,
          raw: trimmed,
        });
      }
    });

    // Parse File Audit Items
    const fileItems: FileAuditItem[] = [];
    const fileLines = text.split(/\n|,|;/);
    fileLines.forEach((fl, idx) => {
      const trimmed = fl.trim();
      if (trimmed.includes('.xlsx') || trimmed.includes('.csv') || trimmed.includes('file')) {
        let fileStatus: 'OK' | 'MISSING' | 'OUTDATED' | 'DOWNLOADED' = 'OK';
        if (trimmed.toLowerCase().includes('thiếu') || trimmed.toLowerCase().includes('missing')) {
          fileStatus = 'MISSING';
        } else if (trimmed.toLowerCase().includes('tải') || trimmed.toLowerCase().includes('download')) {
          fileStatus = 'DOWNLOADED';
        } else if (trimmed.toLowerCase().includes('cũ') || trimmed.toLowerCase().includes('outdated')) {
          fileStatus = 'OUTDATED';
        }

        fileItems.push({
          id: idx,
          filename: trimmed.replace(/^\[.*?\]\s*/, ''),
          status: fileStatus,
          detail: trimmed,
        });
      }
    });

    return {
      summaryCards,
      mismatchedItems,
      fileItems,
      rawText: text,
    };
  }, [resultNote]);

  // Determine if task is currently processing / waiting
  const isTaskProcessing = useMemo(() => {
    const s = (status || '').toUpperCase();
    const raw = (parsedData.rawText || '').toUpperCase();
    return (
      s === 'WAITING' ||
      s === 'PROCESSING' ||
      s === 'PENDING' ||
      raw.includes('ĐANG CHẠY') ||
      raw.includes('ĐANG BẮT ĐẦU') ||
      raw.includes('LOẠI KIỂM TRA KHÔNG ĐƯỢC HỖ TRỢ')
    );
  }, [status, parsedData.rawText]);

  // Determine if task failed or has warning
  const isTaskFailed = useMemo(() => {
    const s = (status || '').toUpperCase();
    const raw = (parsedData.rawText || '').toUpperCase();
    return (
      s === 'FAILED' ||
      s === 'NEEDS_ATTENTION' ||
      raw.includes('THẤT BẠI') ||
      raw.includes('LỖI KẾT NỐI') ||
      raw.includes('FAILED') ||
      raw.includes('NOT FOUND')
    );
  }, [status, parsedData.rawText]);

  const hasMarginWarning = useMemo(() => {
    const text = parsedData.rawText || '';
    return text.includes('Phát hiện') && (text.includes('âm ký quỹ') || text.includes('tài khoản âm') || text.includes('âm'));
  }, [parsedData.rawText]);

  // Detect Task Category intelligently with priority
  const category = useMemo<'SYSTEM_API' | 'FILE_AUDIT' | 'RECONCILIATION'>(() => {
    const titleUpper = (taskTitle || '').toUpperCase();
    const noteUpper = (parsedData.rawText || '').toUpperCase();

    // Priority 1: Pure System / API Watcher (Snapshot Email, API Health, Negative margin checks, Telegram alerts)
    if (
      (titleUpper.includes('JOB SNAPSHOT') ||
      titleUpper.includes('GRAPH API') ||
      titleUpper.includes('KÝ QUỸ') ||
      titleUpper.includes('ÂM KÝ QUỸ') ||
      titleUpper.includes('TELEGRAM') ||
      titleUpper.includes('CẢNH BÁO') ||
      titleUpper.includes('THÔNG BÁO') ||
      titleUpper.includes('GỬI') ||
      noteUpper.includes('MICROSOFT GRAPH API') ||
      noteUpper.includes('GRAPH API QUERY FAILED')) &&
      !titleUpper.includes('ĐỐI CHIẾU') &&
      !titleUpper.includes('SOD') &&
      !titleUpper.includes('SO SÁNH')
    ) {
      return 'SYSTEM_API';
    }

    // Priority 2: File Audit & RPA Backup Downloads
    if (
      titleUpper.includes('FILE') ||
      titleUpper.includes('AUDIT') ||
      titleUpper.includes('SCAN') ||
      titleUpper.includes('BACKUP') ||
      titleUpper.includes('TẢI BÁO CÁO') ||
      titleUpper.includes('RPA')
    ) {
      return 'FILE_AUDIT';
    }

    // Priority 3: Trade / Balance Reconciliation
    if (
      titleUpper.includes('ĐỐI CHIẾU') ||
      noteUpper.includes('ĐỐI CHIẾU') ||
      noteUpper.includes('MS VS CQG') ||
      noteUpper.includes('MS VS STRAITS') ||
      noteUpper.includes('NET POSITION') ||
      noteUpper.includes('KHỚP LỆNH') ||
      parsedData.mismatchedItems.length > 0 ||
      parsedData.summaryCards.length > 0
    ) {
      return 'RECONCILIATION';
    }

    return 'RECONCILIATION';
  }, [taskTitle, parsedData]);

  if (!isOpen) return null;

  const filteredMismatches = parsedData.mismatchedItems.filter(
    (item) =>
      item.account.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.contract.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.system.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-input)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {category === 'SYSTEM_API' && (
                isGeneralSystemTask ? <ShieldAlert size={18} color="#f59e0b" /> : <Server size={18} color="#ec4899" />
              )}
              {category === 'FILE_AUDIT' && <FolderCheck size={18} color="#f59e0b" />}
              {category === 'RECONCILIATION' && <ShieldAlert size={18} color="#0284c7" />}

              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {category === 'SYSTEM_API' && (
                  isGeneralSystemTask ? 'Giám Sát Ký Quỹ & Cảnh Báo Tự Động' : 'Chẩn Đoán Trạng Thái API / Hạ Tầng'
                )}
                {category === 'FILE_AUDIT' && 'Báo Cáo Kiểm Tra File & Backup RPA'}
                {category === 'RECONCILIATION' && 'Chi Tiết Log Đối Chiếu Bot'}
              </h3>

              {isTaskProcessing ? (
                <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, backgroundColor: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.3)' }}>
                  ⏳ ĐANG XỬ LÝ / CHỜ
                </span>
              ) : hasMarginWarning ? (
                <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  ⚠️ WARNING / CẢNH BÁO
                </span>
              ) : !isTaskFailed ? (
                <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  ✓ PASSED
                </span>
              ) : (
                <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  ✕ FAILED / WARNING
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Tác vụ: <strong>{taskTitle}</strong> {checkedAt && `• Thực hiện lúc ${new Date(checkedAt).toLocaleTimeString('vi-VN')}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* =========================================================================
              CATEGORY 1: SYSTEM / API / EMAIL WATCHER DIAGNOSTICS
             ========================================================================= */}
          {category === 'SYSTEM_API' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isTaskFailed ? (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', marginBottom: '10px' }}>
                    <MailWarning size={24} />
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>
                      {isGeneralSystemTask ? 'Phát Hiện Cảnh Báo / Sự Cố Vận Hành' : 'Cảnh Báo Sự Cố Kết Nối / SLA Thất Bại'}
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    {isGeneralSystemTask
                      ? 'Hệ thống đã phát hiện các vấn đề cần lưu ý trong quá trình quét tự động.'
                      : 'Hệ thống không thể hoàn tất quá trình tự động kiểm tra do lỗi hạ tầng kết nối hoặc dịch vụ không phản hồi đúng hạn.'}
                  </p>
                </div>
              ) : hasMarginWarning ? (
                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b', marginBottom: '8px' }}>
                    <AlertTriangle size={24} />
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>
                      Phát Hiện Tài Khoản Âm Ký Quỹ (Đã Cảnh Báo)
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Hệ thống đã phát hiện các tài khoản bị âm ký quỹ và hoàn tất việc gửi danh sách cảnh báo qua Telegram.
                  </p>
                </div>
              ) : (
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981', marginBottom: '8px' }}>
                    <MailCheck size={24} />
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>
                      {isGeneralSystemTask ? 'Trạng Thái Vận Hành Bình Thường' : 'Kết Nối Dịch Vụ Bình Thường'}
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {isGeneralSystemTask
                      ? 'Quy trình kiểm tra tự động đã hoàn tất và không phát hiện bất thường.'
                      : 'Toàn bộ API và luồng xử lý tự động đã phản hồi chính xác.'}
                  </p>
                </div>
              )}

              {/* Log Console Box */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '12px' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Terminal size={14} color="#0284c7" /> {isGeneralSystemTask ? 'Chi tiết kết quả quét tự động' : 'Chi tiết phản hồi chẩn đoán API'}
                  </h4>
                  {parsedMarginAccounts && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {!showRawLog && (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <Search size={12} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
                          <input
                            type="text"
                            placeholder="Tìm TKGD..."
                            value={marginSearch}
                            onChange={(e) => setMarginSearch(e.target.value)}
                            style={{
                              width: '130px',
                              padding: '4px 8px 4px 24px',
                              fontSize: '0.7rem',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              outline: 'none',
                            }}
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowRawLog(!showRawLog)}
                        style={{
                          fontSize: '0.7rem',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <RefreshCw size={10} /> {showRawLog ? 'Xem danh sách' : 'Xem log gốc'}
                      </button>
                    </div>
                  )}
                </div>

                {parsedMarginAccounts && !showRawLog ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0 4px' }}>
                      <span>Phát hiện: <strong>{parsedMarginAccounts.length}</strong> tài khoản âm ký quỹ</span>
                      {marginSearch && <span>Tìm thấy: <strong>{filteredMarginAccounts.length}</strong> kết quả</span>}
                    </div>

                    <div
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        maxHeight: '260px',
                        overflowY: 'auto',
                      }}
                    >
                      {filteredMarginAccounts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Không tìm thấy tài khoản khớp với từ khóa tìm kiếm.
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                            gap: '8px',
                          }}
                        >
                          {filteredMarginAccounts.map((acc, idx) => (
                            <div
                              key={idx}
                              style={{
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {acc.account}
                              </span>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  color: '#ef4444',
                                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                {acc.value ? `${new Intl.NumberFormat('vi-VN').format(acc.value)}` : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      padding: '14px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: isTaskFailed ? '#ef4444' : 'var(--text-primary)',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {parsedData.rawText}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              CATEGORY 2: FILE AUDIT & BACKUP RPA
             ========================================================================= */}
          {category === 'FILE_AUDIT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: 'var(--bg-input)', padding: '14px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderCheck size={18} color="#f59e0b" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Kiểm tra Thư mục Backup & File Báo cáo
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(parsedData.rawText);
                    toast.success('Đã copy toàn bộ log file!');
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                >
                  <Copy size={12} /> Copy Chi Tiết File
                </button>
              </div>

              {/* Log File Content Display */}
              <div
                style={{
                  backgroundColor: 'var(--bg-input)',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}
              >
                {parsedData.rawText}
              </div>
            </div>
          )}

          {/* =========================================================================
              CATEGORY 3: TRADE & BALANCE RECONCILIATION
             ========================================================================= */}
          {category === 'RECONCILIATION' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Summary Cards */}
              {parsedData.summaryCards.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BarChart2 size={14} color="#0284c7" /> Tổng hợp số liệu đối chiếu
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    {parsedData.summaryCards.map((card, i) => (
                      <div
                        key={i}
                        style={{
                          backgroundColor: card.isWarning ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-input)',
                          border: card.isWarning ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-color)',
                          padding: '12px 14px',
                          borderRadius: '8px',
                        }}
                      >
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{card.label}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: card.isWarning ? '#ef4444' : 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {card.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mismatched Items Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} color="#f59e0b" /> Danh sách giao dịch/số dư chênh lệch chi tiết ({parsedData.mismatchedItems.length})
                  </h4>
                  {parsedData.mismatchedItems.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ position: 'relative', width: '220px' }}>
                        <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          placeholder="Lọc số TK, mã HĐ..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="form-input"
                          style={{ fontSize: '0.7rem', padding: '6px 8px 6px 28px', width: '100%' }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(parsedData.rawText);
                          toast.success('Đã copy toàn bộ log!');
                        }}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.7rem', padding: '6px 12px' }}
                      >
                        <Copy size={12} /> Copy Log
                      </button>
                    </div>
                  )}
                </div>

                {parsedData.mismatchedItems.length === 0 ? (
                  isTaskProcessing ? (
                    <div style={{ backgroundColor: 'rgba(2, 132, 199, 0.08)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(2, 132, 199, 0.3)', textAlign: 'center', fontSize: '0.75rem', color: '#0284c7' }}>
                      <Activity size={24} style={{ margin: '0 auto 8px auto', display: 'block' }} />
                      <strong style={{ fontSize: '0.85rem' }}>Tác vụ đang trong quá trình thực thi / kiểm tra...</strong>
                      <div style={{ marginTop: '8px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.72rem', backgroundColor: 'var(--bg-input)', padding: '8px 12px', borderRadius: '6px', textAlign: 'left', wordBreak: 'break-word' }}>
                        {parsedData.rawText}
                      </div>
                    </div>
                  ) : isTaskFailed ? (
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center', fontSize: '0.75rem', color: '#ef4444' }}>
                      <AlertTriangle size={24} style={{ margin: '0 auto 8px auto', display: 'block' }} />
                      <strong style={{ fontSize: '0.85rem' }}>Tác vụ tự động thất bại do Lỗi Hệ Thống / API!</strong>
                      <div style={{ marginTop: '8px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.72rem', backgroundColor: 'var(--bg-input)', padding: '8px 12px', borderRadius: '6px', textAlign: 'left', wordBreak: 'break-word' }}>
                        {parsedData.rawText}
                      </div>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: 'var(--bg-input)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center', fontSize: '0.75rem', color: '#10b981' }}>
                      <CheckCircle2 size={24} style={{ margin: '0 auto 8px auto', display: 'block' }} />
                      Tất cả dữ liệu đối chiếu trùng khớp hoàn toàn! Không có lệch chi tiết.
                    </div>
                  )
                ) : (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', maxHeight: '320px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                          <th style={{ padding: '10px 12px' }}>Hệ thống</th>
                          <th style={{ padding: '10px 12px' }}>Mã TKGD</th>
                          <th style={{ padding: '10px 12px' }}>Mã HĐ</th>
                          <th style={{ padding: '10px 12px' }}>Giá</th>
                          <th style={{ padding: '10px 12px' }}>KL (Qty)</th>
                          <th style={{ padding: '10px 12px' }}>Chi tiết / Lý do lệch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMismatches.map((item) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{item.system}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{item.account}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{item.contract}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{item.price}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{item.qty}</td>
                            <td style={{ padding: '8px 12px', color: '#ef4444', fontWeight: 600 }}>{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Raw Text Fallback Collapsible */}
          <details style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <summary style={{ fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} /> Xem chuỗi Log văn bản gốc (Raw Text)
            </summary>
            <pre style={{ margin: '10px 0 0 0', fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '150px', overflowY: 'auto' }}>
              {parsedData.rawText}
            </pre>
          </details>
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-input)' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '8px 20px' }}>
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
}
