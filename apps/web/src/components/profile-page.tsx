'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiUpload } from '@/lib/api';
import { UserAvatar } from './user-avatar';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function ProfilePage() {
  const { user } = useAuth();
  const [avatarPath, setAvatarPath] = useState<string | null>(user?.avatarPath ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiUpload<{ avatarPath: string }>('/profile/avatar', formData);
      setAvatarPath(result.avatarPath);
    } catch (err: any) {
      setError(err.message || 'Failed to upload avatar');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* Avatar Section */}
      <div className="rounded-xl border border-border/40 bg-card/30 p-6 backdrop-blur-sm">
        <h2 className="mb-4 text-lg font-semibold">Avatar</h2>
        <div className="flex items-center gap-6">
          <UserAvatar
            userId={user.id}
            avatarPath={avatarPath}
            username={user.username}
            size="lg"
          />
          <div className="space-y-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/40 hover:brightness-110 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload new avatar'}
            </button>
            <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* Account Info Section */}
      <div className="rounded-xl border border-border/40 bg-card/30 p-6 backdrop-blur-sm">
        <h2 className="mb-4 text-lg font-semibold">Account Information</h2>
        <dl className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-accent/20 px-4 py-3">
            <dt className="text-sm text-muted-foreground">Username</dt>
            <dd className="text-sm font-medium">{user.username}</dd>
          </div>
          {user.email && (
            <div className="flex items-center justify-between rounded-lg bg-accent/20 px-4 py-3">
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="text-sm font-medium">{user.email}</dd>
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg bg-accent/20 px-4 py-3">
            <dt className="text-sm text-muted-foreground">Role</dt>
            <dd className="text-sm font-medium capitalize">{user.role.toLowerCase()}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
