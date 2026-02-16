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
      <h1 className="mb-6 text-2xl font-bold">Credits</h1>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Current Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{balance} credits</p>
        </CardContent>
      </Card>

      <h2 className="mb-4 text-xl font-semibold">Transaction History</h2>
      <DataTable
        columns={[
          { key: 'type', header: 'Type', render: (e) => (
            <Badge variant={e.type === 'ADD' ? 'default' : e.type === 'DEDUCT' ? 'destructive' : 'secondary'}>
              {e.type}
            </Badge>
          )},
          { key: 'amount', header: 'Amount' },
          { key: 'balanceAfter', header: 'Balance After' },
          { key: 'description', header: 'Description' },
          { key: 'createdAt', header: 'Date', render: (e) => new Date(e.createdAt).toLocaleString() },
        ]}
        data={history}
      />
    </div>
  );
}
