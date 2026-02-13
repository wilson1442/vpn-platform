'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useMobileNav } from '@/lib/mobile-nav-context';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Resellers', href: '/admin/resellers' },
  { label: 'Users', href: '/admin/users' },
  { label: 'VPN Nodes', href: '/admin/vpn-nodes' },
  { label: 'Packages', href: '/admin/packages' },
  { label: 'Credit Packages', href: '/admin/credit-packages' },
  { label: 'Billing', href: '/admin/billing' },
  { label: 'Payment Gateways', href: '/admin/payment-gateways' },
  { label: 'Audit Log', href: '/admin/audit-log' },
  {
    label: 'Logs',
    href: '/admin/logs',
    children: [
      { label: 'Credit Logs', href: '/admin/logs/credit-logs' },
    ],
  },
  { label: 'Settings', href: '/admin/settings' },
];

const resellerNav: NavItem[] = [
  { label: 'Dashboard', href: '/reseller' },
  { label: 'Sub-Resellers', href: '/reseller/sub-resellers' },
  { label: 'Users', href: '/reseller/users' },
  { label: 'Packages', href: '/reseller/packages' },
  { label: 'Credits', href: '/reseller/credits' },
  { label: 'VPN Nodes', href: '/reseller/vpn-nodes' },
  {
    label: 'Logs',
    href: '/reseller/logs',
    children: [
      { label: 'Credit Logs', href: '/reseller/logs/credit-logs' },
    ],
  },
];

const userNav: NavItem[] = [
  { label: 'Dashboard', href: '/user' },
  { label: 'Configs', href: '/user/configs' },
  { label: 'Sessions', href: '/user/sessions' },
];

interface PublicSettings {
  siteName: string;
  logoPath: string | null;
}

interface VersionInfo {
  version: string;
  commit: string;
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const isChildActive = hasChildren && item.children!.some((c) => pathname === c.href);
  const isActive = pathname === item.href || isChildActive;

  useEffect(() => {
    if (isChildActive) setExpanded(true);
  }, [isChildActive]);

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          'block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
          pathname === item.href ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
        )}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
          isActive ? 'text-accent-foreground' : 'text-muted-foreground',
        )}
      >
        {item.label}
        <svg
          className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {expanded && (
        <div className="ml-3 space-y-1 border-l pl-2">
          {item.children!.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              onClick={onNavigate}
              className={cn(
                'block rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent',
                pathname === child.href ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const { isOpen, close } = useMobileNav();
  const [branding, setBranding] = useState<PublicSettings>({ siteName: 'VPN Platform', logoPath: null });
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/settings/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setBranding(data);
      })
      .catch(() => {});

    fetch(`${API_URL}/settings/version`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setVersionInfo(data);
      })
      .catch(() => {});
  }, []);

  const nav = user?.role === 'ADMIN' ? adminNav : user?.role === 'RESELLER' ? resellerNav : userNav;

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform duration-300 ease-in-out md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            {branding.logoPath && (
              <img
                src={`${API_URL}/settings/logo`}
                alt="Logo"
                className="h-8 w-8 rounded object-contain"
              />
            )}
            <span className="text-lg font-semibold">{branding.siteName}</span>
          </div>
          {/* Close button for mobile */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 md:hidden"
            onClick={close}
            aria-label="Close navigation menu"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={close} />
          ))}
        </nav>
        <div className="border-t p-4">
          {versionInfo && (
            <div className="mb-1 text-xs text-muted-foreground/60">
              <Link href="/changelog" className="hover:text-foreground transition-colors underline">
                Changelog
              </Link>
              <p>v{versionInfo.version}</p>
            </div>
          )}
          <p className="mb-2 text-xs text-muted-foreground">{user?.email}</p>
          <Button variant="outline" size="sm" className="w-full" onClick={logout}>
            Logout
          </Button>
        </div>
      </aside>
    </>
  );
}
