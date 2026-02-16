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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gradient bg-gradient-to-r from-cyan-400 to-teal-400">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage invoices and payments</p>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/10"
        >
          {showCreate ? 'Cancel' : 'Create Invoice'}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 space-y-4 rounded-xl border border-border/20 bg-card/40 p-5 backdrop-blur-sm">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Reseller ID</label>
            <Input placeholder="Enter reseller ID" value={form.resellerId} onChange={(e) => setForm({ ...form, resellerId: e.target.value })} required className="font-mono text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount (cents)</label>
            <Input placeholder="e.g. 1000 = $10.00" type="number" value={form.amountCents} onChange={(e) => setForm({ ...form, amountCents: e.target.value })} required className="font-mono text-sm" />
          </div>
          <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white">Create Invoice</Button>
        </form>
      )}

      <DataTable
        searchable
        searchKeys={['id', 'reseller', 'status']}
        searchPlaceholder="Search invoices..."
        columns={[
          { key: 'id', header: 'ID', render: (i) => <code className="font-mono text-xs text-cyan-400/70">{i.id.substring(0, 8)}</code> },
          { key: 'reseller', header: 'Reseller', sortable: true, render: (i) => i.reseller?.user?.email || i.resellerId, sortValue: (i) => i.reseller?.user?.email || i.resellerId },
          { key: 'amountCents', header: 'Amount', sortable: true, render: (i) => <span className="font-mono font-medium">${(i.amountCents / 100).toFixed(2)}</span> },
          { key: 'status', header: 'Status', sortable: true, render: (i) => (
            <Badge
              variant={i.status === 'PAID' ? 'default' : i.status === 'CANCELLED' ? 'destructive' : 'secondary'}
              className={i.status === 'PAID' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : i.status === 'CANCELLED' ? 'bg-rose-500/15 text-rose-400 border-rose-500/20' : 'bg-amber-500/15 text-amber-400 border-amber-500/20'}
            >
              {i.status}
            </Badge>
          )},
          { key: 'actions', header: 'Actions', render: (i) => (
            <div className="flex gap-2">
              {i.status === 'PENDING' && (
                <Button size="sm" onClick={() => handlePay(i.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
                  Mark Paid
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => handleDelete(i)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs">
                Delete
              </Button>
            </div>
          )},
          { key: 'createdAt', header: 'Created', sortable: true, render: (i) => <span className="font-mono text-xs text-muted-foreground">{new Date(i.createdAt).toLocaleDateString()}</span>, sortValue: (i) => new Date(i.createdAt).getTime() },
        ]}
        data={invoices}
      />
    </div>
  );
}
