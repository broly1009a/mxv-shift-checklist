'use client';

import React from 'react';
import { TkgdDashboard } from '@/features/tkgd';

/**
 * Route page: /admin/tkgd-dashboard
 * Cho phép truy cập trực tiếp (hỗ trợ cả Guest và Authenticated user)
 * Module hoá kết nối đến hệ thống đối soát TKGD độc lập (src/features/tkgd).
 */
export default function TkgdDashboardPage() {
  return <TkgdDashboard />;
}
