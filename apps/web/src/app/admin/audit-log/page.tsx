'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);

  const loadLogs = () => api('/audit-logs').then(setLogs).catch(() => {});

  useEffect(() => { loadLogs(); }, []);

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all audit logs? This action cannot be undone.')) return;
    await api('/audit-logs', { method: 'DELETE' });
    setLogs([]);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Audit Log</h1>
        <Button variant="destructive" onClick={handleClearAll}>Clear All</Button>
      </div>
      <DataTable
        columns={[
          { key: 'actor', header: 'Actor', render: (l) => l.actor?.email || 'System' },
          { key: 'action', header: 'Action' },
          { key: 'targetType', header: 'Target Type' },
          { key: 'targetId', header: 'Target ID', render: (l) => l.targetId ? <code className="text-xs">{l.targetId.substring(0, 8)}</code> : '-' },
          { key: 'ipAddress', header: 'IP Address' },
          { key: 'createdAt', header: 'Time', render: (l) => new Date(l.createdAt).toLocaleString() },
        ]}
        data={logs}
      />
    </div>
  );
}
