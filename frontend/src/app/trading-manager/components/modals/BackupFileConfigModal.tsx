'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  CheckSquare,
  Square,
  RotateCcw,
  Filter,
  Save,
  Search,
  FileSpreadsheet,
  Settings,
  Info,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';

export interface BackupReportItem {
  key: string;
  name: string;
  filename: string;
  description?: string;
  group?: string;
  groupLabel?: string;
  isRecommended?: boolean;
  isUnused?: boolean;
}

export interface BackupFileConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  system: 'MS' | 'CQG' | 'CCP' | 'CE' | 'ACM';
  systemName: string;
  allReports: BackupReportItem[];
  token: string | null;
  onSaved?: (savedKeys: string[]) => void;
}

export default function BackupFileConfigModal({
  isOpen,
  onClose,
  system,
  systemName,
  allReports,
  token,
  onSaved,
}: BackupFileConfigModalProps) {
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const settingKey = `bot_backup_selected_reports_${system.toLowerCase()}`;

  // Nạp cấu hình từ MongoDB system_settings khi mở Modal
  const loadSavedConfig = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await api.admin.getSystemSetting(settingKey, token);
      const val = res?.value;
      if (val) {
        const parsed: string[] = JSON.parse(val);
        if (Array.isArray(parsed)) {
          const map: Record<string, boolean> = {};
          allReports.forEach((r) => {
            map[r.key] = parsed.includes(r.key);
          });
          setSelectedMap(map);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Nếu chưa có trong DB, khởi tạo mặc định (bỏ chọn các file rỗng/unused)
    }

    // Mặc định ban đầu nếu chưa có CSDL:
    const initialMap: Record<string, boolean> = {};
    allReports.forEach((r) => {
      initialMap[r.key] = !r.isUnused;
    });
    setSelectedMap(initialMap);
    setLoading(false);
  }, [isOpen, settingKey, token, allReports]);

  useEffect(() => {
    loadSavedConfig();
  }, [loadSavedConfig]);

  // Bộ lọc tìm kiếm
  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return allReports;
    const q = searchQuery.toLowerCase().trim();
    return allReports.filter(
      (r) =>
        r.key.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.filename.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)),
    );
  }, [allReports, searchQuery]);

  const selectedCount = useMemo(() => {
    return allReports.filter((r) => selectedMap[r.key]).length;
  }, [allReports, selectedMap]);

  // Toggle từng checkbox
  const handleToggle = (key: string) => {
    setSelectedMap((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Nút thao tác nhanh: Chọn tất cả
  const handleSelectAll = () => {
    const next: Record<string, boolean> = {};
    allReports.forEach((r) => {
      next[r.key] = true;
    });
    setSelectedMap(next);
  };

  // Nút thao tác nhanh: Bỏ chọn tất cả
  const handleDeselectAll = () => {
    const next: Record<string, boolean> = {};
    allReports.forEach((r) => {
      next[r.key] = false;
    });
    setSelectedMap(next);
  };

  // Nút thao tác nhanh: Bỏ chọn file rỗng / thừa (Unused / Market Maker)
  const handleDeselectUnused = () => {
    const next: Record<string, boolean> = {};
    allReports.forEach((r) => {
      const isUnused =
        r.isUnused ||
        r.key.includes('_MM') ||
        r.group === 'MM' ||
        r.key === 'SESSION_CONFIG' ||
        r.key === 'SESSION_INFO' ||
        r.key === 'AS';
      next[r.key] = !isUnused;
    });
    setSelectedMap(next);
    toast.success('Đã tự động loại bỏ các tệp rỗng / không sử dụng thường xuyên');
  };

  // Nút thao tác nhanh: Khôi phục danh mục khuyến nghị chuẩn
  const handleResetDefault = () => {
    const next: Record<string, boolean> = {};
    allReports.forEach((r) => {
      const isUnused =
        r.isUnused ||
        r.key.includes('_MM') ||
        r.group === 'MM' ||
        r.key === 'SESSION_CONFIG' ||
        r.key === 'SESSION_INFO';
      next[r.key] = !isUnused;
    });
    setSelectedMap(next);
  };

  // Lưu cấu hình vào MongoDB system_settings
  const handleSave = async () => {
    setSaving(true);
    const selectedKeys = allReports
      .filter((r) => selectedMap[r.key])
      .map((r) => r.key);

    try {
      await api.admin.saveSystemSetting(
        settingKey,
        JSON.stringify(selectedKeys),
        token,
      );
      toast.success(`Đã lưu cấu hình ${selectedKeys.length} tệp sao lưu mặc định cho ${systemName}!`);
      if (onSaved) onSaved(selectedKeys);
      onClose();
    } catch (err: any) {
      toast.error(`Lỗi lưu cấu hình: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-card, #181b20)',
          border: '1px solid var(--border-color, #2a2e39)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.48)',
          color: 'var(--text-primary, #e1e4ea)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color, #2a2e39)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.16)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
              }}
            >
              <Settings size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                Cấu hình tệp sao lưu mặc định — {systemName}
              </h3>
              <p
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary, #94a3b8)',
                  margin: '2px 0 0 0',
                }}
              >
                Lưu vào CSDL MongoDB. Scheduler/Bot ngầm và giao diện sẽ đồng bộ dùng danh mục này.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Actions & Search Bar */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-color, #2a2e39)',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSelectAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.76rem',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #2a2e39)',
                backgroundColor: 'var(--bg-input, #22262e)',
                color: 'var(--text-primary, #e1e4ea)',
                cursor: 'pointer',
              }}
            >
              <CheckSquare size={13} color="#3b82f6" />
              Chọn tất cả
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.76rem',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #2a2e39)',
                backgroundColor: 'var(--bg-input, #22262e)',
                color: 'var(--text-primary, #e1e4ea)',
                cursor: 'pointer',
              }}
            >
              <Square size={13} color="#94a3b8" />
              Bỏ chọn tất cả
            </button>
            <button
              type="button"
              onClick={handleDeselectUnused}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.76rem',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                color: '#f59e0b',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              title="Bỏ chọn các file Market Maker luôn rỗng 0 dòng và các file không cần thiết"
            >
              <Filter size={13} />
              Bỏ chọn file thừa/rỗng
            </button>
            <button
              type="button"
              onClick={handleResetDefault}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.76rem',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #2a2e39)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary, #94a3b8)',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={13} />
              Mặc định
            </button>
          </div>

          {/* Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-input, #22262e)',
              border: '1px solid var(--border-color, #2a2e39)',
              minWidth: '180px',
            }}
          >
            <Search size={13} color="var(--text-secondary, #94a3b8)" />
            <input
              type="text"
              placeholder="Tìm kiếm báo cáo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary, #e1e4ea)',
                fontSize: '0.78rem',
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Reports Checkbox List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {loading ? (
            <div
              style={{
                padding: '40px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                color: 'var(--text-secondary, #94a3b8)',
              }}
            >
              <Loader2 className="animate-spin" size={24} />
              <span style={{ fontSize: '0.85rem' }}>Đang nạp cấu hình từ CSDL...</span>
            </div>
          ) : filteredReports.length === 0 ? (
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                color: 'var(--text-secondary, #94a3b8)',
                fontSize: '0.85rem',
              }}
            >
              Không tìm thấy báo cáo nào khớp với từ khóa "{searchQuery}".
            </div>
          ) : (
            filteredReports.map((report) => {
              const isChecked = Boolean(selectedMap[report.key]);
              const isMmOrUnused =
                report.isUnused ||
                report.key.includes('_MM') ||
                report.group === 'MM' ||
                report.key === 'SESSION_CONFIG' ||
                report.key === 'SESSION_INFO';

              return (
                <div
                  key={report.key}
                  onClick={() => handleToggle(report.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${
                      isChecked
                        ? 'rgba(59, 130, 246, 0.4)'
                        : 'var(--border-color, #2a2e39)'
                    }`,
                    backgroundColor: isChecked
                      ? 'rgba(59, 130, 246, 0.08)'
                      : 'var(--bg-input, #22262e)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(report.key)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                    <FileSpreadsheet
                      size={16}
                      color={isChecked ? '#3b82f6' : 'var(--text-secondary, #94a3b8)'}
                      style={{ flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: isChecked ? 600 : 500,
                            color: isChecked ? 'var(--text-primary, #e1e4ea)' : 'var(--text-secondary, #94a3b8)',
                          }}
                        >
                          {report.name}
                        </span>
                        <code
                          style={{
                            fontSize: '0.72rem',
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            color: isChecked ? '#60a5fa' : '#64748b',
                          }}
                        >
                          {report.filename}
                        </code>
                        {isMmOrUnused && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              fontWeight: 600,
                            }}
                          >
                            Thường rỗng 0 dòng
                          </span>
                        )}
                        {report.groupLabel && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              backgroundColor: 'rgba(148, 163, 184, 0.12)',
                              color: '#94a3b8',
                            }}
                          >
                            {report.groupLabel}
                          </span>
                        )}
                      </div>
                      {report.description && (
                        <p
                          style={{
                            fontSize: '0.72rem',
                            color: '#64748b',
                            margin: '2px 0 0 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {report.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color, #2a2e39)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={14} color="var(--text-secondary, #94a3b8)" />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Đã chọn: <strong style={{ color: '#3b82f6' }}>{selectedCount}</strong> / {allReports.length} tệp
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #2a2e39)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary, #94a3b8)',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              Lưu cấu hình mặc định
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
