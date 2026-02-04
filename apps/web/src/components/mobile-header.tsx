'use client';

import { useEffect, useState } from 'react';
import { useMobileNav } from '@/lib/mobile-nav-context';
import { Button } from './ui/button';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface PublicSettings {
  siteName: string;
  logoPath: string | null;
}

export function MobileHeader() {
  const { toggle } = useMobileNav();
  const [branding, setBranding] = useState<PublicSettings>({ siteName: 'VPN Platform', logoPath: null });

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
      <div className="flex items-center gap-2">
        {branding.logoPath && (
          <img
            src={`${API_URL}/settings/logo`}
            alt="Logo"
            className="h-7 w-7 rounded object-contain"
          />
        )}
        <span className="font-semibold">{branding.siteName}</span>
      </div>
    </header>
  );
}
