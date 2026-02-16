'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/data-table';

const DURATION_OPTIONS = [
  { value: '24h', label: '24 Hour Trial' },
  { value: '48h', label: '48 Hour Trial' },
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '12m', label: '12 Months' },
];

const DURATION_LABELS: Record<string, string> = Object.fromEntries(
  DURATION_OPTIONS.map((o) => [o.value, o.label]),
);

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function parseDollarsToCents(dollars: string): number {
  const num = parseFloat(dollars.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

const EMPTY_FORM = {
  name: '',
  duration: '1m',
  description: '',
  maxConnections: '1',
  maxDevices: '3',
  price: '0.00',
  creditCost: '0',
};

export default function ResellerPackagesPage() {
  const { user } = useAuth();
  const [packages, setPackages] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  const load = () =>
    api('/packages').then((all: any[]) => {
      // Show only packages owned by this reseller
      setPackages(all.filter((p) => p.resellerId && p.resellerId === user?.resellerId));
    }).catch(() => {});

  useEffect(() => { if (user) load(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/packages', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          duration: form.duration,
          description: form.description,
          maxConnections: parseInt(form.maxConnections),
          maxDevices: parseInt(form.maxDevices),
          priceMonthly: parseDollarsToCents(form.price),
          creditCost: parseInt(form.creditCost) || 0,
        }),
      });
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to create package');
    }
  };

  const handleDelete = async (pkg: any) => {
    if (!window.confirm(`Are you sure you want to delete package "${pkg.name}"? This action cannot be undone.`)) return;
    await api(`/packages/${pkg.id}`, { method: 'DELETE' });
    load();
  };

  const startEdit = (pkg: any) => {
    setEditingId(pkg.id);
    setEditForm({
      name: pkg.name,
      duration: pkg.duration || '1m',
      description: pkg.description || '',
      maxConnections: String(pkg.maxConnections),
      maxDevices: String(pkg.maxDevices),
      price: (pkg.priceMonthly / 100).toFixed(2),
      creditCost: String(pkg.creditCost || 0),
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api(`/packages/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name,
          duration: editForm.duration,
          description: editForm.description,
          maxConnections: parseInt(editForm.maxConnections),
          maxDevices: parseInt(editForm.maxDevices),
          priceMonthly: parseDollarsToCents(editForm.price),
          creditCost: parseInt(editForm.creditCost) || 0,
        }),
      });
      setEditingId(null);
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to update package');
    }
  };

  const renderForm = (
    formData: typeof EMPTY_FORM,
    setFormData: (f: typeof EMPTY_FORM) => void,
    onSubmit: (e: React.FormEvent) => void,
    submitLabel: string,
    onCancel?: () => void,
    highlight?: boolean,
  ) => (
    <form
      onSubmit={onSubmit}
      className={`mb-6 space-y-4 ${
        highlight
          ? 'rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5 backdrop-blur-sm'
          : 'rounded-xl border border-border/40 bg-card/30 p-5 backdrop-blur-sm'
      }`}
    >
      {highlight && <h3 className="font-semibold text-lg">Edit Package</h3>}

      <div>
        <label className="mb-1 block text-sm font-medium text-muted-foreground">Package Name</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Duration</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Price (USD)</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              className="pl-7"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Max Connections</label>
          <Input
            type="number"
            min="1"
            value={formData.maxConnections}
            onChange={(e) => setFormData({ ...formData, maxConnections: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Max Devices</label>
          <Input
            type="number"
            min="1"
            value={formData.maxDevices}
            onChange={(e) => setFormData({ ...formData, maxDevices: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Credit Cost</label>
          <Input
            type="number"
            min="0"
            value={formData.creditCost}
            onChange={(e) => setFormData({ ...formData, creditCost: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted-foreground">Description</label>
        <textarea
          className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Package description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit">{submitLabel}</Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Packages</h1>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Create Package'}
        </Button>
      </div>

      {showCreate &&
        renderForm(
          form,
          setForm as any,
          handleCreate,
          'Create',
        )}

      {editingId &&
        renderForm(
          editForm,
          setEditForm as any,
          handleEdit,
          'Save',
          () => setEditingId(null),
          true,
        )}

      <DataTable
        columns={[
          { key: 'name', header: 'Name' },
          {
            key: 'duration',
            header: 'Duration',
            render: (p) => DURATION_LABELS[p.duration] || p.duration || '-',
          },
          {
            key: 'priceMonthly',
            header: 'Price',
            render: (p) => formatDollars(p.priceMonthly),
          },
          { key: 'creditCost', header: 'Credit Cost', render: (p) => p.creditCost || 0 },
          { key: 'maxConnections', header: 'Max Connections' },
          { key: 'maxDevices', header: 'Max Devices' },
          {
            key: 'actions',
            header: 'Actions',
            render: (p) => (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(p)}>
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(p)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
        data={packages}
      />
    </div>
  );
}
