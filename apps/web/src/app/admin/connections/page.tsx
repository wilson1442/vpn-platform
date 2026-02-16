'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Session {
  id: string;
  commonName: string;
  realAddress: string;
  connectedAt: string;
  disconnectedAt: string | null;
  bytesReceived: number;
  bytesSent: number;
  vpnNodeId: string;
  user: { email: string };
  vpnNode: { name: string };
}

interface VpnNode {
  id: string;
  name: string;
}

function formatDuration(connectedAt: string) {
  const seconds = Math.floor((Date.now() - new Date(connectedAt).getTime()) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function ConnectionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [nodes, setNodes] = useState<VpnNode[]>([]);
  const [filterNode, setFilterNode] = useState('');
  const [kicking, setKicking] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const loadSessions = useCallback(() => {
    const params = new URLSearchParams({ active: 'true' });
    if (filterNode) params.set('vpnNodeId', filterNode);
    api(`/sessions?${params}`).then(setSessions).catch(() => {});
  }, [filterNode]);

  const loadNodes = () => api('/vpn-nodes').then(setNodes).catch(() => {});

  useEffect(() => {
    loadNodes();
  }, []);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 15_000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  // Tick every second to update durations
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleKick = async (session: Session) => {
    if (!window.confirm(`Kick ${session.commonName} from ${session.vpnNode.name}?`)) return;
    setKicking(session.id);
    try {
      await api(`/sessions/${session.id}/kick`, { method: 'POST' });
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch {
      // ignore
    } finally {
      setKicking(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Connections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sessions.length} active connection{sessions.length !== 1 ? 's' : ''}
            {' \u00b7 '}Auto-refreshes every 15s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-input bg-background/50 px-3 py-2 text-sm"
            value={filterNode}
            onChange={(e) => setFilterNode(e.target.value)}
          >
            <option value="">All Servers</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={loadSessions}>
            Refresh
          </Button>
        </div>
      </div>

      <DataTable
        columns={[
          {
            key: 'commonName',
            header: 'Username',
            render: (s) => <span className="font-medium">{s.commonName}</span>,
          },
          {
            key: 'email',
            header: 'Email',
            hideOnMobile: true,
            render: (s) => s.user.email,
          },
          {
            key: 'realAddress',
            header: 'IP Address',
            render: (s) => <code className="text-xs">{s.realAddress}</code>,
          },
          {
            key: 'vpnNode',
            header: 'Server',
            render: (s) => <Badge variant="outline">{s.vpnNode.name}</Badge>,
          },
          {
            key: 'connectedAt',
            header: 'Connected Since',
            hideOnMobile: true,
            render: (s) => new Date(s.connectedAt).toLocaleString(),
          },
          {
            key: 'duration',
            header: 'Duration',
            render: (s) => formatDuration(s.connectedAt),
          },
          {
            key: 'bytesReceived',
            header: 'Recv',
            hideOnMobile: true,
            render: (s) => formatBytes(s.bytesReceived),
          },
          {
            key: 'bytesSent',
            header: 'Sent',
            hideOnMobile: true,
            render: (s) => formatBytes(s.bytesSent),
          },
          {
            key: 'actions',
            header: '',
            render: (s) => (
              <Button
                variant="destructive"
                size="sm"
                disabled={kicking === s.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleKick(s);
                }}
              >
                {kicking === s.id ? 'Kicking...' : 'Kick'}
              </Button>
            ),
          },
        ]}
        data={sessions}
      />
    </div>
  );
}
