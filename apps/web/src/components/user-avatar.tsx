'use client';

import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface UserAvatarProps {
  userId?: string;
  avatarPath?: string | null;
  username?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-20 w-20 text-2xl',
};

export function UserAvatar({ userId, avatarPath, username, size = 'md', className }: UserAvatarProps) {
  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : '?';

  if (avatarPath && userId) {
    return (
      <img
        src={`${API_URL}/profile/avatar/${userId}?v=${encodeURIComponent(avatarPath)}`}
        alt={username || 'Avatar'}
        className={cn(
          'rounded-full object-cover',
          sizeClasses[size],
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-primary/10 font-medium text-primary',
        sizeClasses[size],
        className,
      )}
    >
      {initials}
    </div>
  );
}
