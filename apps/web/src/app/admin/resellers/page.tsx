'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table';
import { ManageCreditsDialog } from '@/components/manage-credits-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function ResellersPage() {
  const { impersonate } = useAuth();
  const [resellers, setResellers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ userId: '', companyName: '', parentId: '', maxDepth: '3' });
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ companyName: '', maxDepth: '3' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
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
    setEditError('');
  };

  const closeEdit = () => {
    setEditTarget(null);
    setEditError('');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');
    try {
      await api(`/resellers/${editTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ companyName: editForm.companyName, maxDepth: parseInt(editForm.maxDepth) }),
      });
      setEditTarget(null);
      load();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update reseller');
    } finally {
      setEditLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Resellers</h1>
        <Button className="w-full sm:w-auto" onClick={() => setShowCreate(!showCreate)}>
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

      {/* Enhanced Edit Reseller Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit Reseller</DialogTitle>
          </DialogHeader>

          {editTarget && (
            <div className="space-y-6">
              {/* Reseller Profile Header */}
              <div className="flex items-center gap-4 rounded-lg bg-muted/50 p-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                  {getInitials(editTarget.companyName)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{editTarget.companyName}</h3>
                  <p className="text-sm text-muted-foreground truncate">{editTarget.user?.email || 'No email'}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  Reseller
                </Badge>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{editTarget.creditBalance ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Credits</div>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-2xl font-bold">{editTarget._count?.users ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Users</div>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-2xl font-bold">{editTarget.maxDepth}</div>
                  <div className="text-xs text-muted-foreground">Max Depth</div>
                </div>
              </div>

              {/* Info Row */}
              <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-b py-3">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Created {new Date(editTarget.createdAt).toLocaleDateString()}</span>
                </div>
                {editTarget.parent?.user?.username && (
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Owner: {editTarget.parent.user.username}</span>
                  </div>
                )}
              </div>

              {/* Edit Form */}
              <form onSubmit={handleEdit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Company Name</label>
                  <Input
                    value={editForm.companyName}
                    onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                    placeholder="Enter company name"
                    required
                  />
                  <p className="text-xs text-muted-foreground">The display name for this reseller account</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Max Hierarchy Depth</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={editForm.maxDepth}
                    onChange={(e) => setEditForm({ ...editForm, maxDepth: e.target.value })}
                    placeholder="3"
                  />
                  <p className="text-xs text-muted-foreground">Maximum levels of sub-resellers allowed (1-10)</p>
                </div>

                {editError && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {editError}
                  </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button type="button" variant="outline" onClick={closeEdit} disabled={editLoading}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={editLoading}>
                    {editLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DataTable
        columns={[
          { key: 'companyName', header: 'Name' },
          { key: 'user', header: 'Email', hideOnMobile: true, render: (r) => r.user?.email },
          { key: 'creditBalance', header: 'Credits' },
          { key: 'users', header: 'Users', render: (r) => r._count?.users ?? 0 },
          { key: 'lastLoginAt', header: 'Last Login', hideOnMobile: true, render: (r) => r.user?.lastLoginAt ? new Date(r.user.lastLoginAt).toLocaleDateString() : 'Never' },
          { key: 'owner', header: 'Owner', hideOnMobile: true, render: (r) => r.parent?.user?.username || '—' },
          { key: 'createdAt', header: 'Created', hideOnMobile: true, render: (r) => new Date(r.createdAt).toLocaleDateString() },
          { key: 'actions', header: 'Actions', render: (r) => (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => impersonate(r.userId)}>Login As</Button>
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
