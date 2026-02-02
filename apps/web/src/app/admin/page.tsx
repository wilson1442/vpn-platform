'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';
import { BandwidthChart } from '@/components/bandwidth-chart';
import { NodeCard } from '@/components/node-card';
import { Gauge } from '@/components/gauge';

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ users: 0, resellers: 0, nodes: 0 });
  const { stats } = useDashboardStats();

  useEffect(() => {
    Promise.all([
      api('/users').then((d: any[]) => d.length).catch(() => 0),
      api('/resellers').then((d: any[]) => d.length).catch(() => 0),
      api('/vpn-nodes').then((d: any[]) => d.length).catch(() => 0),
    ]).then(([users, resellers, nodes]) => {
      setCounts({ users, resellers, nodes });
    });
  }, []);

  const statCards = [
    { label: 'Users', value: counts.users },
    { label: 'Resellers', value: counts.resellers },
    { label: 'VPN Nodes', value: counts.nodes },
    { label: 'Online Users', value: stats?.onlineUsers ?? 0, highlight: true },
    { label: 'VPN Connections', value: stats?.vpnConnections ?? 0, highlight: true },
  ];

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Admin Dashboard</h1>

      {/* Row 1: Stat cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${stat.highlight ? 'text-green-500' : ''}`}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: Main Server */}
      {stats?.server && (
        <div className="mb-6">
          <h2 className="mb-4 text-xl font-semibold">Main Server</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                  <CardTitle className="text-sm font-medium">API Server</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">{typeof window === 'undefined' ? '' : window.location.hostname}</p>
              </CardHeader>
              <CardContent>
                <div className="flex justify-around">
                  <Gauge value={stats.server.cpuPercent} label="CPU" color="#f59e0b" />
                  <Gauge value={stats.server.memPercent} label="RAM" color="#3b82f6" />
                  <Gauge
                    value={Math.min(100, Math.round(((stats.server.netRxBps + stats.server.netTxBps) / 125_000_000) * 100))}
                    label="Net"
                    color="#22c55e"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Row 3: Bandwidth chart */}
      <div className="mb-6">
        <BandwidthChart data={stats?.bandwidthHistory ?? []} />
      </div>

      {/* Row 4: Node cards */}
      {stats?.nodes && stats.nodes.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold">VPN Nodes</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.nodes.map((node) => (
              <NodeCard key={node.nodeId} node={node} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
