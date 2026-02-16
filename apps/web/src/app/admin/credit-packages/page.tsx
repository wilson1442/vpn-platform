'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/data-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export default function CreditPackagesPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', credits: '', price: '', description: '' });
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', credits: '', price: '', description: '' });

  const load = () => api('/credit-packages').then(setPackages).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/credit-packages', {
      method: 'POST',
      body: JSON.stringify({
        name: form.name,
        credits: parseInt(form.credits),
        price: Math.round(parseFloat(form.price) * 100),
        description: form.description || undefined,
      }),
    });
    setShowCreate(false);
    setForm({ name: '', credits: '', price: '', description: '' });
    load();
  };

  const startEdit = (pkg: any) => {
    setEditTarget(pkg);
    setEditForm({
      name: pkg.name,
      credits: String(pkg.credits),
      price: (pkg.price / 100).toFixed(2),
      description: pkg.description || '',
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api(`/credit-packages/${editTarget.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editForm.name,
        credits: parseInt(editForm.credits),
        price: Math.round(parseFloat(editForm.price) * 100),
        description: editForm.description,
      }),
    });
    setEditTarget(null);
    load();
  };

  const handleDelete = async (pkg: any) => {
    if (!window.confirm(`Delete credit package "${pkg.name}"?`)) return;
    await api(`/credit-packages/${pkg.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
          Credit Packages
        </h1>
        <Button
          className={showCreate ? 'border border-border/20 bg-card/40 backdrop-blur-sm text-muted-foreground hover:text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15'}
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? 'Cancel' : 'Create Package'}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-5 space-y-4">
          <h2 className="font-heading text-sm font-semibold text-cyan-400">New Package Details</h2>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Package Name</label>
            <Input placeholder="e.g. Starter Pack" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Credits</label>
              <Input className="font-mono text-xs" placeholder="100" type="number" min="1" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Price ($)</label>
              <Input className="font-mono text-xs" placeholder="9.99" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Description (optional)</label>
            <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">Create</Button>
        </form>
      )}

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm font-semibold text-cyan-400">Edit Credit Package</DialogTitle>
            <DialogDescription className="font-body text-muted-foreground">Update {editTarget?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Package Name</label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Credits</label>
                <Input className="font-mono text-xs" type="number" min="1" value={editForm.credits} onChange={(e) => setEditForm({ ...editForm, credits: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Price ($)</label>
                <Input className="font-mono text-xs" type="number" step="0.01" min="0" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Description</label>
              <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="border-border/20 hover:bg-card/60" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-5">
        <DataTable
          searchable
          searchKeys={['name', 'description']}
          searchPlaceholder="Search credit packages..."
          columns={[
            { key: 'name', header: 'Name', sortable: true, render: (p) => <span className="font-heading font-semibold text-sm">{p.name}</span> },
            { key: 'credits', header: 'Credits', sortable: true, render: (p) => <span className="font-mono text-xs">{p.credits}</span> },
            { key: 'price', header: 'Price', sortable: true, render: (p) => <span className="font-mono text-xs">${(p.price / 100).toFixed(2)}</span> },
            { key: 'description', header: 'Description', render: (p) => <span className="font-body text-sm text-muted-foreground">{p.description || '—'}</span> },
            { key: 'createdAt', header: 'Created', sortable: true, render: (p) => <span className="font-mono text-xs text-cyan-400/70">{new Date(p.createdAt).toLocaleDateString()}</span>, sortValue: (p) => new Date(p.createdAt).getTime() },
            { key: 'actions', header: 'Actions', render: (p) => (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="border-border/20 hover:border-cyan-500/30 hover:text-cyan-400" onClick={() => startEdit(p)}>Edit</Button>
                <Button variant="destructive" size="sm" className="bg-transparent text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 shadow-none" onClick={() => handleDelete(p)}>Delete</Button>
              </div>
            )},
          ]}
          data={packages}
        />
      </div>
    </div>
  );
}
