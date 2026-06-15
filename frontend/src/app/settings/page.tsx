'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Save, Shield, Bell, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const { user, token, updateUser } = useAuth();

  // State for profile / security
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // State for application settings
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(30);
  const [telegramNotifications, setTelegramNotifications] = useState(true);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [alertThresholdMinutes, setAlertThresholdMinutes] = useState(15);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize fields with current user settings
  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      if (user.settings) {
        setTheme(user.settings.theme || 'dark');
        setAutoRefreshInterval(user.settings.autoRefreshInterval || 30);
        setTelegramNotifications(user.settings.telegramNotifications !== false);
        setTelegramChatId(user.settings.telegramChatId || '');
        setAlertThresholdMinutes(user.settings.alertThresholdMinutes || 15);
      }
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (password && password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        fullName,
        settings: {
          theme,
          autoRefreshInterval: Number(autoRefreshInterval),
          telegramNotifications,
          telegramChatId,
          alertThresholdMinutes: Number(alertThresholdMinutes),
        }
      };

      if (password) {
        payload.password = password;
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Cập nhật cấu hình thất bại');
      }

      const updatedUser = await res.json();
      updateUser(updatedUser);
      setPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Cập nhật thông tin tài khoản thành công!' });
      
      // Update theme token on root element
      document.documentElement.setAttribute('data-theme', theme);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra khi lưu cấu hình.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff' }}>
        Đang tải thông tin...
      </div>
    );
  }

  return (
    <ProtectedRoute>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>Cấu Hình Cá Nhân</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Thiết lập thông tin tài khoản, mật khẩu và cấu hình nhận cảnh báo</p>
      </div>

        {/* Feedback Messages */}
        {message && (
          <div className={`glass-panel`} style={{
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderLeft: `4px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            {message.type === 'success' ? (
              <CheckCircle2 size={20} color="#10b981" />
            ) : (
              <AlertCircle size={20} color="#ef4444" />
            )}
            <span style={{ fontSize: '0.95rem', color: message.type === 'success' ? '#10b981' : '#ef4444', fontWeight: 500 }}>
              {message.text}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '800px' }}>
          
          {/* Section 1: Thông tin tài khoản */}
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <RefreshCw size={20} color="var(--primary-color)" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>Thông Tin Cơ Bản</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Tên tài khoản (Read-only)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={user.username} 
                  disabled 
                  style={{ background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-muted)' }} 
                />
              </div>
              <div>
                <label className="form-label">Họ và tên</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  required 
                  placeholder="Nhập đầy đủ họ và tên"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Bảo mật */}
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Shield size={20} color="#f59e0b" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>Đổi Mật Khẩu (Để trống nếu không đổi)</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Mật khẩu mới</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="form-label">Xác nhận mật khẩu mới</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Cấu hình vận hành & Telegram */}
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Bell size={20} color="#10b981" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>Cấu Hình Nhận Cảnh Báo & Ứng Dụng</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Theme preference */}
              <div>
                <label className="form-label">Giao diện mặc định</label>
                <select 
                  className="form-input" 
                  value={theme} 
                  onChange={(e) => setTheme(e.target.value as any)}
                >
                  <option value="dark">Chế độ tối (Dark Mode)</option>
                  <option value="light">Chế độ sáng (Light Mode)</option>
                </select>
              </div>

              {/* Auto refresh interval */}
              <div>
                <label className="form-label">Tần suất tự động làm mới dữ liệu ca trực</label>
                <select 
                  className="form-input" 
                  value={autoRefreshInterval} 
                  onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                >
                  <option value={10}>10 giây</option>
                  <option value={30}>30 giây</option>
                  <option value={60}>60 giây</option>
                  <option value={120}>2 phút</option>
                  <option value={300}>5 phút</option>
                </select>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '8px 0' }} />

              {/* Telegram Notifications toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox" 
                  id="telegramNotifications"
                  checked={telegramNotifications} 
                  onChange={(e) => setTelegramNotifications(e.target.checked)} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="telegramNotifications" style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer' }}>
                  Kích hoạt nhận cảnh báo cá nhân qua Telegram
                </label>
              </div>

              {/* Telegram Chat ID */}
              {telegramNotifications && (
                <>
                  <div>
                    <label className="form-label">Telegram Chat ID</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={telegramChatId} 
                      onChange={(e) => setTelegramChatId(e.target.value)} 
                      placeholder="e.g. 523192038"
                    />
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px', fontSize: '0.8rem' }}>
                      💡 Hướng dẫn lấy Chat ID: Nhấn tìm kiếm tài khoản bot Telegram của MXV hoặc nhắn tin <code>/start</code> hoặc <code>/my_id</code> với bot <b>@userinfobot</b> hoặc <b>@MXV_Checklist_Bot</b> để lấy ID số của bạn.
                    </small>
                  </div>

                  {/* Alert threshold */}
                  <div>
                    <label className="form-label">Thời gian cảnh báo trước hạn chót (phút)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={alertThresholdMinutes} 
                      onChange={(e) => setAlertThresholdMinutes(Number(e.target.value))} 
                      min={1} 
                      max={180}
                    />
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px', fontSize: '0.8rem' }}>
                      Cảnh báo sẽ tự động gửi qua Telegram khi một tác vụ chưa hoàn thành có deadline cách hiện tại nhỏ hơn hoặc bằng số phút này.
                    </small>
                  </div>
                </>
              )}

            </div>
          </div>

          {/* Action button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isSubmitting}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '1rem' }}
            >
              <Save size={18} />
              <span>{isSubmitting ? 'Đang lưu cấu hình...' : 'Lưu thay đổi'}</span>
            </button>
          </div>

        </form>
      </ProtectedRoute>
    );
}
