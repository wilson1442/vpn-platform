'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';

export default function CreditsPage() {
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [resellerId, setResellerId] = useState('');

  useEffect(() => {
    // Get current user's reseller profile to find resellerId
    api('/resellers').then((resellers: any[]) => {
      if (resellers.length > 0) {
        const myReseller = resellers[0];
        setResellerId(myReseller.id);
        api(`/credits/${myReseller.id}`).then((d: any) => setBalance(d.balance)).catch(() => {});
        api(`/credits/${myReseller.id}/history`).then(setHistory).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">Credits</h1>

      <div className="mb-6 rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-5 space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Current Balance</p>
        <p className="font-heading text-3xl font-bold">
          <span className={balance >= 0 ? 'font-mono font-medium text-emerald-400' : 'font-mono font-medium text-rose-400'}>
            {balance}
          </span>
          <span className="font-body text-lg text-muted-foreground ml-2">credits</span>
        </p>
      </div>

      <h2 className="mb-4 font-heading text-sm font-semibold text-cyan-400 uppercase tracking-wider">Transaction History</h2>
      <DataTable
        searchable
        searchKeys={['type', 'description']}
        searchPlaceholder="Search transactions..."
        columns={[
          { key: 'type', header: 'Type', sortable: true, render: (e) => (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                e.type === 'ADD'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : e.type === 'DEDUCT'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {e.type}
            </span>
          )},
          { key: 'amount', header: 'Amount', sortable: true, render: (e) => (
            <span className={`font-mono font-medium ${
              e.amount > 0 ? 'text-emerald-400' : e.amount < 0 ? 'text-rose-400' : ''
            }`}>
              {e.amount > 0 ? '+' : ''}{e.amount}
            </span>
          )},
          { key: 'balanceAfter', header: 'Balance After', sortable: true, render: (e) => (
            <span className="font-mono text-xs">{e.balanceAfter}</span>
          )},
          { key: 'description', header: 'Description', render: (e) => (
            <span className="font-body text-sm">{e.description}</span>
          )},
          { key: 'createdAt', header: 'Date', sortable: true, render: (e) => (
            <span className="font-mono text-xs text-cyan-400/70">{new Date(e.createdAt).toLocaleString()}</span>
          ), sortValue: (e) => new Date(e.createdAt).getTime() },
        ]}
        data={history}
      />
    </div>
  );
}
