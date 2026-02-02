'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/data-table';
import { ManageCreditsDialog } from '@/components/manage-credits-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export default function ResellersPage() {
  const [resellers, setResellers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ userId: '', companyName: '', parentId: '', maxDepth: '3' });
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ companyName: '', maxDepth: '3' });
  const [creditsTarget, setCreditsTarget] = useState<any>(null);

  const load = () => api('/resellers').then(setResellers).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/resellers', {
      method: 'POST',
      body: JSON.stringify({
        userId: form.userId,
        companyName: form.companyName,
        parentId: form.parentId || undefined,
        maxDepth: parseInt(form.maxDepth),
      }),
    });
    setShowCreate(false);
    setForm({ userId: '', companyName: '', parentId: '', maxDepth: '3' });
    load();
  };

  const handleDelete = async (reseller: any) => {
    if (!window.confirm(`Are you sure you want to delete reseller "${reseller.companyName}"? This action cannot be undone.`)) return;
    await api(`/resellers/${reseller.id}`, { method: 'DELETE' });
    load();
  };

  const startEdit = (reseller: any) => {
    setEditTarget(reseller);
    setEditForm({ companyName: reseller.companyName, maxDepth: String(reseller.maxDepth) });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api(`/resellers/${editTarget.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ companyName: editForm.companyName, maxDepth: parseInt(editForm.maxDepth) }),
    });
    setEditTarget(null);
    load();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Resellers</h1>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Create Reseller'}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 space-y-3 rounded-lg border p-4">
          <Input placeholder="User ID" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required />
          <Input placeholder="Name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
          <Input placeholder="Parent Reseller ID (optional)" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} />
          <Input placeholder="Max Depth" type="number" value={form.maxDepth} onChange={(e) => setForm({ ...form, maxDepth: e.target.value })} />
          <Button type="submit">Create</Button>
        </form>
      )}

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Reseller</DialogTitle>
            <DialogDescription>Update reseller details for {editTarget?.companyName}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <Input value={editForm.companyName} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Max Depth</label>
              <Input type="number" value={editForm.maxDepth} onChange={(e) => setEditForm({ ...editForm, maxDepth: e.target.value })} />
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
          { key: 'companyName', header: 'Name' },
          { key: 'user', header: 'Email', render: (r) => r.user?.email },
          { key: 'creditBalance', header: 'Credits' },
          { key: 'users', header: 'Users', render: (r) => r._count?.users ?? 0 },
          { key: 'lastLoginAt', header: 'Last Login', render: (r) => r.user?.lastLoginAt ? new Date(r.user.lastLoginAt).toLocaleDateString() : 'Never' },
          { key: 'owner', header: 'Owner', render: (r) => r.parent?.user?.username || '—' },
          { key: 'createdAt', header: 'Created', render: (r) => new Date(r.createdAt).toLocaleDateString() },
          { key: 'actions', header: 'Actions', render: (r) => (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCreditsTarget(r)}>Manage Credits</Button>
              <Button variant="outline" size="sm" onClick={() => startEdit(r)}>Edit</Button>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(r)}>Delete</Button>
            </div>
          )},
        ]}
        data={resellers}
      />

      {creditsTarget && (
        <ManageCreditsDialog
          open={!!creditsTarget}
          onOpenChange={(open) => { if (!open) setCreditsTarget(null); }}
          resellerId={creditsTarget.id}
          companyName={creditsTarget.companyName}
          currentBalance={creditsTarget.creditBalance ?? 0}
          onSuccess={load}
        />
      )}
    </div>
  );
}
