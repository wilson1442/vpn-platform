'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function ResellerDashboard() {
  const [stats, setStats] = useState({ users: 0, subResellers: 0, balance: 0 });

  useEffect(() => {
    Promise.all([
      api('/users').then((d: any[]) => d.length).catch(() => 0),
      api('/resellers').then((d: any[]) => Math.max(0, d.length - 1)).catch(() => 0),
    ]).then(([users, subResellers]) => {
      setStats((s) => ({ ...s, users, subResellers }));
    });
  }, []);

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">Reseller Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Users', value: stats.users, color: 'text-cyan-400' },
          { label: 'Sub-Resellers', value: stats.subResellers, color: 'text-teal-400' },
          { label: 'Credit Balance', value: stats.balance, color: 'text-emerald-400' },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`font-mono text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
