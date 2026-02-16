'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';

export default function ResellerVpnNodesPage() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', hostname: '', port: '1194', agentPort: '3001', mgmtPort: '7505' });

  const load = () => api('/vpn-nodes').then(setNodes).catch(() => {});
  useEffect(() => { load(); }, []);

  const isNodeOnline = (node: any) => {
    if (!node.lastHeartbeatAt) return false;
    return Date.now() - new Date(node.lastHeartbeatAt).getTime() < 90000;
  };

  const handleDelete = async (node: any) => {
    if (!window.confirm(`Are you sure you want to delete VPN node "${node.name}"? This action cannot be undone.`)) return;
    await api(`/vpn-nodes/${node.id}`, { method: 'DELETE' });
    load();
  };

  const startEdit = (node: any) => {
    setEditingId(node.id);
    setEditForm({
      name: node.name,
      hostname: node.hostname,
      port: String(node.port),
      agentPort: String(node.agentPort),
      mgmtPort: String(node.mgmtPort),
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api(`/vpn-nodes/${editingId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editForm.name,
        hostname: editForm.hostname,
        port: parseInt(editForm.port),
        agentPort: parseInt(editForm.agentPort),
        mgmtPort: parseInt(editForm.mgmtPort),
      }),
    });
    setEditingId(null);
    load();
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent mb-6">VPN Nodes</h1>

      {editingId && (
        <form onSubmit={handleEdit} className="mb-6 rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-5 space-y-4">
          <h3 className="font-heading text-sm font-semibold text-cyan-400">Edit Node</h3>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">Node Name</label>
            <Input placeholder="Node Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">Hostname</label>
            <Input placeholder="Hostname" value={editForm.hostname} onChange={(e) => setEditForm({ ...editForm, hostname: e.target.value })} required />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">VPN Port</label>
              <Input placeholder="VPN Port" type="number" value={editForm.port} onChange={(e) => setEditForm({ ...editForm, port: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">Agent Port</label>
              <Input placeholder="Agent Port" type="number" value={editForm.agentPort} onChange={(e) => setEditForm({ ...editForm, agentPort: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">Mgmt Port</label>
              <Input placeholder="Mgmt Port" type="number" value={editForm.mgmtPort} onChange={(e) => setEditForm({ ...editForm, mgmtPort: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">Save</Button>
            <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
          </div>
        </form>
      )}

      <DataTable
        searchable
        searchKeys={['name', 'hostname']}
        searchPlaceholder="Search nodes..."
        columns={[
          { key: 'name', header: 'Name', sortable: true, render: (n) => <span className="font-body font-medium">{n.name}</span> },
          { key: 'hostname', header: 'Hostname', sortable: true, render: (n) => <span className="font-mono text-xs text-cyan-400/70">{n.hostname}</span> },
          { key: 'port', header: 'Port', sortable: true, render: (n) => <span className="font-mono text-xs">{n.port}</span> },
          { key: 'status', header: 'Status', sortable: true, render: (n) => (
            isNodeOnline(n)
              ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">Online</Badge>
              : <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/20">Offline</Badge>
          ), sortValue: (n) => isNodeOnline(n) ? 0 : 1 },
          { key: 'actions', header: 'Actions', render: (n) => (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="hover:text-cyan-400 hover:bg-cyan-500/10" onClick={() => startEdit(n)}>Edit</Button>
              <Button variant="ghost" size="sm" className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" onClick={() => handleDelete(n)}>Delete</Button>
            </div>
          )},
        ]}
        data={nodes}
      />
    </div>
  );
}
