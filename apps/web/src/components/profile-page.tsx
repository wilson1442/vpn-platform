'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiUpload } from '@/lib/api';
import { UserAvatar } from './user-avatar';
import { Upload, User, Mail, Shield } from 'lucide-react';

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
      <h1 className="font-heading text-2xl font-bold text-gradient bg-gradient-to-r from-cyan-400 to-teal-400">Profile</h1>

      {/* Avatar Section */}
      <div className="rounded-xl border border-border/30 bg-card/40 p-6 backdrop-blur-sm">
        <h2 className="mb-4 font-heading text-base font-semibold text-foreground/90">Avatar</h2>
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
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/15 transition-all hover:shadow-cyan-500/25 hover:brightness-110 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? 'Uploading...' : 'Upload new avatar'}
            </button>
            <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
            {error && <p className="text-xs text-rose-400">{error}</p>}
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
      <div className="rounded-xl border border-border/30 bg-card/40 p-6 backdrop-blur-sm">
        <h2 className="mb-4 font-heading text-base font-semibold text-foreground/90">Account Information</h2>
        <dl className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-border/20 px-4 py-3">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              Username
            </dt>
            <dd className="text-sm font-medium font-mono">{user.username}</dd>
          </div>
          {user.email && (
            <div className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-border/20 px-4 py-3">
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                Email
              </dt>
              <dd className="text-sm font-medium">{user.email}</dd>
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-border/20 px-4 py-3">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              Role
            </dt>
            <dd className="text-sm font-medium capitalize">{user.role.toLowerCase()}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
