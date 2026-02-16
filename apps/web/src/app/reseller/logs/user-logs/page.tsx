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

const ACTION_BADGE_STYLES: Record<string, string> = {
  created: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  deleted: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  updated: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  extended: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  unknown: 'bg-muted/50 text-muted-foreground border-border/30',
};

export default function ResellerUserLogsPage() {
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
      <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent mb-4">User Logs</h1>

      <div className="mb-4 flex gap-2">
        {(['', 'created', 'updated', 'extended', 'deleted'] as ActionFilter[]).map((t) => (
          <Button
            key={t}
            variant={filterType === t ? 'default' : 'outline'}
            size="sm"
            className={filterType === t ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15' : 'hover:text-cyan-400 hover:bg-cyan-500/10'}
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
            return <Badge className={ACTION_BADGE_STYLES[type] || ACTION_BADGE_STYLES.unknown}>{ACTION_LABELS[type]}</Badge>;
          }},
          { key: 'targetId', header: 'User', render: (r) => <span className="font-body">{r.metadata?.username || r.targetId || '\u2014'}</span> },
          { key: 'actor', header: 'Actor', render: (r) => <span className="font-body">{r.actor?.username || r.actor?.email || '\u2014'}</span> },
          { key: 'ipAddress', header: 'IP Address', render: (r) => <span className="font-mono text-xs text-cyan-400/70">{r.ipAddress || '\u2014'}</span> },
          { key: 'details', header: 'Details', render: (r) => {
            if (!r.metadata) return <span className="text-muted-foreground">{'\u2014'}</span>;
            const parts: string[] = [];
            if (r.metadata.packageName) parts.push(`Package: ${r.metadata.packageName}`);
            if (r.metadata.days) parts.push(`Days: ${r.metadata.days}`);
            return parts.length > 0 ? <span className="font-body text-sm">{parts.join(', ')}</span> : <span className="text-muted-foreground">{'\u2014'}</span>;
          }},
          { key: 'createdAt', header: 'Date', render: (r) => <span className="font-mono text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span> },
        ]}
        data={filtered}
      />

      <div className="mt-4 flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">
          Showing {offset + 1}&ndash;{Math.min(offset + limit, total)} of {total}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="hover:text-cyan-400 hover:bg-cyan-500/10" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
            Previous
          </Button>
          <Button variant="outline" size="sm" className="hover:text-cyan-400 hover:bg-cyan-500/10" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
