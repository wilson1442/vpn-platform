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
    <div>
      <h1 className="mb-4 text-2xl font-bold">Credit Logs</h1>

      <div className="mb-4 flex gap-2">
        {['', 'ADD', 'DEDUCT', 'REFUND', 'TRANSFER'].map((t) => (
          <Button
            key={t}
            variant={filterType === t ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType(t)}
          >
            {t || 'All'}
          </Button>
        ))}
      </div>

      <DataTable
        columns={[
          { key: 'reseller', header: 'Reseller', render: (r) => r.reseller?.companyName ?? '—' },
          { key: 'type', header: 'Type', render: (r) => (
            <Badge variant={TYPE_VARIANTS[r.type] || 'outline'}>{r.type}</Badge>
          )},
          { key: 'amount', header: 'Amount', render: (r) => r.amount },
          { key: 'balanceAfter', header: 'Balance After' },
          { key: 'description', header: 'Description', render: (r) => r.description || '—' },
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
