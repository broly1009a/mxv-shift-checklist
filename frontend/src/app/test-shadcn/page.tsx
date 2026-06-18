'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Shield, Sparkles, ArrowRight } from 'lucide-react';

export default function TestShadcnPage() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #111b36 0%, #060a13 100%)',
      padding: '20px',
      color: '#fff',
      flexDirection: 'column',
      gap: '24px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '500px',
        padding: '40px 32px',
        textAlign: 'center',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div>
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
            <Sparkles size={32} color="#3b82f6" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: '6px' }}>
            Shadcn UI Test
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Kiểm tra hiển thị các component Shadcn UI với Tailwind CSS v4
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              BUTTON VARIANTS:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <Button variant="default">Default Button</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              BUTTON SIZES:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <Button size="xs" variant="default">Extra Small</Button>
              <Button size="sm" variant="default">Small</Button>
              <Button size="default" variant="default">Default size</Button>
              <Button size="lg" variant="default">Large size</Button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '10px' }}>
          <Link href="/login" style={{ flex: 1, textDecoration: 'none' }}>
            <Button variant="outline" className="w-full" style={{ width: '100%', justifyContent: 'center' }}>
              Quay lại Đăng nhập
            </Button>
          </Link>
          <Link href="/dashboard" style={{ flex: 1, textDecoration: 'none' }}>
            <Button variant="default" className="w-full" style={{ width: '100%', justifyContent: 'center' }}>
              Bảng điều khiển <ArrowRight className="ml-1" size={16} />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
