'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLicense } from '@/lib/license-context';
import { useMobileNav } from '@/lib/mobile-nav-context';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Server,
  Wifi,
  Package,
  Coins,
  Receipt,
  Landmark,
  ScrollText,
  FolderOpen,
  Settings,
  FileKey,
  Activity,
  type LucideIcon,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  feature?: string;
  children?: NavItem[];
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Resellers', href: '/admin/resellers', icon: Users, feature: 'resellers' },
  { label: 'Users', href: '/admin/users', icon: UserCircle },
  { label: 'VPN Nodes', href: '/admin/vpn-nodes', icon: Server },
  { label: 'Connections', href: '/admin/connections', icon: Wifi },
  { label: 'Packages', href: '/admin/packages', icon: Package },
  { label: 'Credit Packages', href: '/admin/credit-packages', icon: Coins, feature: 'resellers' },
  { label: 'Billing', href: '/admin/billing', icon: Receipt },
  { label: 'Payment Gateways', href: '/admin/payment-gateways', icon: Landmark },
  { label: 'Audit Log', href: '/admin/audit-log', icon: ScrollText },
  {
    label: 'Logs',
    href: '/admin/logs',
    icon: FolderOpen,
    feature: 'resellers',
    children: [
      { label: 'Credit Logs', href: '/admin/logs/credit-logs' },
      { label: 'User Logs', href: '/admin/logs/user-logs' },
    ],
  },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

const resellerNav: NavItem[] = [
  { label: 'Dashboard', href: '/reseller', icon: LayoutDashboard },
  { label: 'Sub-Resellers', href: '/reseller/sub-resellers', icon: Users },
  { label: 'Users', href: '/reseller/users', icon: UserCircle },
  { label: 'Packages', href: '/reseller/packages', icon: Package },
  { label: 'Credits', href: '/reseller/credits', icon: Coins },
  { label: 'VPN Nodes', href: '/reseller/vpn-nodes', icon: Server },
  {
    label: 'Logs',
    href: '/reseller/logs',
    icon: FolderOpen,
    children: [
      { label: 'Credit Logs', href: '/reseller/logs/credit-logs' },
      { label: 'User Logs', href: '/reseller/logs/user-logs' },
    ],
  },
];

const userNav: NavItem[] = [
  { label: 'Dashboard', href: '/user', icon: LayoutDashboard },
  { label: 'Configs', href: '/user/configs', icon: FileKey },
  { label: 'Sessions', href: '/user/sessions', icon: Activity },
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

  const Icon = item.icon;

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
          pathname === item.href
            ? 'bg-gradient-to-r from-indigo-500/15 to-blue-500/10 text-indigo-400 shadow-sm shadow-indigo-500/5'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
      >
        {pathname === item.href && (
          <span className="absolute left-0 h-6 w-0.5 rounded-full bg-indigo-500" />
        )}
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        {item.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
          isActive
            ? 'text-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
      >
        <span className="flex items-center gap-3">
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          {item.label}
        </span>
        <svg
          className={cn('h-4 w-4 transition-transform duration-200', expanded && 'rotate-90')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <div className={cn(
        'ml-3 space-y-0.5 overflow-hidden border-l border-border/40 pl-3 transition-all duration-200',
        expanded ? 'mt-1 max-h-96 opacity-100' : 'max-h-0 opacity-0',
      )}>
        {item.children!.map((child) => (
          <Link
            key={child.href}
            href={child.href}
            onClick={onNavigate}
            className={cn(
              'block rounded-lg px-3 py-2 text-sm transition-all duration-200',
              pathname === child.href
                ? 'bg-indigo-500/10 text-indigo-400 font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            {child.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const { hasFeature } = useLicense();
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

  const rawNav = user?.role === 'ADMIN' ? adminNav : user?.role === 'RESELLER' ? resellerNav : userNav;
  const nav = rawNav.filter(item => !item.feature || hasFeature(item.feature));

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border/40 bg-background/80 backdrop-blur-xl transition-transform duration-300 ease-in-out md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-border/40 px-5">
          <div className="flex items-center gap-3">
            {branding.logoPath ? (
              <img
                src={`${API_URL}/settings/logo`}
                alt="Logo"
                className="h-16 w-16 rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/20">
                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            )}
            <span className="text-base font-bold tracking-tight">{branding.siteName}</span>
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

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={close} />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/40 p-4">
          {versionInfo && (
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground/60">
              <Link href="/changelog" className="hover:text-indigo-400 transition-colors">
                v{versionInfo.version}
              </Link>
            </div>
          )}
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-blue-500/20 text-xs font-bold text-indigo-400">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium">{user?.username}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={logout}>
            Log out
          </Button>
        </div>
      </aside>
    </>
  );
}
