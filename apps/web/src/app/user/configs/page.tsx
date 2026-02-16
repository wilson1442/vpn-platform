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
  const [generatingAll, setGeneratingAll] = useState(false);

  useEffect(() => {
    api('/configs/nodes')
      .then((data) => {
        if (Array.isArray(data)) setNodes(data);
      })
      .catch(() => {});
    api('/configs/short-urls')
      .then((urls) => {
        if (!Array.isArray(urls)) return;
        const map: Record<string, { code: string; shortUrl: string | null }> = {};
        urls.forEach((u: ShortUrlData) => { map[u.vpnNodeId] = { code: u.code, shortUrl: u.shortUrl }; });
        setShortUrls(map);
      })
      .catch(() => {});
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

  const generateAllUrls = async () => {
    setGeneratingAll(true);
    try {
      const results = await api('/configs/short-urls/all', { method: 'POST' });
      if (!Array.isArray(results)) {
        throw new Error('Invalid response');
      }
      const map: Record<string, { code: string; shortUrl: string | null }> = {};
      results.forEach((u: any) => { map[u.vpnNodeId] = { code: u.code, shortUrl: u.shortUrl }; });
      setShortUrls(map);
    } catch (err: any) {
      alert(err.message || 'Failed to generate URLs');
    } finally {
      setGeneratingAll(false);
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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
            VPN Profiles
          </h1>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            Download a profile for any server below and import it into your OpenVPN client.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15"
          onClick={generateAllUrls}
          disabled={generatingAll || nodes.length === 0}
        >
          {generatingAll ? 'Generating...' : 'Generate All URLs'}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5 backdrop-blur-sm">
          <p className="font-body text-sm text-foreground/80">
            <strong className="font-heading text-cyan-400">Authentication:</strong>{' '}
            When connecting, use your platform username and password.
            No separate certificates are needed.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 backdrop-blur-sm">
          <p className="font-body text-sm text-foreground/80">
            <strong className="font-heading text-emerald-400">Import via URL:</strong>{' '}
            Most OpenVPN apps support importing profiles via URL.
            Click &quot;Copy URL&quot; next to a server and paste it in your app&apos;s URL import field.
          </p>
        </div>
      </div>

      {nodes.length > 0 ? (
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-semibold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
            Available Servers
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nodes.map((node) => (
              <div
                key={node.id}
                className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-5 space-y-4 transition-all duration-300 hover:border-cyan-500/20"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse" />
                    <h3 className="font-heading text-sm font-semibold text-foreground">{node.name}</h3>
                  </div>
                  <div className="space-y-1">
                    <p className="font-mono text-xs text-cyan-400/70">{node.hostname}</p>
                    <p className="font-mono text-xs text-muted-foreground">Port {node.port}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyUrl(node.id)}
                    disabled={loadingUrl === node.id}
                    className="flex-1"
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
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15"
                  >
                    {downloading === node.id ? '...' : 'Download'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/20 border-dashed bg-card/40 backdrop-blur-sm p-12 text-center">
          <p className="font-body text-muted-foreground">No VPN servers available.</p>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            Contact your administrator to set up VPN nodes.
          </p>
        </div>
      )}
    </div>
  );
}
