'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type ActionType = 'install' | 'restart' | 'reinstall';

interface SshDialogState {
  open: boolean;
  action: ActionType;
  nodeId: string;
  nodeName: string;
  hostname: string;
  sshPort: string;
}

interface TerminalState {
  open: boolean;
  action: ActionType;
  nodeId: string;
  jobId: string;
  logs: string[];
  status: 'running' | 'success' | 'failed';
}

export default function VpnNodesPage() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', hostname: '', port: '1194', agentPort: '3001', mgmtPort: '7505', sshPort: '22' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', hostname: '', port: '1194', agentPort: '3001', mgmtPort: '7505' });

  const [sshDialog, setSshDialog] = useState<SshDialogState | null>(null);
  const [sshForm, setSshForm] = useState({ username: 'root', password: '', privateKey: '', authMethod: 'password' as 'password' | 'key' });
  const [terminal, setTerminal] = useState<TerminalState | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const load = () => api('/vpn-nodes').then(setNodes).catch(() => {});
  useEffect(() => { load(); }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminal?.logs]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/vpn-nodes', {
      method: 'POST',
      body: JSON.stringify({
        name: form.name,
        hostname: form.hostname,
        port: parseInt(form.port),
        agentPort: parseInt(form.agentPort),
        mgmtPort: parseInt(form.mgmtPort),
        sshPort: parseInt(form.sshPort),
      }),
    });
    setShowCreate(false);
    setForm({ name: '', hostname: '', port: '1194', agentPort: '3001', mgmtPort: '7505', sshPort: '22' });
    load();
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

  const isNodeOnline = (node: any) => {
    if (!node.lastHeartbeatAt) return false;
    return Date.now() - new Date(node.lastHeartbeatAt).getTime() < 90000;
  };

  const getInstallBadge = (status: string | null) => {
    if (status === 'installed') return <Badge variant="default" className="bg-green-600">Installed</Badge>;
    if (status === 'installing') return <Badge variant="secondary" className="animate-pulse bg-yellow-500 text-white">Installing...</Badge>;
    if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
    return <Badge variant="outline">Not Installed</Badge>;
  };

  const openSshDialog = (node: any, action: ActionType) => {
    setSshDialog({
      open: true,
      action,
      nodeId: node.id,
      nodeName: node.name,
      hostname: node.hostname,
      sshPort: String(node.sshPort || 22),
    });
    setSshForm({ username: 'root', password: '', privateKey: '', authMethod: 'password' });
  };

  const closeSshDialog = () => {
    setSshDialog(null);
    setSshForm({ username: 'root', password: '', privateKey: '', authMethod: 'password' });
  };

  const handleSshSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sshDialog) return;

    const { action, nodeId, hostname, sshPort } = sshDialog;
    const body: any = {
      host: hostname,
      sshPort: parseInt(sshPort),
      username: sshForm.username,
    };
    if (sshForm.authMethod === 'password') {
      body.password = sshForm.password;
    } else {
      body.privateKey = sshForm.privateKey;
    }

    try {
      const result = await api(`/vpn-nodes/${nodeId}/${action}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      closeSshDialog();
      startLogStream(nodeId, action, result.jobId);
    } catch (err: any) {
      alert(err.message || 'Failed to start operation');
    }
  };

  const startLogStream = (nodeId: string, action: ActionType, jobId: string) => {
    // Close any existing stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setTerminal({ open: true, action, nodeId, jobId, logs: [], status: 'running' });

    const token = localStorage.getItem('refreshToken');
    const url = `${API_URL}/vpn-nodes/${nodeId}/${action}/logs/${jobId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
          setTerminal((prev) => prev ? { ...prev, logs: [...prev.logs, data.message] } : prev);
        } else if (data.type === 'status') {
          setTerminal((prev) => prev ? { ...prev, status: data.status } : prev);
          load();
        }
      } catch {
        // plain text fallback
        setTerminal((prev) => prev ? { ...prev, logs: [...prev.logs, event.data] } : prev);
      }
    };

    es.onerror = () => {
      es.close();
      setTerminal((prev) => {
        if (prev && prev.status === 'running') {
          return { ...prev, status: 'failed' };
        }
        return prev;
      });
    };
  };

  const closeTerminal = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setTerminal(null);
    load();
  };

  const actionLabel = (action: ActionType) => {
    if (action === 'install') return 'Install';
    if (action === 'restart') return 'Restart';
    return 'Reinstall';
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">VPN Nodes</h1>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Add Node'}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 space-y-3 rounded-lg border p-4">
          <Input placeholder="Node Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input placeholder="Hostname" value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} required />
          <div className="grid grid-cols-4 gap-2">
            <Input placeholder="VPN Port" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
            <Input placeholder="Agent Port" type="number" value={form.agentPort} onChange={(e) => setForm({ ...form, agentPort: e.target.value })} />
            <Input placeholder="Mgmt Port" type="number" value={form.mgmtPort} onChange={(e) => setForm({ ...form, mgmtPort: e.target.value })} />
            <Input placeholder="SSH Port" type="number" value={form.sshPort} onChange={(e) => setForm({ ...form, sshPort: e.target.value })} />
          </div>
          <Button type="submit">Create</Button>
        </form>
      )}

      {editingId && (
        <form onSubmit={handleEdit} className="mb-6 space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
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

      {/* SSH Credentials Dialog */}
      {sshDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="mb-4 text-lg font-semibold">
              {actionLabel(sshDialog.action)} — {sshDialog.nodeName}
            </h3>
            {sshDialog.action === 'reinstall' && (
              <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                This will stop all services, remove all VPN configuration, and perform a fresh installation.
              </div>
            )}
            <form onSubmit={handleSshSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">SSH Host</label>
                <Input
                  value={sshDialog.hostname}
                  onChange={(e) => setSshDialog({ ...sshDialog, hostname: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">SSH Port</label>
                  <Input
                    type="number"
                    value={sshDialog.sshPort}
                    onChange={(e) => setSshDialog({ ...sshDialog, sshPort: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Username</label>
                  <Input
                    value={sshForm.username}
                    onChange={(e) => setSshForm({ ...sshForm, username: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Auth Method</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={sshForm.authMethod === 'password' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSshForm({ ...sshForm, authMethod: 'password' })}
                  >
                    Password
                  </Button>
                  <Button
                    type="button"
                    variant={sshForm.authMethod === 'key' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSshForm({ ...sshForm, authMethod: 'key' })}
                  >
                    SSH Key
                  </Button>
                </div>
              </div>
              {sshForm.authMethod === 'password' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    value={sshForm.password}
                    onChange={(e) => setSshForm({ ...sshForm, password: e.target.value })}
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium">Private Key</label>
                  <textarea
                    className="w-full rounded-md border p-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-800"
                    rows={6}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                    value={sshForm.privateKey}
                    onChange={(e) => setSshForm({ ...sshForm, privateKey: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="submit">
                  {actionLabel(sshDialog.action)}
                </Button>
                <Button type="button" variant="outline" onClick={closeSshDialog}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Terminal Log Viewer */}
      {terminal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-lg bg-gray-950 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-gray-300">
                  {actionLabel(terminal.action)} Logs
                </span>
                {terminal.status === 'running' && (
                  <Badge variant="secondary" className="animate-pulse bg-yellow-500 text-white">Running...</Badge>
                )}
                {terminal.status === 'success' && (
                  <Badge variant="default" className="bg-green-600">Success</Badge>
                )}
                {terminal.status === 'failed' && (
                  <Badge variant="destructive">Failed</Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={closeTerminal} className="text-gray-400 hover:text-white">
                Close
              </Button>
            </div>
            <div
              ref={terminalRef}
              className="flex-1 overflow-auto p-4 font-mono text-sm leading-relaxed text-green-400"
            >
              {terminal.logs.map((line, i) => (
                <div key={i} className={line.startsWith('[stderr]') ? 'text-yellow-400' : line.startsWith('ERROR') ? 'text-red-400' : line.startsWith('===') ? 'text-white font-bold' : ''}>
                  {line}
                </div>
              ))}
              {terminal.status === 'running' && (
                <div className="animate-pulse text-gray-500">_</div>
              )}
            </div>
          </div>
        </div>
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
          { key: 'installStatus', header: 'Install', render: (n) => getInstallBadge(n.installStatus) },
          { key: 'crlVersion', header: 'CRL Version' },
          { key: 'agentToken', header: 'Agent Token', render: (n) => <code className="text-xs">{n.agentToken?.substring(0, 8)}...</code> },
          { key: 'lastHeartbeatAt', header: 'Last Heartbeat', render: (n) => n.lastHeartbeatAt ? new Date(n.lastHeartbeatAt).toLocaleString() : 'Never' },
          { key: 'actions', header: 'Actions', render: (n) => (
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => startEdit(n)}>Edit</Button>
              {(!n.installStatus || n.installStatus === 'failed') && (
                <Button variant="outline" size="sm" onClick={() => openSshDialog(n, 'install')} className="text-blue-600">
                  Install
                </Button>
              )}
              {n.installStatus === 'installed' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => openSshDialog(n, 'restart')} className="text-green-600">
                    Restart
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openSshDialog(n, 'reinstall')} className="text-orange-600">
                    Reinstall
                  </Button>
                </>
              )}
              <Button variant="destructive" size="sm" onClick={() => handleDelete(n)}>Delete</Button>
            </div>
          )},
        ]}
        data={nodes}
      />
    </div>
  );
}
