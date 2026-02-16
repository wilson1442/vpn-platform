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
  ScrollText,
  FolderOpen,
  Settings,
  FileKey,
  Activity,
  Mail,
  LogOut,
  ChevronRight,
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
  { label: 'Email Templates', href: '/admin/email-templates', icon: Mail },
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
          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
          pathname === item.href
            ? 'bg-cyan-500/8 text-cyan-400'
            : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground',
        )}
      >
        {pathname === item.href && (
          <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-cyan-500" />
        )}
        {Icon && <Icon className="h-[15px] w-[15px] shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />}
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
          isActive
            ? 'text-foreground'
            : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground',
        )}
      >
        <span className="flex items-center gap-3">
          {Icon && <Icon className="h-[15px] w-[15px] shrink-0 opacity-70" />}
          {item.label}
        </span>
        <ChevronRight
          className={cn('h-3.5 w-3.5 transition-transform duration-200', expanded && 'rotate-90')}
        />
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
              'block rounded-md px-3 py-1.5 text-[13px] transition-all duration-200',
              pathname === child.href
                ? 'bg-cyan-500/8 text-cyan-400 font-medium'
                : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground',
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
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border/30 bg-[hsl(228_20%_3.5%)]/95 backdrop-blur-xl transition-transform duration-300 ease-in-out md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center justify-between border-b border-border/20 px-4">
          <div className="flex items-center gap-2.5">
            {branding.logoPath ? (
              <img
                src={`${API_URL}/settings/logo`}
                alt="Logo"
                className="h-14 w-14 rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/15">
                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            )}
            <span className="font-heading text-sm font-semibold tracking-tight text-foreground/90">{branding.siteName}</span>
          </div>
          {/* Close button for mobile */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 md:hidden"
            onClick={close}
            aria-label="Close navigation menu"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2.5">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={close} />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/20 p-3">
          {versionInfo && (
            <div className="mb-2 flex items-center gap-2">
              <Link href="/changelog" className="font-mono text-[10px] text-muted-foreground/40 hover:text-cyan-400 transition-colors">
                v{versionInfo.version}
              </Link>
            </div>
          )}
          <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-white/[0.02] px-2.5 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-cyan-500/15 to-teal-500/15 text-[11px] font-bold text-cyan-400 ring-1 ring-cyan-500/10">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[13px] font-medium text-foreground/80">{user?.username}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border/30 bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-all hover:bg-white/[0.04] hover:text-foreground"
          >
            <LogOut className="h-3 w-3" />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
