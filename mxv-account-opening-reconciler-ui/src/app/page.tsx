'use client';

import React from 'react';
import { TkgdDashboard } from '@/features/tkgd';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function HomePage() {
  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-[#090e1a]">
        <TkgdDashboard />
      </main>
    </ProtectedRoute>
  );
}
