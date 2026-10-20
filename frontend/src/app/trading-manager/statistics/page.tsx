'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StatisticsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/trading-manager/statistics/ms');
  }, [router]);

  return null;
}
