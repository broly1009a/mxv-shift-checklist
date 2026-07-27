'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (handoverNote: string) => Promise<void>;
  isSubmitting: boolean;
}

export default function CloseShiftModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting
}: CloseShiftModalProps) {
  const [handoverNote, setHandoverNote] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverNote.trim()) return;
    await onSubmit(handoverNote.trim());
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
        maxWidth: '550px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
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

        {/* Warning card */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '12px 14px',
          background: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '10px',
          color: '#ef4444',
          fontSize: '0.82rem',
          lineHeight: 1.4
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Lưu ý quan trọng:</strong> Hành động chốt ca trực này sẽ khóa toàn bộ dữ liệu của ca. Bạn sẽ không thể cập nhật trạng thái tác vụ hoặc sửa đổi thông tin sau khi chốt.
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Biên bản bàn giao ca trực *
            </label>
            <textarea
              className="form-input"
              placeholder="Nhập thông tin bàn giao vị thế, trạng thái hệ thống, các sự cố phát sinh hoặc lưu ý đặc biệt cho ca trực sau..."
              value={handoverNote}
              onChange={(e) => setHandoverNote(e.target.value)}
              rows={5}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                lineHeight: '1.4',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                resize: 'vertical',
                width: '100%',
                outline: 'none'
              }}
              required
              disabled={isSubmitting}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <span>* Bắt buộc nhập thông tin bàn giao để thực hiện khóa ca.</span>
              <span>{handoverNote.length} ký tự</span>
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
              disabled={isSubmitting || !handoverNote.trim()}
              style={{
                padding: '8px 16px',
                fontSize: '0.82rem',
                background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                color: '#fff',
                border: 'none',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
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
