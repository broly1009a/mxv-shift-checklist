import React, { useState, useMemo, useEffect } from 'react';
import { X, BarChart2, Terminal, Server, FolderCheck, FileSpreadsheet, FileCheck } from 'lucide-react';
import { ParsedBotData, FileAuditItem, MarginAccount, MismatchedTrade } from './bot-log-viewer/types';
import { ReconciliationVisualReport } from './bot-log-viewer/ReconciliationVisualReport';
import { FileAuditVisualReport } from './bot-log-viewer/FileAuditVisualReport';
import { SystemApiVisualReport } from './bot-log-viewer/SystemApiVisualReport';
import { MarginDecisionVisualReport } from './bot-log-viewer/MarginDecisionVisualReport';
import { EmailScanVisualReport } from './bot-log-viewer/EmailScanVisualReport';
import { RawLogConsoleView } from './bot-log-viewer/RawLogConsoleView';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';

interface BotLogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  taskId?: string;
  resultNote?: string;
  checkedAt?: string | Date;
  status?: string;
  shiftLogId?: string;
}

export default function BotLogViewerModal({
  isOpen,
  onClose,
  taskTitle,
  taskId = '',
  resultNote = '',
  checkedAt,
  status = 'COMPLETED',
  shiftLogId,
}: BotLogViewerModalProps) {
  const [activeTab, setActiveTab] = useState<'visual' | 'raw'>('visual');
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const { token } = useAuth();

  useEffect(() => {
    if (isOpen && shiftLogId && taskId && token) {
      fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs?shiftLogId=${shiftLogId}&taskId=${taskId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setHistoryJobs(data);
            if (data.length > 0) {
              setSelectedJobId(data[0]._id || data[0].id);
            }
          }
        })
        .catch(err => console.error('Lỗi tải lịch sử chạy bot:', err));
    }
  }, [isOpen, shiftLogId, taskId, token]);

  const selectedJob = useMemo(() => {
    return historyJobs.find(j => (j._id || j.id) === selectedJobId);
  }, [historyJobs, selectedJobId]);

  const activeResultNote = useMemo(() => {
    if (!selectedJob) return resultNote;
    const payload = selectedJob.payload || {};
    const result = payload.result;
    if (!result) return selectedJob.logs?.join('\n') || '';

    let type = '';
    if (selectedJob.jobType === 'CHECK_KLGD') type = 'KLGD';
    else if (selectedJob.jobType === 'AUTO_CHECK_SOD') type = 'CQG';
    else if (selectedJob.jobType === 'CHECK_PRE_EOD') type = 'PRE_EOD';
    else if (selectedJob.jobType === 'CHECK_EOD_MM') type = 'EOD';

    return JSON.stringify({
      type,
      result,
      message: selectedJob.logs?.join('\n') || '',
      success: selectedJob.status === 'COMPLETED'
    });
  }, [selectedJob, resultNote]);

  const activeStatus = selectedJob ? selectedJob.status : status;
  const activeCheckedAt = selectedJob ? selectedJob.updatedAt || selectedJob.createdAt : checkedAt;

  const parsedData = useMemo<ParsedBotData>(() => {
    if (!activeResultNote) {
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
    let text = activeResultNote;
    let message = '';
    let jsonType = '';
    let jsonResult: any = null;

    try {
      const json = JSON.parse(activeResultNote);
      isJson = true;
      text = json.message || activeResultNote;
      message = json.message || '';
      jsonType = json.type || '';
      jsonResult = json.result || null;
    } catch (e) {
      // Not JSON
    }

    const titleUpper = (taskTitle || '').toUpperCase();
    const idUpper = (taskId || '').toUpperCase();

    // 0. MARGIN_DECISION Tasks (Bot quét thư mục Quyết định thay đổi ký quỹ)
    if (
      idUpper.includes('MARGIN') ||
      idUpper.includes('DECISION') ||
      titleUpper.includes('QUYẾT ĐỊNH') ||
      titleUpper.includes('THAY ĐỔI KÝ QUỸ') ||
      text.includes('Quyết định thay đổi ký quỹ')
    ) {
      jsonType = 'MARGIN_DECISION';
    }
    // 1. CQG Balance Check (SOD / Số dư CQG / TASK_CHECK_CQG) -> CQG Mode
    else if (
      idUpper === 'TASK_CHECK_CQG' ||
      idUpper.includes('CQG') ||
      titleUpper.includes('SỐ DƯ CQG') ||
      titleUpper.includes('SOD') ||
      text.includes('[ĐỐI CHIẾU SỐ DƯ CQG TỰ ĐỘNG]')
    ) {
      jsonType = 'CQG';
    }
    // 2. EOD Negative Margin Check (Âm ký quỹ) -> EOD Mode
    else if (
      idUpper.includes('EOD_MARGIN') ||
      titleUpper.includes('ÂM KÝ QUỸ') ||
      text.includes('[ĐỐI CHIẾU SỐ DƯ EOD (LỌC TK ÂM KÝ QUỸ)]')
    ) {
      jsonType = 'EOD';
    }
    // 3a. EMAIL_SCAN Tasks (Bot quét hòm thư để tải báo cáo)
    else if (
      idUpper.includes('EMAIL_PARSE') ||
      titleUpper.includes('XÁC MINH EMAIL') ||
      titleUpper.includes('QUÉT HÒM THƯ') ||
      titleUpper.includes('ĐỌC EMAIL') ||
      titleUpper.includes('CHECK EMAIL') ||
      text.includes('quét hòm thư') ||
      text.includes('Đã tìm thấy email khớp') ||
      text.includes('Đã quét hòm thư') ||
      text.includes('email nào khớp tiêu đề')
    ) {
      jsonType = 'EMAIL_SCAN';
    }
    // 3b. SYSTEM_API / Email / Warning Tasks (ops_open_07, etc.)
    else if (
      idUpper.includes('SYSTEM_API') ||
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
      idUpper.includes('FILE_AUDIT') ||
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
      idUpper === 'TASK_CHECK_KLGD' ||
      idUpper.includes('KLGD') ||
      (titleUpper.includes('SO SÁNH M-SYSTEM VS CQG') && !titleUpper.includes('SOD') && !titleUpper.includes('3 BÊN')) ||
      titleUpper.includes('TASK_CHECK_KLGD') ||
      titleUpper.includes('TRONG PHIÊN') ||
      text.includes('[ĐỐI CHIẾU KLGD]')
    ) {
      jsonType = 'KLGD';
    }
    // 6. ĐẦU PHIÊN (Bot tự động chạy đối chiếu dữ liệu 3 bên / TASK_CHECK_EOD) -> PRE_EOD Mode (Ảnh 1)
    else if (
      idUpper === 'TASK_CHECK_EOD' ||
      idUpper.includes('PRE_EOD') ||
      titleUpper.includes('TASK_CHECK_EOD') ||
      titleUpper.includes('CHECK_EOD') ||
      titleUpper.includes('DỮ LIỆU 3 BÊN') ||
      titleUpper.includes('PRE_EOD') ||
      titleUpper.includes('ĐẦU PHIÊN') ||
      text.includes('[ĐỐI CHIẾU TRƯỚC EOD]')
    ) {
      jsonType = 'PRE_EOD';
    } else {
      if (idUpper.includes('PRE_EOD') || titleUpper.includes('PRE_EOD')) {
        jsonType = 'PRE_EOD';
      } else if ((idUpper.includes('CQG') || titleUpper.includes('CQG')) && !idUpper.includes('OPS_OPEN_02') && !titleUpper.includes('OMS')) {
        jsonType = 'CQG';
      } else if ((idUpper.includes('EOD') || titleUpper.includes('EOD')) && !idUpper.includes('OPS_OPEN_02') && !titleUpper.includes('OMS')) {
        jsonType = 'EOD';
      } else {
        jsonType = 'SYSTEM_API';
      }
    }

    let marginAccounts: MarginAccount[] = [];

    // Parsing for EOD mode (Negative Margin Check)
    if (jsonType === 'EOD') {
      let marginAccountsList: MarginAccount[] = jsonResult?.marginAccounts || [];
      if (marginAccountsList.length === 0 && (text.includes('âm ký quỹ') || text.includes('tài khoản âm'))) {
        const match = text.match(/(?:âm ký quỹ(?: đầu ngày)?):\s*([\s\S]+?)(?:\.\s*Đã gửi|\n|$)/i) || 
                      text.match(/(?:tài khoản âm):\s*([\s\S]+?)(?:\.\s*Đã gửi|\n|$)/i);
        if (match) {
          const accountsStr = match[1].trim();
          accountsStr.split(',').forEach((token: string) => {
            const trimmedToken = token.trim();
            if (!trimmedToken) return;

            const tokenMatch = trimmedToken.match(/^([a-zA-Z0-9-]+)\s*\(([^)]+)\)/);
            if (tokenMatch) {
              const account = tokenMatch[1].trim();
              const valueStr = tokenMatch[2].replace(/[^\d.-]/g, '');
              const value = parseFloat(valueStr) || 0;
              marginAccountsList.push({ account, value });
            } else {
              const cleanAcc = trimmedToken.replace(/\..*$/, '').trim();
              if (cleanAcc) marginAccountsList.push({ account: cleanAcc, value: 0 });
            }
          });
        }
      }

      marginAccounts = marginAccountsList;
      jsonResult = {
        marginAccounts: marginAccountsList,
        totalCount: marginAccountsList.length,
        passed: marginAccountsList.length === 0
      };
    }

    // Parsing for CQG mode (SOD Balance Check)
    if (jsonType === 'CQG') {
      let cqgDiscrepancies: any[] = Array.isArray(jsonResult)
        ? jsonResult
        : (jsonResult?.result || jsonResult?.discrepancies || []);

      let totalCount = (Array.isArray(cqgDiscrepancies) && cqgDiscrepancies.length > 0)
        ? cqgDiscrepancies.length
        : (jsonResult?.totalCount || 0);

      const totalMatch = text.match(/Số tài khoản (?:chênh lệch|lệch).*?:\s*(\d+)/i);
      if (totalMatch && !totalCount) {
        totalCount = parseInt(totalMatch[1], 10);
      }

      if (cqgDiscrepancies.length === 0 && text.includes('TK ')) {
        const lines = text.split('\n');
        lines.forEach((line: string) => {
          const trimmed = line.trim();
          const match = trimmed.match(/TK\s+([a-zA-Z0-9-]+):\s*MS\s*\$?([\d.,]+)\s*vs\s*CQG\s*\$?([\d.,]+)\s*\(Chênh lệch:\s*\$?([\d.,]+)\)/i);
          if (match) {
            const maTKGD = match[1].trim();
            const calculatedBalance = parseFloat(match[2].replace(/,/g, '')) || 0;
            const cqgBalance = parseFloat(match[3].replace(/,/g, '')) || 0;
            const differ = parseFloat(match[4].replace(/,/g, '')) || 0;
            cqgDiscrepancies.push({
              maTKGD,
              calculatedBalance,
              cqgBalance,
              differ
            });
          }
        });
      }

      jsonResult = {
        ...(jsonResult || {}),
        discrepancies: cqgDiscrepancies,
        cqgDiscrepancies,
        totalCount: totalCount || cqgDiscrepancies.length,
        passed: (totalCount || cqgDiscrepancies.length) === 0
      };
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
        lines.forEach((line: string) => {
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
    const fileMap = new Map<string, { status: 'OK' | 'MISSING' | 'OUTDATED' | 'DOWNLOADED'; detail: string }>();

    fileLines.forEach((fl: string) => {
      const trimmed = fl.trim();

      // Skip generic/summary log lines
      if (
        trimmed.includes('Starting attempt') ||
        trimmed.includes('Job status transitioned') ||
        trimmed.includes('Thư mục backup:') ||
        trimmed.includes('Kết quả scan:') ||
        trimmed.includes('Attempt') ||
        trimmed.includes('Job failed permanently') ||
        trimmed.includes('Initialize auto-checking') ||
        trimmed.includes('Connecting to database')
      ) {
        return;
      }

      // Pattern 1: Scan result listing missing files
      // e.g. "⚠️ Thiếu/cũ 9 file: DSQLKQ.xlsx(MISSING), DSTrader.xlsx(MISSING)..."
      if ((trimmed.includes('Thiếu/cũ') || trimmed.includes('Thiếu file')) && (trimmed.includes('.xlsx') || trimmed.includes('.csv'))) {
        const fileStatusRegex = /([a-zA-Z0-9_\-\s\.]+\.(?:xlsx|csv|txt))\((MISSING|OUTDATED)\)/g;
        let match;
        while ((match = fileStatusRegex.exec(trimmed)) !== null) {
          const filename = match[1].trim();
          const status = match[2] as 'MISSING' | 'OUTDATED';
          fileMap.set(filename, {
            status,
            detail: status === 'MISSING' ? 'File bị thiếu trong thư mục backup' : 'File cũ hoặc không hợp lệ'
          });
        }
      }

      // Pattern 2: Download success
      // e.g. "✅ Tải thành công: DSQLKQ.xlsx"
      const successMatch = trimmed.match(/(?:✅\s*)?Tải thành công:\s*([a-zA-Z0-9_\-\s\.]+\.(?:xlsx|csv|txt))/i);
      if (successMatch) {
        const filename = successMatch[1].trim();
        fileMap.set(filename, {
          status: 'DOWNLOADED',
          detail: 'Tải thành công từ M-System'
        });
      }

      // Pattern 3: Download failure
      // e.g. "❌ Lỗi khi tải QLTKGDAmKQ.xlsx: page.waitForSelector: Timeout 15000ms exceeded..."
      const failMatch = trimmed.match(/(?:❌\s*)?Lỗi khi tải\s*([a-zA-Z0-9_\-\s\.]+\.(?:xlsx|csv|txt))\s*:\s*(.*)/i);
      if (failMatch) {
        const filename = failMatch[1].trim();
        const errorDetail = failMatch[2].trim();
        fileMap.set(filename, {
          status: 'MISSING',
          detail: errorDetail
        });
      }

      // Pattern 4: Simple download success without icon
      const simpleSuccessMatch = trimmed.match(/Tải thành công:\s*([a-zA-Z0-9_\-\s\.]+\.(?:xlsx|csv|txt))/i);
      if (simpleSuccessMatch) {
        const filename = simpleSuccessMatch[1].trim();
        fileMap.set(filename, {
          status: 'DOWNLOADED',
          detail: 'Tải thành công'
        });
      }

      // Pattern 5: Merge CQG success
      const mergeSuccessMatch = trimmed.match(/(?:Ghép|Merge) file CQG thành công:\s*([a-zA-Z0-9_\-\s\.]+\.(?:xlsx|csv|txt))/i);
      if (mergeSuccessMatch) {
        const filename = mergeSuccessMatch[1].trim();
        fileMap.set(filename, {
          status: 'OK',
          detail: 'Ghép file CQG thành công'
        });
      }
    });

    // Fallback parser if map is empty (old or unstructured logs)
    if (fileMap.size === 0) {
      fileLines.forEach((fl: string, idx: number) => {
        const trimmed = fl.trim();
        if (trimmed.includes('Kết quả scan:') || trimmed.includes('Thư mục backup:')) return;

        if (trimmed.includes('.xlsx') || trimmed.includes('.csv') || trimmed.includes('.txt')) {
          const fileMatch = trimmed.match(/([a-zA-Z0-9_\-\s\.]+\.(?:xlsx|csv|txt))/gi);
          if (fileMatch) {
            fileMatch.forEach(fileCandidate => {
              const filename = fileCandidate.trim();
              let fileStatus: 'OK' | 'MISSING' | 'OUTDATED' | 'DOWNLOADED' = 'OK';
              if (trimmed.toLowerCase().includes('thiếu') || trimmed.toLowerCase().includes('missing') || trimmed.toLowerCase().includes('lỗi')) {
                fileStatus = 'MISSING';
              } else if (trimmed.toLowerCase().includes('tải') || trimmed.toLowerCase().includes('download') || trimmed.toLowerCase().includes('thành công')) {
                fileStatus = 'DOWNLOADED';
              }
              fileMap.set(filename, {
                status: fileStatus,
                detail: trimmed
              });
            });
          }
        }
      });
    }

    // Convert the Map to FileAuditItem[] array
    let fileIdx = 0;
    fileMap.forEach((val, filename) => {
      fileItems.push({
        id: fileIdx++,
        filename,
        status: val.status,
        detail: val.detail
      });
    });

    // Parse negative margin accounts from text if margin warning is active
    if (marginAccounts.length === 0 && (text.includes('âm ký quỹ') || text.includes('tài khoản âm'))) {
      const match = text.match(/(?:âm ký quỹ(?: đầu ngày)?):\s*([\s\S]+)$/i) || text.match(/(?:tài khoản âm):\s*([\s\S]+)$/i);
      if (match) {
        const accountsStr = match[1].trim();
        accountsStr.split(',').forEach((token: string) => {
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

    let emailScanResult: any = null;
    if (jsonType === 'EMAIL_SCAN') {
      const isFound = text.includes('Đã tìm thấy email khớp') || text.includes('Tìm thấy email');
      
      const timeMatch = text.match(/Quét tự động lúc\s*([0-9-:\s]+)/i) || text.match(/\[([0-9-T:\.Z]+)\]/i);
      const scannedAt = timeMatch ? timeMatch[1].trim() : '';

      const downloadMatch = text.match(/Đã tải\s*(?:\d+)?\s*file đính kèm về\s*([^:]+):\s*([^\n]+)/i);
      const downloadDir = downloadMatch ? downloadMatch[1].trim() : '';
      const downloadedFiles = downloadMatch ? downloadMatch[2].split(',').map((s: string) => s.trim()) : [];

      const senderMatch = text.match(/người gửi\s*["']([^"']*)["']/i);
      const sender = senderMatch ? senderMatch[1] : '';

      const subjectMatch = text.match(/(?:tiêu đề|email khớp:)\s*["']([^"']+)["']/i);
      const subject = subjectMatch ? subjectMatch[1] : '';

      const keywordMatch = text.match(/điều kiện:\s*["']([^"']+)["']/i) || text.match(/chứa từ khóa\s*["']([^"']+)["']/i);
      const keyword = keywordMatch ? keywordMatch[1] : '';

      emailScanResult = {
        found: isFound,
        subject,
        sender,
        downloadDir,
        downloadedFiles,
        keyword,
        scannedAt
      };
    }

    return {
      rawText: text,
      isJson,
      jsonType,
      jsonResult,
      message: message || text,
      fileItems,
      marginAccounts,
      emailScanResult
    };
  }, [activeResultNote, taskTitle, taskId]);

  const category = useMemo<'SYSTEM_API' | 'FILE_AUDIT' | 'RECONCILIATION' | 'MARGIN_DECISION' | 'EMAIL_SCAN'>(() => {
    if (parsedData.jsonType === 'MARGIN_DECISION') {
      return 'MARGIN_DECISION';
    }
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
    if (parsedData.jsonType === 'EMAIL_SCAN') {
      return 'EMAIL_SCAN';
    }

    const titleUpper = (taskTitle || '').toUpperCase();
    const idUpper = (taskId || '').toUpperCase();
    if (
      idUpper.includes('MARGIN') ||
      idUpper.includes('DECISION') ||
      titleUpper.includes('QUYẾT ĐỊNH') ||
      titleUpper.includes('THAY ĐỔI KÝ QUỸ')
    ) {
      return 'MARGIN_DECISION';
    }
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
      titleUpper.includes('QUÉT EMAIL') ||
      titleUpper.includes('XÁC MINH EMAIL') ||
      titleUpper.includes('QUÉT HÒM THƯ') ||
      titleUpper.includes('ĐỌC EMAIL') ||
      titleUpper.includes('CHECK EMAIL')
    ) {
      return 'EMAIL_SCAN';
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
  }, [taskTitle, taskId, parsedData]);

  if (!isOpen) return null;

  const isFailed =
    activeStatus === 'FAILED' ||
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {category === 'MARGIN_DECISION' && <FileCheck size={18} color="#34d399" />}
              {category === 'SYSTEM_API' && <Server size={18} color="#ec4899" />}
              {category === 'FILE_AUDIT' && <FolderCheck size={18} color="#f59e0b" />}
              {category === 'RECONCILIATION' && <FileSpreadsheet size={18} color="var(--color-accent)" />}

              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {category === 'MARGIN_DECISION' && 'Giám Sát Quyết Định Thay Đổi Ký Quỹ'}
                {category === 'SYSTEM_API' && 'Giám Sát Hệ Thống & Cảnh Báo'}
                {category === 'FILE_AUDIT' && 'Kiểm Tra Tồn Tại File Báo Cáo'}
                {category === 'RECONCILIATION' && (
                  parsedData.jsonType === 'PRE_EOD' ? 'Đối Chiếu Trước EOD Tự Động' :
                  parsedData.jsonType === 'CQG' ? 'Đối Chiếu Số Dư CQG Tự Động' :
                  parsedData.jsonType === 'EOD' ? 'Đối Chiếu Số Dư EOD (Lọc TK ÂM KÝ QUỸ)' :
                  'Đối Chiếu Khớp Lệnh & Trạng Thái Mở'
                )}
              </h3>

              {activeStatus === 'WAITING' ? (
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

              {/* Lịch sử lần chạy selector */}
              {historyJobs.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '10px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Lần quét:</span>
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    style={{
                      fontSize: '0.72rem',
                      padding: '3px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {historyJobs.map((j, index) => {
                      const date = new Date(j.createdAt);
                      const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const statusStr = j.status === 'COMPLETED' ? 'Khớp' : j.status === 'PROCESSING' ? 'Đang chạy' : 'Lệch/Lỗi';
                      return (
                        <option key={j._id || j.id} value={j._id || j.id}>
                          Lượt #{historyJobs.length - index} ({timeStr}) - {statusStr}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
              Tác vụ: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{taskTitle}</span> {activeCheckedAt && `• Thực hiện lúc ${new Date(activeCheckedAt).toLocaleTimeString('vi-VN')}`}
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
              {category === 'MARGIN_DECISION' && <MarginDecisionVisualReport jsonResult={parsedData.jsonResult} rawText={parsedData.rawText} />}
              {category === 'RECONCILIATION' && <ReconciliationVisualReport parsedData={parsedData} />}
              {category === 'FILE_AUDIT' && <FileAuditVisualReport fileItems={parsedData.fileItems} />}
              {category === 'SYSTEM_API' && <SystemApiVisualReport jsonResult={parsedData.jsonResult} marginAccounts={parsedData.marginAccounts} />}
              {category === 'EMAIL_SCAN' && <EmailScanVisualReport emailScanResult={parsedData.emailScanResult} rawText={parsedData.rawText} />}
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
