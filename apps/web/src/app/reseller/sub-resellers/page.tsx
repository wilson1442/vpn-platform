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
      <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent mb-6">Sub-Resellers</h1>

      {editingId && (
        <form onSubmit={handleEdit} className="mb-6 rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-5 space-y-4">
          <h3 className="font-heading text-sm font-semibold text-cyan-400">Edit Sub-Reseller</h3>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">Company Name</label>
            <Input placeholder="Company Name" value={editForm.companyName} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} required />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">Max Depth</label>
            <Input placeholder="Max Depth" type="number" value={editForm.maxDepth} onChange={(e) => setEditForm({ ...editForm, maxDepth: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">Save</Button>
            <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
          </div>
        </form>
      )}

      <DataTable
        columns={[
          { key: 'companyName', header: 'Company', render: (r) => <span className="font-body">{r.companyName}</span> },
          { key: 'user', header: 'Email', render: (r) => <span className="font-body text-cyan-400 hover:text-cyan-300">{r.user?.email}</span> },
          { key: 'maxDepth', header: 'Max Depth', render: (r) => <span className="font-mono text-xs">{r.maxDepth}</span> },
          { key: 'createdAt', header: 'Created', render: (r) => <span className="font-mono text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span> },
          { key: 'actions', header: 'Actions', render: (r) => (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="hover:text-cyan-400 hover:bg-cyan-500/10" onClick={() => setCreditsTarget(r)}>Manage Credits</Button>
              <Button variant="outline" size="sm" className="hover:text-cyan-400 hover:bg-cyan-500/10" onClick={() => startEdit(r)}>Edit</Button>
              <Button variant="ghost" size="sm" className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" onClick={() => handleDelete(r)}>Delete</Button>
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
