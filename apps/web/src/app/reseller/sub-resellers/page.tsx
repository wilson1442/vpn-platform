'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/data-table';
import { ManageCreditsDialog } from '@/components/manage-credits-dialog';

export default function SubResellersPage() {
  const [resellers, setResellers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ companyName: '', maxDepth: '3' });
  const [creditsTarget, setCreditsTarget] = useState<any>(null);

  const load = () => api('/resellers').then(setResellers).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleDelete = async (reseller: any) => {
    if (!window.confirm(`Are you sure you want to delete sub-reseller "${reseller.companyName}"? This action cannot be undone.`)) return;
    await api(`/resellers/${reseller.id}`, { method: 'DELETE' });
    load();
  };

  const startEdit = (reseller: any) => {
    setEditingId(reseller.id);
    setEditForm({ companyName: reseller.companyName, maxDepth: String(reseller.maxDepth) });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api(`/resellers/${editingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ companyName: editForm.companyName, maxDepth: parseInt(editForm.maxDepth) }),
    });
    setEditingId(null);
    load();
  };

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Sub-Resellers</h1>

      {editingId && (
        <form onSubmit={handleEdit} className="mb-6 space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
          <h3 className="font-semibold">Edit Sub-Reseller</h3>
          <Input placeholder="Company Name" value={editForm.companyName} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} required />
          <Input placeholder="Max Depth" type="number" value={editForm.maxDepth} onChange={(e) => setEditForm({ ...editForm, maxDepth: e.target.value })} />
          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
          </div>
        </form>
      )}

      <DataTable
        columns={[
          { key: 'companyName', header: 'Company' },
          { key: 'user', header: 'Email', render: (r) => r.user?.email },
          { key: 'maxDepth', header: 'Max Depth' },
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
