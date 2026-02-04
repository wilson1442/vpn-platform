'use client';

import { useAuth } from '@/lib/auth-context';
import { Button } from './ui/button';

export function ImpersonationBanner() {
  const { user, isImpersonating, stopImpersonating } = useAuth();

  if (!isImpersonating || !user) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm text-amber-950">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-medium">
          Viewing as: {user.username} ({user.role})
        </span>
        <span className="text-amber-800">
          Logged in as: {user.impersonatedByEmail}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="border-amber-700 bg-amber-600 text-amber-50 hover:bg-amber-700 hover:text-white"
        onClick={stopImpersonating}
      >
        Return to Admin Account
      </Button>
    </div>
  );
}
