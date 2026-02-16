'use client';

import { useAuth } from '@/lib/auth-context';
import { Button } from './ui/button';

export function ImpersonationBanner() {
  const { user, isImpersonating, stopImpersonating } = useAuth();

  if (!isImpersonating || !user) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm text-white shadow-lg shadow-amber-500/20">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-medium">
          Viewing as: {user.username} ({user.role})
        </span>
        <span className="text-amber-100">
          Logged in as: {user.impersonatedByEmail}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        onClick={stopImpersonating}
      >
        Return to Admin Account
      </Button>
    </div>
  );
}
