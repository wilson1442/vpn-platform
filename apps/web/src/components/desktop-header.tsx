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
    <header className="hidden h-14 shrink-0 items-center justify-end border-b bg-background px-4 md:flex md:px-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <UserAvatar
              userId={user.id}
              avatarPath={user.avatarPath}
              username={user.username}
              size="sm"
            />
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
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
