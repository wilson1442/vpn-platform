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
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border/20 bg-background/80 backdrop-blur-xl px-4 md:hidden">
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
        {branding.logoPath ? (
          <img
            src={`${API_URL}/settings/logo`}
            alt="Logo"
            className="h-7 w-7 rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600">
            <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        )}
        <span className="font-bold tracking-tight">{branding.siteName}</span>
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
