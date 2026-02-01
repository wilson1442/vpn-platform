'use client';

import { useEffect, useState } from 'react';
import { api, apiRaw, apiUpload } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Settings {
  siteName: string;
  logoPath: string | null;
  licenseKey: string | null;
  githubRepo: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [siteName, setSiteName] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{ behindBy: number; currentCommit: string; remoteCommit: string } | null>(null);
  const [updateOutput, setUpdateOutput] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = () =>
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

  useEffect(() => {
    load();
  }, []);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ siteName, licenseKey, githubRepo }),
      });
      showMessage('Settings saved', 'success');
      load();
    } catch (err: any) {
      showMessage(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
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

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateStatus(null);
    setUpdateOutput(null);
    try {
      const result = await api<{ behindBy: number; currentCommit: string; remoteCommit: string }>('/settings/update/check', {
        method: 'POST',
      });
      setUpdateStatus(result);
      if (result.behindBy === 0) {
        showMessage('Already up to date', 'success');
      } else {
        showMessage(`${result.behindBy} update(s) available`, 'success');
      }
    } catch (err: any) {
      showMessage(err.message || 'Failed to check for updates', 'error');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!window.confirm('Apply update? The server may need to be restarted afterward.')) return;
    setApplyingUpdate(true);
    setUpdateOutput(null);
    try {
      const result = await api<{ output: string }>('/settings/update/apply', { method: 'POST' });
      setUpdateOutput(result.output);
      showMessage('Update applied', 'success');
      setUpdateStatus(null);
    } catch (err: any) {
      showMessage(err.message || 'Failed to apply update', 'error');
    } finally {
      setApplyingUpdate(false);
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
            <CardTitle>License Key</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="Enter license key"
              type="password"
            />
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
            <CardTitle>Updates</CardTitle>
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
            <div className="flex gap-2">
              <Button onClick={handleCheckUpdates} disabled={checkingUpdates} variant="outline">
                {checkingUpdates ? 'Checking...' : 'Check for Updates'}
              </Button>
              {updateStatus && updateStatus.behindBy > 0 && (
                <Button onClick={handleApplyUpdate} disabled={applyingUpdate}>
                  {applyingUpdate ? 'Applying...' : `Apply Update (${updateStatus.behindBy} commit${updateStatus.behindBy > 1 ? 's' : ''})`}
                </Button>
              )}
            </div>
            {updateStatus && (
              <div className="rounded-md border p-3 text-sm">
                <p>Current: <code className="text-xs">{updateStatus.currentCommit.slice(0, 8)}</code></p>
                <p>Remote: <code className="text-xs">{updateStatus.remoteCommit.slice(0, 8)}</code></p>
                <p>Behind by: {updateStatus.behindBy} commit(s)</p>
              </div>
            )}
            {updateOutput && (
              <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">{updateOutput}</pre>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
