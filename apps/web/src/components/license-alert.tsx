'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLicense } from '@/lib/license-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LicenseAlert() {
  const { user } = useAuth();
  const { locked, loading, refresh } = useLicense();
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setError(null);
    try {
      const result = await api<{ licenseStatus?: { valid: boolean; initError: string | null } }>('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });
      await refresh();
      if (result.licenseStatus?.valid) {
        setSuccess(true);
        setLicenseKey('');
      } else {
        setError(result.licenseStatus?.initError || 'License validation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to activate license');
    } finally {
      setActivating(false);
    }
  };

  // Only render when locked
  if (!user || loading || !locked) return null;

  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-lg">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Panel Locked</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAdmin
              ? 'The license grace period has expired. Enter a valid license key to unlock the panel.'
              : 'The license grace period has expired. Please contact your administrator to unlock the panel.'}
          </p>
        </div>

        {isAdmin && !success && (
          <div className="space-y-3">
            <Input
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="LF-XXXX-XXXX-XXXX-XXXX"
              type="password"
              onKeyDown={(e) => { if (e.key === 'Enter') handleActivate(); }}
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button onClick={handleActivate} disabled={activating || !licenseKey.trim()} className="w-full">
              {activating ? 'Activating...' : 'Activate License'}
            </Button>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-500/10 px-4 py-3 text-center">
            <p className="text-sm font-medium text-green-500">License activated successfully. Unlocking...</p>
          </div>
        )}
      </div>
    </div>
  );
}
