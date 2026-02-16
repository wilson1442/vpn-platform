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
  const { user, impersonate } = useAuth();
  const [resellers, setResellers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ userId: '', companyName: '', parentId: '' });
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
      }),
    });
    setShowCreate(false);
    setForm({ userId: '', companyName: '', parentId: '' });
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">Resellers</h1>
        <Button className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Create Reseller'}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-5 space-y-4">
          <h2 className="font-heading text-sm font-semibold text-cyan-400">New Reseller</h2>
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block font-body">User ID</label>
            <Input placeholder="User ID" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block font-body">Company Name</label>
            <Input placeholder="Name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
          </div>
          {user?.role === 'ADMIN' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block font-body">Parent Reseller</label>
              <select
                className="flex h-10 w-full bg-card/60 border border-border/30 rounded-lg p-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              >
                <option value="">No Parent (Top-level)</option>
                {resellers.map((r) => (
                  <option key={r.id} value={r.id}>{r.companyName}</option>
                ))}
              </select>
            </div>
          )}
          <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">Create</Button>
        </form>
      )}

      {/* Enhanced Edit Reseller Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">Edit Reseller</DialogTitle>
          </DialogHeader>

          {editTarget && (
            <div className="space-y-6">
              {/* Reseller Profile Header */}
              <div className="flex items-center gap-4 rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-600 text-lg font-heading font-semibold text-white shadow-lg shadow-cyan-500/15">
                  {getInitials(editTarget.companyName)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-semibold text-lg truncate">{editTarget.companyName}</h3>
                  <p className="font-body text-sm text-muted-foreground truncate">{editTarget.user?.email || 'No email'}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                  Reseller
                </Badge>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-3 text-center">
                  <div className="font-mono font-medium text-2xl text-cyan-400">{editTarget.creditBalance ?? 0}</div>
                  <div className="font-body text-xs text-muted-foreground">Credits</div>
                </div>
                <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-3 text-center">
                  <div className="font-mono font-medium text-2xl">{editTarget._count?.users ?? 0}</div>
                  <div className="font-body text-xs text-muted-foreground">Users</div>
                </div>
                <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-3 text-center">
                  <div className="font-mono font-medium text-2xl">{editTarget.maxDepth}</div>
                  <div className="font-body text-xs text-muted-foreground">Max Depth</div>
                </div>
              </div>

              {/* Info Row */}
              <div className="flex items-center justify-between font-body text-sm text-muted-foreground border-t border-b border-border/20 py-3">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-cyan-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Created <span className="font-mono text-xs">{new Date(editTarget.createdAt).toLocaleDateString()}</span></span>
                </div>
                {editTarget.parent?.user?.username && (
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-cyan-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Owner: <span className="text-cyan-400 hover:text-cyan-300">{editTarget.parent.user.username}</span></span>
                  </div>
                )}
              </div>

              {/* Edit Form */}
              <form onSubmit={handleEdit} className="space-y-4">
                <h3 className="font-heading text-sm font-semibold text-cyan-400">Edit Details</h3>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block font-body">Company Name</label>
                  <Input
                    value={editForm.companyName}
                    onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                    placeholder="Enter company name"
                    required
                  />
                  <p className="font-body text-xs text-muted-foreground">The display name for this reseller account</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block font-body">Max Hierarchy Depth</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={editForm.maxDepth}
                    onChange={(e) => setEditForm({ ...editForm, maxDepth: e.target.value })}
                    placeholder="3"
                  />
                  <p className="font-body text-xs text-muted-foreground">Maximum levels of sub-resellers allowed (1-10)</p>
                </div>

                {editError && (
                  <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-400 font-body">
                    {editError}
                  </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button type="button" variant="outline" onClick={closeEdit} disabled={editLoading} className="border-border/30">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={editLoading} className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">
                    {editLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DataTable
        searchable
        searchKeys={['companyName', 'user', 'parent']}
        searchPlaceholder="Search resellers by name, email..."
        columns={[
          { key: 'companyName', header: 'Name', sortable: true, render: (r) => <span className="font-heading font-semibold">{r.companyName}</span> },
          { key: 'user', header: 'Email', sortable: true, hideOnMobile: true, render: (r) => <span className="font-body text-sm">{r.user?.email}</span>, sortValue: (r) => r.user?.email || '' },
          { key: 'creditBalance', header: 'Credits', sortable: true, render: (r) => <span className="font-mono font-medium text-cyan-400">{r.creditBalance}</span> },
          { key: 'users', header: 'Users', sortable: true, render: (r) => <span className="font-mono text-xs">{r._count?.users ?? 0}</span>, sortValue: (r) => r._count?.users ?? 0 },
          { key: 'lastLoginAt', header: 'Last Login', sortable: true, hideOnMobile: true, render: (r) => <span className="font-mono text-xs">{r.user?.lastLoginAt ? new Date(r.user.lastLoginAt).toLocaleDateString() : 'Never'}</span>, sortValue: (r) => r.user?.lastLoginAt ? new Date(r.user.lastLoginAt).getTime() : 0 },
          { key: 'owner', header: 'Owner', sortable: true, hideOnMobile: true, render: (r) => <span className="font-body text-sm text-muted-foreground">{r.parent?.user?.username || '—'}</span>, sortValue: (r) => r.parent?.user?.username || '' },
          { key: 'createdAt', header: 'Created', sortable: true, hideOnMobile: true, render: (r) => <span className="font-mono text-xs text-cyan-400/70">{new Date(r.createdAt).toLocaleDateString()}</span>, sortValue: (r) => new Date(r.createdAt).getTime() },
          { key: 'actions', header: 'Actions', render: (r) => (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:text-cyan-400 hover:bg-cyan-500/10" onClick={() => impersonate(r.userId)} title="Login As">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </Button>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:text-cyan-400 hover:bg-cyan-500/10" onClick={() => setCreditsTarget(r)} title="Manage Credits">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </Button>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:text-cyan-400 hover:bg-cyan-500/10" onClick={() => startEdit(r)} title="Edit">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Button>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" onClick={() => handleDelete(r)} title="Delete">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
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
