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
  customerEmail: string | null;
  product: string | null;
  initError: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    active: {
      label: 'Active',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    },
    grace_period: {
      label: 'Grace Period',
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    expired: {
      label: 'Expired',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
    unknown: {
      label: 'Invalid',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
  };
  const c = config[status] || { label: 'No License', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400' };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}

function StatusDot({ valid }: { valid: boolean }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${valid ? 'bg-green-500' : 'bg-red-500'}`} />
  );
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
      await api('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });
      await loadLicenseStatus();
      refreshLicense();
      showMessage('License key saved', 'success');
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
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                License
                {licenseStatus && <StatusDot valid={licenseStatus.valid} />}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={loadLicenseStatus} className="text-xs text-muted-foreground">
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {licenseStatus && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <StatusBadge status={licenseStatus.status} />
                </div>
                {licenseStatus.product && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Product</span>
                    <span className="text-sm text-muted-foreground">{licenseStatus.product}</span>
                  </div>
                )}
                {licenseStatus.tier && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Tier</span>
                    <span className="text-sm text-muted-foreground capitalize">{licenseStatus.tier}</span>
                  </div>
                )}
                {licenseStatus.customerEmail && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Customer</span>
                    <span className="text-sm text-muted-foreground">{licenseStatus.customerEmail}</span>
                  </div>
                )}
                {licenseStatus.expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Expires</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(licenseStatus.expiresAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                {licenseStatus.features.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Features</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {licenseStatus.features.map((f) => (
                        <span
                          key={f}
                          className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {licenseStatus.initError && (
                  <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/20 dark:text-red-400">
                    {licenseStatus.initError}
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">License Key</label>
              <div className="flex gap-2">
                <Input
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="Enter license key"
                  type="password"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleActivateLicense(); }}
                />
                <Button onClick={handleActivateLicense} disabled={activatingLicense || !licenseKey.trim()}>
                  {activatingLicense ? 'Activating...' : 'Activate'}
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
