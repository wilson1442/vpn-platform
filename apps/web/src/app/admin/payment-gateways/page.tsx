'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface GatewayConfig {
  [key: string]: string;
}

const GATEWAY_FIELDS: Record<string, { label: string; fields: { key: string; label: string; type?: string; placeholder: string }[] }> = {
  stripe: {
    label: 'Stripe',
    fields: [
      { key: 'secretKey', label: 'Secret Key', type: 'password', placeholder: 'sk_live_...' },
      { key: 'publishableKey', label: 'Publishable Key', placeholder: 'pk_live_...' },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', placeholder: 'whsec_...' },
    ],
  },
  paypal: {
    label: 'PayPal',
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'PayPal Client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'PayPal Client Secret' },
      { key: 'mode', label: 'Mode', placeholder: 'sandbox or live' },
      { key: 'webhookId', label: 'Webhook ID', placeholder: 'PayPal Webhook ID' },
    ],
  },
  authorize_net: {
    label: 'Authorize.net',
    fields: [
      { key: 'apiLoginId', label: 'API Login ID', placeholder: 'API Login ID' },
      { key: 'transactionKey', label: 'Transaction Key', type: 'password', placeholder: 'Transaction Key' },
      { key: 'environment', label: 'Environment', placeholder: 'sandbox or production' },
    ],
  },
  venmo: {
    label: 'Venmo',
    fields: [
      { key: 'businessHandle', label: 'Business Handle', placeholder: '@your-business' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Venmo API Key (via PayPal/Braintree)' },
      { key: 'merchantId', label: 'Merchant ID', placeholder: 'Braintree Merchant ID' },
    ],
  },
  cashapp: {
    label: 'Cash App',
    fields: [
      { key: 'cashtag', label: 'Cashtag', placeholder: '$YourBusiness' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Cash App API Key (via Square)' },
      { key: 'locationId', label: 'Location ID', placeholder: 'Square Location ID' },
    ],
  },
  zelle: {
    label: 'Zelle',
    fields: [
      { key: 'email', label: 'Zelle Email', placeholder: 'payments@yourbusiness.com' },
      { key: 'phone', label: 'Zelle Phone', placeholder: '+1234567890' },
      { key: 'recipientName', label: 'Recipient Name', placeholder: 'Business Name' },
      { key: 'instructions', label: 'Payment Instructions', placeholder: 'Include your username in the memo' },
    ],
  },
};

export default function PaymentGatewaysPage() {
  const [gateways, setGateways] = useState<any[]>([]);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [configForm, setConfigForm] = useState<GatewayConfig>({});
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await api('/payment-gateways');
      if (data.length === 0) {
        const seeded = await api('/payment-gateways/seed-defaults', { method: 'POST' });
        setGateways(seeded);
      } else {
        setGateways(data);
      }
    } catch {
      setGateways([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (gw: any) => {
    setEditTarget(gw);
    setConfigForm(gw.config || {});
    setIsEnabled(gw.isEnabled);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await api(`/payment-gateways/${editTarget.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        isEnabled,
        config: configForm,
      }),
    });
    setEditTarget(null);
    load();
  };

  const handleToggle = async (gw: any) => {
    await api(`/payment-gateways/${gw.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isEnabled: !gw.isEnabled }),
    });
    load();
  };

  const getFields = (provider: string) => {
    return GATEWAY_FIELDS[provider]?.fields || [];
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payment Gateways</h1>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        Configure payment gateways for resellers to purchase credit packages. Enable a gateway and provide its credentials to activate it.
      </p>

      <div className="grid gap-4">
        {gateways.map((gw) => {
          const fieldDefs = getFields(gw.provider);
          const hasConfig = fieldDefs.some((f) => gw.config?.[f.key]);
          return (
            <div
              key={gw.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{gw.displayName}</span>
                    {gw.isEnabled ? (
                      <Badge variant="default" className="bg-green-600">Enabled</Badge>
                    ) : (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hasConfig ? 'Configured' : 'Not configured'} — {fieldDefs.length} settings available
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggle(gw)}
                >
                  {gw.isEnabled ? 'Disable' : 'Enable'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => startEdit(gw)}>
                  Configure
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure {editTarget?.displayName}</DialogTitle>
            <DialogDescription>Enter API credentials and settings for {editTarget?.displayName}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
              />
              Enabled
            </label>

            {editTarget && getFields(editTarget.provider).map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-sm font-medium">{field.label}</label>
                <Input
                  type={field.type || 'text'}
                  placeholder={field.placeholder}
                  value={configForm[field.key] || ''}
                  onChange={(e) => setConfigForm({ ...configForm, [field.key]: e.target.value })}
                />
              </div>
            ))}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
