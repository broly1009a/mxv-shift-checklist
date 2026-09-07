'use client';

import React from 'react';
import { CleanRecord } from '../../types/tkgd.types';
import { formatDateStr } from '../../utils/tkgd.helpers';

interface TabRawJsonLogProps {
  inspectRecord: CleanRecord;
}

export const TabRawJsonLog: React.FC<TabRawJsonLogProps> = ({ inspectRecord }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.75rem' }}>
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '10px',
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontWeight: 700, color: '#3b82f6' }}>Đối soát 3 chiều lần gần nhất</span>
          <span style={{ color: 'var(--text-muted)' }}>
            {formatDateStr(inspectRecord.ketLuan?.reconciledAt || new Date().toISOString())}
          </span>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Trạng thái kết luận:{' '}
          <strong
            style={{
              color:
                inspectRecord.ketLuan?.trangThai === 'KHOP'
                  ? '#10b981'
                  : inspectRecord.ketLuan?.trangThai === 'CAN_KIEM_TRA'
                  ? '#d97706'
                  : '#ef4444',
            }}
          >
            {inspectRecord.ketLuan?.trangThai || 'CHUA_XU_LY'}
          </strong>
        </p>
      </div>

      {inspectRecord.snapshots && inspectRecord.snapshots.length > 0 ? (
        inspectRecord.snapshots.map((snap, sIdx) => (
          <div
            key={sIdx}
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'transparent',
            }}
          >
            <span style={{ fontWeight: 600 }}>Lần {sIdx + 1} - Hành động: {snap.action}</span>
            <span style={{ float: 'right', color: 'var(--text-muted)' }}>{formatDateStr(snap.snapshotAt)}</span>
          </div>
        ))
      ) : (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
          Chưa có lịch sử thay đổi snapshot nào được ghi nhận cho tài khoản này.
        </p>
      )}

      {/* Tùy chọn xem JSON thô để debug */}
      <details style={{ marginTop: '10px' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>
          Xem Dữ Liệu Kỹ Thuật (Raw JSON Payload)
        </summary>
        <pre
          style={{
            marginTop: '8px',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            overflowX: 'auto',
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            maxHeight: '300px',
          }}
        >
          {JSON.stringify(inspectRecord, null, 2)}
        </pre>
      </details>
    </div>
  );
};
