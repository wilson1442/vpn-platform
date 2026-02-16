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

const ACTION_BADGE_COLORS: Record<string, string> = {
  created: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  updated: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20',
  extended: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  deleted: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
  unknown: 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/20',
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
          User Logs
        </h1>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Track user account actions and modifications
        </p>
      </div>

      {/* Filter Card */}
      <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-4">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">
          Filter by Action
        </label>
        <div className="flex gap-2 flex-wrap">
          {(['', 'created', 'updated', 'extended', 'deleted'] as ActionFilter[]).map((t) => (
            <Button
              key={t}
              variant={filterType === t ? 'default' : 'outline'}
              size="sm"
              className={
                filterType === t
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15'
                  : 'bg-card/60 border border-border/30 rounded-lg text-sm hover:bg-card/80'
              }
              onClick={() => setFilterType(t)}
            >
              {t ? ACTION_LABELS[t] : 'All'}
            </Button>
          ))}
        </div>
      </div>

      {/* Data Table Card */}
      <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
        <DataTable
          searchable
          searchKeys={['action', 'targetId', 'actor', 'ipAddress', 'metadata']}
          searchPlaceholder="Search logs by user, actor, IP..."
          columns={[
            { key: 'action', header: 'Action', sortable: true, render: (r) => {
              const type = classifyAction(r.action);
              return (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_BADGE_COLORS[type] || ACTION_BADGE_COLORS.unknown}`}>
                  {ACTION_LABELS[type]}
                </span>
              );
            }, sortValue: (r) => classifyAction(r.action) },
            { key: 'targetId', header: 'User', sortable: true, render: (r) => (
              <span className="font-body text-sm">{r.metadata?.username || r.targetId || '—'}</span>
            ), sortValue: (r) => r.metadata?.username || r.targetId || '' },
            { key: 'actor', header: 'Actor', sortable: true, render: (r) => (
              <span className="font-body text-sm">{r.actor?.username || r.actor?.email || '—'}</span>
            ), sortValue: (r) => r.actor?.username || r.actor?.email || '' },
            { key: 'ipAddress', header: 'IP Address', sortable: true, render: (r) => (
              <span className="font-mono text-xs text-cyan-400/70">{r.ipAddress || '—'}</span>
            )},
            { key: 'details', header: 'Details', render: (r) => {
              if (!r.metadata) return <span className="text-muted-foreground">—</span>;
              const parts: string[] = [];
              if (r.metadata.packageName) parts.push(`Package: ${r.metadata.packageName}`);
              if (r.metadata.days) parts.push(`Days: ${r.metadata.days}`);
              return parts.length > 0
                ? <span className="font-body text-sm">{parts.join(', ')}</span>
                : <span className="text-muted-foreground">—</span>;
            }},
            { key: 'createdAt', header: 'Date', sortable: true, render: (r) => (
              <span className="font-mono text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
            ), sortValue: (r) => new Date(r.createdAt).getTime() },
          ]}
          data={filtered}
        />
      </div>

      {/* Pagination */}
      <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-4 flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">
          Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-card/60 border border-border/30 rounded-lg text-sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-card/60 border border-border/30 rounded-lg text-sm"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
