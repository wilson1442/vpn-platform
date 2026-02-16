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
    {
      label: 'Users',
      value: counts.users,
      gradient: 'from-cyan-500/10 to-cyan-600/5',
      color: 'text-cyan-400',
      borderColor: 'border-l-cyan-400',
    },
    {
      label: 'Resellers',
      value: counts.resellers,
      gradient: 'from-teal-500/10 to-teal-600/5',
      color: 'text-teal-400',
      borderColor: 'border-l-teal-400',
    },
    {
      label: 'VPN Nodes',
      value: counts.nodes,
      gradient: 'from-emerald-500/10 to-emerald-600/5',
      color: 'text-emerald-400',
      borderColor: 'border-l-emerald-400',
    },
    {
      label: 'Online Users',
      value: stats?.onlineUsers ?? 0,
      highlight: true,
      gradient: 'from-amber-500/10 to-amber-600/5',
      color: 'text-amber-400',
      borderColor: 'border-l-amber-400',
    },
    {
      label: 'VPN Connections',
      value: stats?.vpnConnections ?? 0,
      highlight: true,
      gradient: 'from-violet-500/10 to-violet-600/5',
      color: 'text-violet-400',
      borderColor: 'border-l-violet-400',
    },
  ];

  return (
    <div>
      <h1 className="font-heading mb-6 text-3xl font-bold bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
        Admin Dashboard
      </h1>

      {/* License warning banner */}
      {!licenseLoading && !valid && (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 shadow-lg shadow-amber-500/20">
              <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-400">Server Unlicensed</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This server is running without a valid license. Some features may be restricted.
              </p>
              <Link
                href="/admin/settings"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
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
      <div className="mb-5 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => (
          <Card
            key={stat.label}
            className={`rounded-xl border border-border/20 bg-gradient-to-br ${stat.gradient} bg-card/40 backdrop-blur-sm border-l-2 ${stat.borderColor} hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-200`}
          >
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <p className={`font-mono text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: Main Server */}
      {stats?.server && (
        <div className="mb-5">
          <h2 className="font-heading mb-3 text-xl font-semibold bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
            Main Server
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Card className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-200">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse" />
                  <CardTitle className="text-sm font-medium">API Server</CardTitle>
                </div>
                <p className="font-mono text-xs text-muted-foreground">{typeof window === 'undefined' ? '' : window.location.hostname}</p>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <div className="flex justify-around">
                  <Gauge value={stats.server.cpuPercent} label="CPU" color="#f59e0b" />
                  <Gauge value={stats.server.memPercent} label="RAM" color="#2dd4bf" />
                  <Gauge
                    value={Math.min(100, Math.round(((stats.server.netRxBps + stats.server.netTxBps) / 125_000_000) * 100))}
                    label="Net"
                    color="#34d399"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Row 3: Bandwidth chart */}
      <div className="mb-5">
        <BandwidthChart data={stats?.bandwidthHistory ?? []} />
      </div>

      {/* Row 4: Node cards */}
      {stats?.nodes && stats.nodes.length > 0 && (
        <div>
          <h2 className="font-heading mb-3 text-xl font-semibold bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
            VPN Nodes
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {stats.nodes.map((node) => (
              <NodeCard key={node.nodeId} node={node} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
