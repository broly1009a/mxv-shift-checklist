'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Save, Shield, Bell, RefreshCw, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';

type TabType = 'profile' | 'notifications' | 'security';

export default function SettingsPage() {
  const { user, token, updateUser } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('profile');

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

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize fields with current user settings
  useEffect(() => {
    if (user) {
      Promise.resolve().then(() => {
        setFullName(user.fullName || '');
        if (user.settings) {
          setTheme(user.settings.theme || 'dark');
          setAutoRefreshInterval(user.settings.autoRefreshInterval || 30);
          setTelegramNotifications(user.settings.telegramNotifications !== false);
          setTelegramChatId(user.settings.telegramChatId || '');
          setAlertThresholdMinutes(user.settings.alertThresholdMinutes || 15);
        }
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password && password !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
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
      toast.success('Cập nhật thông tin tài khoản thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Có lỗi xảy ra khi lưu cấu hình.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-primary)' }}>
        Đang tải thông tin...
      </div>
    );
  }

  return (
    <ProtectedRoute>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Cấu Hình & Hồ Sơ</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Quản lý thông tin cá nhân, cài đặt ứng dụng và bảo mật tài khoản</p>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '32px',
          width: '100%',
        }}>
          <div style={{
            display: 'inline-flex',
            background: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
            padding: '6px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            gap: '6px',
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              style={{
                background: activeTab === 'profile' ? 'var(--color-accent)' : 'transparent',
                border: 'none',
                outline: 'none',
                color: activeTab === 'profile' ? '#ffffff' : 'var(--text-secondary)',
                padding: '10px 20px',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: activeTab === 'profile' ? '0 4px 12px rgba(59, 130, 246, 0.25)' : 'none',
              }}
            >
              <UserIcon size={16} />
              <span>Hồ sơ cá nhân</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              style={{
                background: activeTab === 'notifications' ? 'var(--color-accent)' : 'transparent',
                border: 'none',
                outline: 'none',
                color: activeTab === 'notifications' ? '#ffffff' : 'var(--text-secondary)',
                padding: '10px 20px',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: activeTab === 'notifications' ? '0 4px 12px rgba(59, 130, 246, 0.25)' : 'none',
              }}
            >
              <Bell size={16} />
              <span>Nhận cảnh báo & Ứng dụng</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              style={{
                background: activeTab === 'security' ? 'var(--color-accent)' : 'transparent',
                border: 'none',
                outline: 'none',
                color: activeTab === 'security' ? '#ffffff' : 'var(--text-secondary)',
                padding: '10px 20px',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: activeTab === 'security' ? '0 4px 12px rgba(59, 130, 246, 0.25)' : 'none',
              }}
            >
              <Shield size={16} />
              <span>Bảo mật & Đổi mật khẩu</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
          
          <div style={{ width: '100%' }}>
            
            {/* Tab 1: Profile */}
            {activeTab === 'profile' && (
              <div className="glass-panel" style={{ padding: '32px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <UserIcon size={22} color="var(--color-accent)" />
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Thông Tin Tài Khoản</h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

                  <div>
                    <label className="form-label">Chức vụ / Vai trò (Read-only)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={
                        user.role === 'ADMIN' ? 'Quản trị viên hệ thống' :
                        user.role === 'CHAIRMAN' ? 'Chủ tịch Hội đồng' :
                        user.role === 'CEO' ? 'Tổng Giám đốc' :
                        user.role === 'DIVISION_DIRECTOR' ? 'Giám đốc Khối' :
                        user.role === 'DEPARTMENT_HEAD' ? 'Trưởng bộ phận' :
                        'Nhân viên vận hành'
                      } 
                      disabled 
                      style={{ background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-muted)' }} 
                    />
                  </div>

                  {user.division && (
                    <div>
                      <label className="form-label">Khối trực thuộc (Read-only)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={user.division.name} 
                        disabled 
                        style={{ background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-muted)' }} 
                      />
                    </div>
                  )}

                  {user.department && (
                    <div>
                      <label className="form-label">Bộ phận / Phòng ban (Read-only)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={user.department.name} 
                        disabled 
                        style={{ background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-muted)' }} 
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Notifications & Theme */}
            {activeTab === 'notifications' && (
              <div className="glass-panel" style={{ padding: '32px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <Bell size={22} color="#10b981" />
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Thiết Lập Ứng Dụng & Cảnh Báo</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                    <label htmlFor="telegramNotifications" style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer' }}>
                      Kích hoạt nhận tin nhắn nhắc việc cá nhân trực tiếp từ Bot Telegram
                    </label>
                  </div>

                  {/* Telegram Chat ID & Alert threshold */}
                  {telegramNotifications && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '20px', borderLeft: '2px solid var(--color-accent)' }}>
                      <div>
                        <label className="form-label">Telegram Chat ID cá nhân</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={telegramChatId} 
                          onChange={(e) => setTelegramChatId(e.target.value)} 
                          placeholder="e.g. 523192038"
                        />
                        <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px', fontSize: '0.8rem', lineHeight: '1.4' }}>
                          💡 <strong>Hướng dẫn liên kết nhận tin nhắn riêng:</strong><br />
                          1. Tìm kiếm bot Telegram của hệ thống (ví dụ: <b>@MXV_Checklist_Bot</b>) và nhấn <b>/start</b>.<br />
                          2. Nhắn tin <code>/my_id</code> với bot hoặc dùng bot <b>@userinfobot</b> để lấy ID số cá nhân của bạn rồi điền vào ô trên.
                        </small>
                      </div>

                      <div>
                        <label className="form-label">Thời gian nhắc nhở trước hạn chót (phút)</label>
                        <input 
                          type="number" 
                          className="form-input" 
                          value={alertThresholdMinutes} 
                          onChange={(e) => setAlertThresholdMinutes(Number(e.target.value))} 
                          min={1} 
                          max={180}
                        />
                        <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px', fontSize: '0.8rem', lineHeight: '1.4' }}>
                          Hệ thống sẽ tự động gửi tin nhắn riêng cho bạn khi một tác vụ chưa hoàn thành có deadline cách hiện tại nhỏ hơn hoặc bằng số phút này.
                        </small>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Security */}
            {activeTab === 'security' && (
              <div className="glass-panel" style={{ padding: '32px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <Shield size={22} color="#f59e0b" />
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Bảo Mật & Đổi Mật Khẩu</h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label className="form-label">Mật khẩu mới (Để trống nếu không đổi)</label>
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
            )}

          </div>

          {/* Action button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '12px' }}>
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
      </div>
    </ProtectedRoute>
  );
}
