'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLicense } from '@/lib/license-context';
import Link from 'next/link';

function formatCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

export function LicenseBanner() {
  const { user } = useAuth();
  const { status, loading, locked, gracePeriodEndsAt } = useLicense();
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!gracePeriodEndsAt) return;
    setCountdown(formatCountdown(gracePeriodEndsAt));
    const interval = setInterval(() => {
      setCountdown(formatCountdown(gracePeriodEndsAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [gracePeriodEndsAt]);

  if (loading || !user || status === 'active' || locked || !gracePeriodEndsAt) return null;

  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span className="text-amber-600 dark:text-amber-400">
          License invalid &mdash; <strong>{countdown}</strong> remaining before panel lockout
        </span>
      </div>
      {isAdmin ? (
        <Link href="/admin/settings" className="shrink-0 text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 font-medium underline underline-offset-2">
          Go to Settings
        </Link>
      ) : (
        <span className="shrink-0 text-amber-600/70 dark:text-amber-400/70">Contact your administrator</span>
      )}
    </div>
  );
}
