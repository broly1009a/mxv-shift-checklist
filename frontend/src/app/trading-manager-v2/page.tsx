'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TradingManagerV2RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/trading-manager');
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-300">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="text-sm font-medium">Đang chuyển hướng tới Trading Manager chính thức...</p>
      </div>
    </div>
  );
}
