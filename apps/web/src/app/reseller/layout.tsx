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
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!hasFeature('resellers')) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold">Feature Not Available</h1>
          <p className="text-muted-foreground">
            The reseller feature requires a VPN Pro license. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MobileNavProvider>
      <div className="flex h-screen flex-col">
        <ImpersonationBanner />
        <LicenseBanner />
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <MobileHeader />
            <DesktopHeader />
            <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
          </div>
        </div>
        <LicenseAlert />
      </div>
    </MobileNavProvider>
  );
}
