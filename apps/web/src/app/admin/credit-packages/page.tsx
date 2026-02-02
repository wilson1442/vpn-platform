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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Credit Packages</h1>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Create Package'}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 space-y-3 rounded-lg border p-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Package Name</label>
            <Input placeholder="e.g. Starter Pack" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Credits</label>
              <Input placeholder="100" type="number" min="1" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Price ($)</label>
              <Input placeholder="9.99" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description (optional)</label>
            <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <Button type="submit">Create</Button>
        </form>
      )}

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Credit Package</DialogTitle>
            <DialogDescription>Update {editTarget?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Package Name</label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Credits</label>
                <Input type="number" min="1" value={editForm.credits} onChange={(e) => setEditForm({ ...editForm, credits: e.target.value })} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Price ($)</label>
                <Input type="number" step="0.01" min="0" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DataTable
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'credits', header: 'Credits' },
          { key: 'price', header: 'Price', render: (p) => `$${(p.price / 100).toFixed(2)}` },
          { key: 'description', header: 'Description', render: (p) => p.description || '—' },
          { key: 'createdAt', header: 'Created', render: (p) => new Date(p.createdAt).toLocaleDateString() },
          { key: 'actions', header: 'Actions', render: (p) => (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => startEdit(p)}>Edit</Button>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(p)}>Delete</Button>
            </div>
          )},
        ]}
        data={packages}
      />
    </div>
  );
}
