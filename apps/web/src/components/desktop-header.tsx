'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { UserAvatar } from './user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function DesktopHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const rolePrefix = user.role === 'ADMIN' ? '/admin' : user.role === 'RESELLER' ? '/reseller' : '/user';

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="hidden h-16 shrink-0 items-center justify-end border-b border-border/20 bg-background/50 backdrop-blur-sm px-6 md:flex">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 rounded-full px-2 py-1.5 outline-none ring-offset-background transition-all duration-200 hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <UserAvatar
              userId={user.id}
              avatarPath={user.avatarPath}
              username={user.username}
              size="sm"
            />
            <span className="text-sm font-medium">{user.username}</span>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.username}</p>
              {user.email && (
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`${rolePrefix}/profile`} className="cursor-pointer">
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-rose-400 focus:text-rose-400">
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
