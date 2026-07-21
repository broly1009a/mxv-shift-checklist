'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Settings,
  Clock,
  Save,
  Sliders,
  DollarSign,
  Calendar,
  Layers,
} from 'lucide-react';

interface SystemSchedulerSettingsProps {
  token: string;
  apiBaseUrl: string;
}

export default function SystemSchedulerSettings({
  token,
  apiBaseUrl,
}: SystemSchedulerSettingsProps) {
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  // System parameters states
  const [sessionStartTime, setSessionStartTime] = useState('05:00');
  const [usdExchangeRate, setUsdExchangeRate] = useState(25220);

  // Scheduler state
  const [schedulerConfig, setSchedulerConfig] = useState<any[]>([]);

  // Existing full config state so we don't wipe other fields when saving
  const [fullConfigData, setFullConfigData] = useState<any>({});

  // Fetch config
  const fetchConfig = async () => {
    if (!token) return;
    setLoadingConfig(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFullConfigData(data);
        if (data.sessionStartTime) {
          setSessionStartTime(data.sessionStartTime);
        }
        if (data.usdExchangeRate) {
          setUsdExchangeRate(data.usdExchangeRate);
        }
        if (data.schedulerConfig) {
          setSchedulerConfig(data.schedulerConfig);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải tham số & cấu hình lập lịch từ máy chủ');
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [token]);

  // Save parameters and scheduler config
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingConfig(true);
    const toastId = toast.loading('Đang lưu tham số & cấu hình lập lịch...');

    try {
      const payload = {
        ...fullConfigData,
        sessionStartTime,
        usdExchangeRate,
        schedulerConfig,
      };

      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Lỗi khi cập nhật cấu hình');
      }

      toast.success('Lưu tham số hệ thống & lịch chạy tự động thành công!', { id: toastId });
      fetchConfig();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ', { id: toastId });
    } finally {
      setSavingConfig(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  };

  if (loadingConfig) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#10b981' }} className="animate-spin" />
          <span>Đang tải tham số hệ thống & cấu hình scheduler...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* System Parameters Panel */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <h4 style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '12px',
            margin: 0,
          }}>
            <Settings size={18} style={{ color: '#10b981' }} />
            Tham số hệ thống & Phiên giao dịch
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
            <div>
              <label style={labelStyle}>Giờ bắt đầu phiên mặc định</label>
              <div style={{ position: 'relative' }}>
                <Clock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="time"
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                  value={sessionStartTime}
                  onChange={(e) => setSessionStartTime(e.target.value)}
                  required
                />
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                Mốc phân chia phiên giao dịch mặc định. Được áp dụng tự động cho Bot chạy trong nền và màn hình checklist.
              </p>
            </div>
            
            <div>
              <label style={labelStyle}>Tỷ giá quy đổi USD/VND mặc định</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>VND</span>
                <input
                  type="number"
                  className="form-input"
                  style={{ paddingLeft: '46px' }}
                  value={usdExchangeRate}
                  onChange={(e) => setUsdExchangeRate(Number(e.target.value))}
                  required
                />
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                Tỷ giá quy đổi dùng cho tính toán chênh lệch số dư tài khoản CQG (Balance Reconciliation).
              </p>
            </div>
          </div>
        </div>

        {/* Scheduler config panel */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <h4 style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '12px',
            margin: 0,
          }}>
            <Clock size={18} style={{ color: '#10b981' }} />
            Lập lịch chạy tự động (Scheduler)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {schedulerConfig.map((task, idx) => (
              <div
                key={task.id || idx}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{task.name}</h5>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Job Type: <code style={{ color: '#10b981', fontFamily: 'monospace' }}>{task.jobType}</code>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Giờ chạy:</span>
                    <input
                      type="time"
                      className="form-input"
                      style={{ padding: '6px 10px', fontSize: '0.75rem', width: '110px' }}
                      value={task.time}
                      onChange={(e) => {
                        const updated = [...schedulerConfig];
                        updated[idx] = { ...updated[idx], time: e.target.value };
                        setSchedulerConfig(updated);
                      }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={task.enabled}
                      onChange={(e) => {
                        const updated = [...schedulerConfig];
                        updated[idx] = { ...updated[idx], enabled: e.target.checked };
                        setSchedulerConfig(updated);
                      }}
                      style={{ accentColor: '#10b981' }}
                    />
                    Kích hoạt
                  </label>
                </div>
              </div>
            ))}
            {schedulerConfig.length === 0 && (
              <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '16px 0' }}>Không tìm thấy cấu hình lập lịch.</p>
            )}
          </div>
        </div>

        {/* Submit Save button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            type="submit"
            disabled={savingConfig}
            className="btn btn-primary"
            style={{ padding: '12px 28px', fontSize: '0.85rem', fontWeight: 700 }}
          >
            <Save size={16} />
            {savingConfig ? 'Đang lưu...' : 'Lưu tham số & lịch chạy tự động'}
          </button>
        </div>
      </form>
    </div>
  );
}
