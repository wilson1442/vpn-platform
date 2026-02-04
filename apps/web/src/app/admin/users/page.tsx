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
  const [editForm, setEditForm] = useState({ username: '', email: '', password: '', role: '', isActive: true, expiresAt: '' });
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
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = { username: editForm.username, email: editForm.email || undefined, role: editForm.role, isActive: editForm.isActive, expiresAt: editForm.expiresAt || null };
    if (editForm.password) body.password = editForm.password;
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
        <h1 className="text-3xl font-bold">Users</h1>
        <Button className="w-full sm:w-auto" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Create User'}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 space-y-3 rounded-lg border p-4">
          <Input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          <Input placeholder="Email (optional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select className="w-full rounded-md border p-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="USER">User</option>
            <option value="RESELLER">Reseller</option>
            <option value="ADMIN">Admin</option>
          </select>
          <Input placeholder="Reseller ID (optional)" value={form.resellerId} onChange={(e) => setForm({ ...form, resellerId: e.target.value })} />
          <label className="block text-sm font-medium">Package (optional)</label>
          <select className="w-full rounded-md border p-2 text-sm" value={form.packageId} onChange={(e) => setForm({ ...form, packageId: e.target.value })}>
            <option value="">No package (manual expiration)</option>
            {packages.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} ({p.duration})</option>
            ))}
          </select>
          {!form.packageId && (
            <>
              <label className="block text-sm font-medium">Expires At (optional)</label>
              <Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </>
          )}
          <Button type="submit">Create</Button>
        </form>
      )}

      {editingId && (
        <form onSubmit={handleEdit} className="mb-6 space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
          <h3 className="font-semibold">Edit User</h3>
          <Input placeholder="Username" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} required />
          <Input placeholder="Email (optional)" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <Input placeholder="New Password (leave blank to keep)" type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
          <select className="w-full rounded-md border p-2 text-sm" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
            <option value="USER">User</option>
            <option value="RESELLER">Reseller</option>
            <option value="ADMIN">Admin</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
            Active
          </label>
          <label className="block text-sm font-medium">Expires At (leave blank for never)</label>
          <Input type="datetime-local" value={editForm.expiresAt} onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })} />
          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
          </div>
        </form>
      )}

      {extendingId && (
        <form onSubmit={handleExtend} className="mb-6 space-y-3 rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-900 dark:bg-green-950/20">
          <h3 className="font-semibold">Extend User Package</h3>
          <select className="w-full rounded-md border p-2 text-sm" value={extendPackageId} onChange={(e) => setExtendPackageId(e.target.value)} required>
            <option value="">Select a package</option>
            {packages.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} ({p.duration})</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="submit">Extend</Button>
            <Button type="button" variant="outline" onClick={() => { setExtendingId(null); setExtendPackageId(''); }}>Cancel</Button>
          </div>
        </form>
      )}

      <DataTable
        columns={[
          { key: 'username', header: 'Username' },
          { key: 'email', header: 'Email', hideOnMobile: true, render: (u) => u.email || '-' },
          { key: 'owner', header: 'Owner', hideOnMobile: true, render: (u) => u.reseller ? u.reseller.companyName : 'Panel' },
          { key: 'role', header: 'Role', render: (u) => <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>{u.role}</Badge> },
          { key: 'package', header: 'Package', render: (u) => u.entitlement?.package?.name || '-' },
          { key: 'isActive', header: 'Status', render: (u) => {
            const expired = u.expiresAt && new Date(u.expiresAt) < new Date();
            if (!u.isActive) return <Badge variant="destructive">Inactive</Badge>;
            if (expired) return <Badge variant="destructive">Expired</Badge>;
            return <Badge variant="default">Active</Badge>;
          }},
          { key: 'expiresAt', header: 'Expires', render: (u) => u.expiresAt ? new Date(u.expiresAt).toLocaleDateString() : 'Never' },
          { key: 'createdAt', header: 'Created', hideOnMobile: true, render: (u) => new Date(u.createdAt).toLocaleDateString() },
          { key: 'shortUrls', header: 'TinyURLs', hideOnMobile: true, render: (u) => {
            if (!u.shortUrls || u.shortUrls.length === 0) return '-';
            return (
              <div className="space-y-1">
                {u.shortUrls.map((s: any) => (
                  <div key={s.code} className="text-xs">
                    <span className="text-muted-foreground">{s.vpnNode?.name}: </span>
                    {s.shortUrl ? (
                      <a href={s.shortUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
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
            <div className="flex gap-2">
              {u.role !== 'ADMIN' && (
                <Button variant="outline" size="sm" onClick={() => impersonate(u.id)}>Login As</Button>
              )}
              <Button variant="outline" size="sm" onClick={() => startEdit(u)}>Edit</Button>
              <Button variant="outline" size="sm" onClick={() => { setExtendingId(u.id); setExtendPackageId(''); }}>Extend</Button>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(u)}>Delete</Button>
            </div>
          )},
        ]}
        data={users}
      />
    </div>
  );
}
