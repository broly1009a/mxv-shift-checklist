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
  Terminal,
  BarChart2,
  Download,
  Info,
  ChevronRight,
  ShieldCheck,
  Check,
  AlertCircle
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

interface MismatchedTrade {
  source: string;
  maTKGD: string;
  maHD: string;
  giaKhop: string;
  klGiaoDich: string;
  reason: string;
}

interface MismatchedPosition {
  account: string;
  symbol: string;
  msPosition: number;
  cqgPosition: number;
  differ: number;
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
  const [activeTab, setActiveTab] = useState<'visual' | 'raw'>('visual');

  // Parse structured data first
  const parsedData = useMemo(() => {
    if (!resultNote) {
      return {
        rawText: '',
        isJson: false,
        jsonType: '',
        jsonResult: null,
        message: '',
        fileItems: [],
        marginAccounts: []
      };
    }

    let isJson = false;
    let jsonType = '';
    let jsonResult: any = null;
    let message = '';
    let text = resultNote;

    try {
      const json = JSON.parse(resultNote);
      isJson = true;
      text = json.message || resultNote;
      message = json.message || '';
      jsonType = json.type || '';
      jsonResult = json.result || null;
    } catch (e) {
      // Not JSON
    }

    // Fallback parsing if not JSON
    if (!isJson) {
      const upperText = text.toUpperCase();
      if (text.includes('[ĐỐI CHIẾU TRƯỚC EOD]')) {
        jsonType = 'PRE_EOD';
        const totals: any = {};
        const mismatchedTrades: MismatchedTrade[] = [];
        const mismatchedPositions: MismatchedPosition[] = [];

        // Parse totals
        const acmMatch = text.match(/Khớp lệnh tự doanh\s*\(MS vs Straits\):\s*(\d+)\s*vs\s*(\d+)\s*lot\s*\(Chênh lệch:\s*(\d+)\s*lot\)/i);
        if (acmMatch) {
          totals.totalACM_MS = parseInt(acmMatch[1], 10);
          totals.totalACM_Straits = parseInt(acmMatch[2], 10);
          totals.differACM = parseInt(acmMatch[3], 10);
        }
        const cqgMatch = text.match(/Khớp lệnh thường\s*\(MS vs CQG\):\s*(\d+)\s*vs\s*(\d+)\s*lot\s*\(Chênh lệch:\s*(\d+)\s*lot\)/i);
        if (cqgMatch) {
          totals.totalCQG_MS = parseInt(cqgMatch[1], 10);
          totals.totalCQG_FR = parseInt(cqgMatch[2], 10);
          totals.differCQG = parseInt(cqgMatch[3], 10);
        }

        const lines = text.split('\n');
        let mode: 'trades' | 'positions' | 'none' = 'none';
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed.includes('giao dịch bị lệch chi tiết:')) {
            mode = 'trades';
            return;
          }
          if (trimmed.includes('chênh lệnh vị thế ròng') || (trimmed.includes('net position') && trimmed.includes('chi tiết:')) || trimmed.includes('chênh lệch vị thế ròng')) {
            mode = 'positions';
            return;
          }
          if (trimmed.startsWith('•') || trimmed.startsWith('✓')) {
            mode = 'none';
          }

          if (mode === 'trades' && trimmed.startsWith('-')) {
            const tradeMatch = trimmed.match(/^-\s*\[(.*?)\]\s*TK\s*([^,:]+),?\s*HĐ\s*([^,]+),?\s*Giá\s*([^,]+),?\s*Qty\s*([^:]+):\s*(.*)/i);
            if (tradeMatch) {
              mismatchedTrades.push({
                source: tradeMatch[1]?.trim(),
                maTKGD: tradeMatch[2]?.trim(),
                maHD: tradeMatch[3]?.trim(),
                giaKhop: tradeMatch[4]?.trim(),
                klGiaoDich: tradeMatch[5]?.trim(),
                reason: tradeMatch[6]?.trim()
              });
            }
          } else if (mode === 'positions' && trimmed.startsWith('-')) {
            const posMatch = trimmed.match(/^-\s*TK\s*([^,]+),?\s*HĐ\s*([^:]+):\s*MS\s*([-\d]+)\s*vs\s*CQG\s*([-\d]+)\s*\(Chênh lệch:\s*([-\d]+)\)/i);
            if (posMatch) {
              mismatchedPositions.push({
                account: posMatch[1]?.trim(),
                symbol: posMatch[2]?.trim(),
                msPosition: parseInt(posMatch[3] || '0', 10),
                cqgPosition: parseInt(posMatch[4] || '0', 10),
                differ: parseInt(posMatch[5] || '0', 10)
              });
            }
          }
        });

        jsonResult = {
          totals,
          mismatchedTrades,
          mismatchedPositions,
          passed: mismatchedTrades.length === 0 && mismatchedPositions.length === 0
        };
      } else if (text.includes('[ĐỐI CHIẾU SỐ DƯ CQG TỰ ĐỘNG]') && !text.includes('[ĐỐI CHIẾU SỐ DƯ EOD')) {
        jsonType = 'CQG';
        const discrepancies: any[] = [];
        const lines = text.split('\n');
        let inDiscrepancies = false;
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed.includes('Danh sách tài khoản lệch:')) {
            inDiscrepancies = true;
            return;
          }
          if (trimmed.startsWith('•') || trimmed.startsWith('✓')) {
            inDiscrepancies = false;
          }

          if (inDiscrepancies && trimmed.startsWith('-')) {
            const match = trimmed.match(/^-\s*TK\s*([^,:]+):\s*MS\s*\$?([-\d.,]+)\s*vs\s*CQG\s*\$?([-\d.,]+)\s*\(Chênh lệch:\s*\$?([-\d.,]+)\)/i);
            if (match) {
              discrepancies.push({
                maTKGD: match[1]?.trim(),
                calculatedBalance: parseFloat(match[2]?.replace(/,/g, '') || '0'),
                cqgBalance: parseFloat(match[3]?.replace(/,/g, '') || '0'),
                differ: parseFloat(match[4]?.replace(/,/g, '') || '0'),
                inMS: true,
                inCQG: true
              });
            }
          }
        });
        jsonResult = discrepancies;
      } else if (text.includes('[ĐỐI CHIẾU SỐ DƯ EOD (LỌC TK ÂM KÝ QUỸ)]')) {
        jsonType = 'EOD';
        const negativeBalanceAccs: string[] = [];
        const negativeIMRAcc: string[] = [];
        const cqgResult: any[] = [];

        const balMatch = text.match(/Tài khoản âm số dư hiện tại:\s*(.*)/i);
        if (balMatch) {
          balMatch[1].split(',').forEach(a => {
            const trimmed = a.trim();
            if (trimmed) negativeBalanceAccs.push(trimmed);
          });
        }
        const imrMatch = text.match(/Tài khoản âm ký quỹ khả dụng:\s*(.*)/i);
        if (imrMatch) {
          imrMatch[1].split(',').forEach(a => {
            const trimmed = a.trim();
            if (trimmed) negativeIMRAcc.push(trimmed);
          });
        }

        const lines = text.split('\n');
        let inCqg = false;
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed.includes('[ĐỐI CHIẾU SỐ DƯ CQG TỰ ĐỘNG]')) {
            inCqg = true;
          }
          if (inCqg && trimmed.startsWith('-')) {
            const match = trimmed.match(/^-\s*TK\s*([^,:]+):\s*MS\s*\$?([-\d.,]+)\s*vs\s*CQG\s*\$?([-\d.,]+)\s*\(Chênh lệch:\s*\$?([-\d.,]+)\)/i);
            if (match) {
              cqgResult.push({
                maTKGD: match[1]?.trim(),
                calculatedBalance: parseFloat(match[2]?.replace(/,/g, '') || '0'),
                cqgBalance: parseFloat(match[3]?.replace(/,/g, '') || '0'),
                differ: parseFloat(match[4]?.replace(/,/g, '') || '0'),
                inMS: true,
                inCQG: true
              });
            }
          }
        });

        jsonResult = {
          negativeBalanceAccs,
          negativeIMRAcc,
          cqgResult
        };
      } else if (text.includes('email sao kê') || text.includes('xác minh email')) {
        jsonType = 'SYSTEM_API';
        let totalCount = 0;
        let failedCount = 0;
        let failedList = '';

        const totalMatch = text.match(/tổng số (\d+) email/i) || text.match(/sao kê đã được gửi thành công \((\d+) email\)/i);
        if (totalMatch) {
          totalCount = parseInt(totalMatch[1], 10);
        }
        const failMatch = text.match(/Phát hiện (\d+) email gửi thất bại/i);
        if (failMatch) {
          failedCount = parseInt(failMatch[1], 10);
        }
        const listMatch = text.match(/danh sách thất bại:\s*([\s\S]+)$/i) || text.match(/failedList:\s*([\s\S]+)$/i);
        if (listMatch) {
          failedList = listMatch[1].trim();
        }

        jsonResult = {
          totalCount,
          failedCount,
          failedList
        };
      } else if (upperText.includes('FILE') || upperText.includes('AUDIT') || upperText.includes('TỒN TẠI') || upperText.includes('DOWNLOADED')) {
        jsonType = 'FILE_AUDIT';
      }
    }

    // Parse File items for File Audit
    const fileItems: FileAuditItem[] = [];
    const fileLines = text.split('\n');
    fileLines.forEach((fl, idx) => {
      const trimmed = fl.trim();
      if (trimmed.includes('.xlsx') || trimmed.includes('.csv') || trimmed.includes('.txt') || trimmed.toLowerCase().includes('file')) {
        let fileStatus: 'OK' | 'MISSING' | 'OUTDATED' | 'DOWNLOADED' = 'OK';
        if (trimmed.toLowerCase().includes('thiếu') || trimmed.toLowerCase().includes('missing') || trimmed.toLowerCase().includes('không tồn tại')) {
          fileStatus = 'MISSING';
        } else if (trimmed.toLowerCase().includes('tải') || trimmed.toLowerCase().includes('download') || trimmed.toLowerCase().includes('tồn tại') || trimmed.toLowerCase().includes('ok') || trimmed.toLowerCase().includes('thành công')) {
          fileStatus = 'DOWNLOADED';
        } else if (trimmed.toLowerCase().includes('cũ') || trimmed.toLowerCase().includes('outdated')) {
          fileStatus = 'OUTDATED';
        }

        fileItems.push({
          id: idx,
          filename: trimmed.replace(/^\[.*?\]\s*/, '').split(':')[0].trim(),
          status: fileStatus,
          detail: trimmed
        });
      }
    });

    // Parse negative margin accounts from text if margin warning is active
    let marginAccounts: { account: string; value: number }[] = [];
    if (text.includes('âm ký quỹ') || text.includes('tài khoản âm')) {
      const match = text.match(/(?:âm ký quỹ(?: đầu ngày)?):\s*([\s\S]+)$/i) || text.match(/(?:tài khoản âm):\s*([\s\S]+)$/i);
      if (match) {
        const accountsStr = match[1].trim();
        accountsStr.split(',').forEach((token) => {
          const trimmedToken = token.trim();
          if (!trimmedToken) return;

          const tokenMatch = trimmedToken.match(/^([a-zA-Z0-9-]+)\s*\(([^)]+)\)/);
          if (tokenMatch) {
            const account = tokenMatch[1].trim();
            const valueStr = tokenMatch[2].replace(/[^\d.-]/g, '');
            const value = parseFloat(valueStr) || 0;
            marginAccounts.push({ account, value });
          } else {
            marginAccounts.push({ account: trimmedToken, value: 0 });
          }
        });
      }
    }

    return {
      rawText: text,
      isJson,
      jsonType,
      jsonResult,
      message: message || text,
      fileItems,
      marginAccounts
    };
  }, [resultNote]);

  const category = useMemo<'SYSTEM_API' | 'FILE_AUDIT' | 'RECONCILIATION'>(() => {
    if (parsedData.jsonType === 'PRE_EOD' || parsedData.jsonType === 'CQG' || parsedData.jsonType === 'EOD') {
      return 'RECONCILIATION';
    }
    if (parsedData.jsonType === 'FILE_AUDIT') {
      return 'FILE_AUDIT';
    }
    if (parsedData.jsonType === 'SYSTEM_API') {
      return 'SYSTEM_API';
    }

    // Default heuristics based on title
    const titleUpper = (taskTitle || '').toUpperCase();
    if (
      titleUpper.includes('KÝ QUỸ') ||
      titleUpper.includes('ÂM KÝ QUỸ') ||
      titleUpper.includes('TELEGRAM') ||
      titleUpper.includes('CẢNH BÁO') ||
      titleUpper.includes('THÔNG BÁO') ||
      titleUpper.includes('GỬI') ||
      titleUpper.includes('EMAIL')
    ) {
      return 'SYSTEM_API';
    }
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
    return 'RECONCILIATION';
  }, [taskTitle, parsedData]);

  if (!isOpen) return null;

  const handleCopyLog = () => {
    navigator.clipboard.writeText(parsedData.rawText);
    toast.success('Đã sao chép log gốc!');
  };

  const isFailed = status === 'FAILED' || (parsedData.isJson && !parsedData.jsonResult?.passed && parsedData.jsonType === 'PRE_EOD') || (parsedData.jsonType === 'CQG' && parsedData.jsonResult?.length > 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '900px',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: 'rgba(23, 23, 37, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(30, 30, 50, 0.5), rgba(20, 20, 35, 0.5))',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {category === 'SYSTEM_API' && <Server size={18} color="#ec4899" />}
              {category === 'FILE_AUDIT' && <FolderCheck size={18} color="#f59e0b" />}
              {category === 'RECONCILIATION' && <FileSpreadsheet size={18} color="#3b82f6" />}

              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                {category === 'SYSTEM_API' && 'Giám Sát Hệ Thống & Cảnh Báo'}
                {category === 'FILE_AUDIT' && 'Kiểm Tra Tồn Tại File Báo Cáo'}
                {category === 'RECONCILIATION' && 'Kết Quả Đối Chiếu Số Liệu'}
              </h3>

              {status === 'WAITING' ? (
                <span style={{ fontSize: '0.68rem', padding: '3px 10px', borderRadius: '20px', fontWeight: 700, backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  ⏳ ĐANG XỬ LÝ
                </span>
              ) : isFailed ? (
                <span style={{ fontSize: '0.68rem', padding: '3px 10px', borderRadius: '20px', fontWeight: 700, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  ✕ CHƯA ĐẠT
                </span>
              ) : (
                <span style={{ fontSize: '0.68rem', padding: '3px 10px', borderRadius: '20px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  ✓ ĐẠT YÊU CẦU
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', margin: '6px 0 0 0' }}>
              Tác vụ: <span style={{ color: '#fff', fontWeight: 600 }}>{taskTitle}</span> {checkedAt && `• Thực hiện lúc ${new Date(checkedAt).toLocaleTimeString('vi-VN')}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(0, 0, 0, 0.2)', padding: '0 24px' }}>
          <button
            onClick={() => setActiveTab('visual')}
            style={{
              padding: '12px 16px',
              fontSize: '0.8rem',
              fontWeight: activeTab === 'visual' ? 700 : 500,
              color: activeTab === 'visual' ? '#3b82f6' : 'rgba(255,255,255,0.6)',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'visual' ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <BarChart2 size={14} /> Báo cáo trực quan
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            style={{
              padding: '12px 16px',
              fontSize: '0.8rem',
              fontWeight: activeTab === 'raw' ? 700 : 500,
              color: activeTab === 'raw' ? '#3b82f6' : 'rgba(255,255,255,0.6)',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'raw' ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Terminal size={14} /> Log chi tiết (Raw Logs)
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeTab === 'raw' ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>CONSOLE LOG OUTPUT</span>
                <button
                  onClick={handleCopyLog}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <Copy size={12} /> Sao chép log
                </button>
              </div>
              <pre
                style={{
                  flex: 1,
                  margin: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  padding: '16px',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: '#34d399',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  overflowY: 'auto',
                  lineHeight: 1.6
                }}
              >
                {parsedData.rawText}
              </pre>
            </div>
          ) : (
            <>
              {/* =========================================================================
                  RECONCILIATION VISUAL VIEW
                 ========================================================================= */}
              {category === 'RECONCILIATION' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Pre-EOD Mode */}
                  {parsedData.jsonType === 'PRE_EOD' && parsedData.jsonResult && (
                    <>
                      {/* Totals Cards Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', fontWeight: 600 }}>TỰ DOANH (MS vs Straits)</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                            {parsedData.jsonResult.totals?.totalACM_MS ?? 0} <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>vs</span> {parsedData.jsonResult.totals?.totalACM_Straits ?? 0} <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>lot</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: (parsedData.jsonResult.totals?.differACM ?? 0) > 0 ? '#ef4444' : '#10b981', marginTop: '6px', fontWeight: 600 }}>
                            Chênh lệch: {parsedData.jsonResult.totals?.differACM ?? 0} lot
                          </div>
                        </div>

                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', fontWeight: 600 }}>LỆNH THƯỜNG (MS vs CQG)</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                            {parsedData.jsonResult.totals?.totalCQG_MS ?? 0} <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>vs</span> {parsedData.jsonResult.totals?.totalCQG_FR ?? 0} <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>lot</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: (parsedData.jsonResult.totals?.differCQG ?? 0) > 0 ? '#ef4444' : '#10b981', marginTop: '6px', fontWeight: 600 }}>
                            Chênh lệch: {parsedData.jsonResult.totals?.differCQG ?? 0} lot
                          </div>
                        </div>

                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', fontWeight: 600 }}>CHÊNH LỆCH CHI TIẾT</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: (parsedData.jsonResult.mismatchedTrades?.length ?? 0) > 0 ? '#f87171' : '#34d399' }}>
                            {parsedData.jsonResult.mismatchedTrades?.length ?? 0} giao dịch
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>
                            Lệch khớp lệnh chi tiết
                          </div>
                        </div>

                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', fontWeight: 600 }}>LỆCH NET POSITION</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: (parsedData.jsonResult.mismatchedPositions?.length ?? 0) > 0 ? '#f87171' : '#34d399' }}>
                            {parsedData.jsonResult.mismatchedPositions?.length ?? 0} tài khoản
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>
                            Vị thế ròng CQG vs M-System
                          </div>
                        </div>
                      </div>

                      {/* Trade Mismatch Table */}
                      {(parsedData.jsonResult.mismatchedTrades?.length ?? 0) > 0 && (
                        <div>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={14} color="#f87171" /> Chi tiết giao dịch lệch khớp lệnh ({parsedData.jsonResult.mismatchedTrades.length})
                          </h4>
                          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                                  <th style={{ padding: '10px' }}>Nguồn</th>
                                  <th style={{ padding: '10px' }}>Mã TKGD</th>
                                  <th style={{ padding: '10px' }}>Hợp đồng</th>
                                  <th style={{ padding: '10px' }}>Giá</th>
                                  <th style={{ padding: '10px' }}>Số lượng</th>
                                  <th style={{ padding: '10px' }}>Lý do lệch</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parsedData.jsonResult.mismatchedTrades.map((m: any, idx: number) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                    <td style={{ padding: '10px', color: '#60a5fa', fontWeight: 700 }}>{m.source}</td>
                                    <td style={{ padding: '10px', color: '#fbbf24', fontFamily: 'monospace' }}>{m.maTKGD}</td>
                                    <td style={{ padding: '10px', color: '#fff' }}>{m.maHD}</td>
                                    <td style={{ padding: '10px', color: '#fff' }}>{m.giaKhop}</td>
                                    <td style={{ padding: '10px', color: '#fff', fontWeight: 600 }}>{m.klGiaoDich}</td>
                                    <td style={{ padding: '10px', color: '#f87171' }}>{m.reason}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Position Mismatch Table */}
                      {(parsedData.jsonResult.mismatchedPositions?.length ?? 0) > 0 && (
                        <div>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={14} color="#f87171" /> Chi tiết lệch vị thế ròng (Net Position) ({parsedData.jsonResult.mismatchedPositions.length})
                          </h4>
                          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                                  <th style={{ padding: '10px' }}>Tài khoản</th>
                                  <th style={{ padding: '10px' }}>Hợp đồng</th>
                                  <th style={{ padding: '10px' }}>Vị thế MS</th>
                                  <th style={{ padding: '10px' }}>Vị thế CQG</th>
                                  <th style={{ padding: '10px' }}>Chênh lệch</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parsedData.jsonResult.mismatchedPositions.map((m: any, idx: number) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                    <td style={{ padding: '10px', color: '#fbbf24', fontFamily: 'monospace', fontWeight: 700 }}>{m.account}</td>
                                    <td style={{ padding: '10px', color: '#fff' }}>{m.symbol}</td>
                                    <td style={{ padding: '10px', color: '#fff' }}>{m.msPosition}</td>
                                    <td style={{ padding: '10px', color: '#fff' }}>{m.cqgPosition}</td>
                                    <td style={{ padding: '10px', color: '#f87171', fontWeight: 700 }}>{m.differ}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {!parsedData.jsonResult.mismatchedTrades?.length && !parsedData.jsonResult.mismatchedPositions?.length && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', color: '#34d399' }}>
                          <CheckCircle2 size={20} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Đối chiếu Pre-EOD hoàn toàn khớp! Không phát hiện chênh lệch.</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* CQG Balance Mode */}
                  {parsedData.jsonType === 'CQG' && parsedData.jsonResult && (
                    <>
                      <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyItems: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px', fontWeight: 600 }}>TỔNG SỐ TÀI KHOẢN LỆCH (&gt;100 USD)</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: parsedData.jsonResult.length > 0 ? '#f87171' : '#34d399' }}>
                            {parsedData.jsonResult.length} tài khoản
                          </div>
                        </div>
                        {parsedData.jsonResult.usdRate && (
                          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>TỶ GIÁ USD/VND</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                              {parsedData.jsonResult.usdRate.toLocaleString('vi-VN')} VND
                            </div>
                          </div>
                        )}
                      </div>

                      {parsedData.jsonResult.length > 0 ? (
                        <div>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={14} color="#f87171" /> Chi tiết lệch số dư tài khoản
                          </h4>
                          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                                  <th style={{ padding: '10px' }}>Mã TKGD</th>
                                  <th style={{ padding: '10px' }}>Số dư M-System</th>
                                  <th style={{ padding: '10px' }}>Số dư CQG</th>
                                  <th style={{ padding: '10px' }}>Chênh lệch (USD)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parsedData.jsonResult.map((m: any, idx: number) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                    <td style={{ padding: '10px', color: '#fbbf24', fontFamily: 'monospace', fontWeight: 700 }}>{m.maTKGD}</td>
                                    <td style={{ padding: '10px', color: '#fff' }}>${m.calculatedBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '10px', color: '#fff' }}>${m.cqgBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '10px', color: '#f87171', fontWeight: 700 }}>${m.differ?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', color: '#34d399' }}>
                          <CheckCircle2 size={20} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Số dư M-System và CQG đầu ngày khớp 100%!</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* EOD Mode */}
                  {parsedData.jsonType === 'EOD' && parsedData.jsonResult && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.02)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                          <div style={{ fontSize: '0.7rem', color: '#f87171', marginBottom: '4px', fontWeight: 600 }}>TÀI KHOẢN ÂM SỐ DƯ HIỆN TẠI (QLTKGD)</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f87171' }}>
                            {parsedData.jsonResult.negativeBalanceAccs?.length || 0} tài khoản
                          </div>
                        </div>

                        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.02)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                          <div style={{ fontSize: '0.7rem', color: '#f87171', marginBottom: '4px', fontWeight: 600 }}>TÀI KHOẢN ÂM KÝ QUỸ KHẢ DỤNG (EOD IMR)</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f87171' }}>
                            {parsedData.jsonResult.negativeIMRAcc?.length || 0} tài khoản
                          </div>
                        </div>

                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px', fontWeight: 600 }}>TÀI KHOẢN LỆCH CQG (&gt;100 USD)</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: (parsedData.jsonResult.cqgResult?.length || 0) > 0 ? '#f87171' : '#34d399' }}>
                            {parsedData.jsonResult.cqgResult?.length || 0} tài khoản
                          </div>
                        </div>
                      </div>

                      {/* Negative Balance list */}
                      {parsedData.jsonResult.negativeBalanceAccs?.length > 0 && (
                        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '10px' }}>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={14} /> Danh sách tài khoản âm số dư hiện tại (QLTKGD):
                          </h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {parsedData.jsonResult.negativeBalanceAccs.map((acc: string) => (
                              <span key={acc} style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                {acc}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Negative IMR list */}
                      {parsedData.jsonResult.negativeIMRAcc?.length > 0 && (
                        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '10px' }}>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={14} /> Danh sách tài khoản âm ký quỹ khả dụng (EOD):
                          </h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {parsedData.jsonResult.negativeIMRAcc.map((acc: string) => (
                              <span key={acc} style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                {acc}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CQG discrepancies inside EOD */}
                      {parsedData.jsonResult.cqgResult?.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={14} color="#f87171" /> Danh sách tài khoản chênh lệch CQG ròng (&gt;100 USD)
                          </h4>
                          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                                  <th style={{ padding: '10px' }}>Mã TKGD</th>
                                  <th style={{ padding: '10px' }}>Số dư MS</th>
                                  <th style={{ padding: '10px' }}>Số dư CQG</th>
                                  <th style={{ padding: '10px' }}>Chênh lệch (USD)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parsedData.jsonResult.cqgResult.map((m: any, idx: number) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                    <td style={{ padding: '10px', color: '#fbbf24', fontFamily: 'monospace', fontWeight: 700 }}>{m.maTKGD}</td>
                                    <td style={{ padding: '10px', color: '#fff' }}>${m.calculatedBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '10px', color: '#fff' }}>${m.cqgBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '10px', color: '#f87171', fontWeight: 700 }}>${m.differ?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {!parsedData.jsonResult.negativeBalanceAccs?.length && !parsedData.jsonResult.negativeIMRAcc?.length && !parsedData.jsonResult.cqgResult?.length && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', color: '#34d399' }}>
                          <CheckCircle2 size={20} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Không có tài khoản âm số dư/âm ký quỹ, số dư CQG khớp hoàn toàn!</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* =========================================================================
                  FILE AUDIT STRUCTURED VIEW
                 ========================================================================= */}
              {category === 'FILE_AUDIT' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>TỔNG SỐ FILE KIỂM TRA</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                        {parsedData.fileItems.length} file
                      </div>
                    </div>
                    <div style={{ padding: '14px', background: 'rgba(16, 185, 129, 0.02)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                      <div style={{ fontSize: '0.68rem', color: '#34d399', marginBottom: '4px' }}>FILE TỒN TẠI / ĐÃ TẢI</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>
                        {parsedData.fileItems.filter(f => f.status === 'OK' || f.status === 'DOWNLOADED').length} file
                      </div>
                    </div>
                    <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.02)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                      <div style={{ fontSize: '0.68rem', color: '#f87171', marginBottom: '4px' }}>FILE THIẾU (MISSING)</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f87171' }}>
                        {parsedData.fileItems.filter(f => f.status === 'MISSING').length} file
                      </div>
                    </div>
                  </div>

                  <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                          <th style={{ padding: '10px 12px' }}>Tên File Báo Cáo</th>
                          <th style={{ padding: '10px 12px' }}>Trạng Thái</th>
                          <th style={{ padding: '10px 12px' }}>Chi Tiết Quét</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.fileItems.map((item) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#fff' }}>{item.filename}</td>
                            <td style={{ padding: '10px 12px' }}>
                              {item.status === 'MISSING' ? (
                                <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                  THIẾU FILE
                                </span>
                              ) : item.status === 'OUTDATED' ? (
                                <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                  FILE CŨ
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                  KHỚP / SẴN SÀNG
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)' }}>{item.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* =========================================================================
                  SYSTEM API & GENERAL SYSTEM VIEW
                 ========================================================================= */}
              {category === 'SYSTEM_API' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {parsedData.jsonType === 'SYSTEM_API' && parsedData.jsonResult && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px', fontWeight: 600 }}>TỔNG SỐ EMAIL GỬI</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
                            {parsedData.jsonResult.totalCount || 0} email
                          </div>
                        </div>
                        <div style={{ padding: '16px', background: (parsedData.jsonResult.failedCount || 0) > 0 ? 'rgba(239, 68, 68, 0.02)' : 'rgba(16, 185, 129, 0.02)', borderRadius: '10px', border: (parsedData.jsonResult.failedCount || 0) > 0 ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(16, 185, 129, 0.15)' }}>
                          <div style={{ fontSize: '0.7rem', color: (parsedData.jsonResult.failedCount || 0) > 0 ? '#f87171' : '#34d399', marginBottom: '4px', fontWeight: 600 }}>EMAIL GỬI THẤT BẠI</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: (parsedData.jsonResult.failedCount || 0) > 0 ? '#f87171' : '#34d399' }}>
                            {parsedData.jsonResult.failedCount || 0} email
                          </div>
                        </div>
                      </div>

                      {parsedData.jsonResult.failedList && (
                        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '10px' }}>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={14} /> Danh sách email lỗi:
                          </h4>
                          <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.75rem', color: '#f87171', whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                            {parsedData.jsonResult.failedList}
                          </pre>
                        </div>
                      )}
                    </>
                  )}

                  {/* Margin accounts list if not parsed via JSON but via fallback text */}
                  {parsedData.marginAccounts.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.03)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '10px' }}>
                        <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={15} /> Phát hiện tài khoản âm ký quỹ ({parsedData.marginAccounts.length} tài khoản)
                        </h4>
                        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                          Danh sách tài khoản âm ký quỹ đã được gửi cảnh báo đến các kênh vận hành tự động:
                        </p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                        {parsedData.marginAccounts.map((acc, idx) => (
                          <div key={idx} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24' }}>{acc.account}</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#f87171', fontWeight: 700 }}>
                              {acc.value !== 0 ? acc.value.toLocaleString('vi-VN') : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {parsedData.marginAccounts.length === 0 && !parsedData.jsonResult && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '10px', color: '#34d399' }}>
                      <CheckCircle2 size={24} />
                      <div>
                        <strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: '2px' }}>Trạng thái API & Email ổn định</strong>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Hệ thống phản hồi bình thường, không phát hiện tài khoản âm ký quỹ hoặc lỗi kết nối.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.4)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
}
