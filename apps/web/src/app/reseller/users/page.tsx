'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';

export default function ResellerUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', packageId: '', expiresAt: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ email: '', password: '', isActive: true, expiresAt: '' });
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [extendPackageId, setExtendPackageId] = useState('');

  const load = () => {
    api('/users').then(setUsers).catch(() => {});
    api('/packages').then(setPackages).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const selectedPackage = packages.find((p) => p.id === form.packageId);
  const extendSelectedPackage = packages.find((p) => p.id === extendPackageId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/users', {
      method: 'POST',
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        role: 'USER',
        packageId: form.packageId || undefined,
        expiresAt: !form.packageId && form.expiresAt ? form.expiresAt : undefined,
      }),
    });
    setShowCreate(false);
    setForm({ email: '', password: '', packageId: '', expiresAt: '' });
    load();
  };

  const handleDelete = async (user: any) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.email}"? This action cannot be undone.`)) return;
    await api(`/users/${user.id}`, { method: 'DELETE' });
    load();
  };

  const startEdit = (user: any) => {
    setEditingId(user.id);
    setEditForm({ email: user.email, password: '', isActive: user.isActive, expiresAt: user.expiresAt ? new Date(user.expiresAt).toISOString().slice(0, 16) : '' });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = { email: editForm.email, isActive: editForm.isActive, expiresAt: editForm.expiresAt || null };
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
          <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <label className="block text-sm font-medium">Package (optional)</label>
          <select className="w-full rounded-md border p-2 text-sm" value={form.packageId} onChange={(e) => setForm({ ...form, packageId: e.target.value })}>
            <option value="">No package (manual expiration)</option>
            {packages.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} ({p.duration})</option>
            ))}
          </select>
          {selectedPackage && selectedPackage.creditCost > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              This will deduct {selectedPackage.creditCost} credits from your balance.
            </p>
          )}
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
          <Input placeholder="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
          <Input placeholder="New Password (leave blank to keep)" type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
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
          {extendSelectedPackage && extendSelectedPackage.creditCost > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              This will deduct {extendSelectedPackage.creditCost} credits from your balance.
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit">Extend</Button>
            <Button type="button" variant="outline" onClick={() => { setExtendingId(null); setExtendPackageId(''); }}>Cancel</Button>
          </div>
        </form>
      )}

      <DataTable
        columns={[
          { key: 'email', header: 'Email' },
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
