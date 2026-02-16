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
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
          Sessions
        </h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">
          View your VPN connection history
        </p>
      </div>
      <DataTable
        columns={[
          {
            key: 'commonName',
            header: 'Common Name',
            render: (s) => (
              <span className="font-mono text-xs text-cyan-400/70">{s.commonName}</span>
            ),
          },
          {
            key: 'vpnNode',
            header: 'Node',
            render: (s) => (
              <span className="font-body text-sm text-foreground">{s.vpnNode?.name}</span>
            ),
          },
          {
            key: 'realAddress',
            header: 'IP Address',
            render: (s) => (
              <span className="font-mono text-xs text-cyan-400/70">{s.realAddress}</span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (s) => (
              s.disconnectedAt ? (
                <Badge variant="secondary" className="bg-rose-500/15 text-rose-400 border-transparent">
                  Disconnected
                </Badge>
              ) : (
                <Badge variant="default" className="bg-emerald-500/15 text-emerald-400 border-transparent">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse" />
                  Active
                </Badge>
              )
            ),
          },
          {
            key: 'connectedAt',
            header: 'Connected',
            render: (s) => (
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(s.connectedAt).toLocaleString()}
              </span>
            ),
          },
          {
            key: 'disconnectedAt',
            header: 'Disconnected',
            render: (s) => (
              <span className="font-mono text-xs text-muted-foreground">
                {s.disconnectedAt ? new Date(s.disconnectedAt).toLocaleString() : '-'}
              </span>
            ),
          },
          {
            key: 'kickedReason',
            header: 'Kick Reason',
            render: (s) => (
              <span className="font-body text-xs text-muted-foreground">
                {s.kickedReason || '-'}
              </span>
            ),
          },
        ]}
        data={sessions}
      />
    </div>
  );
}
