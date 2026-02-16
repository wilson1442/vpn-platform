'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

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
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', hostname: '', port: '1194', agentPort: '3001', mgmtPort: '7505', sshPort: '22' });

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
    setEditTarget(node);
    setEditForm({
      name: node.name,
      hostname: node.hostname,
      port: String(node.port),
      agentPort: String(node.agentPort),
      mgmtPort: String(node.mgmtPort),
      sshPort: String(node.sshPort || 22),
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api(`/vpn-nodes/${editTarget.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editForm.name,
        hostname: editForm.hostname,
        port: parseInt(editForm.port),
        agentPort: parseInt(editForm.agentPort),
        mgmtPort: parseInt(editForm.mgmtPort),
        sshPort: parseInt(editForm.sshPort),
      }),
    });
    setEditTarget(null);
    load();
  };

  const isNodeOnline = (node: any) => {
    if (!node.lastHeartbeatAt) return false;
    return Date.now() - new Date(node.lastHeartbeatAt).getTime() < 90000;
  };

  const getInstallBadge = (status: string | null) => {
    if (status === 'installed') return <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">Installed</Badge>;
    if (status === 'installing') return <Badge className="animate-pulse border-amber-500/30 bg-amber-500/10 text-amber-400">Installing...</Badge>;
    if (status === 'failed') return <Badge className="border-rose-500/30 bg-rose-500/10 text-rose-400">Failed</Badge>;
    return <Badge variant="outline" className="border-border/30 text-muted-foreground">Not Installed</Badge>;
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
          VPN Nodes
        </h1>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className={showCreate ? 'border border-border/30 bg-card/40 text-muted-foreground hover:text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15'}
        >
          {showCreate ? 'Cancel' : 'Add Node'}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-5 space-y-4">
          <p className="font-heading text-sm font-semibold text-cyan-400">New Node Configuration</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Node Name</label>
              <Input placeholder="e.g. us-east-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Hostname</label>
              <Input placeholder="e.g. 10.0.0.1" value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">VPN Port</label>
              <Input placeholder="1194" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Agent Port</label>
              <Input placeholder="3001" type="number" value={form.agentPort} onChange={(e) => setForm({ ...form, agentPort: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Mgmt Port</label>
              <Input placeholder="7505" type="number" value={form.mgmtPort} onChange={(e) => setForm({ ...form, mgmtPort: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">SSH Port</label>
              <Input placeholder="22" type="number" value={form.sshPort} onChange={(e) => setForm({ ...form, sshPort: e.target.value })} />
            </div>
          </div>
          <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">Create Node</Button>
        </form>
      )}

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">Edit VPN Node</DialogTitle>
            <DialogDescription className="font-body text-muted-foreground">Update configuration for {editTarget?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Node Name</label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Hostname</label>
              <Input value={editForm.hostname} onChange={(e) => setEditForm({ ...editForm, hostname: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">VPN Port</label>
                <Input type="number" value={editForm.port} onChange={(e) => setEditForm({ ...editForm, port: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Agent Port</label>
                <Input type="number" value={editForm.agentPort} onChange={(e) => setEditForm({ ...editForm, agentPort: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Management Port</label>
                <Input type="number" value={editForm.mgmtPort} onChange={(e) => setEditForm({ ...editForm, mgmtPort: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">SSH Port</label>
                <Input type="number" value={editForm.sshPort} onChange={(e) => setEditForm({ ...editForm, sshPort: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)} className="border-border/30">Cancel</Button>
              <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SSH Credentials Dialog */}
      {sshDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-6 shadow-2xl shadow-cyan-500/5">
            <h3 className="font-heading text-lg font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent mb-4">
              {actionLabel(sshDialog.action)} — {sshDialog.nodeName}
            </h3>
            {sshDialog.action === 'reinstall' && (
              <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm font-body text-rose-300">
                This will stop all services, remove all VPN configuration, and perform a fresh installation.
              </div>
            )}
            <form onSubmit={handleSshSubmit} className="space-y-4">
              <p className="font-heading text-sm font-semibold text-cyan-400">Connection Details</p>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">SSH Host</label>
                <Input
                  value={sshDialog.hostname}
                  onChange={(e) => setSshDialog({ ...sshDialog, hostname: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">SSH Port</label>
                  <Input
                    type="number"
                    value={sshDialog.sshPort}
                    onChange={(e) => setSshDialog({ ...sshDialog, sshPort: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Username</label>
                  <Input
                    value={sshForm.username}
                    onChange={(e) => setSshForm({ ...sshForm, username: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Auth Method</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setSshForm({ ...sshForm, authMethod: 'password' })}
                    className={sshForm.authMethod === 'password' ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15' : 'border border-border/30 bg-card/60 text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10'}
                  >
                    Password
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setSshForm({ ...sshForm, authMethod: 'key' })}
                    className={sshForm.authMethod === 'key' ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15' : 'border border-border/30 bg-card/60 text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10'}
                  >
                    SSH Key
                  </Button>
                </div>
              </div>
              {sshForm.authMethod === 'password' ? (
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Password</label>
                  <Input
                    type="password"
                    value={sshForm.password}
                    onChange={(e) => setSshForm({ ...sshForm, password: e.target.value })}
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Private Key</label>
                  <textarea
                    className="w-full rounded-lg font-mono bg-[#0a0e1a] border border-border/20 p-3 text-xs text-cyan-400/70"
                    rows={6}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                    value={sshForm.privateKey}
                    onChange={(e) => setSshForm({ ...sshForm, privateKey: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">
                  {actionLabel(sshDialog.action)}
                </Button>
                <Button type="button" onClick={closeSshDialog} className="border border-border/30 bg-card/60 text-muted-foreground hover:text-white">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Terminal Log Viewer */}
      {terminal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm shadow-2xl shadow-cyan-500/5">
            <div className="flex items-center justify-between border-b border-border/20 px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="font-heading text-sm font-semibold text-cyan-400">
                  {actionLabel(terminal.action)} Logs
                </span>
                {terminal.status === 'running' && (
                  <Badge className="animate-pulse border-amber-500/30 bg-amber-500/10 text-amber-400">Running...</Badge>
                )}
                {terminal.status === 'success' && (
                  <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">Success</Badge>
                )}
                {terminal.status === 'failed' && (
                  <Badge className="border-rose-500/30 bg-rose-500/10 text-rose-400">Failed</Badge>
                )}
              </div>
              <Button size="sm" onClick={closeTerminal} className="hover:text-cyan-400 hover:bg-cyan-500/10 text-muted-foreground">
                Close
              </Button>
            </div>
            <div
              ref={terminalRef}
              className="flex-1 overflow-auto font-mono bg-[#0a0e1a] border-t-0 p-4 text-sm leading-relaxed text-emerald-400"
            >
              {terminal.logs.map((line, i) => (
                <div key={i} className={line.startsWith('[stderr]') ? 'text-amber-400' : line.startsWith('ERROR') ? 'text-rose-400' : line.startsWith('===') ? 'text-cyan-300 font-bold' : ''}>
                  {line}
                </div>
              ))}
              {terminal.status === 'running' && (
                <div className="animate-pulse text-cyan-400/40">_</div>
              )}
            </div>
          </div>
        </div>
      )}

      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (n) => (
            <span className="font-heading font-semibold text-sm">{n.name}</span>
          )},
          { key: 'hostname', header: 'Hostname', render: (n) => (
            <span className="font-mono text-xs text-cyan-400/70">{n.hostname}</span>
          )},
          { key: 'port', header: 'Port', render: (n) => (
            <span className="font-mono text-xs">{n.port}</span>
          )},
          { key: 'status', header: 'Status', render: (n) => (
            isNodeOnline(n)
              ? <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">Online</Badge>
              : <Badge className="border-rose-500/30 bg-rose-500/10 text-rose-400">Offline</Badge>
          )},
          { key: 'installStatus', header: 'Install', render: (n) => getInstallBadge(n.installStatus) },
          { key: 'crlVersion', header: 'CRL Version', render: (n) => (
            <span className="font-mono text-xs">{n.crlVersion}</span>
          )},
          { key: 'agentToken', header: 'Agent Token', render: (n) => <code className="font-mono text-xs text-cyan-400/70">{n.agentToken?.substring(0, 8)}...</code> },
          { key: 'lastHeartbeatAt', header: 'Last Heartbeat', render: (n) => (
            <span className="font-mono text-xs">{n.lastHeartbeatAt ? new Date(n.lastHeartbeatAt).toLocaleString() : 'Never'}</span>
          )},
          { key: 'actions', header: 'Actions', render: (n) => (
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => startEdit(n)} className="hover:text-cyan-400 hover:bg-cyan-500/10 border-border/30 text-xs">Edit</Button>
              {(!n.installStatus || n.installStatus === 'failed') && (
                <Button variant="outline" size="sm" onClick={() => openSshDialog(n, 'install')} className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border-border/30 text-xs">
                  Install
                </Button>
              )}
              {n.installStatus === 'installed' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => openSshDialog(n, 'restart')} className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border-border/30 text-xs">
                    Restart
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openSshDialog(n, 'reinstall')} className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border-border/30 text-xs">
                    Reinstall
                  </Button>
                </>
              )}
              <Button size="sm" onClick={() => handleDelete(n)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs">Delete</Button>
            </div>
          )},
        ]}
        data={nodes}
      />
    </div>
  );
}
