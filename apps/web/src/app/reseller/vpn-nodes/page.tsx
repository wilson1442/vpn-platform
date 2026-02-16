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
      <h1 className="mb-6 text-2xl font-bold">VPN Nodes</h1>

      {editingId && (
        <form onSubmit={handleEdit} className="mb-6 space-y-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5 backdrop-blur-sm">
          <h3 className="font-semibold">Edit Node</h3>
          <Input placeholder="Node Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
          <Input placeholder="Hostname" value={editForm.hostname} onChange={(e) => setEditForm({ ...editForm, hostname: e.target.value })} required />
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="VPN Port" type="number" value={editForm.port} onChange={(e) => setEditForm({ ...editForm, port: e.target.value })} />
            <Input placeholder="Agent Port" type="number" value={editForm.agentPort} onChange={(e) => setEditForm({ ...editForm, agentPort: e.target.value })} />
            <Input placeholder="Mgmt Port" type="number" value={editForm.mgmtPort} onChange={(e) => setEditForm({ ...editForm, mgmtPort: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
          </div>
        </form>
      )}

      <DataTable
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'hostname', header: 'Hostname' },
          { key: 'port', header: 'Port' },
          { key: 'status', header: 'Status', render: (n) => (
            <Badge variant={isNodeOnline(n) ? 'default' : 'destructive'}>
              {isNodeOnline(n) ? 'Online' : 'Offline'}
            </Badge>
          )},
          { key: 'actions', header: 'Actions', render: (n) => (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => startEdit(n)}>Edit</Button>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(n)}>Delete</Button>
            </div>
          )},
        ]}
        data={nodes}
      />
    </div>
  );
}
