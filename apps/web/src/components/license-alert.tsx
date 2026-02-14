'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLicense } from '@/lib/license-context';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export function LicenseAlert() {
  const { user } = useAuth();
  const { valid, loading, refresh } = useLicense();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && user && !valid && !dismissed) {
      setOpen(true);
    }
  }, [loading, user, valid, dismissed]);

  // Reset dismissed state if license becomes valid
  useEffect(() => {
    if (valid) {
      setDismissed(false);
      setOpen(false);
    }
  }, [valid]);

  const handleDismiss = () => {
    setOpen(false);
    setDismissed(true);
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setError(null);
    try {
      await api('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });
      await refresh();
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setLicenseKey('');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to activate license');
    } finally {
      setActivating(false);
    }
  };

  if (!user || loading || valid) return null;

  const isAdmin = user.role === 'ADMIN';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <DialogTitle className="text-center">Server Unlicensed</DialogTitle>
          <DialogDescription className="text-center">
            {isAdmin
              ? 'This server does not have a valid license. Enter your license key below to activate, or go to Settings to configure it later.'
              : 'This server does not have a valid license. Please contact your administrator to activate the license.'}
          </DialogDescription>
        </DialogHeader>

        {isAdmin && !success && (
          <div className="space-y-3">
            <div>
              <Input
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Enter license key"
                type="password"
                onKeyDown={(e) => { if (e.key === 'Enter') handleActivate(); }}
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-500/10 px-4 py-3 text-center">
            <p className="text-sm font-medium text-green-500">License activated successfully</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {isAdmin && !success ? (
            <>
              <Button variant="outline" onClick={handleDismiss}>
                Later
              </Button>
              <Button onClick={handleActivate} disabled={activating || !licenseKey.trim()}>
                {activating ? 'Activating...' : 'Activate License'}
              </Button>
            </>
          ) : !success ? (
            <Button variant="outline" onClick={handleDismiss} className="w-full">
              Dismiss
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
