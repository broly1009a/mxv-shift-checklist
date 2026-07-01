'use client';

import React from 'react';
import Link from 'next/link';
import { CheckSquare, ArrowRight, Lock, Unlock, Clock, User } from 'lucide-react';
import { ShiftLog } from '../hooks/useChecklist';

interface ShiftCardGridProps {
  activeLogs: ShiftLog[];
}

export default function ShiftCardGrid({ activeLogs }: ShiftCardGridProps) {
  const pendingShifts = activeLogs.filter(item => item.status !== 'COMPLETED');
  const completedShifts = activeLogs.filter(item => item.status === 'COMPLETED');

  return (
    <div className="animate-fade-in no-print" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <style dangerouslySetInnerHTML={{
        __html: `
        .shift-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }
        .premium-card {
          border-radius: 16px;
          border: 1px solid var(--border-color);
          background: var(--bg-card);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .premium-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
          border-color: rgba(59, 130, 246, 0.4);
        }
        .premium-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          background: var(--color-accent);
          opacity: 0.8;
        }
        .premium-card.completed-glow {
          border-color: rgba(16, 185, 129, 0.25);
          background: rgba(16, 185, 129, 0.01);
        }
        .premium-card.completed-glow::before {
          background: #10b981;
        }
        .premium-card.completed-shift-style {
          border-color: var(--border-color);
          background: rgba(255, 255, 255, 0.01);
          opacity: 0.85;
        }
        .premium-card.completed-shift-style::before {
          background: #64748b;
        }
        .premium-card.completed-shift-style:hover {
          border-color: rgba(100, 116, 139, 0.4);
          opacity: 1;
        }
        .session-badge-premium {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 10px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .session-badge-open {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.2);
        }
        .session-badge-during {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }
        .session-badge-close {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .status-badge-pending {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }
        .status-badge-completed {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .shift-section-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px dashed var(--border-color);
        }
        `
      }} />

      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: '8px' }}>
          Bảng Vận Hành Ca Trực
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Chọn một ca trực đang mở dưới đây hoặc quay lại <Link href="/dashboard" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600, borderBottom: '1px dashed var(--color-accent)' }}>Bảng điều khiển</Link> để bắt đầu ca mới.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '32px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {activeLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed var(--border-color)', borderRadius: '16px', background: 'rgba(255,255,255,0.01)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '20px' }}>Chưa có ca trực nào được tạo hôm nay.</p>
            <Link href="/dashboard" className="btn btn-primary" style={{ padding: '12px 24px', borderRadius: '8px', fontWeight: 600 }}>
              Đến bảng điều khiển khởi tạo
            </Link>
          </div>
        ) : (
          <>
            {/* Section 1: Active Shifts (Đang vận hành) */}
            {pendingShifts.length > 0 && (
              <div>
                <h3 className="shift-section-title">
                  <Unlock size={20} color="var(--color-accent)" /> Ca trực đang vận hành ({pendingShifts.length})
                </h3>
                <div className="shift-grid">
                  {pendingShifts.map(item => {
                    const isDone = item.progressPercentage === 100;
                    const sessionType = item.templateId?.sessionType || 'OPEN';
                    
                    let badgeClass = 'session-badge-premium session-badge-open';
                    let badgeLabel = 'Mở Cửa';
                    if (sessionType === 'DURING') {
                      badgeClass = 'session-badge-premium session-badge-during';
                      badgeLabel = 'Trong Phiên';
                    } else if (sessionType === 'CLOSE') {
                      badgeClass = 'session-badge-premium session-badge-close';
                      badgeLabel = 'Đóng Cửa';
                    }

                    return (
                      <div key={item._id} className={`premium-card ${isDone ? 'completed-glow' : ''}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div>
                            <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.4', marginBottom: '8px' }}>
                              {item.templateId?.title || 'Không rõ mẫu'}
                            </h4>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <span className={badgeClass}>{badgeLabel}</span>
                              <span className="session-badge-premium status-badge-pending">
                                <Clock size={11} style={{ marginRight: '2px' }} /> Đang trực
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{
                          fontSize: '0.88rem',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          borderTop: '1px dashed var(--border-color)',
                          paddingTop: '12px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Trực ngày:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{item.shiftDate}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Phòng ban:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{item.templateId?.departmentId?.name || 'Không xác định'}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Người trực:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{item.userId?.fullName || 'Hệ thống'}</strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                            <span style={{ color: isDone ? '#10b981' : 'var(--text-secondary)' }}>
                              {isDone ? 'Hoàn thành 100%' : 'Tiến độ thực hiện'}
                            </span>
                            <span style={{ color: isDone ? '#10b981' : 'var(--text-primary)', fontSize: '0.95rem' }}>
                              {item.progressPercentage}%
                            </span>
                          </div>
                          <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${item.progressPercentage}%`,
                              height: '100%',
                              background: isDone ? '#10b981' : 'var(--color-accent)',
                              borderRadius: '4px',
                              transition: 'width 0.4s ease'
                            }}></div>
                          </div>
                        </div>

                        <Link
                          href={`/checklist?id=${item._id}`}
                          className="btn btn-primary"
                          style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '8px',
                            marginTop: '8px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            background: isDone ? 'rgba(16, 185, 129, 0.15)' : 'var(--color-accent)',
                            color: isDone ? '#10b981' : '#fff',
                            border: isDone ? '1px solid rgba(16, 185, 129, 0.3)' : 'none'
                          }}
                        >
                          Mở Worksheet <ArrowRight size={16} />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2: Completed Shifts (Đã chốt ca) */}
            {completedShifts.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h3 className="shift-section-title" style={{ color: 'var(--text-secondary)' }}>
                  <Lock size={20} color="#64748b" /> Ca trực đã chốt hôm nay ({completedShifts.length})
                </h3>
                <div className="shift-grid">
                  {completedShifts.map(item => {
                    const sessionType = item.templateId?.sessionType || 'OPEN';
                    
                    let badgeClass = 'session-badge-premium session-badge-open';
                    let badgeLabel = 'Mở Cửa';
                    if (sessionType === 'DURING') {
                      badgeClass = 'session-badge-premium session-badge-during';
                      badgeLabel = 'Trong Phiên';
                    } else if (sessionType === 'CLOSE') {
                      badgeClass = 'session-badge-premium session-badge-close';
                      badgeLabel = 'Đóng Cửa';
                    }

                    return (
                      <div key={item._id} className="premium-card completed-shift-style">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div>
                            <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '8px' }}>
                              {item.templateId?.title || 'Không rõ mẫu'}
                            </h4>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <span className={badgeClass}>{badgeLabel}</span>
                              <span className="session-badge-premium status-badge-completed">
                                <Lock size={11} style={{ marginRight: '2px' }} /> Đã chốt
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{
                          fontSize: '0.88rem',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          borderTop: '1px dashed var(--border-color)',
                          paddingTop: '12px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Trực ngày:</span>
                            <strong>{item.shiftDate}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Phòng ban:</span>
                            <strong>{item.templateId?.departmentId?.name || 'Không xác định'}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Trực chính:</span>
                            <strong>{item.userId?.fullName || 'Hệ thống'}</strong>
                          </div>
                          {item.closedBy && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dotted var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
                              <span>Người chốt ca:</span>
                              <strong style={{ color: 'var(--text-primary)' }}>{item.closedBy.fullName}</strong>
                            </div>
                          )}
                          {item.closedAt && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Thời gian chốt:</span>
                              <strong style={{ color: 'var(--text-primary)' }}>{new Date(item.closedAt).toLocaleTimeString('vi-VN')}</strong>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                            <span>Tiến độ khi chốt</span>
                            <span>{item.progressPercentage}%</span>
                          </div>
                          <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${item.progressPercentage}%`,
                              height: '100%',
                              background: '#10b981',
                              borderRadius: '4px',
                            }}></div>
                          </div>
                        </div>

                        <Link
                          href={`/checklist?id=${item._id}`}
                          className="btn btn-secondary"
                          style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '8px',
                            marginTop: '8px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                          }}
                        >
                          Xem chi tiết <ArrowRight size={16} />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
