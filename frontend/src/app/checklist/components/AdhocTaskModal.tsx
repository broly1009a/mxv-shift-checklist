'use client';

import React from 'react';
import { Plus } from 'lucide-react';

interface AdhocTaskModalProps {
  isAdhocModalOpen: boolean;
  setIsAdhocModalOpen: (open: boolean) => void;
  adhocTaskName: string;
  setAdhocTaskName: (name: string) => void;
  adhocPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  setAdhocPriority: (priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => void;
  adhocDeadline: string;
  setAdhocDeadline: (deadline: string) => void;
  isSubmittingAdhoc: boolean;
  handleAddAdhocTask: (e: React.FormEvent) => Promise<void>;
}

export default function AdhocTaskModal({
  isAdhocModalOpen,
  setIsAdhocModalOpen,
  adhocTaskName,
  setAdhocTaskName,
  adhocPriority,
  setAdhocPriority,
  adhocDeadline,
  setAdhocDeadline,
  isSubmittingAdhoc,
  handleAddAdhocTask
}: AdhocTaskModalProps) {
  if (!isAdhocModalOpen) return null;

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
        maxWidth: '500px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} color="var(--color-primary)" /> Thêm tác vụ phát sinh trong ca
          </h3>
          <button
            onClick={() => setIsAdhocModalOpen(false)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleAddAdhocTask} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nội dung công việc (Tác vụ)*</label>
            <input
              type="text"
              className="form-input"
              placeholder="Mô tả công việc cần làm..."
              value={adhocTaskName}
              onChange={(e) => setAdhocTaskName(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Độ ưu tiên*</label>
            <select
              className="form-input"
              value={adhocPriority}
              onChange={(e) => setAdhocPriority(e.target.value as any)}
              style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
            >
              <option value="LOW">THẤP</option>
              <option value="MEDIUM">TRUNG BÌNH</option>
              <option value="HIGH">CAO</option>
              <option value="CRITICAL">KHẨN CẤP</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Hạn chót (Deadline - tùy chọn)</label>
            <input
              type="text"
              className="form-input"
              placeholder="vd: 17:00, 21:30..."
              value={adhocDeadline}
              onChange={(e) => setAdhocDeadline(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => setIsAdhocModalOpen(false)}
              className="btn btn-secondary"
              disabled={isSubmittingAdhoc}
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmittingAdhoc || !adhocTaskName.trim()}
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
            >
              {isSubmittingAdhoc ? 'Đang thêm...' : 'Thêm tác vụ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
