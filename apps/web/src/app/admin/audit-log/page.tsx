'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';

function timeAgo(date: string | null) {
  if (!date) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);

  const loadLogs = () => api('/audit-logs').then(setLogs).catch(() => {});
  const loadNodes = () => api('/vpn-nodes').then(setNodes).catch(() => {});

  useEffect(() => {
    loadLogs();
    loadNodes();
    const interval = setInterval(loadNodes, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all audit logs? This action cannot be undone.')) return;
    await api('/audit-logs', { method: 'DELETE' });
    setLogs([]);
  };

  const isOnline = (node: any) => {
    if (!node.lastHeartbeatAt) return false;
    return Date.now() - new Date(node.lastHeartbeatAt).getTime() < 90_000;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
            Audit Log
          </h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            System activity and node health monitoring
          </p>
        </div>
        <Button
          variant="destructive"
          className="bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/15"
          onClick={handleClearAll}
        >
          Clear All
        </Button>
      </div>

      {/* Node Heartbeat Status Cards */}
      {nodes.length > 0 && (
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3 block">
            Node Status
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {nodes.map((node) => {
              const online = isOnline(node);
              return (
                <div
                  key={node.id}
                  className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-heading font-semibold truncate">{node.name}</h3>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      online
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-400 shadow-sm shadow-rose-400/50'}`} />
                      {online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-cyan-400/70 truncate">{node.hostname}</p>
                  <div className="mt-2 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Last heartbeat: {timeAgo(node.lastHeartbeatAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Data Table Card */}
      <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
        <DataTable
          columns={[
            { key: 'actor', header: 'Actor', render: (l) => (
              <span className="font-body text-sm">{l.actor?.email || 'System'}</span>
            )},
            { key: 'action', header: 'Action', render: (l) => (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                {l.action}
              </span>
            )},
            { key: 'targetType', header: 'Target Type', render: (l) => (
              <span className="font-body text-sm">{l.targetType}</span>
            )},
            { key: 'targetId', header: 'Target ID', render: (l) => l.targetId
              ? <code className="font-mono text-xs text-cyan-400/70">{l.targetId.substring(0, 8)}</code>
              : <span className="text-muted-foreground">-</span>
            },
            { key: 'ipAddress', header: 'IP Address', render: (l) => (
              <span className="font-mono text-xs text-cyan-400/70">{l.ipAddress}</span>
            )},
            { key: 'createdAt', header: 'Time', render: (l) => (
              <span className="font-mono text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</span>
            )},
          ]}
          data={logs}
        />
      </div>
    </div>
  );
}
