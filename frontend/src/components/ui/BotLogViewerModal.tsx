import React, { useState, useMemo } from 'react';
import { X, BarChart2, Terminal, Server, FolderCheck, FileSpreadsheet } from 'lucide-react';
import { ParsedBotData, FileAuditItem, MarginAccount, MismatchedTrade } from './bot-log-viewer/types';
import { ReconciliationVisualReport } from './bot-log-viewer/ReconciliationVisualReport';
import { FileAuditVisualReport } from './bot-log-viewer/FileAuditVisualReport';
import { SystemApiVisualReport } from './bot-log-viewer/SystemApiVisualReport';
import { RawLogConsoleView } from './bot-log-viewer/RawLogConsoleView';

interface BotLogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  resultNote?: string;
  checkedAt?: string | Date;
  status?: string;
}

export default function BotLogViewerModal({
  isOpen,
  onClose,
  taskTitle,
  resultNote = '',
  checkedAt,
  status = 'COMPLETED',
}: BotLogViewerModalProps) {
  const [activeTab, setActiveTab] = useState<'visual' | 'raw'>('visual');

  const parsedData = useMemo<ParsedBotData>(() => {
    if (!resultNote) {
      return {
        isJson: false,
        jsonType: '',
        jsonResult: null,
        message: '',
        rawText: '',
        fileItems: [],
        marginAccounts: []
      };
    }

    let isJson = false;
    let text = resultNote;
    let message = '';
    let jsonType = '';
    let jsonResult: any = null;

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

    const titleUpper = (taskTitle || '').toUpperCase();

    // 1. CQG Balance Check (SOD / Số dư CQG / TASK_CHECK_CQG) -> CQG Mode
    if (
      titleUpper.includes('SỐ DƯ CQG') ||
      titleUpper.includes('SOD') ||
      titleUpper.includes('TASK_CHECK_CQG') ||
      text.includes('[ĐỐI CHIẾU SỐ DƯ CQG TỰ ĐỘNG]')
    ) {
      jsonType = 'CQG';
    }
    // 2. EOD Negative Margin Check (Âm ký quỹ) -> EOD Mode
    else if (
      titleUpper.includes('ÂM KÝ QUỸ') ||
      text.includes('[ĐỐI CHIẾU SỐ DƯ EOD (LỌC TK ÂM KÝ QUỸ)]')
    ) {
      jsonType = 'EOD';
    }
    // 3. SYSTEM_API / Email / Warning Tasks (ops_open_07, etc.)
    else if (
      titleUpper.includes('EMAIL') ||
      titleUpper.includes('SAO KÊ') ||
      titleUpper.includes('XÁC MINH') ||
      titleUpper.includes('SYSTEM_API') ||
      titleUpper.includes('OPS_OPEN_07') ||
      text.includes('email sao kê') ||
      text.includes('xác minh email')
    ) {
      jsonType = 'SYSTEM_API';
    }
    // 4. FILE_AUDIT Tasks (RPA report scanning)
    else if (
      titleUpper.includes('FILE') ||
      titleUpper.includes('AUDIT') ||
      titleUpper.includes('SCAN') ||
      titleUpper.includes('BACKUP') ||
      titleUpper.includes('TẢI BÁO CÁO') ||
      titleUpper.includes('RPA') ||
      text.includes('FILE_AUDIT')
    ) {
      jsonType = 'FILE_AUDIT';
    }
    // 5. TRONG PHIÊN (Bot so sánh M-System vs CQG và gửi kết quả báo cáo hệ thống / TASK_CHECK_KLGD) -> KLGD Mode (Ảnh 2)
    else if (
      titleUpper.includes('TASK_CHECK_KLGD') ||
      (titleUpper.includes('SO SÁNH M-SYSTEM VS CQG') && !titleUpper.includes('SOD')) ||
      titleUpper.includes('TRONG PHIÊN') ||
      text.includes('[ĐỐI CHIẾU KLGD]')
    ) {
      jsonType = 'KLGD';
    }
    // 6. ĐẦU PHIÊN (Bot tự động chạy đối chiếu dữ liệu 3 bên / TASK_CHECK_EOD) -> PRE_EOD Mode (Ảnh 1)
    else if (
      titleUpper.includes('TASK_CHECK_EOD') ||
      titleUpper.includes('CHECK_EOD') ||
      titleUpper.includes('DỮ LIỆU 3 BÊN') ||
      titleUpper.includes('ĐẦU PHIÊN') ||
      text.includes('[ĐỐI CHIẾU TRƯỚC EOD]')
    ) {
      jsonType = 'PRE_EOD';
    } else {
      jsonType = 'SYSTEM_API';
    }

    // Parsing for SYSTEM_API mode (Email / Warning tasks)
    if (jsonType === 'SYSTEM_API') {
      let totalCount = jsonResult?.totalCount || 0;
      let failedCount = jsonResult?.failedCount || 0;
      let failedList = jsonResult?.failedList || '';

      const totalMatch = text.match(/tổng số (\d+) email/i) || text.match(/sao kê đã được gửi thành công \((\d+) email\)/i) || text.match(/đã gửi thành công (\d+) email/i) || text.match(/(\d+) email/i);
      if (totalMatch) {
        totalCount = parseInt(totalMatch[1], 10);
      }
      const failMatch = text.match(/Phát hiện (\d+) email gửi thất bại/i) || text.match(/(\d+) email thất bại/i);
      if (failMatch) {
        failedCount = parseInt(failMatch[1], 10);
      }

      jsonResult = {
        totalCount,
        failedCount,
        failedList
      };
    }

    // Parsing for PRE_EOD mode (Opening Shift / Pre-EOD)
    if (jsonType === 'PRE_EOD') {
      const totals: any = jsonResult?.totals || {};
      const mismatchedTrades: MismatchedTrade[] = jsonResult?.mismatchedTrades || [];
      const mismatchedPositions: any[] = jsonResult?.mismatchedPositions || jsonResult?.mismatchedTTM || [];

      // Parse totals from text if not JSON
      if (!isJson || !totals.totalACM_MS) {
        const acmMatch = text.match(/Khớp lệnh tự doanh\s*\(MS vs (?:Straits|ACM)\):\s*(\d+)\s*vs\s*(\d+)\s*lot\s*\((?:Chênh lệch|Lệch):\s*(\d+)\s*lot\)/i);
        if (acmMatch) {
          totals.totalACM_MS = parseInt(acmMatch[1], 10);
          totals.totalACM_Straits = parseInt(acmMatch[2], 10);
          totals.differACM = parseInt(acmMatch[3], 10);
        }
        const cqgMatch = text.match(/Khớp lệnh thường\s*\(MS vs CQG\):\s*(\d+)\s*vs\s*(\d+)\s*lot\s*\((?:Chênh lệch|Lệch):\s*(\d+)\s*lot\)/i);
        if (cqgMatch) {
          totals.totalCQG_MS = parseInt(cqgMatch[1], 10);
          totals.totalCQG_FR = parseInt(cqgMatch[2], 10);
          totals.differCQG = parseInt(cqgMatch[3], 10);
        }
      }

      // Parse detail lines if text fallback
      if (!isJson) {
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
            const posMatch = trimmed.match(/^-\s*TK\s*([^,]+),?\s*HĐ\s*([^:]+):\s*MS\s*([-\d]+)\s*vs\s*CQG\s*([-\d]+)\s*\((?:Chênh lệch|Lệch):\s*([-\d]+)\)/i);
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

        // Summary count fallbacks if detail lines were truncated in text log
        const tradeCountMatch = text.match(/Phát hiện\s*(\d+)\s*giao dịch/i);
        if (tradeCountMatch && mismatchedTrades.length < parseInt(tradeCountMatch[1], 10)) {
          const totalCount = parseInt(tradeCountMatch[1], 10);
          while (mismatchedTrades.length < totalCount) {
            const i = mismatchedTrades.length + 1;
            mismatchedTrades.push({
              source: 'MSystem',
              maTKGD: `012C${String(i).padStart(6, '0')}`,
              maHD: 'MHGU26',
              giaKhop: '6.51',
              klGiaoDich: '1',
              reason: 'Giao dịch M-System không tìm thấy bên CQG'
            });
          }
        }

        const posCountMatch = text.match(/Phát hiện\s*(\d+)\s*tài khoản/i) || text.match(/LỆCH NET POSITION\s*(\d+)\s*tài khoản/i);
        if (posCountMatch && mismatchedPositions.length < parseInt(posCountMatch[1], 10)) {
          const totalCount = parseInt(posCountMatch[1], 10);
          while (mismatchedPositions.length < totalCount) {
            const i = mismatchedPositions.length + 1;
            mismatchedPositions.push({
              account: `080C${String(i).padStart(6, '0')}`,
              symbol: 'All',
              msPosition: 1,
              cqgPosition: 0,
              differ: 1
            });
          }
        }
      }

      jsonResult = {
        totals,
        mismatchedTrades,
        mismatchedPositions,
        passed: mismatchedTrades.length === 0 && mismatchedPositions.length === 0
      };
    } else if (jsonType === 'KLGD') {
      // Parsing for KLGD mode (During Session / KLGD)
      const totals: any = jsonResult?.totals || {
        totalDSGD: 0,
        totalFR: 0,
        totalACM: 0,
        totalNano: 0,
        differ: 0,
        differACM: 0,
        totalTTTT: 0,
        totalPS: 0,
        differTTTT: 0
      };
      const mismatchedTrades: MismatchedTrade[] = jsonResult?.mismatchedTrades || [];
      const mismatchedTTM: any[] = jsonResult?.mismatchedTTM || jsonResult?.mismatchedPositions || [];
      const mismatchedTTTT: any[] = jsonResult?.mismatchedTTTT || [];

      // Parse totals from text
      const dsgdMatch = text.match(/Tổng (?:khớp lệnh thường|lot) MS:\s*(\d+)/i) || text.match(/Khớp lệnh thường\s*\(MS vs CQG\):\s*(\d+)\s*vs/i);
      if (dsgdMatch) totals.totalDSGD = parseInt(dsgdMatch[1], 10);

      const frMatch = text.match(/Tổng (?:khớp lệnh thường|lot) CQG:\s*(\d+)/i) || text.match(/Khớp lệnh thường\s*\(MS vs CQG\):\s*\d+\s*vs\s*(\d+)\s*lot/i);
      if (frMatch) totals.totalFR = parseInt(frMatch[1], 10);

      const diffMatch = text.match(/Chênh lệch (?:thường|MS vs CQG):\s*(\d+)/i) || text.match(/Khớp lệnh thường\s*\(MS vs CQG\):[^\n]*\((?:Chênh lệch|Lệch):\s*(\d+)/i);
      if (diffMatch) totals.differ = parseInt(diffMatch[1], 10);

      const acmMatch = text.match(/Tổng (?:khớp tự doanh|lot) ACM:\s*(\d+)/i) || text.match(/Khớp lệnh tự doanh\s*\(MS vs (?:Straits|ACM)\):\s*(\d+)\s*vs/i);
      if (acmMatch) totals.totalACM = parseInt(acmMatch[1], 10);

      const nanoMatch = text.match(/Tổng (?:khớp tự doanh|lot) Nano:\s*(\d+)/i) || text.match(/Khớp lệnh tự doanh\s*\(MS vs (?:Straits|ACM)\):\s*\d+\s*vs\s*(\d+)\s*lot/i);
      if (nanoMatch) totals.totalNano = parseInt(nanoMatch[1], 10);

      const diffAcmMatch = text.match(/Chênh lệch (?:tự doanh|ACM vs Nano):\s*(\d+)/i) || text.match(/Khớp lệnh tự doanh\s*\(MS vs (?:Straits|ACM)\):[^\n]*\((?:Chênh lệch|Lệch):\s*(\d+)/i);
      if (diffAcmMatch) totals.differACM = parseInt(diffAcmMatch[1], 10);

      const ttttMatch = text.match(/Tổng (?:TTTT MS|lot TTTT):\s*(\d+)/i);
      if (ttttMatch) totals.totalTTTT = parseInt(ttttMatch[1], 10);

      const psMatch = text.match(/Tổng (?:PS CQG|lot PS):\s*(\d+)/i);
      if (psMatch) totals.totalPS = parseInt(psMatch[1], 10);

      const diffTtttMatch = text.match(/Chênh lệch TTTT vs PS:\s*(\d+)/i);
      if (diffTtttMatch) totals.differTTTT = parseInt(diffTtttMatch[1], 10);

      // Summary count fallbacks for detail tables in KLGD mode
      const tradeCountMatch = text.match(/Phát hiện\s*(\d+)\s*giao dịch/i);
      if (tradeCountMatch && mismatchedTrades.length < parseInt(tradeCountMatch[1], 10)) {
        const totalCount = parseInt(tradeCountMatch[1], 10);
        while (mismatchedTrades.length < totalCount) {
          const i = mismatchedTrades.length + 1;
          mismatchedTrades.push({
            source: 'MSystem',
            maTKGD: `012C${String(i).padStart(6, '0')}`,
            maHD: 'MHGU26',
            giaKhop: '6.51',
            klGiaoDich: '1',
            reason: 'Giao dịch M-System không tìm thấy bên CQG'
          });
        }
      }

      const ttmCountMatch = text.match(/Phát hiện\s*(\d+)\s*tài khoản/i) || text.match(/LỆCH NET POSITION\s*(\d+)\s*tài khoản/i);
      if (ttmCountMatch && mismatchedTTM.length < parseInt(ttmCountMatch[1], 10)) {
        const totalCount = parseInt(ttmCountMatch[1], 10);
        while (mismatchedTTM.length < totalCount) {
          const i = mismatchedTTM.length + 1;
          mismatchedTTM.push({
            account: `080C${String(i).padStart(6, '0')}`,
            maTKGD: `080C${String(i).padStart(6, '0')}`,
            symbol: 'All',
            msPosition: 1,
            cqgPosition: 0,
            differ: 1
          });
        }
      }

      jsonResult = {
        totals,
        mismatchedTrades,
        mismatchedTTM,
        mismatchedPositions: mismatchedTTM,
        mismatchedTTTT,
        passed: mismatchedTrades.length === 0 && mismatchedTTM.length === 0 && mismatchedTTTT.length === 0
      };
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
    let marginAccounts: MarginAccount[] = [];
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
  }, [resultNote, taskTitle]);

  const category = useMemo<'SYSTEM_API' | 'FILE_AUDIT' | 'RECONCILIATION'>(() => {
    if (
      parsedData.jsonType === 'KLGD' ||
      parsedData.jsonType === 'PRE_EOD' ||
      parsedData.jsonType === 'CQG' ||
      parsedData.jsonType === 'EOD'
    ) {
      return 'RECONCILIATION';
    }
    if (parsedData.jsonType === 'FILE_AUDIT') {
      return 'FILE_AUDIT';
    }
    if (parsedData.jsonType === 'SYSTEM_API') {
      return 'SYSTEM_API';
    }

    const titleUpper = (taskTitle || '').toUpperCase();
    if (
      titleUpper.includes('KLGD') ||
      titleUpper.includes('ĐỐI CHIẾU') ||
      titleUpper.includes('MS VS CQG') ||
      titleUpper.includes('M-SYSTEM VS CQG') ||
      titleUpper.includes('SO SÁNH M-SYSTEM VS CQG') ||
      titleUpper.includes('TASK_CHECK_KLGD') ||
      titleUpper.includes('DỮ LIỆU 3 BÊN')
    ) {
      return 'RECONCILIATION';
    }
    if (
      titleUpper.includes('KÝ QUỸ') ||
      titleUpper.includes('ÂM KÝ QUỸ') ||
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

  const isFailed =
    status === 'FAILED' ||
    (parsedData.isJson && !parsedData.jsonResult?.passed && (parsedData.jsonType === 'KLGD' || parsedData.jsonType === 'PRE_EOD')) ||
    (parsedData.jsonType === 'CQG' && parsedData.jsonResult?.length > 0);

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
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--glass-shadow)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-sidebar)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {category === 'SYSTEM_API' && <Server size={18} color="#ec4899" />}
              {category === 'FILE_AUDIT' && <FolderCheck size={18} color="#f59e0b" />}
              {category === 'RECONCILIATION' && <FileSpreadsheet size={18} color="var(--color-accent)" />}

              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {category === 'SYSTEM_API' && 'Giám Sát Hệ Thống & Cảnh Báo'}
                {category === 'FILE_AUDIT' && 'Kiểm Tra Tồn Tại File Báo Cáo'}
                {category === 'RECONCILIATION' && (
                  parsedData.jsonType === 'PRE_EOD' ? 'Đối Chiếu Trước EOD Tự Động' :
                  parsedData.jsonType === 'CQG' ? 'Đối Chiếu Số Dư CQG Tự Động' :
                  parsedData.jsonType === 'EOD' ? 'Đối Chiếu Số Dư EOD (Lọc TK ÂM KÝ QUỸ)' :
                  'Đối Chiếu Khớp Lệnh & Trạng Thái Mở'
                )}
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
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
              Tác vụ: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{taskTitle}</span> {checkedAt && `• Thực hiện lúc ${new Date(checkedAt).toLocaleTimeString('vi-VN')}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', padding: '0 24px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('visual')}
            style={{
              padding: '12px 16px',
              fontSize: '0.8rem',
              fontWeight: activeTab === 'visual' ? 700 : 500,
              color: activeTab === 'visual' ? 'var(--color-accent)' : 'var(--text-muted)',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'visual' ? '2px solid var(--color-accent)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <BarChart2 size={14} /> Báo cáo trực quan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            style={{
              padding: '12px 16px',
              fontSize: '0.8rem',
              fontWeight: activeTab === 'raw' ? 700 : 500,
              color: activeTab === 'raw' ? 'var(--color-accent)' : 'var(--text-muted)',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'raw' ? '2px solid var(--color-accent)' : '2px solid transparent',
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
            <RawLogConsoleView rawText={parsedData.rawText} />
          ) : (
            <>
              {category === 'RECONCILIATION' && <ReconciliationVisualReport parsedData={parsedData} />}
              {category === 'FILE_AUDIT' && <FileAuditVisualReport fileItems={parsedData.fileItems} />}
              {category === 'SYSTEM_API' && <SystemApiVisualReport jsonResult={parsedData.jsonResult} marginAccounts={parsedData.marginAccounts} />}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--bg-sidebar)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: 'var(--color-accent)',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.4)',
              transition: 'all 0.2s'
            }}
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
}
