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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const logout = useCallback(() => {
    localStorage.removeItem('mxv_token');
    localStorage.removeItem('mxv_user');
    setToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  useEffect(() => {
    // Check if user is authenticated from local storage
    const storedToken = localStorage.getItem('mxv_token');
    const storedUser = localStorage.getItem('mxv_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
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
          !url.includes('/api/v1/auth/register')
        ) {
          logout();
          throw new Error('Unauthorized'); // Chặn không cho code tiếp tục chạy vào phần parse JSON/set state để tránh crash trang
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
      setLoading(false);

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };



  const updateUser = (updatedUser: User) => {
    localStorage.setItem('mxv_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginSSO, logout, updateUser }}>
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
