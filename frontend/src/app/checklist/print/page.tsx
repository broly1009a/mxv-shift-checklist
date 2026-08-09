'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ShiftLogDetail {
  taskId: string;
  taskNameSnapshot: string;
  prioritySnapshot: string;
  isChecked: boolean;
  status: string;
  resultNote?: string;
  checkedAt?: string;
  completedAt?: string;
  note?: string;
  deadlineSnapshot?: string;
}

interface ShiftLog {
  _id: string;
  status: string;
  shiftDate?: string;
  handoverNote?: string;
  progressPercentage: number;
  details: ShiftLogDetail[];
  templateId?: { title?: string; sessionType?: string };
  userId?: { fullName?: string; username?: string };
  closedBy?: { fullName?: string };
}

// ─── Checkbox component ───────────────────────────────────────────────────────
function CB({ checked }: { checked: boolean }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      readOnly
      style={{ width: '12px', height: '12px', margin: 0, verticalAlign: 'middle', cursor: 'default' }}
    />
  );
}

// ─── Main print component ─────────────────────────────────────────────────────
function QlgdPrintPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shiftLogId = searchParams.get('id');

  const [log, setLog] = React.useState<ShiftLog | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch shift log data on mount
  React.useEffect(() => {
    if (!shiftLogId) {
      setError('Không tìm thấy ID ca trực trong URL.');
      setLoading(false);
      return;
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { router.replace('/login'); return; }

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    fetch(`${apiBase}/shift-logs/${shiftLogId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: ShiftLog) => { setLog(data); setLoading(false); })
      .catch((err) => { setError(`Lỗi tải dữ liệu: ${err.message}`); setLoading(false); });
  }, [shiftLogId, router]);

  // Auto-print after data loads
  React.useEffect(() => {
    if (!loading && log && !error) {
      const t = setTimeout(() => window.print(), 700);
      return () => clearTimeout(t);
    }
  }, [loading, log, error]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const getTask = React.useCallback((log: ShiftLog, stt: number): ShiftLogDetail | undefined => {
    const d = log.details;
    switch (stt) {
      case 1: return d.find(x => x.taskId === 'ops_open_02' || x.taskId.includes('open_01') || x.taskNameSnapshot.toLowerCase().includes('t-1') || x.taskNameSnapshot.toLowerCase().includes('trước eod'));
      case 2: return d.find(x => x.taskId === 'TASK_CHECK_EOD' || x.taskNameSnapshot.toLowerCase().includes('eod hệ thống') || x.taskId.includes('EOD'));
      case 3: return d.find(x => x.taskId === 'TASK_CHECK_CQG' || x.taskNameSnapshot.toLowerCase().includes('sync cqg') || x.taskNameSnapshot.toLowerCase().includes('đồng bộ cqg') || x.taskId.includes('CQG'));
      case 4: return d.find(x => x.taskId === 'ops_open_07' || x.taskNameSnapshot.toLowerCase().includes('năng lượng') || x.taskNameSnapshot.toLowerCase().includes('sao kê'));
      case 5: return d.find(x => x.taskId === 'ops_during_05' || x.taskNameSnapshot.toLowerCase().includes('tất toán'));
      case 6: return d.find(x => x.taskId.includes('lme') || x.taskNameSnapshot.toLowerCase().includes('lme'));
      case 7: return d.find(x => x.taskId.includes('options') || x.taskNameSnapshot.toLowerCase().includes('options') || x.taskNameSnapshot.toLowerCase().includes('exercise'));
      case 8: return d.find(x => x.taskId === 'ops_during_04' || x.taskNameSnapshot.toLowerCase().includes('tiếp nhận') || x.taskNameSnapshot.toLowerCase().includes('hỗ trợ'));
      case 9: return d.find(x => x.taskId === 'ops_close_01' || x.taskNameSnapshot.toLowerCase().includes('backup'));
      case 10: return d.find(x => x.taskId === 'TASK_CCP_STATISTICS' || x.taskNameSnapshot.toLowerCase().includes('tổng hợp') || x.taskNameSnapshot.toLowerCase().includes('thống kê'));
      case 11: return d.find(x => x.taskId === 'TASK_CHECK_KLGD' || x.taskNameSnapshot.toLowerCase().includes('đối chiếu klgd'));
      default: return undefined;
    }
  }, []);

  const getSysVal = (task: ShiftLogDetail | undefined, sys: 'MS' | 'CQG' | 'Nano' | 'ACM') => {
    const empty = { klgd: '', ttm: '', tttt: '' };
    if (!task?.resultNote) return empty;
    try {
      const data = JSON.parse(task.resultNote);
      const t = data.totals || data;
      if (sys === 'MS')   return { klgd: t.totalDSGD ?? t.msKlgd ?? '', ttm: t.totalTTM ?? t.msTtm ?? '', tttt: t.totalTTTT ?? t.msTttt ?? '' };
      if (sys === 'CQG')  return { klgd: t.totalFR ?? t.cqgKlgd ?? '', ttm: t.totalOP ?? t.cqgTtm ?? '', tttt: t.totalPS ?? t.cqgTttt ?? '' };
      if (sys === 'Nano') return { klgd: t.totalNano ?? t.nanoKlgd ?? '', ttm: 'X', tttt: 'X' };
      if (sys === 'ACM')  return { klgd: t.totalACM ?? t.acmKlgd ?? '', ttm: 'X', tttt: 'X' };
    } catch {
      const txt = task.resultNote;
      if (sys === 'MS') {
        const k = txt.match(/MS:?\s*KLGD:?\s*(\d+)/i) || txt.match(/KLGD:?\s*(\d+)/i);
        const m = txt.match(/MS:?\s*TTM:?\s*(\d+)/i)  || txt.match(/TTM:?\s*(\d+)/i);
        const t2 = txt.match(/MS:?\s*TTTT:?\s*(\d+)/i) || txt.match(/TTTT:?\s*(\d+)/i);
        return { klgd: k?.[1] ?? '', ttm: m?.[1] ?? '', tttt: t2?.[1] ?? '' };
      }
      if (sys === 'CQG') {
        const k = txt.match(/CQG:?\s*KLGD:?\s*(\d+)/i) || txt.match(/FR:?\s*(\d+)/i);
        const m = txt.match(/CQG:?\s*TTM:?\s*(\d+)/i)  || txt.match(/OP:?\s*(\d+)/i);
        const t2 = txt.match(/CQG:?\s*TTTT:?\s*(\d+)/i)|| txt.match(/PS:?\s*(\d+)/i);
        return { klgd: k?.[1] ?? '', ttm: m?.[1] ?? '', tttt: t2?.[1] ?? '' };
      }
      if (sys === 'Nano') { const k = txt.match(/Nano:?\s*KLGD:?\s*(\d+)/i); return { klgd: k?.[1] ?? '', ttm: 'X', tttt: 'X' }; }
      if (sys === 'ACM')  { const k = txt.match(/ACM:?\s*KLGD:?\s*(\d+)/i);  return { klgd: k?.[1] ?? '', ttm: 'X', tttt: 'X' }; }
    }
    return empty;
  };

  const fmtTime = (task?: ShiftLogDetail) => {
    const d = task?.completedAt || task?.checkedAt;
    if (!d) return '';
    return new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const isChecked = (t?: ShiftLogDetail, force = false) => force || (t?.isChecked ?? false) || t?.status === 'PASSED';
  const isFailed  = (t?: ShiftLogDetail) => t?.status === 'FAILED';

  // ─── Data ─────────────────────────────────────────────────────────────────────
  const sessionType = log.templateId?.sessionType || '';
  const titleText   = log.templateId?.title || '';
  const caNumber =
    sessionType === 'OPEN'   || titleText.toLowerCase().includes('mở cửa')    ? 1 :
    sessionType === 'DURING' || titleText.toLowerCase().includes('trong phiên')? 2 :
    sessionType === 'CLOSE'  || titleText.toLowerCase().includes('đóng cửa')  ? 3 : 0;
  const done = log.status === 'COMPLETED';

  const t1  = getTask(log, 1);
  const t2  = getTask(log, 2);
  const t3  = getTask(log, 3);
  const t4  = getTask(log, 4);
  const t5  = getTask(log, 5);
  const t6  = getTask(log, 6);
  const t7  = getTask(log, 7);
  const t8  = getTask(log, 8);
  const t9  = getTask(log, 9);
  const t10 = getTask(log, 10);
  const t11 = getTask(log, 11);

  const ms2  = getSysVal(t2,  'MS');
  const cqg3 = getSysVal(t3,  'CQG');
  const nano4= getSysVal(t4,  'Nano');
  const acm5 = getSysVal(t5,  'ACM');

  const ms11  = getSysVal(t11, 'MS');
  const cqg11 = getSysVal(t11, 'CQG');
  const nano11= getSysVal(t11, 'Nano');
  const acm11 = getSysVal(t11, 'ACM');

  const shiftDate = (() => {
    if (!log.shiftDate) return '…… / …… / 20……';
    const [y, m, d] = log.shiftDate.split('-');
    return `${d} / ${m} / ${y}`;
  })();

  const pct = log.progressPercentage ?? 0;
  const hrChecked = (hr: string) => {
    const ca1 = ['06h00','08h00','10h00','12h00','14h00'];
    const ca2 = ['14h00','16h00','18h00','20h00','22h00'];
    const ca3 = ['22h00','00h00','02h00','04h00'];
    if (caNumber === 1) return ca1.includes(hr) && (done || pct > 40);
    if (caNumber === 2) return ca2.includes(hr) && (done || pct > 40);
    if (caNumber === 3) return ca3.includes(hr) && (done || pct > 40);
    return false;
  };

  // Shared cell style
  const C: React.CSSProperties = { border: '1px solid #000', padding: '4px 6px', verticalAlign: 'middle' };
  const CH: React.CSSProperties = { ...C, fontWeight: 'bold', textAlign: 'center', background: '#f5f5f5', fontSize: '0.8rem' };
  const CC: React.CSSProperties = { ...C, textAlign: 'center' };

  // Cross-out diagonal cell
  const CrossCell = ({ colSpan = 1, rowSpan = 1 }: { colSpan?: number; rowSpan?: number }) => (
    <td colSpan={colSpan} rowSpan={rowSpan} style={{
      ...CC,
      background: `
        linear-gradient(to top right,    transparent 49.5%, #000 49.5%, #000 50.5%, transparent 50.5%),
        linear-gradient(to bottom right, transparent 49.5%, #000 49.5%, #000 50.5%, transparent 50.5%)
      `,
    }} />
  );

  const EvalCell = ({ task, force = false, rowSpan = 1 }: { task?: ShiftLogDetail; force?: boolean; rowSpan?: number }) => (
    <td rowSpan={rowSpan} style={{ ...CC, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'default' }}>
          <CB checked={isChecked(task, force)} /> Đạt
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'default' }}>
          <CB checked={isFailed(task)} /> K.Đạt
        </label>
      </div>
    </td>
  );

  const hours06to12 = ['06h00','08h00','10h00','12h00'];
  const hours16to04 = ['16h00','18h00','20h00','22h00','00h00','02h00','04h00'];

  // ─── CSS ─────────────────────────────────────────────────────────────────────
  const css = `
    * { box-sizing: border-box; }
    html, body {
      font-family: "Times New Roman", Times, serif;
      color: #000;
      background: #fff;
      font-size: 13px;
      margin: 0; padding: 0;
      line-height: 1.35;
    }
    table { border-collapse: collapse; }
    .page {
      width: 297mm;
      min-height: 210mm;
      padding: 12mm 15mm;
      margin: 0 auto;
      page-break-after: always;
      break-after: page;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }
    .no-print { display: flex; }
    @media print {
      @page { size: A4 landscape; margin: 0; }
      html, body { background: #fff !important; width: 297mm; height: 210mm; }
      .no-print { display: none !important; }
      .page { padding: 12mm 15mm; width: 297mm; height: 210mm; page-break-after: always; break-after: page; }
    }
    .action-bar {
      justify-content: flex-end;
      gap: 10px;
      padding: 10px 15px;
      background: #f0f4f8;
      border-bottom: 1px solid #ccc;
    }
    .action-bar button {
      padding: 7px 18px; border: none; border-radius: 6px;
      cursor: pointer; font-size: 0.88rem; font-weight: 600;
    }
    .btn-print { background: #0d9488; color: #fff; }
    .btn-close  { background: #e5e7eb; color: #333; }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* Action bar */}
      <div className="action-bar no-print">
        <button className="btn-close" onClick={() => window.close()}>✕ Đóng</button>
        <button className="btn-print" onClick={() => window.print()}>🖨 In / Lưu PDF</button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TRANG 1 — MẶT TRƯỚC  (landscape A4)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="page">
        <div>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '15px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <img src="/logomxv.svg" alt="MXV Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 'bold', textTransform: 'uppercase' }}>SỞ GIAO DỊCH HÀNG HÓA VIỆT NAM (MXV)</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#333' }}>KHỐI QUẢN LÝ GIAO DỊCH</div>
                <div style={{ fontSize: '0.75rem', color: '#555' }}>Bộ phận Quản lý giám sát giao dịch</div>
              </div>
            </div>
            <div style={{ border: '1px solid #000', padding: '4px 10px', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center' }}>
              Mẫu số: 03/QT/TVH
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', margin: '5px 0 3px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              PHIẾU THEO DÕI THỰC HIỆN TRỰC GIAO DỊCH
            </h2>
            <p style={{ fontSize: '0.9rem', margin: '0', fontStyle: 'italic' }}>
              (Phiên giao dịch ngày {shiftDate})
            </p>
          </div>

          {/* Ca trực table */}
          <div style={{ marginBottom: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <tbody>
                <tr>
                  <td style={{ ...C, width: '33.33%' }}>
                    <strong>Ca 1 (06h00 - 14h00).</strong> Nhân viên trực:{' '}
                    {caNumber === 1 ? log.userId?.fullName || '...................................' : '...................................'}
                  </td>
                  <td style={{ ...C, width: '33.33%' }}>
                    <strong>Ca 2 (14h00 - 22h00).</strong> Nhân viên trực:{' '}
                    {caNumber === 2 ? log.userId?.fullName || '...................................'
                      : log.closedBy && log.closedBy.fullName !== log.userId?.fullName
                      ? log.closedBy.fullName : '...................................'}
                  </td>
                  <td style={{ ...C, width: '33.33%' }}>
                    <strong>Ca 3 (22h00 - 06h00).</strong> Nhân viên trực:{' '}
                    {caNumber === 3 ? log.userId?.fullName || '...................................' : '...................................'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', margin: '10px 0 6px 0' }}>BẢNG CHI TIẾT CÔNG VIỆC</h3>

          {/* Bảng chi tiết công việc STT 1–9 */}
          <table style={{ width: '100%', fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th style={{ ...CH, width: '35px' }}>STT</th>
                <th style={CH}>Đầu mục công việc</th>
                <th style={{ ...CH, width: '65px' }}>Thời gian thực hiện</th>
                <th style={{ ...CH, width: '65px' }}>Hệ thống / Ca</th>
                <th style={{ ...CH, width: '55px' }}>KLGD</th>
                <th style={{ ...CH, width: '55px' }}>TTM</th>
                <th style={{ ...CH, width: '55px' }}>TTTT</th>
                <th style={{ ...CH, width: '120px' }}>Đánh giá</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1 */}
              <tr>
                <td style={CC}>1</td>
                <td style={C}>Kiểm tra số liệu GD phiên liền trước (T-1) trước EOD</td>
                <td style={CC}>{fmtTime(t1) || '05:30'}</td>
                <CrossCell colSpan={4} />
                <EvalCell task={t1} />
              </tr>

              {/* Row 2 */}
              <tr>
                <td style={CC}>2</td>
                <td style={C}>EOD hệ thống M-System</td>
                <td style={CC}>{fmtTime(t2)}</td>
                <td style={{ ...CC, fontWeight: 'bold' }}>MS</td>
                <td style={CC}>{ms2.klgd}</td>
                <td style={CC}>{ms2.ttm}</td>
                <td style={CC}>{ms2.tttt}</td>
                <EvalCell task={t2} />
              </tr>

              {/* Row 3 */}
              <tr>
                <td style={CC}>3</td>
                <td style={C}>SOD, Đồng bộ CQG (sync CQG)</td>
                <td style={CC}>{fmtTime(t3)}</td>
                <td style={{ ...CC, fontWeight: 'bold' }}>CQG</td>
                <td style={CC}>{cqg3.klgd}</td>
                <td style={CC}>{cqg3.ttm}</td>
                <td style={CC}>{cqg3.tttt}</td>
                <EvalCell task={t3} />
              </tr>

              {/* Row 4 */}
              <tr>
                <td style={CC}>4</td>
                <td style={C}>Gửi báo cáo GD Năng lượng, Gạo</td>
                <td style={CC}>{fmtTime(t4)}</td>
                <td style={{ ...CC, fontWeight: 'bold' }}>Nano</td>
                <td style={CC}>{nano4.klgd}</td>
                <CrossCell /><CrossCell />
                <EvalCell task={t4} />
              </tr>

              {/* Row 5 */}
              <tr>
                <td style={CC}>5</td>
                <td style={C}>Xử lý tất toán Trạng thái mở của hợp đồng đến hạn tất toán</td>
                <td style={CC}>{fmtTime(t5)}</td>
                <td style={{ ...CC, fontWeight: 'bold' }}>ACM</td>
                <td style={CC}>{acm5.klgd}</td>
                <CrossCell /><CrossCell />
                <EvalCell task={t5} />
              </tr>

              {/* Row 6 */}
              <tr>
                <td style={CC}>6</td>
                <td style={C}>Xử lý giao dịch LME</td>
                <td style={CC}>{fmtTime(t6)}</td>
                <td style={{ ...CC, fontSize: '0.75rem' }}>
                  <div><label><CB checked={caNumber === 2 && !!t6?.isChecked} /> Ca 2</label></div>
                </td>
                <td colSpan={3} style={{ ...C, background: '#fafafa' }}></td>
                <EvalCell task={t6} />
              </tr>

              {/* Row 7: Options — 3 sub-rows (Ca 1 / Ca 2 / Ca 3) */}
              <tr>
                <td style={{ ...CC, verticalAlign: 'middle' }} rowSpan={3}>7</td>
                <td style={{ ...C, verticalAlign: 'middle' }} rowSpan={3}>Xử lý Exercise Options</td>
                <td style={CC}>{caNumber === 1 ? fmtTime(t7) : ''}</td>
                <td style={{ ...CC, fontSize: '0.75rem' }}><label><CB checked={caNumber === 1 && !!t7?.isChecked} /> Ca 1</label></td>
                <td colSpan={3} style={{ ...C, background: '#fafafa' }}></td>
                <EvalCell task={t7} rowSpan={3} />
              </tr>
              <tr>
                <td style={CC}>{caNumber === 2 ? fmtTime(t7) : ''}</td>
                <td style={{ ...CC, fontSize: '0.75rem' }}><label><CB checked={caNumber === 2 && !!t7?.isChecked} /> Ca 2</label></td>
                <td colSpan={3} style={{ ...C, background: '#fafafa' }}></td>
              </tr>
              <tr>
                <td style={CC}>{caNumber === 3 ? fmtTime(t7) : ''}</td>
                <td style={{ ...CC, fontSize: '0.75rem' }}><label><CB checked={caNumber === 3 && !!t7?.isChecked} /> Ca 3</label></td>
                <td colSpan={3} style={{ ...C, background: '#fafafa' }}></td>
              </tr>

              {/* Row 8: Support — 3 sub-rows */}
              <tr>
                <td style={{ ...CC }} rowSpan={3}>8</td>
                <td style={C} rowSpan={3}>Tiếp nhận, giải đáp thắc mắc của TVKD/KH liên quan đến giao dịch</td>
                <td style={CC}>{caNumber === 1 ? fmtTime(t8) : ''}</td>
                <td style={{ ...CC, fontSize: '0.75rem' }}><label><CB checked={caNumber === 1 && !!t8?.isChecked} /> Ca 1</label></td>
                <td colSpan={3} style={{ ...C, background: '#fafafa' }}></td>
                <EvalCell task={t8} rowSpan={3} />
              </tr>
              <tr>
                <td style={CC}>{caNumber === 2 ? fmtTime(t8) : ''}</td>
                <td style={{ ...CC, fontSize: '0.75rem' }}><label><CB checked={caNumber === 2 && !!t8?.isChecked} /> Ca 2</label></td>
                <td colSpan={3} style={{ ...C, background: '#fafafa' }}></td>
              </tr>
              <tr>
                <td style={CC}>{caNumber === 3 ? fmtTime(t8) : ''}</td>
                <td style={{ ...CC, fontSize: '0.75rem' }}><label><CB checked={caNumber === 3 && !!t8?.isChecked} /> Ca 3</label></td>
                <td colSpan={3} style={{ ...C, background: '#fafafa' }}></td>
              </tr>

              {/* Row 9: Backup */}
              <tr>
                <td style={CC}>9</td>
                <td style={C}>Backup dữ liệu giao dịch cuối phiên</td>
                <td style={CC}>{fmtTime(t9)}</td>
                <td style={{ ...CC, fontSize: '0.75rem' }}><label><CB checked={caNumber === 3 && !!t9?.isChecked} /> Ca 3</label></td>
                <td colSpan={3} style={{ ...C, background: '#fafafa' }}></td>
                <EvalCell task={t9} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TRANG 2 — MẶT SAU  (landscape A4)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="page">
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '0.9rem', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px' }}>
            BẢNG CHI TIẾT CÔNG VIỆC (TIẾP THEO)
          </div>

          <table style={{ width: '100%', fontSize: '0.78rem' }}>
            <thead>
              <tr>
                <th style={{ ...CH, width: '35px' }}>STT</th>
                <th style={CH}>Đầu mục công việc</th>
                <th style={{ ...CH, width: '65px' }}>Mốc thời gian</th>
                <th style={{ ...CH, width: '75px' }}>Hệ thống / Chỉ số</th>
                <th style={{ ...CH, width: '50px' }}>KLGD</th>
                <th style={{ ...CH, width: '50px' }}>TTM</th>
                <th style={{ ...CH, width: '50px' }}>TTTT</th>
                <th style={{ ...CH, width: '120px' }}>Đánh giá</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 10 */}
              <tr>
                <td style={CC}>10</td>
                <td style={C}>
                  <strong>Tổng hợp, thống kê, làm báo cáo</strong>
                  {t10?.note && <div style={{ fontSize: '0.72rem', fontStyle: 'italic', marginTop: '2px' }}>* {t10.note}</div>}
                </td>
                <td style={CC}>Cuối ca</td>
                <td style={{ ...CC }}>MS / CQG</td>
                <td colSpan={3} style={{ ...C, background: '#fafafa' }}></td>
                <EvalCell task={t10} />
              </tr>

              {/* Row 11: Giờ 06h00–12h00 */}
              {hours06to12.map((hr, i) => (
                <tr key={hr}>
                  {i === 0 && <td rowSpan={hours06to12.length + 1 + (hours16to04.length)} style={{ ...CC, fontSize: '0.8rem', fontWeight: 'bold' }}>11</td>}
                  {i === 0 && <td rowSpan={hours06to12.length + 1 + (hours16to04.length)} style={{ ...C }}>
                    <strong>Giám sát đối chiếu giao dịch</strong>
                  </td>}
                  <td style={CC}>{hr}</td>
                  <td style={{ ...CC, fontSize: '0.72rem' }}>MS/CQG/Nano/ACM</td>
                  <td style={{ ...C, background: '#fafafa' }}></td>
                  <td style={{ ...C, background: '#fafafa' }}></td>
                  <td style={{ ...C, background: '#fafafa' }}></td>
                  <EvalCell task={t11} force={hrChecked(hr)} />
                </tr>
              ))}

              {/* 14h00 — 4 sub-rows với dữ liệu MS/CQG/Nano/ACM */}
              <tr>
                <td rowSpan={4} style={{ ...CC, fontWeight: 'bold' }}>14h00</td>
                <td style={{ ...CC, fontWeight: 'bold' }}>MS</td>
                <td style={{ ...CC, fontSize: '0.72rem' }}>{ms11.klgd}</td>
                <td style={{ ...CC, fontSize: '0.72rem' }}>{ms11.ttm}</td>
                <td style={{ ...CC, fontSize: '0.72rem' }}>{ms11.tttt}</td>
                <EvalCell task={t11} force={hrChecked('14h00')} rowSpan={4} />
              </tr>
              <tr>
                <td style={{ ...CC, fontWeight: 'bold' }}>CQG</td>
                <td style={{ ...CC, fontSize: '0.72rem' }}>{cqg11.klgd}</td>
                <td style={{ ...CC, fontSize: '0.72rem' }}>{cqg11.ttm}</td>
                <td style={{ ...CC, fontSize: '0.72rem' }}>{cqg11.tttt}</td>
              </tr>
              <tr>
                <td style={{ ...CC, fontWeight: 'bold' }}>Nano</td>
                <td style={{ ...CC, fontSize: '0.72rem' }}>{nano11.klgd}</td>
                <CrossCell /><CrossCell />
              </tr>
              <tr>
                <td style={{ ...CC, fontWeight: 'bold' }}>ACM</td>
                <td style={{ ...CC, fontSize: '0.72rem' }}>{acm11.klgd}</td>
                <CrossCell /><CrossCell />
              </tr>

              {/* Giờ 16h00–04h00 */}
              {hours16to04.map((hr) => (
                <tr key={hr}>
                  <td style={CC}>{hr}</td>
                  <td style={{ ...CC, fontSize: '0.72rem' }}>MS/CQG/Nano/ACM</td>
                  {hr === '22h00' ? (
                    <><CrossCell /><CrossCell /><CrossCell /></>
                  ) : (
                    <>
                      <td style={{ ...C, background: '#fafafa' }}></td>
                      <td style={{ ...C, background: '#fafafa' }}></td>
                      <td style={{ ...C, background: '#fafafa' }}></td>
                    </>
                  )}
                  <EvalCell task={t11} force={hrChecked(hr)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom section of back page: handover notes & signatures */}
        <div style={{ display: 'flex', gap: '30px', marginTop: '15px', alignItems: 'stretch' }}>
          {/* Handover notes */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '3px' }}>III. NỘI DUNG BÀN GIAO CA TRỰC</div>
            <div style={{
              border: '1px solid #000', padding: '8px 12px', flex: 1, minHeight: '80px',
              fontSize: '0.82rem', fontStyle: 'italic', lineHeight: '1.4', whiteSpace: 'pre-wrap',
            }}>
              {log.handoverNote ? `"${log.handoverNote}"` : 'Không có bàn giao hay lưu ý đặc biệt cho ca sau.'}
            </div>
          </div>

          {/* Signature block */}
          <div style={{ width: '380px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '5px', textAlign: 'center' }}>BẢNG KÝ XÁC NHẬN</div>
            <table style={{ width: '100%', fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th style={{ ...CH, width: '60px' }}>Ca trực</th>
                  <th style={CH}>Ký xác nhận (Ký, ghi rõ họ tên)</th>
                  <th style={{ ...CH, width: '120px' }}>Trưởng Bộ phận</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((ca) => {
                  const isCurrent = caNumber === ca;
                  return (
                    <tr key={ca}>
                      <td style={{ ...CC, fontWeight: 'bold', height: '48px' }}>Ca {ca}</td>
                      <td style={C}>
                        {isCurrent && done ? (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1.05rem', color: '#1e3a8a', marginBottom: '1px' }}>
                              {log.userId?.fullName?.split(' ').pop()}
                            </div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 'bold' }}>{log.userId?.fullName}</div>
                          </div>
                        ) : ca === 1 && !isCurrent ? (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1.05rem', color: '#1e3a8a', marginBottom: '1px' }}>Minh</div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 'bold' }}>Lê Đăng Bình Minh</div>
                          </div>
                        ) : null}
                      </td>
                      <td style={C}>
                        {ca === 1 ? (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1.05rem', color: '#1e3a8a', marginBottom: '1px' }}>Hiep</div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 'bold' }}>Trần Hoàng Hiệp</div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <Suspense fallback={
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif' }}>
        Đang tải phiếu...
      </div>
    }>
      <QlgdPrintPage />
    </Suspense>
  );
}
