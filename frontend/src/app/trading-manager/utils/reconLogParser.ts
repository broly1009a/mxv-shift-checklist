export interface ReconLogMilestone {
  source: 'MS' | 'CQG' | 'ACM' | 'CCP' | 'BARRIER' | 'RECON';
  title: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'SKIPPED' | 'PENDING';
  timestamp?: string; // HH:mm:ss
  details?: string;
}

export interface ParsedReconLogSummary {
  startTime?: string;
  endTime?: string;
  durationSeconds?: number;
  barrierStatus: 'SYNCED' | 'TIMEOUT' | 'ABORTED' | 'PENDING';
  barrierTime?: string;
  downloads: {
    ms: ReconLogMilestone;
    cqg: ReconLogMilestone;
    acm: ReconLogMilestone;
    ccp: ReconLogMilestone;
  };
  anomaly?: {
    hasAnomaly: boolean;
    note?: string;
  };
  filterWindow?: {
    start?: string;
    end?: string;
  };
  reconResult: {
    status: 'PASSED' | 'FAILED' | 'WAITING' | 'ABORTED' | 'UNKNOWN';
    verdictText: string;
    differKlgd?: number;
    differAcm?: number;
    details?: string;
  };
  rawLogsCount: number;
}

function extractTimestamp(line: string): { timeStr?: string; isoTime?: string; cleanLine: string } {
  const match = line.match(/^\[(.*?)\]\s*(.*)$/);
  if (!match) return { cleanLine: line.trim() };

  const rawTime = match[1];
  const cleanLine = match[2].trim();

  // Thử parse ISO
  const d = new Date(rawTime);
  if (!isNaN(d.getTime())) {
    const timeStr = d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    return { timeStr, isoTime: rawTime, cleanLine };
  }

  // Fallback nếu là chuỗi giờ sẵn có
  if (/^\d{2}:\d{2}(:\d{2})?/.test(rawTime)) {
    return { timeStr: rawTime, cleanLine };
  }

  return { cleanLine };
}

/**
 * Trích xuất tóm tắt nghiệp vụ từ danh sách dòng log thô
 */
export function parseReconJobLogs(logs: string[] = [], summaryData?: any): ParsedReconLogSummary {
  const result: ParsedReconLogSummary = {
    barrierStatus: 'PENDING',
    downloads: {
      ms: { source: 'MS', title: 'M-System (DSGD, TTM, TTTT)', status: 'PENDING' },
      cqg: { source: 'CQG', title: 'CQG (FR, OP, PS)', status: 'PENDING' },
      acm: { source: 'ACM', title: 'ACM Nano (Straits/Fill)', status: 'PENDING' },
      ccp: { source: 'CCP', title: 'CoreCCP (VNClear)', status: 'PENDING' },
    },
    reconResult: {
      status: 'UNKNOWN',
      verdictText: 'Chưa có kết luận',
    },
    rawLogsCount: logs.length,
  };

  if (!logs || logs.length === 0) {
    // Nếu không có logs, dùng fallback từ summaryData nếu có
    if (summaryData?.klgd) {
      const totals = summaryData.klgd.totals || {};
      const differ = totals.differ || 0;
      const differACM = totals.differACM || 0;
      const passed = differ === 0 && differACM === 0;

      result.reconResult = {
        status: passed ? 'PASSED' : 'FAILED',
        verdictText: passed ? 'KHỚP HOÀN TOÀN' : 'CÓ LỆCH SỐ LIỆU',
        differKlgd: differ,
        differAcm: differACM,
      };
      if (summaryData.klgd.acmSessionAnomaly) {
        result.anomaly = {
          hasAnomaly: true,
          note: summaryData.klgd.acmAnomalyNote || 'Sàn ACM chưa cắt phiên kế toán (Trade Date re-check)',
        };
      }
    }
    return result;
  }

  let firstIso: string | undefined;
  let lastIso: string | undefined;

  for (const rawLine of logs) {
    if (!rawLine || typeof rawLine !== 'string') continue;
    const { timeStr, isoTime, cleanLine } = extractTimestamp(rawLine);

    if (isoTime) {
      if (!firstIso) firstIso = isoTime;
      lastIso = isoTime;
    }

    // 1. Mốc khởi động
    if (cleanLine.includes('Bắt đầu chạy đối chiếu') || cleanLine.includes('Khởi động quy trình')) {
      if (!result.startTime && timeStr) result.startTime = timeStr;
    }

    // 2. M-System
    if (cleanLine.includes('MS') || cleanLine.includes('M-System')) {
      if (cleanLine.includes('thành công') || cleanLine.includes('Hoàn tất xuất') || cleanLine.includes('hoàn tất')) {
        result.downloads.ms = {
          source: 'MS',
          title: 'M-System (DSGD, TTM, TTTT)',
          status: 'SUCCESS',
          timestamp: timeStr || result.downloads.ms.timestamp,
          details: cleanLine.replace(/^[-\s>]*MS\s*/i, '').trim(),
        };
      } else if (cleanLine.includes('Lỗi') || cleanLine.includes('Thất bại') || cleanLine.includes('error')) {
        result.downloads.ms = {
          source: 'MS',
          title: 'M-System (DSGD, TTM, TTTT)',
          status: 'ERROR',
          timestamp: timeStr || result.downloads.ms.timestamp,
          details: cleanLine,
        };
      }
    }

    // 3. CQG
    if (cleanLine.includes('CQG')) {
      if (cleanLine.includes('thành công') || cleanLine.includes('Hoàn tất') || cleanLine.includes('hoàn tất tải')) {
        result.downloads.cqg = {
          source: 'CQG',
          title: 'CQG (FR, OP, PS)',
          status: 'SUCCESS',
          timestamp: timeStr || result.downloads.cqg.timestamp,
          details: cleanLine.replace(/^[-\s>]*CQG\s*/i, '').trim(),
        };
      } else if (cleanLine.includes('Lỗi') || cleanLine.includes('error') || cleanLine.includes('Thất bại')) {
        result.downloads.cqg = {
          source: 'CQG',
          title: 'CQG (FR, OP, PS)',
          status: 'ERROR',
          timestamp: timeStr || result.downloads.cqg.timestamp,
          details: cleanLine,
        };
      }
    }

    // 4. ACM
    if (cleanLine.includes('ACM')) {
      if (cleanLine.includes('thành công') || cleanLine.includes('Tải Straits.csv') || cleanLine.includes('Tải báo cáo Fill')) {
        result.downloads.acm = {
          source: 'ACM',
          title: 'ACM Nano (Straits/Fill)',
          status: 'SUCCESS',
          timestamp: timeStr || result.downloads.acm.timestamp,
          details: cleanLine.replace(/^[-\s>]*ACM\s*/i, '').trim(),
        };
      } else if (cleanLine.includes('Lỗi') || cleanLine.includes('error') || cleanLine.includes('Thất bại')) {
        result.downloads.acm = {
          source: 'ACM',
          title: 'ACM Nano (Straits/Fill)',
          status: 'ERROR',
          timestamp: timeStr || result.downloads.acm.timestamp,
          details: cleanLine,
        };
      }
    }

    // 5. CoreCCP
    if (cleanLine.includes('CCP') || cleanLine.includes('CoreCCP')) {
      if (cleanLine.includes('thành công') || cleanLine.includes('hoàn tất')) {
        result.downloads.ccp = {
          source: 'CCP',
          title: 'CoreCCP (VNClear)',
          status: 'SUCCESS',
          timestamp: timeStr || result.downloads.ccp.timestamp,
          details: cleanLine.replace(/^[-\s>]*CCP\s*/i, '').trim(),
        };
      } else if (cleanLine.includes('Chưa cấu hình') || cleanLine.includes('Bỏ qua')) {
        result.downloads.ccp = {
          source: 'CCP',
          title: 'CoreCCP (VNClear)',
          status: 'SKIPPED',
          timestamp: timeStr,
          details: 'Chưa cấu hình tài khoản CoreCCP (bỏ qua)',
        };
      } else if (cleanLine.includes('Lỗi') || cleanLine.includes('error')) {
        result.downloads.ccp = {
          source: 'CCP',
          title: 'CoreCCP (VNClear)',
          status: 'ERROR',
          timestamp: timeStr || result.downloads.ccp.timestamp,
          details: cleanLine,
        };
      }
    }

    // 6. Rào cản đồng bộ
    if (cleanLine.includes('sẵn sàng tải tươi đồng thời') || cleanLine.includes('Pha 2') || cleanLine.includes('Trigger tải tươi')) {
      result.barrierStatus = 'SYNCED';
      if (timeStr) result.barrierTime = timeStr;
    } else if (cleanLine.includes('timeout rào cản') || cleanLine.includes('ngưỡng timeout')) {
      result.barrierStatus = 'TIMEOUT';
      if (timeStr) result.barrierTime = timeStr;
    } else if (cleanLine.includes('QUY TRÌNH ĐỐI SOÁT TẠM DỪNG') || cleanLine.includes('StrictBarrier')) {
      result.barrierStatus = 'ABORTED';
      if (timeStr) result.barrierTime = timeStr;
    }

    // 7. Cảnh báo ACM chưa cắt phiên
    if (cleanLine.includes('ACM CHƯA CẮT PHIÊN') || cleanLine.includes('chưa cắt phiên kế toán')) {
      result.anomaly = {
        hasAnomaly: true,
        note: cleanLine.replace(/^[-\s>]*\[ACM CHƯA CẮT PHIÊN\]\s*/i, '').trim() || cleanLine,
      };
    }

    // 8. Khung thời gian lọc lệnh
    if (cleanLine.includes('Khoảng thời gian lọc:')) {
      const matchWindow = cleanLine.match(/từ\s+(.*?)\s+đến\s+(.*)/i);
      if (matchWindow) {
        result.filterWindow = {
          start: matchWindow[1].trim(),
          end: matchWindow[2].trim(),
        };
      }
    }

    // 9. Kết quả đối soát
    if (cleanLine.includes('Kết quả: KHỚP') || cleanLine.includes('Đối chiếu hoàn tất: KHỚP')) {
      result.reconResult.status = 'PASSED';
      result.reconResult.verdictText = 'KHỚP HOÀN TOÀN';
      result.reconResult.differKlgd = 0;
      result.reconResult.differAcm = 0;
    } else if (cleanLine.includes('Kết quả: LỆCH') || cleanLine.includes('Đối chiếu: LỆCH')) {
      result.reconResult.status = 'FAILED';
      result.reconResult.verdictText = 'CÓ LỆCH SỐ LIỆU';
      const matchDiff = cleanLine.match(/Lệch\s*(?:MS\s*vs\s*CQG)?[:\s]+(\d+)/i);
      if (matchDiff) {
        result.reconResult.differKlgd = parseInt(matchDiff[1], 10);
      }
      const matchAcm = cleanLine.match(/Lệch\s*ACM[:\s]+(\d+)/i);
      if (matchAcm) {
        result.reconResult.differAcm = parseInt(matchAcm[1], 10);
      }
    } else if (cleanLine.includes('Đang chờ cập nhật đầy đủ') || cleanLine.includes('Đang chờ dữ liệu')) {
      result.reconResult.status = 'WAITING';
      result.reconResult.verdictText = 'ĐANG CHỜ DỮ LIỆU ĐỐI SOÁT';
    }
  }

  // Luôn đồng bộ chuẩn xác từ summaryData nếu có (Ground Truth)
  if (summaryData?.klgd) {
    const totals = summaryData.klgd.totals || {};
    const differ = totals.differ !== undefined ? totals.differ : (result.reconResult.differKlgd ?? 0);
    const differACM = totals.differACM !== undefined ? totals.differACM : (result.reconResult.differAcm ?? 0);
    const passed = differ === 0 && differACM === 0;

    result.reconResult.status = passed ? 'PASSED' : 'FAILED';
    result.reconResult.verdictText = passed ? 'KHỚP HOÀN TOÀN' : 'CÓ LỆCH SỐ LIỆU';
    result.reconResult.differKlgd = differ;
    result.reconResult.differAcm = differACM;

    if (summaryData.klgd.acmSessionAnomaly) {
      result.anomaly = {
        hasAnomaly: true,
        note: summaryData.klgd.acmAnomalyNote || 'Sàn ACM chưa cắt phiên kế toán (Hệ thống tự động đối soát theo Trade Date)',
      };
    }
  }

  // Bảo vệ: Nếu cả 2 độ lệch đều bằng 0 thì bắt buộc là PASSED (tránh lỗi hiển thị sai trạng thái)
  if (result.reconResult.differKlgd === 0 && result.reconResult.differAcm === 0 && result.reconResult.status !== 'WAITING') {
    result.reconResult.status = 'PASSED';
    result.reconResult.verdictText = 'KHỚP HOÀN TOÀN';
  }

  // Tính tổng thời lượng chạy
  if (firstIso && lastIso) {
    const tStart = new Date(firstIso).getTime();
    const tEnd = new Date(lastIso).getTime();
    if (!isNaN(tStart) && !isNaN(tEnd) && tEnd >= tStart) {
      result.durationSeconds = Math.round((tEnd - tStart) / 1000);
      result.endTime = new Date(lastIso).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      });
    }
  }

  return result;
}
