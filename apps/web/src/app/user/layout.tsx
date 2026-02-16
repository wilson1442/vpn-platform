'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { MobileNavProvider } from '@/lib/mobile-nav-context';
import { Sidebar } from '@/components/sidebar';
import { MobileHeader } from '@/components/mobile-header';
import { DesktopHeader } from '@/components/desktop-header';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { LicenseAlert } from '@/components/license-alert';
import { LicenseBanner } from '@/components/license-banner';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <MobileNavProvider>
      <div className="flex h-screen flex-col bg-background">
        <ImpersonationBanner />
        <LicenseBanner />
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <MobileHeader />
            <DesktopHeader />
            <main className="flex-1 overflow-auto bg-dots p-4 md:p-6 lg:p-8">{children}</main>
          </div>
        </div>
        <LicenseAlert />
      </div>
    </MobileNavProvider>
  );
}
