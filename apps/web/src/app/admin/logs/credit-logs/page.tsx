'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const TYPE_VARIANTS: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  ADD: 'default',
  DEDUCT: 'destructive',
  REFUND: 'secondary',
  TRANSFER: 'outline',
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  ADD: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  DEDUCT: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
  REFUND: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  TRANSFER: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20',
};

export default function AdminCreditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filterType, setFilterType] = useState<string>('');
  const limit = 50;

  const load = () => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    api(`/credits/logs?${params}`).then((res) => {
      setLogs(res.data);
      setTotal(res.total);
    }).catch(() => {});
  };

  useEffect(() => { load(); }, [offset]);

  const filtered = filterType ? logs.filter((l) => l.type === filterType) : logs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
          Credit Logs
        </h1>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Monitor credit transactions and balance changes
        </p>
      </div>

      {/* Filter Card */}
      <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-4">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">
          Filter by Type
        </label>
        <div className="flex gap-2 flex-wrap">
          {['', 'ADD', 'DEDUCT', 'REFUND', 'TRANSFER'].map((t) => (
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
              {t || 'All'}
            </Button>
          ))}
        </div>
      </div>

      {/* Data Table Card */}
      <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
        <DataTable
          columns={[
            { key: 'reseller', header: 'Reseller', render: (r) => (
              <span className="font-body text-sm">{r.reseller?.companyName ?? '—'}</span>
            )},
            { key: 'type', header: 'Type', render: (r) => (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_BADGE_COLORS[r.type] || 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/20'}`}>
                {r.type}
              </span>
            )},
            { key: 'amount', header: 'Amount', render: (r) => (
              <span className="font-mono text-xs">{r.amount}</span>
            )},
            { key: 'balanceAfter', header: 'Balance After', render: (r) => (
              <span className="font-mono text-xs">{r.balanceAfter}</span>
            )},
            { key: 'description', header: 'Description', render: (r) => (
              <span className="font-body text-sm">{r.description || '—'}</span>
            )},
            { key: 'createdAt', header: 'Date', render: (r) => (
              <span className="font-mono text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
            )},
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
