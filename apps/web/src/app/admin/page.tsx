'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLicense } from '@/lib/license-context';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';
import { BandwidthChart } from '@/components/bandwidth-chart';
import { NodeCard } from '@/components/node-card';
import { Gauge } from '@/components/gauge';

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ users: 0, resellers: 0, nodes: 0 });
  const { stats } = useDashboardStats();
  const { valid, loading: licenseLoading } = useLicense();

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

      {/* License warning banner */}
      {!licenseLoading && !valid && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-500">Server Unlicensed</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This server is running without a valid license. Some features may be restricted.
              </p>
              <Link
                href="/admin/settings"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-500 hover:text-amber-400 transition-colors"
              >
                Enter license key
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Row 1: Stat cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.label} className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${stat.highlight ? 'text-green-400' : 'text-zinc-100'}`}>
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
