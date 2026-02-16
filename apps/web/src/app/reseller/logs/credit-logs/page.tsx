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

const TYPE_BADGE_STYLES: Record<string, string> = {
  ADD: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  DEDUCT: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  REFUND: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  TRANSFER: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
};

export default function ResellerCreditLogsPage() {
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
    <div>
      <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent mb-4">Credit Logs</h1>

      <div className="mb-4 flex gap-2">
        {['', 'ADD', 'DEDUCT', 'REFUND', 'TRANSFER'].map((t) => (
          <Button
            key={t}
            variant={filterType === t ? 'default' : 'outline'}
            size="sm"
            className={filterType === t ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15' : 'hover:text-cyan-400 hover:bg-cyan-500/10'}
            onClick={() => setFilterType(t)}
          >
            {t || 'All'}
          </Button>
        ))}
      </div>

      <DataTable
        columns={[
          { key: 'reseller', header: 'Reseller', render: (r) => <span className="font-body">{r.reseller?.companyName ?? '\u2014'}</span> },
          { key: 'type', header: 'Type', render: (r) => (
            <Badge className={TYPE_BADGE_STYLES[r.type] || 'bg-muted/50 text-muted-foreground border-border/30'}>{r.type}</Badge>
          )},
          { key: 'amount', header: 'Amount', render: (r) => (
            <span className={`font-mono font-medium ${r.type === 'DEDUCT' ? 'text-rose-400' : 'text-emerald-400'}`}>
              {r.type === 'DEDUCT' ? '-' : '+'}{r.amount}
            </span>
          )},
          { key: 'balanceAfter', header: 'Balance After', render: (r) => <span className="font-mono text-xs">{r.balanceAfter}</span> },
          { key: 'description', header: 'Description', render: (r) => <span className="font-body text-sm">{r.description || '\u2014'}</span> },
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
