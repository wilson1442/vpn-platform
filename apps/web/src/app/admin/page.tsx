'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, resellers: 0, nodes: 0, activeSessions: 0 });

  useEffect(() => {
    Promise.all([
      api('/users').then((d: any[]) => d.length).catch(() => 0),
      api('/resellers').then((d: any[]) => d.length).catch(() => 0),
      api('/vpn-nodes').then((d: any[]) => d.length).catch(() => 0),
      api('/sessions?active=true').then((d: any[]) => d.length).catch(() => 0),
    ]).then(([users, resellers, nodes, activeSessions]) => {
      setStats({ users, resellers, nodes, activeSessions });
    });
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Admin Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Users', value: stats.users },
          { label: 'Resellers', value: stats.resellers },
          { label: 'VPN Nodes', value: stats.nodes },
          { label: 'Active Sessions', value: stats.activeSessions },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
