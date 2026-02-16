'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ActionFilter = '' | 'created' | 'updated' | 'extended' | 'deleted';

function classifyAction(action: string): string {
  if (action.startsWith('DELETE /users')) return 'deleted';
  if (action.includes('/extend')) return 'extended';
  if (action.startsWith('PATCH /users')) return 'updated';
  if (action.startsWith('POST /users')) return 'created';
  return 'unknown';
}

const ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  extended: 'Extended',
  deleted: 'Deleted',
  unknown: 'Unknown',
};

const ACTION_VARIANTS: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  created: 'default',
  deleted: 'destructive',
  updated: 'secondary',
  extended: 'outline',
};

export default function AdminUserLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filterType, setFilterType] = useState<ActionFilter>('');
  const limit = 50;

  const load = () => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    api(`/audit-logs/user-logs?${params}`).then((res) => {
      setLogs(res.data);
      setTotal(res.total);
    }).catch(() => {});
  };

  useEffect(() => { load(); }, [offset]);

  const filtered = filterType ? logs.filter((l) => classifyAction(l.action) === filterType) : logs;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">User Logs</h1>

      <div className="mb-4 flex gap-2">
        {(['', 'created', 'updated', 'extended', 'deleted'] as ActionFilter[]).map((t) => (
          <Button
            key={t}
            variant={filterType === t ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType(t)}
          >
            {t ? ACTION_LABELS[t] : 'All'}
          </Button>
        ))}
      </div>

      <DataTable
        columns={[
          { key: 'action', header: 'Action', render: (r) => {
            const type = classifyAction(r.action);
            return <Badge variant={ACTION_VARIANTS[type] || 'outline'}>{ACTION_LABELS[type]}</Badge>;
          }},
          { key: 'targetId', header: 'User', render: (r) => r.metadata?.username || r.targetId || '—' },
          { key: 'actor', header: 'Actor', render: (r) => r.actor?.username || r.actor?.email || '—' },
          { key: 'ipAddress', header: 'IP Address', render: (r) => r.ipAddress || '—' },
          { key: 'details', header: 'Details', render: (r) => {
            if (!r.metadata) return '—';
            const parts: string[] = [];
            if (r.metadata.packageName) parts.push(`Package: ${r.metadata.packageName}`);
            if (r.metadata.days) parts.push(`Days: ${r.metadata.days}`);
            return parts.length > 0 ? parts.join(', ') : '—';
          }},
          { key: 'createdAt', header: 'Date', render: (r) => new Date(r.createdAt).toLocaleString() },
        ]}
        data={filtered}
      />

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
