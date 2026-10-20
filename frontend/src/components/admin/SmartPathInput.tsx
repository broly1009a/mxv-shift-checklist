'use client';

import React, { useMemo, useState } from 'react';
import { Folder, Sparkles, Calendar, Info, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';

import {
  SmartPathPreset,
  DEFAULT_STORAGE_PRESETS,
  parseWindowsStoragePath,
} from '@/config/storage-path.config';

export type { SmartPathPreset };
export { parseWindowsStoragePath };

export interface SmartPathInputProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  targetType?: 'folder' | 'file' | 'any';
  presets?: SmartPathPreset[];
  verifyButtonText?: string;
}

export default function SmartPathInput({
  value,
  onChange,
  label = 'Đường dẫn hệ thống',
  placeholder = 'vd: M:\\Tailieuchung\\QLGD-IT\\... hoặc dán C:\\... hoặc /mnt/...',
  style,
  targetType = 'any',
  presets,
  verifyButtonText,
}: SmartPathInputProps) {
  const { token } = useAuth();
  const parsed = useMemo(() => parseWindowsStoragePath(value), [value]);
  const activePresets = presets || DEFAULT_STORAGE_PRESETS;

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    success: boolean;
    exists: boolean;
    canWrite: boolean;
    isFile?: boolean;
    resolvedPath?: string;
    message: string;
  } | null>(null);

  const isFileMode = targetType === 'file' || parsed?.isFile;

  const defaultBtnText = isFileMode ? 'Kiểm tra file & quyền ghi' : 'Kiểm tra quyền ghi';
  const buttonLabel = verifyButtonText || defaultBtnText;

  const handleVerifyPath = async () => {
    if (!value || !value.trim()) {
      setVerifyResult({
        success: false,
        exists: false,
        canWrite: false,
        message: 'Vui lòng nhập hoặc chọn đường dẫn trước khi kiểm tra.',
      });
      return;
    }

    setIsVerifying(true);
    setVerifyResult(null);

    try {
      const authToken =
        token || (typeof window !== 'undefined' ? localStorage.getItem('mxv_token') : null);
      const data = await api.admin.verifyStoragePath({ path: value, targetType }, authToken);
      setVerifyResult(data);
    } catch (err: any) {
      setVerifyResult({
        success: false,
        exists: false,
        canWrite: false,
        message: `Không thể kết nối đến máy chủ kiểm tra: ${err.message}`,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleValueChange = (newVal: string) => {
    setVerifyResult(null); // Reset kết quả kiểm tra khi đường dẫn thay đổi
    onChange(newVal);
  };

  return (
    <div style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {label}
        </label>
        {/* Nút chọn nhanh thư mục chuẩn ổ M */}
        {activePresets.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {activePresets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleValueChange(preset.path)}
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#2563eb',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontWeight: 600,
                }}
                title={`Điền mẫu: ${preset.path}`}
              >
                + {preset.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          className="form-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          style={{ flex: 1, fontSize: '0.78rem', fontFamily: 'monospace' }}
        />

        <button
          type="button"
          onClick={handleVerifyPath}
          disabled={isVerifying || !value.trim()}
          style={{
            whiteSpace: 'nowrap',
            background: 'var(--bg-card, #f8fafc)',
            border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
            padding: '7px 12px',
            borderRadius: '6px',
            cursor: isVerifying || !value.trim() ? 'not-allowed' : 'pointer',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-secondary, #475569)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            opacity: isVerifying || !value.trim() ? 0.6 : 1,
            flexShrink: 0,
          }}
          title={
            isFileMode
              ? 'Kiểm tra xem tập tin có tồn tại và hệ thống có quyền ghi/cập nhật hay không'
              : 'Kiểm tra xem thư mục có tồn tại và hệ thống có quyền ghi dữ liệu hay không'
          }
        >
          {isVerifying ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Đang kiểm tra...</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={13} style={{ color: '#2563eb' }} />
              <span>{buttonLabel}</span>
            </>
          )}
        </button>
      </div>

      {/* Hiển thị kết quả kiểm tra quyền ghi */}
      {verifyResult && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            background: verifyResult.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${verifyResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: verifyResult.success ? '#065f46' : '#991b1b',
          }}
        >
          {verifyResult.success ? (
            <CheckCircle2 size={15} style={{ color: '#10b981', marginTop: '1px', flexShrink: 0 }} />
          ) : (
            <AlertCircle size={15} style={{ color: '#ef4444', marginTop: '1px', flexShrink: 0 }} />
          )}
          <div>
            <div style={{ fontWeight: 600 }}>{verifyResult.message}</div>
            {verifyResult.resolvedPath && (
              <div style={{ fontSize: '0.68rem', opacity: 0.85, marginTop: '2px', fontFamily: 'monospace' }}>
                Đường dẫn trên máy chủ ({verifyResult.isFile ? 'Tập tin' : 'Thư mục'}): {verifyResult.resolvedPath}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hộp gợi ý chuyển đổi thông minh khi dán đường dẫn cá nhân (C:\), UNC hoặc Linux */}
      {parsed && parsed.hasConversionDiff && (
        <div
          style={{
            marginTop: '8px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'var(--bg-card, rgba(59, 130, 246, 0.05))',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
            fontSize: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2563eb', marginBottom: '8px' }}>
            <Info size={14} />
            <span style={{ fontWeight: 600 }}>Đề xuất chuẩn hóa sang ổ chia sẻ mạng (ổ M:):</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            {parsed.hasDynamicVars && (
              <button
                type="button"
                onClick={() => handleValueChange(parsed.dynamicPath)}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
                }}
                title="Tự động cập nhật đường dẫn theo năm/ngày ca trực"
              >
                <Sparkles size={13} /> Áp dụng đường dẫn động (${'YYYY'} / ${'MM'})
              </button>
            )}

            <button
              type="button"
              onClick={() => handleValueChange(parsed.suggestedPath)}
              style={{
                background: 'var(--bg-app, #f1f5f9)',
                color: 'var(--text-secondary, #475569)',
                border: '1px solid var(--border-color, rgba(0, 0, 0, 0.15))',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Lưu đường dẫn ổ M cố định này"
            >
              {parsed.isFile ? <FileText size={13} /> : <Folder size={13} />} Áp dụng đường dẫn ổ M cố định
            </button>
          </div>

          {/* Xem trước đường dẫn thực tế */}
          <div style={{ fontSize: '0.72rem', lineHeight: '1.5', padding: '6px 10px', borderRadius: '4px', background: 'var(--bg-app, rgba(0,0,0,0.03))' }}>
            <div>
              <span style={{ color: '#059669', fontWeight: 600 }}>• Hôm nay ({new Date().toLocaleDateString('vi-VN')}):</span>{' '}
              <span style={{ fontFamily: 'monospace', color: 'var(--text-primary, #0f172a)' }}>{parsed.todayPreview}</span>
            </div>
            {parsed.todayPreview !== parsed.tomorrowPreview && (
              <div>
                <span style={{ color: '#2563eb', fontWeight: 600 }}>• Ngày mai:</span>{' '}
                <span style={{ fontFamily: 'monospace', color: 'var(--text-primary, #0f172a)' }}>{parsed.tomorrowPreview}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hiển thị xem trước ngày nếu người dùng đã nhập sẵn biến động */}
      {parsed && !parsed.hasConversionDiff && parsed.hasDynamicVars && (
        <div style={{ marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={13} style={{ color: '#059669' }} />
          <span>
            <strong style={{ color: '#059669' }}>Xem trước:</strong> Hôm nay tương đương:{' '}
            <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{parsed.todayPreview}</span>
          </span>
        </div>
      )}
    </div>
  );
}
