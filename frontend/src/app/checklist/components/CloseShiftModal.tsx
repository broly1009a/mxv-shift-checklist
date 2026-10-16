'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, AlertCircle, XCircle } from 'lucide-react';

export interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (handoverNote: string) => Promise<void>;
  isSubmitting: boolean;
  shiftLog?: {
    progressPercentage?: number;
    details?: Array<{
      taskId?: string;
      taskNameSnapshot?: string;
      prioritySnapshot?: string;
      isChecked?: boolean;
    }>;
  } | null;
}

export default function CloseShiftModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  shiftLog
}: CloseShiftModalProps) {
  const [handoverNote, setHandoverNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const progress = Number(shiftLog?.progressPercentage || 0);
  const details = shiftLog?.details || [];
  const totalTasks = details.length;
  const completedTasks = details.filter(d => d.isChecked).length;
  const pendingTasks = totalTasks - completedTasks;
  const criticalPending = details.filter(
    d => !d.isChecked && (d.prioritySnapshot || '').toUpperCase() === 'CRITICAL'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = handoverNote.trim();

    if (!trimmed) {
      setError('Vui lòng nhập nội dung biên bản bàn giao trước khi chốt ca.');
      return;
    }

    // Quality Gate: Nếu ca chưa hoàn thành 100%, bắt buộc giải trình có nghĩa (tối thiểu 15 ký tự)
    if (progress < 100 && trimmed.length < 15) {
      setError(`Ca trực còn ${pendingTasks} tác vụ chưa hoàn thành. Biên bản bàn giao phải ghi rõ lý do tồn đọng và người nhận bàn giao (tối thiểu 15 ký tự).`);
      return;
    }

    setError(null);
    await onSubmit(trimmed);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '560px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        borderRadius: '12px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="var(--color-primary)" /> Chốt ca trực & Bàn giao
          </h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            &times;
          </button>
        </div>

        {/* Quality Gate Status Assessment Cards */}
        {progress >= 100 ? (
          <div style={{
            display: 'flex',
            gap: '12px',
            padding: '12px 14px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '10px',
            color: '#10b981',
            fontSize: '0.82rem',
            lineHeight: 1.4
          }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Ca trực đạt chuẩn xuất sắc (100%):</strong> Tất cả {totalTasks}/{totalTasks} tác vụ đã hoàn thành. Hãy nhập biên bản bàn giao ngắn gọn để hoàn tất khóa sổ.
            </div>
          </div>
        ) : progress <= 0 ? (
          <div style={{
            display: 'flex',
            gap: '12px',
            padding: '12px 14px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '10px',
            color: '#ef4444',
            fontSize: '0.82rem',
            lineHeight: 1.4
          }}>
            <XCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>CẢNH BÁO BỎ TRẮNG (0%):</strong> Ca trực chưa có bất kỳ tác vụ nào được thực hiện. Việc chốt ca này sẽ được ghi nhận là <em>Chốt bỏ trắng</em> trong báo cáo kiểm toán. Bắt buộc giải trình lý do.
            </div>
          </div>
        ) : criticalPending.length > 0 ? (
          <div style={{
            display: 'flex',
            gap: '12px',
            padding: '12px 14px',
            background: 'rgba(234, 88, 12, 0.08)',
            border: '1px solid rgba(234, 88, 12, 0.3)',
            borderRadius: '10px',
            color: '#ea580c',
            fontSize: '0.82rem',
            lineHeight: 1.4
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>CẢNH BÁO TRỌNG YẾU:</strong> Ca trực còn {criticalPending.length} tác vụ mức <strong>KHẨN CẤP / TRỌNG YẾU (CRITICAL)</strong> chưa hoàn thành:
              <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                {criticalPending.slice(0, 3).map((t, idx) => (
                  <li key={idx} style={{ fontSize: '0.8rem' }}>{t.taskNameSnapshot || t.taskId}</li>
                ))}
                {criticalPending.length > 3 && <li>...và {criticalPending.length - 3} tác vụ khác</li>}
              </ul>
              Bắt buộc nêu rõ sự cố và phương án bàn giao cho ca tiếp theo.
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            gap: '12px',
            padding: '12px 14px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '10px',
            color: '#f59e0b',
            fontSize: '0.82rem',
            lineHeight: 1.4
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Ca trực chốt có tồn đọng ({progress}%):</strong> Còn <strong>{pendingTasks}/{totalTasks} tác vụ</strong> chưa hoàn tất. Vui lòng ghi chú cụ thể các đầu việc tồn đọng để bàn giao cho ca tiếp theo.
            </div>
          </div>
        )}

        {/* Warning info */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Hành động chốt ca trực sẽ khóa toàn bộ dữ liệu của ca. Bạn sẽ không thể cập nhật trạng thái tác vụ sau khi chốt.
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Biên bản bàn giao ca trực * {progress < 100 && <span style={{ color: '#ef4444' }}>(Tối thiểu 15 ký tự)</span>}
            </label>
            <textarea
              className="form-input"
              placeholder={progress < 100 
                ? "Nêu rõ nguyên nhân các tác vụ chưa hoàn thành, vị thế thị trường và tên nhân sự nhận bàn giao cho ca kế tiếp..." 
                : "Nhập thông tin bàn giao vị thế, trạng thái hệ thống, hoặc lưu ý đặc biệt cho ca trực sau..."}
              value={handoverNote}
              onChange={(e) => {
                setHandoverNote(e.target.value);
                if (error) setError(null);
              }}
              rows={4}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                lineHeight: '1.4',
                background: 'var(--bg-input)',
                border: error ? '1px solid #ef4444' : '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                resize: 'vertical',
                width: '100%',
                outline: 'none'
              }}
              disabled={isSubmitting}
            />
            {error && (
              <div style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} /> {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <span>* Bắt buộc nhập biên bản bàn giao để thực hiện khóa sổ.</span>
              <span style={{ color: progress < 100 && handoverNote.trim().length < 15 ? '#ef4444' : 'var(--text-muted)' }}>
                {handoverNote.length} ký tự {progress < 100 ? '/ tối thiểu 15' : ''}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
              style={{ padding: '8px 16px', fontSize: '0.82rem', height: '36px' }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                fontSize: '0.82rem',
                background: progress >= 100 ? '#10b981' : progress <= 0 ? '#ef4444' : '#f59e0b',
                color: '#fff',
                border: 'none',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                borderRadius: '6px',
                fontWeight: 600
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Đang chốt ca...
                </>
              ) : (
                'Chốt ca & Bàn giao'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
