'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMobileNav } from '@/lib/mobile-nav-context';
import { useAuth } from '@/lib/auth-context';
import { Button } from './ui/button';
import { UserAvatar } from './user-avatar';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface PublicSettings {
  siteName: string;
  logoPath: string | null;
}

export function MobileHeader() {
  const { toggle } = useMobileNav();
  const { user } = useAuth();
  const [branding, setBranding] = useState<PublicSettings>({ siteName: 'VPN Platform', logoPath: null });

  const rolePrefix = user?.role === 'ADMIN' ? '/admin' : user?.role === 'RESELLER' ? '/reseller' : '/user';

  useEffect(() => {
    fetch(`${API_URL}/settings/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setBranding(data);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden">
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0"
        onClick={toggle}
        aria-label="Toggle navigation menu"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </Button>
      <div className="flex flex-1 items-center gap-2">
        {branding.logoPath && (
          <img
            src={`${API_URL}/settings/logo`}
            alt="Logo"
            className="h-7 w-7 rounded object-contain"
          />
        )}
        <span className="font-semibold">{branding.siteName}</span>
      </div>
      {user && (
        <Link href={`${rolePrefix}/profile`}>
          <UserAvatar
            userId={user.id}
            avatarPath={user.avatarPath}
            username={user.username}
            size="sm"
          />
        </Link>
      )}
    </header>
  );
}
