'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/context/AuthContext';

export interface LegacyGttCheckerSectionProps {
  token: string | null;
  selectedDate: string;
}

export default function LegacyGttCheckerSection({ token, selectedDate }: LegacyGttCheckerSectionProps) {
  const [gttLoading, setGttLoading] = useState<boolean>(false);
  const [gttExporting, setGttExporting] = useState<boolean>(false);
  const [gttRows, setGttRows] = useState<any[]>([]);

  // Check GTT (Giá thanh toán - C# BackupService.CreateGTT & RunGttCheck)
  const handleCheckGtt = async () => {
    if (!token || gttLoading) return;
    setGttLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/run-gtt-check`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ downloadMarketCsv: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.report?.rows) {
        setGttRows(data.report.rows);
        toast.success(`Đối chiếu GTT hoàn tất: ${data.report.rows.length} mã hợp đồng`, { duration: 5000 });
      } else {
        toast.success('Đã chạy kiểm tra GTT!');
      }
    } catch (err: any) {
      toast.error(`Kiểm tra GTT thất bại: ${err.message}`);
    } finally {
      setGttLoading(false);
    }
  };

  // Tạo file nhập GTT (Export Correction Excel)
  const handleExportGttCorrection = async () => {
    if (!token || gttExporting) return;
    setGttExporting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/gtt-report/export-correction?type=settlement`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GTT_Nhap_${selectedDate || 'today'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Đã xuất và tải xuống file nhập GTT!');
    } catch (err: any) {
      toast.error(`Tải file nhập GTT thất bại: ${err.message}`);
    } finally {
      setGttExporting(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Giá thanh toán (GTT M-System vs CQG)
          </span>
          <button
            type="button"
            onClick={handleCheckGtt}
            disabled={gttLoading}
            className="btn btn-primary"
            style={{ fontSize: '0.78rem', padding: '5px 16px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            {gttLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            <span>Check GTT</span>
          </button>
          <button
            type="button"
            onClick={handleExportGttCorrection}
            disabled={gttExporting}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '5px 14px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            {gttExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            <span>Tạo file nhập GTT</span>
          </button>
        </div>
        {gttRows.length > 0 && (
          <span style={{ fontSize: '0.76rem', fontFamily: 'monospace', color: '#10b981', fontWeight: 700 }}>
            Đã kiểm tra {gttRows.length} mã hợp đồng
          </span>
        )}
      </div>

      {/* Bảng GTT: Mã HĐ | GTT MS | GTT CQG */}
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>
              <th style={{ padding: '8px 12px', borderRight: '1px solid var(--border-color)', width: '30%' }}>Mã HĐ</th>
              <th style={{ padding: '8px 12px', borderRight: '1px solid var(--border-color)', width: '35%', textAlign: 'right' }}>GTT MS</th>
              <th style={{ padding: '8px 12px', width: '35%', textAlign: 'right' }}>GTT CQG</th>
            </tr>
          </thead>
          <tbody>
            {gttRows.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Chưa có dữ liệu đối chiếu giá thanh toán. Bấm &ldquo;Check GTT&rdquo; để kiểm tra.
                </td>
              </tr>
            ) : (
              gttRows.map((row, idx) => {
                const isDiff = row.gttMs !== null && row.gttCqg !== null && row.gttMs !== row.gttCqg;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isDiff ? 'rgba(239, 68, 68, 0.06)' : 'transparent', fontFamily: 'monospace' }}>
                    <td style={{ padding: '6px 12px', borderRight: '1px solid var(--border-color)', fontWeight: 700, color: isDiff ? '#ef4444' : 'var(--text-primary)' }}>
                      {row.symbol}
                    </td>
                    <td style={{ padding: '6px 12px', borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>
                      {row.gttMs !== null ? row.gttMs.toLocaleString('vi-VN') : '—'}
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: isDiff ? 800 : 400, color: isDiff ? '#ef4444' : 'inherit' }}>
                      {row.gttCqg !== null ? row.gttCqg.toLocaleString('vi-VN') : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
