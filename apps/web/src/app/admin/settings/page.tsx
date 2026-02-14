'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, apiRaw, apiUpload } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { UpdateWizard } from '@/components/update-wizard';
import { useLicense } from '@/lib/license-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Settings {
  siteName: string;
  logoPath: string | null;
  licenseKey: string | null;
  githubRepo: string;
}

interface LicenseStatus {
  valid: boolean;
  status: string;
  tier: string | null;
  expiresAt: string | null;
  features: string[];
  product: string | null;
  initError: string | null;
  gracePeriodEndsAt: string | null;
  locked: boolean;
}

function LicenseStatusIcon({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
        <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
    );
  }
  if (status === 'grace_period') {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
        <svg className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
  }
  if (status === 'expired') {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
        <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
    );
  }
  // no_license / unknown / suspended
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-500/10">
      <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    </div>
  );
}

function LicenseStatusLabel({ status }: { status: string }) {
  const config: Record<string, { label: string; description: string; color: string }> = {
    active: { label: 'Licensed', description: 'Your license is active and valid', color: 'text-green-500' },
    grace_period: { label: 'Grace Period', description: 'License is in grace period — please renew soon', color: 'text-yellow-500' },
    expired: { label: 'Expired', description: 'Your license has expired', color: 'text-red-500' },
    suspended: { label: 'Suspended', description: 'Your license has been suspended', color: 'text-red-500' },
    no_license: { label: 'Unlicensed', description: 'No license key has been activated', color: 'text-zinc-400' },
  };
  const c = config[status] || { label: 'Invalid', description: 'License validation failed', color: 'text-red-500' };

  return (
    <div>
      <p className={`text-lg font-semibold ${c.color}`}>{c.label}</p>
      <p className="text-sm text-muted-foreground">{c.description}</p>
    </div>
  );
}

function maskLicenseKey(key: string) {
  if (key.length <= 8) return '****';
  return key.slice(0, 3) + '-' + '*'.repeat(4) + '-' + '*'.repeat(4) + '-' + key.slice(-4);
}

export default function SettingsPage() {
  const { refresh: refreshLicense } = useLicense();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [siteName, setSiteName] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [activatingLicense, setActivatingLicense] = useState(false);

  const loadLicenseStatus = useCallback(() =>
    api<LicenseStatus>('/license/status')
      .then((data) => setLicenseStatus(data))
      .catch(() => {}),
  []);

  const load = useCallback(() => {
    api<Settings>('/settings')
      .then((data) => {
        setSettings(data);
        setSiteName(data.siteName);
        setLicenseKey(data.licenseKey || '');
        setGithubRepo(data.githubRepo || '');
        if (data.logoPath) {
          setLogoPreview(`${API_URL}/settings/logo`);
        }
        setLoadError(null);
      })
      .catch((err) => {
        setLoadError(err.message || 'Failed to load settings');
      });
    loadLicenseStatus();
  }, [loadLicenseStatus]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll license status every 30 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(loadLicenseStatus, 30000);
    return () => clearInterval(interval);
  }, [loadLicenseStatus]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ siteName, githubRepo }),
      });
      showMessage('Settings saved', 'success');
      load();
    } catch (err: any) {
      showMessage(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleActivateLicense = async () => {
    if (!licenseKey.trim()) return;
    setActivatingLicense(true);
    try {
      const result = await api<{ licenseStatus?: LicenseStatus }>('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });
      await loadLicenseStatus();
      refreshLicense();
      if (result.licenseStatus?.valid) {
        showMessage('License activated successfully', 'success');
      } else {
        const err = result.licenseStatus?.initError || 'License validation failed';
        showMessage(err, 'error');
      }
    } catch (err: any) {
      showMessage(err.message || 'Failed to save license key', 'error');
    } finally {
      setActivatingLicense(false);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', logoFile);
      await apiUpload('/settings/logo', formData);
      showMessage('Logo uploaded', 'success');
      setLogoFile(null);
      load();
    } catch (err: any) {
      showMessage(err.message || 'Failed to upload logo', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleBackup = async () => {
    setDownloadingBackup(true);
    try {
      const resp = await apiRaw('/settings/backup', { method: 'POST' });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = resp.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] || 'backup.sql';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showMessage('Backup downloaded', 'success');
    } catch (err: any) {
      showMessage(err.message || 'Failed to create backup', 'error');
    } finally {
      setDownloadingBackup(false);
    }
  };

  if (!settings) {
    if (loadError) {
      return <div className="text-red-600 dark:text-red-400">{loadError}</div>;
    }
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Settings</h1>

      {message && (
        <div
          className={`mb-4 rounded-md px-4 py-2 text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-400' : 'bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Site Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Logo</label>
              <div className="flex items-center gap-4">
                {logoPreview && (
                  <img src={logoPreview} alt="Logo preview" className="h-12 w-12 rounded object-contain border" />
                )}
                <Input type="file" accept="image/*" onChange={handleLogoSelect} />
                <Button onClick={handleLogoUpload} disabled={!logoFile || uploadingLogo}>
                  {uploadingLogo ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Site Name</label>
              <div className="flex gap-2">
                <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="VPN Platform" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>License</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Status banner */}
            {licenseStatus && (
              <div className={`rounded-lg border p-4 ${
                licenseStatus.status === 'active'
                  ? 'border-green-500/20 bg-green-500/5'
                  : licenseStatus.status === 'grace_period'
                    ? 'border-yellow-500/20 bg-yellow-500/5'
                    : licenseStatus.status === 'expired' || licenseStatus.status === 'suspended'
                      ? 'border-red-500/20 bg-red-500/5'
                      : 'border-zinc-500/20 bg-zinc-500/5'
              }`}>
                <div className="flex items-center gap-4">
                  <LicenseStatusIcon status={licenseStatus.status} />
                  <LicenseStatusLabel status={licenseStatus.status} />
                </div>

                {/* Error message */}
                {licenseStatus.initError && (
                  <div className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">
                    {licenseStatus.initError}
                  </div>
                )}

                {/* Grace period warning */}
                {licenseStatus.status !== 'active' && licenseStatus.gracePeriodEndsAt && (
                  <div className={`mt-3 rounded-md px-3 py-2 text-sm ${
                    licenseStatus.locked
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {licenseStatus.locked
                      ? 'Panel is locked. Enter a valid license key below to unlock.'
                      : `Panel will lock on ${new Date(licenseStatus.gracePeriodEndsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}
                  </div>
                )}
              </div>
            )}

            {/* License details grid */}
            {licenseStatus && licenseStatus.status !== 'no_license' && (
              <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                {settings?.licenseKey && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">License Key</p>
                    <p className="mt-1 font-mono text-sm">{maskLicenseKey(settings.licenseKey)}</p>
                  </div>
                )}
                {licenseStatus.product && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Product</p>
                    <p className="mt-1 text-sm">{licenseStatus.product}</p>
                  </div>
                )}
                {licenseStatus.tier && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tier</p>
                    <p className="mt-1 text-sm capitalize">{licenseStatus.tier}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Expires</p>
                  <p className="mt-1 text-sm">
                    {licenseStatus.expiresAt
                      ? new Date(licenseStatus.expiresAt).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })
                      : 'Never'}
                  </p>
                </div>
                {licenseStatus.features.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Features</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {licenseStatus.features.map((f) => (
                        <span
                          key={f}
                          className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Activation input */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                {licenseStatus?.status === 'no_license' ? 'Activate License' : 'Change License Key'}
              </label>
              <div className="flex gap-2">
                <Input
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="LF-XXXX-XXXX-XXXX-XXXX"
                  type="password"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleActivateLicense(); }}
                />
                <Button onClick={handleActivateLicense} disabled={activatingLicense || !licenseKey.trim()}>
                  {activatingLicense ? 'Validating...' : 'Activate'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Backup</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Download a full SQL dump of the database.
            </p>
            <Button onClick={handleBackup} disabled={downloadingBackup}>
              {downloadingBackup ? 'Downloading...' : 'Download Backup'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">GitHub Repository URL</label>
              <Input
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="https://github.com/user/repo"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Check for and install system updates from GitHub.
            </p>
            <Button onClick={() => setUpdateDialogOpen(true)}>
              Manage Updates
            </Button>
          </CardContent>
        </Card>

        <UpdateWizard open={updateDialogOpen} onOpenChange={setUpdateDialogOpen} />

        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
