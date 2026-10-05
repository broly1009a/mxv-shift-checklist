'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface User {
  id: string;
  username: string;
  email?: string;
  fullName: string;
  title?: string;
  role: string;
  department?: {
    _id: string;
    id: string;
    name: string;
    code: string;
  };
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, pass: string) => Promise<void>;
  logout: () => void;
  updateUser: (updatedUser: User) => void;
  theme: 'light' | 'dark';
  changeTheme: (newTheme: 'light' | 'dark') => Promise<void>;
}

export const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    // Trong môi trường production trên trình duyệt, luôn dùng relative path ""
    // để tự động tương thích với mọi host/port (localhost:8080 qua SSH tunnel, IP 10.1.0.16, hay domain)
    if (process.env.NODE_ENV === 'production') {
      return '';
    }
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
})();

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('mxv_tkgd_token') || localStorage.getItem('token');
      const storedUser = localStorage.getItem('mxv_tkgd_user') || localStorage.getItem('user');
      if (storedToken) setToken(storedToken);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        setUser({
          id: 'tkgd-admin-1',
          username: 'ttbt.admin',
          email: 'hieptruong@mxv.vn',
          fullName: 'Cán bộ Thanh Toán Bù Trừ (TTBT)',
          role: 'ADMIN',
          department: {
            _id: 'dept-ttbt',
            id: 'dept-ttbt',
            name: 'Thanh toán bù trừ',
            code: 'TTBT',
          },
        });
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (username: string) => {
    const dummyUser: User = {
      id: 'tkgd-admin-1',
      username,
      email: 'hieptruong@mxv.vn',
      fullName: 'Cán bộ TTBT',
      role: 'ADMIN',
    };
    setUser(dummyUser);
    setToken('mock-jwt-token-tkgd');
    localStorage.setItem('mxv_tkgd_user', JSON.stringify(dummyUser));
    localStorage.setItem('mxv_tkgd_token', 'mock-jwt-token-tkgd');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('mxv_tkgd_user');
    localStorage.removeItem('mxv_tkgd_token');
  };

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('mxv_tkgd_user', JSON.stringify(updatedUser));
  }, []);

  const changeTheme = async (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        updateUser,
        theme,
        changeTheme,
      }}
    >
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
