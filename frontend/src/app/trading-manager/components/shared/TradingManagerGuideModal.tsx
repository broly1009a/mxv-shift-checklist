'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Play,
  Save,
  Sliders,
  FileSpreadsheet,
  Activity,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  HelpCircle,
  ExternalLink,
  ArrowRight,
  Database,
  Info,
} from 'lucide-react';

interface TradingManagerGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TradingManagerGuideModal({
  isOpen,
  onClose,
}: TradingManagerGuideModalProps) {
  const [mounted, setMounted] = useState(false);
  const [guideTab, setGuideTab] = useState<'WORKFLOW' | 'FORMULAS' | 'ORDER_TYPES' | 'ALL_TABS'>('WORKFLOW');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(9, 14, 26, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '1050px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <BookOpen size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Tài Liệu Hướng Dẫn Vận Hành & Thiết Kế Bàn Giám Sát Trading Manager
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                Cẩm nang trực quan dành cho nhân sự ca trực: Đối soát trong phiên, Pre-EOD, và Thống kê CoreCCP.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL SUB-TABS */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '10px 24px 0 24px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            overflowX: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setGuideTab('WORKFLOW')}
            style={{
              padding: '10px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              backgroundColor: guideTab === 'WORKFLOW' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
              border: 'none',
              borderBottom: guideTab === 'WORKFLOW' ? '2px solid #10b981' : '2px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: guideTab === 'WORKFLOW' ? '#10b981' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Play size={14} />
            <span>1. Quy Trình 4 Bước Thống Kê CCP</span>
          </button>

          <button
            type="button"
            onClick={() => setGuideTab('FORMULAS')}
            style={{
              padding: '10px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              backgroundColor: guideTab === 'FORMULAS' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
              border: 'none',
              borderBottom: guideTab === 'FORMULAS' ? '2px solid #10b981' : '2px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: guideTab === 'FORMULAS' ? '#10b981' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <DollarSign size={14} />
            <span>2. Công Thức GTGD & Quy Cách Hàng Hóa</span>
          </button>

          <button
            type="button"
            onClick={() => setGuideTab('ORDER_TYPES')}
            style={{
              padding: '10px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              backgroundColor: guideTab === 'ORDER_TYPES' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
              border: 'none',
              borderBottom: guideTab === 'ORDER_TYPES' ? '2px solid #10b981' : '2px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: guideTab === 'ORDER_TYPES' ? '#10b981' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ShieldCheck size={14} />
            <span>3. Kiểm Tra 4 Loại Lệnh & Ngoại Lệ</span>
          </button>

          <button
            type="button"
            onClick={() => setGuideTab('ALL_TABS')}
            style={{
              padding: '10px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              backgroundColor: guideTab === 'ALL_TABS' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
              border: 'none',
              borderBottom: guideTab === 'ALL_TABS' ? '2px solid #10b981' : '2px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: guideTab === 'ALL_TABS' ? '#10b981' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Database size={14} />
            <span>4. Tổng Quan 4 Tab Trading Manager</span>
          </button>
        </div>

        {/* MODAL CONTENT AREA */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
          }}
        >
          {/* TAB 1: QUY TRÌNH 4 BƯỚC */}
          {guideTab === 'WORKFLOW' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'var(--text-primary)',
                }}
              >
                <Info size={20} color="#10b981" style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ color: '#10b981' }}>Mục tiêu thay thế Macro VBA:</strong>{' '}
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Tính năng này thay thế hoàn toàn file macro Excel thống kê cũ, tự động tổng hợp số lot và giá trị giao dịch của tài khoản ACM từ nguồn CoreCCP và ghi an toàn vào file Excel lũy kế năm.
                  </span>
                </div>
              </div>

              {/* 4 STEPS CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {/* Step 1 */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      1
                    </span>
                    <strong style={{ color: 'var(--text-primary)' }}>Nạp Tệp Dữ Liệu</strong>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Chọn ngày giao dịch, sau đó chọn tệp <strong>DSGD_*.xlsx</strong> (bắt buộc). Có thể nạp thêm <strong>TTM</strong>, <strong>TTTT</strong>, và <strong>Tỷ giá</strong>.
                  </p>
                </div>

                {/* Step 2 */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: '#3b82f6',
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      2
                    </span>
                    <strong style={{ color: 'var(--text-primary)' }}>Bấm Tổng Hợp</strong>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Nhấn nút <strong>[Tổng Hợp Số Lot & GTGD]</strong>. Hệ thống tính toán toàn bộ số lot, GTGD, tỷ trọng và 4 loại lệnh trong vòng <strong>&lt; 50ms</strong>.
                  </p>
                </div>

                {/* Step 3 */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: '#f59e0b',
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      3
                    </span>
                    <strong style={{ color: 'var(--text-primary)' }}>Thẩm Định Báo Cáo</strong>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Xem thẻ KPI, đối chiếu bảng <strong>Chi tiết TVKD</strong> hoặc <strong>Phân bổ Hàng hóa</strong>. Kiểm tra thẻ <strong>4 Loại Lệnh</strong> xem có TVKD nào thiếu lệnh không.
                  </p>
                </div>

                {/* Step 4 */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      4
                    </span>
                    <strong style={{ color: 'var(--text-primary)' }}>Ghi File Lũy Kế</strong>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                    Nhấn nút <strong>[Ghi Vào File Lũy Kế ACM]</strong>. Hệ thống tự động backup file cũ vào <code>Backup_Snapshots/</code> và điền số liệu đúng ô Excel.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CÔNG THỨC & QUY CÁCH HÀNG HÓA */}
          {guideTab === 'FORMULAS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981', marginTop: 0 }}>
                  Công Thức Tính Giá Trị Giao Dịch Chuẩn:
                </h4>
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'var(--bg-app)',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    marginBottom: '10px',
                    fontWeight: 700,
                  }}
                >
                  GTGD (VND) = Khối Lượng Khớp (Lot) × Giá Khớp TB × Hệ Số Quy Đổi × Tỷ Giá USD
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  * Mã Hàng hóa được lấy tự động từ <strong>5 ký tự đầu</strong> của Mã Hợp Đồng (ví dụ: <code>SI5COZ26</code> → <code>SI5CO</code>).
                </p>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 14px' }}>Mã HĐ Mẫu</th>
                      <th style={{ padding: '10px 14px' }}>Mã HH (5 ký tự đầu)</th>
                      <th style={{ padding: '10px 14px' }}>Tên Hàng Hóa</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Hệ Số Quy Cách</th>
                      <th style={{ padding: '10px 14px' }}>Đơn Vị Ngoại Tệ</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Ví Dụ Tính Toán (1 Lot)</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>CP2COZ26</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#10b981' }}>CP2CO</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'sans-serif', color: 'var(--text-primary)' }}>Đồng Nano</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>1,000</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>USD / lbs</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-primary)' }}>6.49 × 1,000 × 25,920 = 168.220.800 đ</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>SI5COZ26</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#10b981' }}>SI5CO</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'sans-serif', color: 'var(--text-primary)' }}>Bạc Nano</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>100</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>USD / oz</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-primary)' }}>30.50 × 100 × 25,920 = 79.056.000 đ</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>PL1NYZ26</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#10b981' }}>PL1NY</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'sans-serif', color: 'var(--text-primary)' }}>Bạch Kim Nano</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>5</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>USD / oz</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-primary)' }}>980.0 × 5 × 25,920 = 127.008.000 đ</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: 4 LOẠI LỆNH & NGOẠI LỆ */}
          {guideTab === 'ORDER_TYPES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ef4444', marginTop: 0 }}>
                  Quy Tắc Giám Sát 4 Loại Lệnh (MKT, LMT, STP, STL):
                </h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Theo quy chuẩn kiểm soát giao dịch thị trường, mỗi Thành viên Kinh doanh (TVKD) có phát sinh giao dịch trong phiên bắt buộc phải phát sinh đầy đủ 4 loại lệnh:
                </p>
                <ul style={{ paddingLeft: '20px', marginTop: '8px', marginBottom: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  <li><strong>MKT</strong>: Lệnh thị trường (Market Order)</li>
                  <li><strong>LMT</strong>: Lệnh giới hạn (Limit Order)</li>
                  <li><strong>STP</strong>: Lệnh dừng (Stop Order)</li>
                  <li><strong>STL</strong>: Lệnh dừng giới hạn (Stop-Limit Order)</li>
                </ul>
              </div>

              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>Cách xử lý khi phát hiện TVKD thiếu loại lệnh:</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  1. Trên giao diện Thống Kê, tích chọn checkbox <strong>"Thiếu loại lệnh"</strong> ở góc trên bên phải bảng dữ liệu.<br />
                  2. Hệ thống sẽ lọc ra các TVKD vi phạm kèm tag màu đỏ hiển thị chính xác các loại lệnh còn thiếu (ví dụ: <code>[THIẾU: LMT/STP/STL]</code>).<br />
                  3. Nhân sự ca trực ghi nhận vào Biên bản ca trực hoặc thông báo phòng Giám sát Giao dịch theo quy trình nội bộ.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: TỔNG QUAN 4 TAB */}
          {guideTab === 'ALL_TABS' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
                <strong style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={15} /> 1. Check GD – EOD – Sync
                </strong>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: 0 }}>
                  Đối chiếu khớp lệnh trong phiên định kỳ 1h/lần (Check KLGD), kiểm tra Pre-EOD 3 bên, đối chiếu số dư EOD M-System, và đồng bộ số dư CQG Sync (ngưỡng lệch &gt; $100).
                </p>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
                <strong style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database size={15} /> 2. Backup – Thống Kê – GTT
                </strong>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: 0 }}>
                  Khớp 1:1 với FormMain.cs của C# cũ: Tải 14 báo cáo M-System, 9 báo cáo CQG, lập bảng đối chiếu Giá Thanh Toán (GTT), và quét ký quỹ IMR 4 nhóm điều kiện.
                </p>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
                <strong style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sliders size={15} /> 3. Cấu Hình – Đường Dẫn
                </strong>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: 0 }}>
                  Quản lý đường dẫn thư mục backup M-System, thư mục CQG, thông số kết nối SFTP Client, và ngưỡng cảnh báo chênh lệch tiền tệ lúc đang chạy (runtime).
                </p>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
                <strong style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileSpreadsheet size={15} /> 4. Báo Cáo & CoreCCP
                </strong>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: 0 }}>
                  Sub-tab 1 kiểm soát số dư EOD 4 thành phần VNCLEAR. Sub-tab 2 thay thế toàn diện macro VBA Excel: tổng hợp số lot, tính GTGD, và ghi file lũy kế năm.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Hệ thống Bàn Giám Sát Ca Trực MXV • Phiên bản 2.0 (Migration CoreCCP)
          </span>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '6px 18px' }}
          >
            Đã Hiểu & Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
