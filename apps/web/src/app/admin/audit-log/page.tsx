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
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Audit Log</h1>
        <Button variant="destructive" onClick={handleClearAll}>Clear All</Button>
      </div>

      {/* Node Heartbeat Status Cards */}
      {nodes.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {nodes.map((node) => {
            const online = isOnline(node);
            return (
              <div
                key={node.id}
                className="rounded-lg border bg-card p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold truncate">{node.name}</h3>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${online ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
                    {online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{node.hostname}</p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Last heartbeat: {timeAgo(node.lastHeartbeatAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DataTable
        columns={[
          { key: 'actor', header: 'Actor', render: (l) => l.actor?.email || 'System' },
          { key: 'action', header: 'Action' },
          { key: 'targetType', header: 'Target Type' },
          { key: 'targetId', header: 'Target ID', render: (l) => l.targetId ? <code className="text-xs">{l.targetId.substring(0, 8)}</code> : '-' },
          { key: 'ipAddress', header: 'IP Address' },
          { key: 'createdAt', header: 'Time', render: (l) => new Date(l.createdAt).toLocaleString() },
        ]}
        data={logs}
      />
    </div>
  );
}
