'use client';

import React from 'react';

// Base pulse div
export function Skeleton({
  width = '100%',
  height = '20px',
  borderRadius = '6px',
  style = {},
  className = ''
}: {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes skeleton-shimmer {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.25; }
        }
        .skeleton-pulse-base {
          animation: skeleton-shimmer 1.8s ease-in-out infinite;
          background-color: var(--border-color);
          opacity: 0.85;
        }
        `
      }} />
      <div
        className={`skeleton-pulse-base ${className}`}
        style={{
          width,
          height,
          borderRadius,
          ...style
        }}
      />
    </>
  );
}

// Table rows loading
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {/* Header row */}
      <div style={{ display: 'flex', gap: '16px', padding: '12px 8px', borderBottom: '2px solid var(--border-color)' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} height={24} style={{ flex: i === 1 ? 2 : 1 }} />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`r-${r}`} style={{ display: 'flex', gap: '16px', padding: '16px 8px', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`c-${r}-${c}`} height={20} style={{ flex: c === 1 ? 2 : 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Stats Cards loading
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width="40%" height={16} />
            <Skeleton width="24px" height={24} borderRadius="50%" />
          </div>
          <Skeleton width="60%" height={32} />
          <Skeleton width="80%" height={14} style={{ marginTop: '4px' }} />
        </div>
      ))}
    </div>
  );
}

// Form fields loading
export function FormSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '600px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Skeleton width="100px" height={16} />
        <Skeleton width="100%" height={40} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Skeleton width="120px" height={16} />
        <Skeleton width="100%" height={40} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Skeleton width="80px" height={16} />
        <Skeleton width="100%" height={100} />
      </div>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
        <Skeleton width="100px" height={38} />
        <Skeleton width="120px" height={38} />
      </div>
    </div>
  );
}
