'use client';

import { useEffect, useState } from 'react';
import { api, apiRaw } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Certificate {
  id: string;
  commonName: string;
  createdAt: string;
}

interface VpnNode {
  id: string;
  name: string;
  hostname: string;
  port: number;
}

interface GenerateResult {
  certificate: Certificate;
  ovpnConfig: string;
  nodeName: string;
}

export default function ConfigsPage() {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [nodes, setNodes] = useState<VpnNode[]>([]);
  const [selectedNode, setSelectedNode] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [generateNode, setGenerateNode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    api('/configs/certificates').then(setCerts).catch(() => {});
    api('/configs/nodes').then(setNodes).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setGenerating(true);
    try {
      const result: GenerateResult = await api('/configs/generate', {
        method: 'POST',
        body: JSON.stringify({ deviceName, vpnNodeId: generateNode }),
      });
      setGeneratedResult(result);
      setShowGenerate(false);
      setDeviceName('');
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to generate config');
    } finally {
      setGenerating(false);
    }
  };

  const triggerDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'application/x-openvpn-profile' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownload = async (certId: string) => {
    if (!selectedNode) return alert('Select a VPN node first');
    try {
      const resp = await apiRaw(`/configs/${certId}/download/${selectedNode}`);
      const config = await resp.text();
      const cert = certs.find((c) => c.id === certId);
      const filename = cert ? `${cert.commonName}.ovpn` : 'client.ovpn';
      triggerDownload(filename, config);
    } catch (err: any) {
      alert(err.message || 'Download failed');
    }
  };

  const handleEmail = async (certId: string) => {
    if (!selectedNode) return alert('Select a VPN node first');
    const email = prompt('Enter email address:');
    if (!email) return;
    try {
      await api(`/configs/${certId}/email/${selectedNode}`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      alert('Configuration email queued');
    } catch (err: any) {
      alert(err.message || 'Failed to send email');
    }
  };

  const handleDelete = async (cert: Certificate) => {
    if (!window.confirm(`Delete "${cert.commonName}"? This revokes the certificate and cannot be undone.`)) return;
    try {
      await api(`/configs/certificates/${cert.id}`, { method: 'DELETE' });
      load();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">VPN Configurations</h1>
        <Button onClick={() => { setShowGenerate(!showGenerate); setGeneratedResult(null); setError(''); }}>
          {showGenerate ? 'Cancel' : 'Generate New Config'}
        </Button>
      </div>

      {/* Generated config result */}
      {generatedResult && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-300">Config Generated Successfully</h3>
              <p className="text-sm text-green-700 dark:text-green-400">
                <strong>{generatedResult.certificate.commonName}</strong> for node <strong>{generatedResult.nodeName}</strong>
              </p>
            </div>
            <Button
              onClick={() => {
                triggerDownload(`${generatedResult.certificate.commonName}.ovpn`, generatedResult.ovpnConfig);
              }}
            >
              Download .ovpn
            </Button>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-green-700 dark:text-green-400">View config contents</summary>
            <pre className="mt-2 max-h-60 overflow-auto rounded bg-black/5 p-3 font-mono text-xs text-green-900 dark:bg-black/20 dark:text-green-200">
              {generatedResult.ovpnConfig}
            </pre>
          </details>
          <button
            className="mt-2 text-xs text-green-600 underline dark:text-green-400"
            onClick={() => setGeneratedResult(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Generate form */}
      {showGenerate && (
        <form onSubmit={handleGenerate} className="mb-6 space-y-3 rounded-lg border p-4">
          <h3 className="font-semibold">Generate New VPN Configuration</h3>
          <p className="text-sm text-muted-foreground">
            This will create a new client certificate and generate a ready-to-use .ovpn file.
          </p>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Device Name</label>
              <Input
                placeholder="e.g. laptop, phone, tablet"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">Letters, numbers, and hyphens only</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">VPN Server</label>
              <select
                className="w-full rounded-md border p-2 text-sm"
                value={generateNode}
                onChange={(e) => setGenerateNode(e.target.value)}
                required
              >
                <option value="">Select a server</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.name} ({n.hostname})</option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" disabled={generating || !deviceName || !generateNode}>
            {generating ? 'Generating...' : 'Generate Config'}
          </Button>
        </form>
      )}

      {/* Existing configs */}
      {certs.length > 0 && (
        <>
          <div className="mb-3 flex items-center gap-3">
            <label className="text-sm font-medium">Server for download/email:</label>
            <select
              className="rounded-md border p-1.5 text-sm"
              value={selectedNode}
              onChange={(e) => setSelectedNode(e.target.value)}
            >
              <option value="">Select node</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.name} ({n.hostname})</option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Device</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {certs.map((cert) => (
                  <tr key={cert.id}>
                    <td className="px-4 py-3">
                      <code className="text-sm">{cert.commonName}</code>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(cert.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => handleDownload(cert.id)}>
                          Download
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEmail(cert.id)}>
                          Email
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(cert)}>
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {certs.length === 0 && !showGenerate && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No VPN configurations yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click "Generate New Config" to create your first VPN profile.
          </p>
        </div>
      )}
    </div>
  );
}
