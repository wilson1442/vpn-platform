'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { MobileNavProvider } from '@/lib/mobile-nav-context';
import { Sidebar } from '@/components/sidebar';
import { MobileHeader } from '@/components/mobile-header';
import { DesktopHeader } from '@/components/desktop-header';
import { ImpersonationBanner } from '@/components/impersonation-banner';

export default function ResellerLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'RESELLER')) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <MobileNavProvider>
      <div className="flex h-screen flex-col">
        <ImpersonationBanner />
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <MobileHeader />
            <DesktopHeader />
            <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
          </div>
        </div>
      </div>
    </MobileNavProvider>
  );
}
