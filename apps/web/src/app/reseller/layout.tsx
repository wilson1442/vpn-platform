'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLicense } from '@/lib/license-context';
import { MobileNavProvider } from '@/lib/mobile-nav-context';
import { Sidebar } from '@/components/sidebar';
import { MobileHeader } from '@/components/mobile-header';
import { DesktopHeader } from '@/components/desktop-header';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { LicenseAlert } from '@/components/license-alert';
import { LicenseBanner } from '@/components/license-banner';

export default function ResellerLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { hasFeature, loading: licenseLoading } = useLicense();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'RESELLER')) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || licenseLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <span className="text-xs text-muted-foreground font-mono">Loading...</span>
        </div>
      </div>
    );
  }

  if (!hasFeature('resellers')) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/20">
            <svg className="h-7 w-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="mb-2 font-heading text-2xl font-bold">Feature Not Available</h1>
          <p className="text-muted-foreground">
            The reseller feature requires a VPN Pro license. Please contact your administrator.
          </p>
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
            <main className="relative flex-1 overflow-auto bg-dots p-4 md:p-6 lg:p-8">
              <div className="relative z-10">{children}</div>
            </main>
          </div>
        </div>
        <LicenseAlert />
      </div>
    </MobileNavProvider>
  );
}
