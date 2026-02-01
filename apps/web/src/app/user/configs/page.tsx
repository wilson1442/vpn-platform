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

export default function ConfigsPage() {
  const [nodes, setNodes] = useState<VpnNode[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    api('/configs/nodes').then(setNodes).catch(() => {});
  }, []);

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

      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Authentication:</strong> When connecting, use your platform username and password.
          No separate certificates are needed.
        </p>
      </div>

      {nodes.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Server</th>
                <th className="px-4 py-3 text-left font-medium">Hostname</th>
                <th className="px-4 py-3 text-left font-medium">Port</th>
                <th className="px-4 py-3 text-right font-medium">Profile</th>
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
                    <Button
                      size="sm"
                      onClick={() => handleDownload(node)}
                      disabled={downloading === node.id}
                    >
                      {downloading === node.id ? 'Downloading...' : 'Download .ovpn'}
                    </Button>
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
