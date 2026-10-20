'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TradingManagerBackupIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/trading-manager/backup/ms-cqg');
  }, [router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-muted)' }}>
      <span>Đang chuyển hướng tới Sao lưu MS – CQG...</span>
    </div>
  );
}
