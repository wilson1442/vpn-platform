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
    <div>
      {expired && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">
          Your account has expired. VPN connections are disabled. Please contact your administrator to extend your account.
        </div>
      )}
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Package</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{entitlement?.package?.name || 'No package'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Max Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{entitlement?.maxConnections || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{certCount}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
