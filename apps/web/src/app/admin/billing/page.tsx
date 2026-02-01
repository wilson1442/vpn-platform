'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';

export default function BillingPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ resellerId: '', amountCents: '' });

  const load = () => api('/invoices').then(setInvoices).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/invoices', {
      method: 'POST',
      body: JSON.stringify({ resellerId: form.resellerId, amountCents: parseInt(form.amountCents) }),
    });
    setShowCreate(false);
    setForm({ resellerId: '', amountCents: '' });
    load();
  };

  const handleDelete = async (invoice: any) => {
    if (!window.confirm(`Are you sure you want to delete this invoice? This action cannot be undone.`)) return;
    await api(`/invoices/${invoice.id}`, { method: 'DELETE' });
    load();
  };

  const handlePay = async (id: string) => {
    await api(`/invoices/${id}/pay`, { method: 'POST' });
    load();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Billing</h1>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Create Invoice'}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 space-y-3 rounded-lg border p-4">
          <Input placeholder="Reseller ID" value={form.resellerId} onChange={(e) => setForm({ ...form, resellerId: e.target.value })} required />
          <Input placeholder="Amount (cents)" type="number" value={form.amountCents} onChange={(e) => setForm({ ...form, amountCents: e.target.value })} required />
          <Button type="submit">Create Invoice</Button>
        </form>
      )}

      <DataTable
        columns={[
          { key: 'id', header: 'ID', render: (i) => <code className="text-xs">{i.id.substring(0, 8)}</code> },
          { key: 'reseller', header: 'Reseller', render: (i) => i.reseller?.user?.email || i.resellerId },
          { key: 'amountCents', header: 'Amount', render: (i) => `$${(i.amountCents / 100).toFixed(2)}` },
          { key: 'status', header: 'Status', render: (i) => (
            <Badge variant={i.status === 'PAID' ? 'default' : i.status === 'CANCELLED' ? 'destructive' : 'secondary'}>
              {i.status}
            </Badge>
          )},
          { key: 'actions', header: 'Actions', render: (i) => (
            <div className="flex gap-2">
              {i.status === 'PENDING' && <Button size="sm" onClick={() => handlePay(i.id)}>Mark Paid</Button>}
              <Button variant="destructive" size="sm" onClick={() => handleDelete(i)}>Delete</Button>
            </div>
          )},
          { key: 'createdAt', header: 'Created', render: (i) => new Date(i.createdAt).toLocaleDateString() },
        ]}
        data={invoices}
      />
    </div>
  );
}
