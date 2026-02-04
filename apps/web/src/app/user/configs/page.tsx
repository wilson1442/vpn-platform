'use client';

import { useEffect, useState } from 'react';
import { api, apiRaw } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface VpnNode {
  id: string;
  name: string;
  hostname: string;
  port: number;
}

interface ShortUrlData {
  code: string;
  shortUrl: string | null;
  vpnNodeId: string;
}

export default function ConfigsPage() {
  const [nodes, setNodes] = useState<VpnNode[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [shortUrls, setShortUrls] = useState<Record<string, { code: string; shortUrl: string | null }>>({});
  const [copiedNode, setCopiedNode] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);

  useEffect(() => {
    api('/configs/nodes').then(setNodes).catch(() => {});
    api('/configs/short-urls').then((urls: ShortUrlData[]) => {
      const map: Record<string, { code: string; shortUrl: string | null }> = {};
      urls.forEach((u) => { map[u.vpnNodeId] = { code: u.code, shortUrl: u.shortUrl }; });
      setShortUrls(map);
    }).catch(() => {});
  }, []);

  const getProfileUrl = (nodeId: string) => {
    const data = shortUrls[nodeId];
    if (!data) return null;
    // Use Bitly URL if available, otherwise use local short URL
    if (data.shortUrl) return data.shortUrl;
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin.replace(':3100', ':3000')
      : '';
    return `${baseUrl}/configs/p/${data.code}`;
  };

  const getOrCreateShortUrl = async (nodeId: string) => {
    if (shortUrls[nodeId]) return shortUrls[nodeId];
    setLoadingUrl(nodeId);
    try {
      const result = await api(`/configs/short-url/${nodeId}`, { method: 'POST' });
      const data = { code: result.code, shortUrl: result.shortUrl };
      setShortUrls((prev) => ({ ...prev, [nodeId]: data }));
      return data;
    } finally {
      setLoadingUrl(null);
    }
  };

  const copyUrl = async (nodeId: string) => {
    try {
      const data = await getOrCreateShortUrl(nodeId);
      const url = data.shortUrl || `${window.location.origin.replace(':3100', ':3000')}/configs/p/${data.code}`;
      await navigator.clipboard.writeText(url);
      setCopiedNode(nodeId);
      setTimeout(() => setCopiedNode(null), 2000);
    } catch {
      alert('Failed to copy URL');
    }
  };

  const regenerateUrl = async (nodeId: string) => {
    if (!confirm('Regenerating will invalidate the old URL. Continue?')) return;
    setLoadingUrl(nodeId);
    try {
      const result = await api(`/configs/short-url/${nodeId}/regenerate`, { method: 'POST' });
      setShortUrls((prev) => ({ ...prev, [nodeId]: { code: result.code, shortUrl: result.shortUrl } }));
    } catch {
      alert('Failed to regenerate URL');
    } finally {
      setLoadingUrl(null);
    }
  };

  const handleDownload = async (node: VpnNode) => {
    setDownloading(node.id);
    try {
      const resp = await apiRaw(`/configs/nodes/${node.id}/download`);
      const config = await resp.text();
      const blob = new Blob([config], { type: 'application/x-openvpn-profile' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${node.name}.ovpn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">VPN Profiles</h1>
        <p className="mt-1 text-muted-foreground">
          Download a profile for any server below and import it into your OpenVPN client.
        </p>
      </div>

      <div className="mb-6 space-y-3">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Authentication:</strong> When connecting, use your platform username and password.
            No separate certificates are needed.
          </p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <p className="text-sm text-green-800 dark:text-green-300">
            <strong>Import via URL:</strong> Most OpenVPN apps support importing profiles via URL.
            Click &quot;Copy URL&quot; next to a server and paste it in your app&apos;s URL import field.
          </p>
        </div>
      </div>

      {nodes.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Server</th>
                <th className="px-4 py-3 text-left font-medium">Hostname</th>
                <th className="px-4 py-3 text-left font-medium">Port</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {nodes.map((node) => (
                <tr key={node.id}>
                  <td className="px-4 py-3 font-medium">{node.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <code className="text-sm">{node.hostname}</code>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{node.port}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyUrl(node.id)}
                        disabled={loadingUrl === node.id}
                      >
                        {loadingUrl === node.id ? '...' : copiedNode === node.id ? 'Copied!' : 'Copy URL'}
                      </Button>
                      {shortUrls[node.id] && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => regenerateUrl(node.id)}
                          disabled={loadingUrl === node.id}
                          title="Regenerate URL"
                        >
                          ↻
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleDownload(node)}
                        disabled={downloading === node.id}
                      >
                        {downloading === node.id ? '...' : 'Download'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No VPN servers available.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact your administrator to set up VPN nodes.
          </p>
        </div>
      )}
    </div>
  );
}
