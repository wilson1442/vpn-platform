'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';

export default function SessionsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    api(`/sessions?userId=${user.id}`).then(setSessions).catch(() => {});
  }, [user]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Sessions</h1>
      <DataTable
        columns={[
          { key: 'commonName', header: 'Common Name' },
          { key: 'vpnNode', header: 'Node', render: (s) => s.vpnNode?.name },
          { key: 'realAddress', header: 'IP Address' },
          { key: 'status', header: 'Status', render: (s) => (
            <Badge variant={s.disconnectedAt ? 'secondary' : 'default'}>
              {s.disconnectedAt ? 'Disconnected' : 'Active'}
            </Badge>
          )},
          { key: 'connectedAt', header: 'Connected', render: (s) => new Date(s.connectedAt).toLocaleString() },
          { key: 'disconnectedAt', header: 'Disconnected', render: (s) => s.disconnectedAt ? new Date(s.disconnectedAt).toLocaleString() : '-' },
          { key: 'kickedReason', header: 'Kick Reason', render: (s) => s.kickedReason || '-' },
        ]}
        data={sessions}
      />
    </div>
  );
}
