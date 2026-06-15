'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Shield, Key, User as UserIcon, Mail, Info, X } from 'lucide-react';

export default function LoginPage() {
  const { user, login, loginSSO } = useAuth();
  const router = useRouter();

  // Internal login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // SSO Simulation modal fields
  const [showSSOModal, setShowSSOModal] = useState(false);
  const [ssoEmail, setSsoEmail] = useState('');
  const [ssoFullName, setSsoFullName] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleInternalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.');
      setLoading(false);
    }
  };

  const handleSSOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!ssoEmail) {
      setError('Vui lòng nhập email Microsoft.');
      return;
    }
    if (!ssoEmail.endsWith('@mxv.vn')) {
      setError('Email bắt buộc phải thuộc tên miền Sở MXV (@mxv.vn).');
      return;
    }

    setLoading(true);
    try {
      await loginSSO(ssoEmail, ssoFullName);
      setSuccess('Đăng nhập Microsoft 365 thành công!');
      setShowSSOModal(false);
    } catch (err: any) {
      // If the error indicates waiting for admin activation
      if (err.message && err.message.includes('chờ Admin kích hoạt')) {
        setError(err.message);
        setSuccess('Tài khoản đã được tạo tự động từ Microsoft 365! Vui lòng chờ Admin kích hoạt.');
        setShowSSOModal(false);
      } else {
        setError(err.message || 'Đăng nhập Microsoft 365 thất bại.');
      }
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #111b36 0%, #060a13 100%)',
      padding: '20px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px 32px',
        textAlign: 'center',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div>
          {/* Logo / Brand */}
          <div style={{
            width: '64px',
            height: '64px',
            background: 'rgba(59, 130, 246, 0.15)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            boxShadow: '0 0 20px 0 rgba(59, 130, 246, 0.2)'
          }}>
            <Shield size={32} color="#3b82f6" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: '6px', color: '#fff' }}>
            MXV Shift Checklist
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Sở Giao Dịch Hàng Hóa Việt Nam
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '12px 16px',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '0.875rem',
            textAlign: 'left',
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            padding: '12px 16px',
            borderRadius: '8px',
            color: 'var(--color-primary)',
            fontSize: '0.875rem',
            textAlign: 'left',
          }}>
            {success}
          </div>
        )}

        {/* Internal Login Form */}
        <form onSubmit={handleInternalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Tên đăng nhập
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <UserIcon size={18} />
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="Nhập tên đăng nhập"
                style={{ paddingLeft: '44px' }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Mật khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Key size={18} />
              </div>
              <input
                type="password"
                className="form-input"
                placeholder="Nhập mật khẩu"
                style={{ paddingLeft: '44px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '1rem', marginTop: '10px' }}
            disabled={loading}
          >
            {loading && !showSSOModal ? 'Đang xác thực...' : 'Đăng Nhập'}
          </button>
        </form>

        {/* Separator */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
          <span style={{ padding: '0 12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>HOẶC</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
        </div>

        {/* Microsoft 365 SSO Login Button */}
        <button
          type="button"
          onClick={() => {
            setError('');
            setSuccess('');
            setShowSSOModal(true);
          }}
          className="btn"
          style={{
            width: '100%',
            padding: '12px 14px',
            fontSize: '0.95rem',
            fontWeight: 600,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            cursor: 'pointer',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
          }}
        >
          {/* Microsoft colored 4-square logo using SVG */}
          <svg width="18" height="18" viewBox="0 0 23 23" fill="none" style={{ flexShrink: 0 }}>
            <rect width="10.5" height="10.5" fill="#F25022"/>
            <rect x="12" width="10.5" height="10.5" fill="#7FBA00"/>
            <rect y="12" width="10.5" height="10.5" fill="#00A4EF"/>
            <rect x="12" y="12" width="10.5" height="10.5" fill="#FFB900"/>
          </svg>
          Đăng nhập bằng Microsoft 365
        </button>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          Hệ thống giám sát vận hành nội bộ IT Core v1.3.0
        </div>
      </div>

      {/* Simulated Microsoft SSO Login Modal */}
      {showSSOModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%',
            maxWidth: '440px',
            background: '#0d1326',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="18" height="18" viewBox="0 0 23 23" fill="none">
                  <rect width="10.5" height="10.5" fill="#F25022"/>
                  <rect x="12" width="10.5" height="10.5" fill="#7FBA00"/>
                  <rect y="12" width="10.5" height="10.5" fill="#00A4EF"/>
                  <rect x="12" y="12" width="10.5" height="10.5" fill="#FFB900"/>
                </svg>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                  Xác thực tài khoản Microsoft 365
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSSOModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginTop: '-8px' }}>
              Nhập email Office 365 doanh nghiệp của bạn. Nếu chưa có tài khoản trên hệ thống, hệ thống sẽ tự động đăng ký và chờ Admin phê duyệt.
            </p>

            <form onSubmit={handleSSOSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Email cơ quan (@mxv.vn) *
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="username@mxv.vn"
                    style={{ paddingLeft: '40px', fontSize: '0.9rem' }}
                    value={ssoEmail}
                    onChange={(e) => setSsoEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Họ và tên hiển thị (Chỉ dùng khi đăng ký mới)
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <UserIcon size={16} />
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nguyễn Văn A (bỏ trống nếu đã có tài khoản)"
                    style={{ paddingLeft: '40px', fontSize: '0.9rem' }}
                    value={ssoFullName}
                    onChange={(e) => setSsoFullName(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div style={{
                background: 'rgba(59, 130, 246, 0.04)',
                border: '1px solid rgba(59, 130, 246, 0.08)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
                display: 'flex',
                gap: '8px'
              }}>
                <Info size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
                <div>
                  Đây là môi trường phát triển nội bộ. Hệ thống sẽ bỏ qua bước MFA và lấy trực tiếp thông tin từ Email để phân tích tạo tài khoản.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowSSOModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  {loading ? 'Đang xác thực...' : 'Đăng Nhập'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
