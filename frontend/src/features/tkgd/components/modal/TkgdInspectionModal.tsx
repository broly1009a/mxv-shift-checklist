'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  X,
  SlidersHorizontal,
  ImageIcon,
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  Lock,
  Zap,
} from 'lucide-react';
import {
  CleanRecord,
  AccountManifest,
  PreviewImageState,
  PreviewPdfState,
} from '../../types/tkgd.types';
import { cleanMailName, getAccountTypeBadges } from '../../utils/tkgd.helpers';
import { tkgdApi } from '../../services/tkgd.api';
import { TabDataComparison } from './TabDataComparison';
import { TabAttachmentsViewer } from './TabAttachmentsViewer';
import { TabRawJsonLog } from './TabRawJsonLog';

interface TkgdInspectionModalProps {
  record: CleanRecord | null;
  onClose: () => void;
  accountManifest: AccountManifest | null;
  loadingManifest: boolean;
  onPreviewImage: (state: PreviewImageState) => void;
  onPreviewPdf: (state: PreviewPdfState) => void;
  apiBaseUrl: string;
  onRecordUpdated?: (record: CleanRecord) => void;
}

export const TkgdInspectionModal: React.FC<TkgdInspectionModalProps> = ({
  record,
  onClose,
  accountManifest,
  loadingManifest,
  onPreviewImage,
  onPreviewPdf,
  apiBaseUrl,
  onRecordUpdated,
}) => {
  const [activeModalTab, setActiveModalTab] = useState<'DIFF' | 'ATTACHMENTS' | 'AUDIT'>('DIFF');
  const [isApproving, setIsApproving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [isReEvaluating, setIsReEvaluating] = useState(false);
  const [showApproveBox, setShowApproveBox] = useState(false);
  const [approveReason, setApproveReason] = useState('Đã xác minh hồ sơ gốc hợp lệ');

  // Hotkey ESC đóng modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!record) return null;

  const baseCode = (
    record.maTKGDBase ||
    (record.maTKGD ? record.maTKGD.split('-')[0] : '') ||
    record.noiDungMail?.maTKGD_Futures ||
    '-'
  ).trim();

  const customerName =
    cleanMailName(record.noiDungMail?.tenTaiKhoan) !== '-'
      ? cleanMailName(record.noiDungMail?.tenTaiKhoan)
      : record.ms?.hoVaTen || '-';

  const badges = getAccountTypeBadges(record);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '92vh',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  So Sánh Đối Soát Chi Tiết
                </h2>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                  }}
                >
                  {baseCode}
                </span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {badges.map((b, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: b.bg,
                        color: b.color,
                        border: `1px solid ${b.border}`,
                      }}
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Khách hàng: <strong>{customerName}</strong> | TVKD: <strong>{record.maTVKD || '003'}</strong> | Ngày đợt: {record.batchDate}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Đóng (ESC)"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 24px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          {[
            { id: 'DIFF', label: 'So Sánh Trường Dữ Liệu', icon: SlidersHorizontal },
            { id: 'ATTACHMENTS', label: 'Hồ Sơ & Ảnh CCCD', icon: ImageIcon },
            { id: 'AUDIT', label: 'Lịch Sử Kiểm Toán', icon: ShieldCheck },
          ].map((tab) => {
            const active = activeModalTab === tab.id;
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveModalTab(tab.id as 'DIFF' | 'ATTACHMENTS' | 'AUDIT')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: active ? '1px solid var(--border-focus)' : '1px solid transparent',
                  backgroundColor: active ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  color: active ? '#3b82f6' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <IconComponent size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {activeModalTab === 'DIFF' && (
            <TabDataComparison
              inspectRecord={record}
              onSwitchToAttachments={() => setActiveModalTab('ATTACHMENTS')}
            />
          )}

          {activeModalTab === 'ATTACHMENTS' && (
            <TabAttachmentsViewer
              inspectRecord={record}
              accountManifest={accountManifest}
              loadingManifest={loadingManifest}
              onPreviewImage={onPreviewImage}
              onPreviewPdf={onPreviewPdf}
              apiBaseUrl={apiBaseUrl}
            />
          )}

          {activeModalTab === 'AUDIT' && (
            <TabRawJsonLog inspectRecord={record} />
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
          }}
        >
          {/* Form nhập lý do phê duyệt nếu đang mở */}
          {showApproveBox && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <ShieldCheck size={18} color="#10b981" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', marginBottom: '4px' }}>
                  Lý do chấp thuận / phê duyệt hồ sơ bằng tay:
                </div>
                <input
                  type="text"
                  value={approveReason}
                  onChange={(e) => setApproveReason(e.target.value)}
                  placeholder="Ví dụ: Đã xác minh CMND 9 số theo công văn, hoặc sai khác ký tự gõ phím..."
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: '0.78rem',
                  }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end' }}>
                <button
                  disabled={isApproving}
                  onClick={async () => {
                    if (!record?._id) return;
                    setIsApproving(true);
                    try {
                      const res = await tkgdApi.manualApprove(record._id, approveReason);
                      toast.success(res.message || 'Đã phê duyệt hồ sơ thành công!');
                      setShowApproveBox(false);
                      if (res.record) onRecordUpdated?.(res.record);
                    } catch (err: any) {
                      toast.error('Lỗi duyệt hồ sơ: ' + err.message);
                    } finally {
                      setIsApproving(false);
                    }
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    backgroundColor: '#10b981',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    cursor: isApproving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {isApproving ? 'Đang duyệt...' : 'Xác nhận duyệt'}
                </button>
                <button
                  disabled={isApproving}
                  onClick={() => setShowApproveBox(false)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Phím tắt: Bấm{' '}
                <kbd
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  ESC
                </kbd>{' '}
                để đóng
              </div>

              {/* Thông tin đã duyệt tay nếu có */}
              {record?.manualReview?.isOverridden && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.72rem',
                    color: '#059669',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    padding: '3px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    fontWeight: 600,
                  }}
                  title={`Duyệt lúc: ${record.manualReview.approvedAt || ''}`}
                >
                  <Lock size={12} /> Đã duyệt tay bởi {record.manualReview.approvedBy || 'Cán bộ'}
                  {record.manualReview.reason ? ` (${record.manualReview.reason})` : ''}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Nút hành động Duyệt tay hoặc Hủy duyệt */}
              {record?.manualReview?.isOverridden ? (
                <button
                  disabled={isReverting}
                  onClick={async () => {
                    if (!record?._id) return;
                    if (!confirm('Bạn có chắc chắn muốn hủy phê duyệt tay và để hệ thống đối soát máy lại?')) return;
                    setIsReverting(true);
                    try {
                      const res = await tkgdApi.revertApprove(record._id);
                      toast.success(res.message || 'Đã hủy duyệt tay thành công!');
                      if (res.record) onRecordUpdated?.(res.record);
                    } catch (err: any) {
                      toast.error('Lỗi hủy duyệt: ' + err.message);
                    } finally {
                      setIsReverting(false);
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: isReverting ? 'not-allowed' : 'pointer',
                  }}
                >
                  <RotateCcw size={13} /> {isReverting ? 'Đang hủy...' : 'Hủy phê duyệt tay'}
                </button>
              ) : (
                !showApproveBox && (
                  <button
                    onClick={() => setShowApproveBox(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#10b981',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <ShieldCheck size={15} /> Phê Duyệt Hồ Sơ (Chấp Thuận)
                  </button>
                )
              )}

              {/* Nút Tái Thẩm Định Hồ Sơ (Dọn Sạch Lỗi Stale & Re-run Rule Engine) */}
              {!record?.manualReview?.isOverridden && !showApproveBox && (
                <button
                  disabled={isReEvaluating}
                  onClick={async () => {
                    if (!record?._id) return;
                    setIsReEvaluating(true);
                    try {
                      const res = await tkgdApi.reEvaluateRecord(record._id);
                      toast.success(res.message || 'Đã tái thẩm định hồ sơ thành công!');
                      if (res.record) onRecordUpdated?.(res.record);
                    } catch (err: any) {
                      toast.error('Lỗi tái thẩm định: ' + err.message);
                    } finally {
                      setIsReEvaluating(false);
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#3b82f6',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: isReEvaluating ? 'not-allowed' : 'pointer',
                  }}
                  title="Chạy lại bộ luật đối soát chéo trên dữ liệu mới nhất, xóa bỏ các cảnh báo stale cũ"
                >
                  <Zap size={14} /> {isReEvaluating ? 'Đang thẩm định...' : 'Tái Thẩm Định'}
                </button>
              )}

              <button
                onClick={onClose}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

