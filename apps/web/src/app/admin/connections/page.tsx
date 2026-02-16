'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, RefreshCw } from 'lucide-react';

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
          <h1 className="font-heading text-2xl font-bold text-gradient bg-gradient-to-r from-cyan-400 to-teal-400">Live Connections</h1>
          <div className="mt-1.5 flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-mono">{sessions.length}</span> active
            </div>
            <span className="text-border">|</span>
            <span className="text-xs">Auto-refreshes every 15s</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-border/30 bg-card/60 px-3 py-2 text-sm backdrop-blur-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/30"
            value={filterNode}
            onChange={(e) => setFilterNode(e.target.value)}
          >
            <option value="">All Servers</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={loadSessions} className="gap-1.5 border-border/30">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <DataTable
        searchable
        searchKeys={['commonName', 'realAddress', 'vpnNode']}
        searchPlaceholder="Search by username, IP, server..."
        columns={[
          {
            key: 'commonName',
            header: 'Username',
            sortable: true,
            render: (s) => <span className="font-medium">{s.commonName}</span>,
          },
          {
            key: 'email',
            header: 'Email',
            sortable: true,
            hideOnMobile: true,
            render: (s) => <span className="text-muted-foreground">{s.user.email}</span>,
            sortValue: (s) => s.user.email,
          },
          {
            key: 'realAddress',
            header: 'IP Address',
            sortable: true,
            render: (s) => <code className="font-mono text-xs text-cyan-400/70">{s.realAddress}</code>,
          },
          {
            key: 'vpnNode',
            header: 'Server',
            sortable: true,
            render: (s) => (
              <Badge variant="outline" className="border-border/30 bg-white/[0.02] font-mono text-xs">
                {s.vpnNode.name}
              </Badge>
            ),
            sortValue: (s) => s.vpnNode.name,
          },
          {
            key: 'connectedAt',
            header: 'Connected Since',
            sortable: true,
            hideOnMobile: true,
            render: (s) => <span className="font-mono text-xs text-muted-foreground">{new Date(s.connectedAt).toLocaleString()}</span>,
            sortValue: (s) => new Date(s.connectedAt).getTime(),
          },
          {
            key: 'duration',
            header: 'Duration',
            sortable: true,
            render: (s) => <span className="font-mono text-xs text-emerald-400">{formatDuration(s.connectedAt)}</span>,
            sortValue: (s) => new Date(s.connectedAt).getTime(),
          },
          {
            key: 'bytesReceived',
            header: 'Recv',
            sortable: true,
            hideOnMobile: true,
            render: (s) => <span className="font-mono text-xs">{formatBytes(s.bytesReceived)}</span>,
          },
          {
            key: 'bytesSent',
            header: 'Sent',
            sortable: true,
            hideOnMobile: true,
            render: (s) => <span className="font-mono text-xs">{formatBytes(s.bytesSent)}</span>,
          },
          {
            key: 'actions',
            header: '',
            render: (s) => (
              <Button
                variant="ghost"
                size="sm"
                disabled={kicking === s.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleKick(s);
                }}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs"
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
