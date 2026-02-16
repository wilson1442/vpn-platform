'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function UserDashboard() {
  const { user } = useAuth();
  const [entitlement, setEntitlement] = useState<any>(null);
  const [certCount, setCertCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    api(`/entitlements/user/${user.id}`).then(setEntitlement).catch(() => {});
    api('/configs/certificates').then((d: any[]) => setCertCount(d.length)).catch(() => {});
  }, [user]);

  const expired = user?.expiresAt && new Date(user.expiresAt) < new Date();

  return (
    <div className="space-y-8">
      {expired && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-rose-400 shadow-lg shadow-rose-400/50 animate-pulse" />
            <p className="font-body text-sm text-rose-300">
              Your account has expired. VPN connections are disabled. Please contact your administrator to extend your account.
            </p>
          </div>
        </div>
      )}

      <div>
        <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">
          Overview of your VPN account
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Package
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold text-cyan-400">
              {entitlement?.package?.name || 'No package'}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Max Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold text-teal-400">
              {entitlement?.maxConnections || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Certificates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold text-emerald-400">
              {certCount}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
