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
      <h1 className="mb-6 text-2xl font-bold">Reseller Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Users', value: stats.users },
          { label: 'Sub-Resellers', value: stats.subResellers },
          { label: 'Credit Balance', value: stats.balance },
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
