'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';

export default function UsersPage() {
  const { impersonate } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'USER' as string, resellerId: '', packageId: '', expiresAt: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ username: '', email: '', password: '', role: '', isActive: true, expiresAt: '', maxConnections: '' });
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [extendPackageId, setExtendPackageId] = useState('');

  const load = () => {
    api('/users').then(setUsers).catch(() => {});
    api('/packages').then(setPackages).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/users', {
      method: 'POST',
      body: JSON.stringify({
        username: form.username,
        email: form.email || undefined,
        password: form.password,
        role: form.role,
        resellerId: form.resellerId || undefined,
        packageId: form.packageId || undefined,
        expiresAt: !form.packageId && form.expiresAt ? form.expiresAt : undefined,
      }),
    });
    setShowCreate(false);
    setForm({ username: '', email: '', password: '', role: 'USER', resellerId: '', packageId: '', expiresAt: '' });
    load();
  };

  const handleDelete = async (user: any) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) return;
    await api(`/users/${user.id}`, { method: 'DELETE' });
    load();
  };

  const startEdit = (user: any) => {
    setEditingId(user.id);
    setEditForm({
      username: user.username,
      email: user.email || '',
      password: '',
      role: user.role,
      isActive: user.isActive,
      expiresAt: user.expiresAt ? new Date(user.expiresAt).toISOString().slice(0, 16) : '',
      maxConnections: user.entitlement?.maxConnections?.toString() || '',
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = { username: editForm.username, email: editForm.email || undefined, role: editForm.role, isActive: editForm.isActive, expiresAt: editForm.expiresAt || null };
    if (editForm.password) body.password = editForm.password;
    if (editForm.maxConnections) body.maxConnections = parseInt(editForm.maxConnections, 10);
    await api(`/users/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) });
    setEditingId(null);
    load();
  };

  const handleExtend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendPackageId) return;
    await api(`/users/${extendingId}/extend`, {
      method: 'POST',
      body: JSON.stringify({ packageId: extendPackageId }),
    });
    setExtendingId(null);
    setExtendPackageId('');
    load();
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">Users</h1>
        <Button
          className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? 'Cancel' : 'Create User'}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-5 space-y-4">
          <h3 className="font-heading text-sm font-semibold text-cyan-400">New User</h3>
          <Input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          <Input placeholder="Email (optional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Role</label>
            <select className="w-full bg-card/60 border border-border/30 rounded-lg p-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="USER">User</option>
              <option value="RESELLER">Reseller</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <Input placeholder="Reseller ID (optional)" value={form.resellerId} onChange={(e) => setForm({ ...form, resellerId: e.target.value })} />
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Package (optional)</label>
            <select className="w-full bg-card/60 border border-border/30 rounded-lg p-2 text-sm" value={form.packageId} onChange={(e) => setForm({ ...form, packageId: e.target.value })}>
              <option value="">No package (manual expiration)</option>
              {packages.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} ({p.duration})</option>
              ))}
            </select>
          </div>
          {!form.packageId && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Expires At (optional)</label>
              <Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </div>
          )}
          <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">Create</Button>
        </form>
      )}

      {editingId && (
        <form onSubmit={handleEdit} className="mb-6 rounded-xl border border-cyan-500/15 bg-cyan-500/[0.03] backdrop-blur-sm p-5 space-y-4">
          <h3 className="font-heading text-sm font-semibold text-cyan-400">Edit User</h3>
          <Input placeholder="Username" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} required />
          <Input placeholder="Email (optional)" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <Input placeholder="New Password (leave blank to keep)" type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Role</label>
            <select className="w-full bg-card/60 border border-border/30 rounded-lg p-2 text-sm" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
              <option value="USER">User</option>
              <option value="RESELLER">Reseller</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
            Active
          </label>
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Max Connections</label>
            <Input type="number" min="1" placeholder="Max Connections" value={editForm.maxConnections} onChange={(e) => setEditForm({ ...editForm, maxConnections: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Expires At (leave blank for never)</label>
            <Input type="datetime-local" value={editForm.expiresAt} onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">Save</Button>
            <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
          </div>
        </form>
      )}

      {extendingId && (
        <form onSubmit={handleExtend} className="mb-6 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] backdrop-blur-sm p-5 space-y-4">
          <h3 className="font-heading text-sm font-semibold text-emerald-400">Extend User Package</h3>
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Package</label>
            <select className="w-full bg-card/60 border border-border/30 rounded-lg p-2 text-sm" value={extendPackageId} onChange={(e) => setExtendPackageId(e.target.value)} required>
              <option value="">Select a package</option>
              {packages.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} ({p.duration})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/15">Extend</Button>
            <Button type="button" variant="outline" onClick={() => { setExtendingId(null); setExtendPackageId(''); }}>Cancel</Button>
          </div>
        </form>
      )}

      <DataTable
        searchable
        searchKeys={['username', 'email', 'role', 'reseller', 'entitlement']}
        searchPlaceholder="Search users by name, email, role..."
        columns={[
          { key: 'username', header: 'Username', sortable: true },
          { key: 'email', header: 'Email', sortable: true, hideOnMobile: true, render: (u) => u.email || '-' },
          { key: 'owner', header: 'Owner', sortable: true, hideOnMobile: true, render: (u) => u.reseller ? u.reseller.companyName : 'Panel', sortValue: (u) => u.reseller?.companyName || 'Panel' },
          { key: 'role', header: 'Role', sortable: true, render: (u) => <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>{u.role}</Badge> },
          { key: 'package', header: 'Package', sortable: true, render: (u) => u.entitlement?.package?.name || '-', sortValue: (u) => u.entitlement?.package?.name || '' },
          { key: 'connections', header: 'Connections', sortable: true, render: (u) => u.entitlement ? `${u._count?.vpnSessions || 0} / ${u.entitlement.maxConnections}` : '-', sortValue: (u) => u._count?.vpnSessions || 0 },
          { key: 'isActive', header: 'Status', sortable: true, render: (u) => {
            const expired = u.expiresAt && new Date(u.expiresAt) < new Date();
            if (!u.isActive) return <Badge variant="destructive">Inactive</Badge>;
            if (expired) return <Badge variant="destructive">Expired</Badge>;
            return <Badge variant="default">Active</Badge>;
          }, sortValue: (u) => { const expired = u.expiresAt && new Date(u.expiresAt) < new Date(); return !u.isActive ? 2 : expired ? 1 : 0; }},
          { key: 'expiresAt', header: 'Expires', sortable: true, render: (u) => u.expiresAt ? new Date(u.expiresAt).toLocaleDateString() : 'Never', sortValue: (u) => u.expiresAt ? new Date(u.expiresAt).getTime() : Infinity },
          { key: 'createdAt', header: 'Created', sortable: true, hideOnMobile: true, render: (u) => new Date(u.createdAt).toLocaleDateString(), sortValue: (u) => new Date(u.createdAt).getTime() },
          { key: 'shortUrls', header: 'TinyURLs', hideOnMobile: true, render: (u) => {
            if (!u.shortUrls || u.shortUrls.length === 0) return '-';
            return (
              <div className="space-y-1">
                {u.shortUrls.map((s: any) => (
                  <div key={s.code} className="text-xs">
                    <span className="text-muted-foreground">{s.vpnNode?.name}: </span>
                    {s.shortUrl ? (
                      <a href={s.shortUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 hover:underline">
                        {s.shortUrl.replace('https://', '')}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{s.code}</span>
                    )}
                  </div>
                ))}
              </div>
            );
          }},
          { key: 'actions', header: 'Actions', render: (u) => (
            <div className="flex gap-1">
              {u.role !== 'ADMIN' && (
                <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:text-cyan-400 hover:bg-cyan-500/10" onClick={() => impersonate(u.id)} title="Login As">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:text-cyan-400 hover:bg-cyan-500/10" onClick={() => startEdit(u)} title="Edit">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Button>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:text-cyan-400 hover:bg-cyan-500/10" onClick={() => { setExtendingId(u.id); setExtendPackageId(''); }} title="Extend">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </Button>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" onClick={() => handleDelete(u)} title="Delete">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            </div>
          )},
        ]}
        data={users}
      />
    </div>
  );
}
