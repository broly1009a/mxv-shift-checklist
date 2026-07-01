'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  department?: {
    _id: string;
    id: string;
    name: string;
    code: string;
  };
  division?: {
    _id: string;
    id: string;
    name: string;
    code: string;
  };
  settings?: {
    theme: 'dark' | 'light';
    autoRefreshInterval: number;
    telegramNotifications: boolean;
    telegramChatId: string;
    alertThresholdMinutes: number;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, pass: string) => Promise<void>;
  loginSSO: (email: string, fullName: string) => Promise<void>;
  logout: () => void;
  updateUser: (updatedUser: User) => void;
  theme: 'light' | 'dark';
  changeTheme: (newTheme: 'light' | 'dark') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<'light' | 'dark'>('dark');
  const router = useRouter();

  const updateUser = useCallback((updatedUser: User) => {
    localStorage.setItem('mxv_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    if (updatedUser.settings?.theme) {
      setThemeState(updatedUser.settings.theme);
      document.documentElement.setAttribute('data-theme', updatedUser.settings.theme);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('mxv_token');
    localStorage.removeItem('mxv_user');
    setToken(null);
    setUser(null);
    setThemeState('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    router.push('/login');
  }, [router]);

  const changeTheme = useCallback(async (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem('mxv_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);

    if (user && token) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            settings: {
              ...user.settings,
              theme: newTheme
            }
          })
        });
        if (res.ok) {
          const updatedUser = await res.json();
          updateUser(updatedUser);
        }
      } catch (err) {
        console.error('Failed to sync theme to DB:', err);
      }
    }
  }, [user, token, updateUser]);

  useEffect(() => {
    // Check if user is authenticated from local storage
    const storedToken = localStorage.getItem('mxv_token');
    const storedUser = localStorage.getItem('mxv_user');
    const storedTheme = localStorage.getItem('mxv_theme') as 'light' | 'dark';

    Promise.resolve().then(() => {
      let activeTheme: 'light' | 'dark' = 'dark';
      
      // Trang đăng nhập hoặc root luôn bắt buộc dùng dark mode
      const isLoginPage = window.location.pathname === '/' || window.location.pathname.startsWith('/login');
      
      if (!isLoginPage) {
        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser) as User;
          setToken(storedToken);
          setUser(parsedUser);
          if (parsedUser.settings?.theme) {
            activeTheme = parsedUser.settings.theme;
          } else if (storedTheme) {
            activeTheme = storedTheme;
          }
        } else if (storedTheme) {
          activeTheme = storedTheme;
        }
      }
      
      setThemeState(activeTheme);
      document.documentElement.setAttribute('data-theme', activeTheme);
      setLoading(false);
    });
  }, []);

  // Global fetch interceptor for 401 errors
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as any).url || '';
        if (
          !url.includes('/api/v1/auth/login') &&
          !url.includes('/api/v1/auth/sso') &&
          !url.includes('/api/v1/auth/register') &&
          !url.includes('/api/v1/auth/exchange-token')
        ) {
          logout();
          // Trả về một Promise không bao giờ resolve/reject để dừng luồng thực thi tiếp theo của hàm fetch (không chạy vào parse JSON hay set state gây crash)
          // đồng thời tránh phát sinh lỗi Unhandled Promise Rejection hiển thị ở UI Dev Overlay của Next.js.
          return new Promise(() => {});
        }
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [logout]);

  const login = async (username: string, pass: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pass }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Đăng nhập thất bại');
      }

      const data = await res.json();
      const tokenVal = data.access_token;
      const userVal = data.user;

      localStorage.setItem('mxv_token', tokenVal);
      localStorage.setItem('mxv_user', JSON.stringify(userVal));

      setToken(tokenVal);
      setUser(userVal);

      // Cập nhật theme theo cấu hình của user vừa đăng nhập
      if (userVal.settings?.theme) {
        setThemeState(userVal.settings.theme);
        document.documentElement.setAttribute('data-theme', userVal.settings.theme);
      } else {
        const storedTheme = localStorage.getItem('mxv_theme') as 'light' | 'dark' || 'dark';
        setThemeState(storedTheme);
        document.documentElement.setAttribute('data-theme', storedTheme);
      }

      setLoading(false);

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const loginSSO = async (email: string, fullName: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/sso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Đăng nhập AD thất bại');
      }

      const data = await res.json();
      const tokenVal = data.access_token;
      const userVal = data.user;

      localStorage.setItem('mxv_token', tokenVal);
      localStorage.setItem('mxv_user', JSON.stringify(userVal));

      setToken(tokenVal);
      setUser(userVal);

      // Cập nhật theme theo cấu hình của user vừa đăng nhập
      if (userVal.settings?.theme) {
        setThemeState(userVal.settings.theme);
        document.documentElement.setAttribute('data-theme', userVal.settings.theme);
      } else {
        const storedTheme = localStorage.getItem('mxv_theme') as 'light' | 'dark' || 'dark';
        setThemeState(storedTheme);
        document.documentElement.setAttribute('data-theme', storedTheme);
      }

      setLoading(false);

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };



  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginSSO, logout, updateUser, theme, changeTheme }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
