'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, apiRaw, apiUpload } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UpdateWizard } from '@/components/update-wizard';
import { useLicense } from '@/lib/license-context';
import { cn } from '@/lib/utils';
import {
  Palette,
  Mail,
  CreditCard,
  KeyRound,
  Database,
  RefreshCw,
  Upload,
  Send,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ImagePlus,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Settings {
  siteName: string;
  logoPath: string | null;
  licenseKey: string | null;
  githubRepo: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFrom: string | null;
  smtpSecure: boolean;
}

interface LicenseStatus {
  valid: boolean;
  status: string;
  tier: string | null;
  expiresAt: string | null;
  features: string[];
  product: string | null;
  initError: string | null;
  gracePeriodEndsAt: string | null;
  locked: boolean;
}

interface PaymentGateway {
  id: string;
  provider: string;
  displayName: string;
  isEnabled: boolean;
  config: Record<string, string>;
}

const TABS: { key: TabKey; label: string; icon: LucideIcon; description: string }[] = [
  { key: 'branding', label: 'Branding', icon: Palette, description: 'Logo & site identity' },
  { key: 'email', label: 'Email / SMTP', icon: Mail, description: 'Mail server config' },
  { key: 'payments', label: 'Payments', icon: CreditCard, description: 'Payment gateways' },
  { key: 'license', label: 'License', icon: KeyRound, description: 'License management' },
  { key: 'backup', label: 'Backup', icon: Database, description: 'Database backup' },
  { key: 'updates', label: 'Updates', icon: RefreshCw, description: 'System updates' },
];

type TabKey = 'branding' | 'email' | 'payments' | 'license' | 'backup' | 'updates';

// ─── Gateway field definitions per provider ────────────

const GATEWAY_FIELDS: Record<string, { key: string; label: string; type?: string; placeholder: string }[]> = {
  stripe: [
    { key: 'secretKey', label: 'Secret Key', type: 'password', placeholder: 'sk_live_...' },
    { key: 'publishableKey', label: 'Publishable Key', placeholder: 'pk_live_...' },
    { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', placeholder: 'whsec_...' },
  ],
  paypal: [
    { key: 'clientId', label: 'Client ID', placeholder: 'PayPal Client ID' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'PayPal Client Secret' },
    { key: 'mode', label: 'Mode', placeholder: 'sandbox or live' },
    { key: 'webhookId', label: 'Webhook ID', placeholder: 'PayPal Webhook ID' },
  ],
  authorize_net: [
    { key: 'apiLoginId', label: 'API Login ID', placeholder: 'API Login ID' },
    { key: 'transactionKey', label: 'Transaction Key', type: 'password', placeholder: 'Transaction Key' },
    { key: 'environment', label: 'Environment', placeholder: 'sandbox or production' },
  ],
  cashapp: [
    { key: 'cashtag', label: 'Cashtag', placeholder: '$YourBusiness' },
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Cash App API Key (via Square)' },
    { key: 'locationId', label: 'Location ID', placeholder: 'Square Location ID' },
  ],
  zelle: [
    { key: 'email', label: 'Zelle Email', placeholder: 'payments@yourbusiness.com' },
    { key: 'phone', label: 'Zelle Phone', placeholder: '+1234567890' },
    { key: 'recipientName', label: 'Recipient Name', placeholder: 'Business Name' },
    { key: 'instructions', label: 'Payment Instructions', placeholder: 'Include your username in the memo' },
  ],
  venmo: [
    { key: 'businessHandle', label: 'Business Handle', placeholder: '@your-business' },
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Venmo API Key (via PayPal/Braintree)' },
    { key: 'merchantId', label: 'Merchant ID', placeholder: 'Braintree Merchant ID' },
  ],
};

const GATEWAY_ORDER = ['stripe', 'paypal', 'authorize_net', 'cashapp', 'zelle', 'venmo'];

const GATEWAY_META: Record<string, { name: string; color: string; accent: string; docsUrl: string; docsLabel: string }> = {
  stripe: { name: 'Stripe', color: 'from-violet-500/20 to-indigo-500/10', accent: 'text-violet-400', docsUrl: 'https://docs.stripe.com/keys', docsLabel: 'Stripe API Keys Guide' },
  paypal: { name: 'PayPal', color: 'from-blue-500/20 to-sky-500/10', accent: 'text-blue-400', docsUrl: 'https://developer.paypal.com/api/rest/', docsLabel: 'PayPal REST API Setup' },
  authorize_net: { name: 'Authorize.net', color: 'from-orange-500/20 to-amber-500/10', accent: 'text-orange-400', docsUrl: 'https://developer.authorize.net/api/reference/index.html', docsLabel: 'Authorize.net API Reference' },
  cashapp: { name: 'Cash App', color: 'from-emerald-500/20 to-green-500/10', accent: 'text-emerald-400', docsUrl: 'https://developer.squareup.com/docs/cash-app-pay', docsLabel: 'Cash App Pay via Square Docs' },
  zelle: { name: 'Zelle', color: 'from-purple-500/20 to-fuchsia-500/10', accent: 'text-purple-400', docsUrl: 'https://www.zellepay.com/get-started', docsLabel: 'Zelle Setup Guide' },
  venmo: { name: 'Venmo', color: 'from-cyan-500/20 to-teal-500/10', accent: 'text-cyan-400', docsUrl: 'https://developer.paypal.com/docs/checkout/pay-with-venmo/', docsLabel: 'Venmo via Braintree/PayPal Docs' },
};

// ─── Gateway SVG logos ────────────────────────────────
function StripeLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
    </svg>
  );
}

function PayPalLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
    </svg>
  );
}

function AuthorizeNetLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
      <path d="M14 15h4" />
    </svg>
  );
}

function CashAppLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.59 3.47A5.1 5.1 0 0 0 20.53.41C19.36 0 18.05 0 15.44 0H8.56C5.95 0 4.64 0 3.47.41A5.1 5.1 0 0 0 .41 3.47C0 4.64 0 5.95 0 8.56v6.88c0 2.61 0 3.92.41 5.09a5.1 5.1 0 0 0 3.06 3.06c1.17.41 2.48.41 5.09.41h6.88c2.61 0 3.92 0 5.09-.41a5.1 5.1 0 0 0 3.06-3.06c.41-1.17.41-2.48.41-5.09V8.56c0-2.61 0-3.92-.41-5.09zM17.42 7.67l-.89.89a.37.37 0 0 1-.48.04 5.02 5.02 0 0 0-2.76-.83c-1.18 0-2.01.53-2.01 1.32 0 .86.86 1.17 2.27 1.63 2.14.7 3.84 1.5 3.84 3.75 0 2.37-1.89 3.98-4.75 4.17l-.37 1.15a.37.37 0 0 1-.35.26h-1.7a.37.37 0 0 1-.36-.47l.35-1.1c-1.33-.24-2.47-.8-3.22-1.47a.37.37 0 0 1-.02-.53l.94-.94a.37.37 0 0 1 .49-.03 5.32 5.32 0 0 0 3.18 1.1c1.4 0 2.2-.62 2.2-1.48 0-.9-.77-1.27-2.42-1.81-2.04-.68-3.57-1.53-3.57-3.54 0-2.13 1.69-3.73 4.37-3.98l.35-1.11a.37.37 0 0 1 .35-.26h1.7c.25 0 .42.23.36.47l-.33 1.05c1.12.22 2.04.65 2.72 1.17a.37.37 0 0 1 .05.53z" />
    </svg>
  );
}

function ZelleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.559 24h-2.841a.483.483 0 0 1-.483-.483v-6.628H4.559A.559.559 0 0 1 4 16.33v-2.262a.97.97 0 0 1 .195-.583L14 1.165V4.63H8.89l-4.27 5.426h5.616V4.262c0-.266.216-.482.483-.482h2.84c.267 0 .483.216.483.482v6.628h5.4a.558.558 0 0 1 .558.559v2.264a.968.968 0 0 1-.196.582L10 22.835V19.37h5.144l4.236-5.426h-5.616v5.573a.483.483 0 0 1-.205.396z" />
    </svg>
  );
}

function VenmoLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.559 0c.904 1.49 1.311 3.03 1.311 4.97 0 6.19-5.286 14.24-9.576 19.89H5.764L2.13.78l7.15-.67 1.9 15.28c1.77-2.88 3.95-7.41 3.95-10.52 0-1.85-.316-3.11-.812-4.12L21.559 0z" />
    </svg>
  );
}

const GatewayLogo: Record<string, React.FC<{ className?: string }>> = {
  stripe: StripeLogo,
  paypal: PayPalLogo,
  authorize_net: AuthorizeNetLogo,
  cashapp: CashAppLogo,
  zelle: ZelleLogo,
  venmo: VenmoLogo,
};

// ─── Helper: section panel wrapper ─────────────────────

function SettingsPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-5 space-y-4',
      className,
    )}>
      {children}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h3 className="font-heading text-base font-semibold text-foreground/90">{title}</h3>
      {description && <p className="mt-1 font-body text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">{children}</label>;
}

function maskLicenseKey(key: string) {
  if (key.length <= 8) return '****';
  return key.slice(0, 3) + '-' + '*'.repeat(4) + '-' + '*'.repeat(4) + '-' + key.slice(-4);
}

// ─── Main page ─────────────────────────────────────────

export default function SettingsPage() {
  const { refresh: refreshLicense } = useLicense();
  const searchParams = useSearchParams();
  const initialTab = TABS.find((t) => t.key === searchParams.get('tab'))?.key || 'branding';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [siteName, setSiteName] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [activatingLicense, setActivatingLicense] = useState(false);

  // Payment gateways
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [gatewayConfigs, setGatewayConfigs] = useState<Record<string, Record<string, string>>>({});
  const [savingGateway, setSavingGateway] = useState<string | null>(null);

  const loadLicenseStatus = useCallback(() =>
    api<LicenseStatus>('/license/status')
      .then((data) => setLicenseStatus(data))
      .catch(() => {}),
  []);

  const loadGateways = useCallback(async () => {
    try {
      let data = await api<PaymentGateway[]>('/payment-gateways');
      if (data.length === 0) {
        data = await api<PaymentGateway[]>('/payment-gateways/seed-defaults', { method: 'POST' });
      }
      setGateways(data);
      const configs: Record<string, Record<string, string>> = {};
      for (const gw of data) {
        configs[gw.provider] = gw.config || {};
      }
      setGatewayConfigs(configs);
    } catch {
      setGateways([]);
    }
  }, []);

  const load = useCallback(() => {
    api<Settings>('/settings')
      .then((data) => {
        setSettings(data);
        setSiteName(data.siteName);
        setLicenseKey(data.licenseKey || '');
        setGithubRepo(data.githubRepo || '');
        setSmtpHost(data.smtpHost || '');
        setSmtpPort(data.smtpPort ? String(data.smtpPort) : '');
        setSmtpUser(data.smtpUser || '');
        setSmtpPass(data.smtpPass || '');
        setSmtpFrom(data.smtpFrom || '');
        setSmtpSecure(data.smtpSecure ?? false);
        if (data.logoPath) {
          setLogoPreview(`${API_URL}/settings/logo`);
        }
        setLoadError(null);
      })
      .catch((err) => {
        setLoadError(err.message || 'Failed to load settings');
      });
    loadLicenseStatus();
    loadGateways();
  }, [loadLicenseStatus, loadGateways]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(loadLicenseStatus, 30000);
    return () => clearInterval(interval);
  }, [loadLicenseStatus]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          siteName,
          githubRepo,
          smtpHost: smtpHost || null,
          smtpPort: smtpPort ? parseInt(smtpPort, 10) : null,
          smtpUser: smtpUser || null,
          smtpPass: smtpPass || null,
          smtpFrom: smtpFrom || null,
          smtpSecure,
        }),
      });
      showMessage('Settings saved', 'success');
      load();
    } catch (err: any) {
      showMessage(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleActivateLicense = async () => {
    if (!licenseKey.trim()) return;
    setActivatingLicense(true);
    try {
      const result = await api<{ licenseStatus?: LicenseStatus }>('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });
      await loadLicenseStatus();
      refreshLicense();
      if (result.licenseStatus?.valid) {
        showMessage('License activated successfully', 'success');
      } else {
        const err = result.licenseStatus?.initError || 'License validation failed';
        showMessage(err, 'error');
      }
    } catch (err: any) {
      showMessage(err.message || 'Failed to save license key', 'error');
    } finally {
      setActivatingLicense(false);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', logoFile);
      await apiUpload('/settings/logo', formData);
      showMessage('Logo uploaded', 'success');
      setLogoFile(null);
      load();
    } catch (err: any) {
      showMessage(err.message || 'Failed to upload logo', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleBackup = async () => {
    setDownloadingBackup(true);
    try {
      const resp = await apiRaw('/settings/backup', { method: 'POST' });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = resp.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] || 'backup.sql';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showMessage('Backup downloaded', 'success');
    } catch (err: any) {
      showMessage(err.message || 'Failed to create backup', 'error');
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailTo.trim()) return;
    setTestingEmail(true);
    try {
      const result = await api<{ success: boolean; message: string }>('/settings/test-email', {
        method: 'POST',
        body: JSON.stringify({ to: testEmailTo.trim() }),
      });
      if (result.success) {
        showMessage(result.message, 'success');
      } else {
        showMessage(result.message, 'error');
      }
      setShowTestEmail(false);
      setTestEmailTo('');
    } catch (err: any) {
      showMessage(err.message || 'Failed to send test email', 'error');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleToggleGateway = async (gw: PaymentGateway) => {
    try {
      await api(`/payment-gateways/${gw.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !gw.isEnabled }),
      });
      showMessage(`${gw.displayName} ${gw.isEnabled ? 'disabled' : 'enabled'}`, 'success');
      loadGateways();
    } catch (err: any) {
      showMessage(err.message || 'Failed to update gateway', 'error');
    }
  };

  const handleSaveGateway = async (gw: PaymentGateway, config: Record<string, string>) => {
    setSavingGateway(gw.provider);
    try {
      await api(`/payment-gateways/${gw.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ config }),
      });
      showMessage(`${gw.displayName} settings saved`, 'success');
      loadGateways();
    } catch (err: any) {
      showMessage(err.message || 'Failed to save gateway settings', 'error');
    } finally {
      setSavingGateway(null);
    }
  };

  // ─── Loading / Error states ────────────────────────────

  if (!settings) {
    if (loadError) {
      return (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-5">
          <XCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <p className="font-body text-sm text-rose-400">{loadError}</p>
        </div>
      );
    }
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
          <span className="font-body text-sm">Loading settings...</span>
        </div>
      </div>
    );
  }

  // ─── License helper data ───────────────────────────────

  const licenseConfig: Record<string, { icon: LucideIcon; label: string; description: string; border: string; bg: string; text: string }> = {
    active: { icon: ShieldCheck, label: 'Licensed', description: 'Your license is active and valid', border: 'border-emerald-500/30', bg: 'bg-gradient-to-br from-emerald-500/10 to-green-500/5', text: 'text-emerald-400' },
    grace_period: { icon: Clock, label: 'Grace Period', description: 'License is in grace period — renew soon', border: 'border-amber-500/30', bg: 'bg-gradient-to-br from-amber-500/10 to-yellow-500/5', text: 'text-amber-400' },
    expired: { icon: ShieldX, label: 'Expired', description: 'Your license has expired', border: 'border-rose-500/30', bg: 'bg-gradient-to-br from-rose-500/10 to-rose-500/5', text: 'text-rose-400' },
    suspended: { icon: ShieldAlert, label: 'Suspended', description: 'Your license has been suspended', border: 'border-rose-500/30', bg: 'bg-gradient-to-br from-rose-500/10 to-rose-500/5', text: 'text-rose-400' },
    no_license: { icon: Shield, label: 'Unlicensed', description: 'No license key has been activated', border: 'border-zinc-500/30', bg: 'bg-gradient-to-br from-zinc-500/10 to-zinc-600/5', text: 'text-zinc-400' },
  };

  const lc = licenseConfig[licenseStatus?.status || ''] || licenseConfig.no_license;
  const LicenseIcon = lc.icon;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-gradient bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">Manage your platform configuration</p>
      </div>

      {/* Toast */}
      {message && (
        <div
          className={cn(
            'mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 font-body text-sm animate-slide-in-from-bottom',
            message.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-400',
          )}
        >
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Two-column layout: tabs + content */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ─── Tab navigation (vertical sidebar) ──────── */}
        <nav className="shrink-0 lg:w-56">
          <div className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-x-visible lg:pb-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-200 whitespace-nowrap lg:whitespace-normal lg:w-full font-body',
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/15 to-teal-500/10 text-cyan-400 shadow-sm shadow-cyan-500/5'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 hidden h-6 w-0.5 -translate-y-1/2 rounded-full bg-cyan-500 lg:block" />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium">{tab.label}</span>
                    <span className="mt-0.5 hidden text-xs text-muted-foreground lg:block">{tab.description}</span>
                  </div>
                  <ChevronRight className={cn(
                    'ml-auto hidden h-3.5 w-3.5 shrink-0 transition-opacity lg:block',
                    isActive ? 'opacity-60' : 'opacity-0 group-hover:opacity-30',
                  )} />
                </button>
              );
            })}
          </div>
        </nav>

        {/* ─── Content area ───────────────────────────── */}
        <div className="min-w-0 flex-1">

          {/* ─── Branding ───────────────────────────── */}
          {activeTab === 'branding' && (
            <SettingsPanel>
              <SectionHeader title="Site Identity" description="Customize your platform's appearance with a logo and display name." />

              <div className="space-y-5">
                {/* Logo upload */}
                <div>
                  <FieldLabel>Logo</FieldLabel>
                  <div className="flex items-start gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/20 bg-card/60">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain p-1" />
                      ) : (
                        <ImagePlus className="h-6 w-6 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input type="file" accept="image/*" onChange={handleLogoSelect} className="text-xs" />
                      <Button size="sm" onClick={handleLogoUpload} disabled={!logoFile || uploadingLogo} className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">
                        <Upload className="mr-2 h-3.5 w-3.5" />
                        {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Site name */}
                <div>
                  <FieldLabel>Site Name</FieldLabel>
                  <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="VPN Platform" />
                </div>
              </div>

              <div className="mt-6 flex justify-end border-t border-border/20 pt-5">
                <Button onClick={handleSaveSettings} disabled={saving} className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </SettingsPanel>
          )}

          {/* ─── Email / SMTP ───────────────────────── */}
          {activeTab === 'email' && (
            <div className="space-y-5">
              <SettingsPanel>
                <SectionHeader title="SMTP Configuration" description="Configure your outgoing mail server for transactional emails." />

                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Host</FieldLabel>
                    <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" />
                  </div>
                  <div>
                    <FieldLabel>Port</FieldLabel>
                    <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" type="number" />
                  </div>
                  <div>
                    <FieldLabel>Username</FieldLabel>
                    <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="user@example.com" />
                  </div>
                  <div>
                    <FieldLabel>Password</FieldLabel>
                    <Input value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="********" type="password" />
                  </div>
                  <div>
                    <FieldLabel>From Address</FieldLabel>
                    <Input value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder="noreply@example.com" />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex cursor-pointer items-center gap-2.5 font-body text-sm">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={smtpSecure}
                          onChange={(e) => setSmtpSecure(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="h-5 w-9 rounded-full bg-zinc-700 transition-colors peer-checked:bg-cyan-600" />
                        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                      </div>
                      <span className="text-muted-foreground">TLS (port 465)</span>
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end border-t border-border/20 pt-5">
                  <Button onClick={handleSaveSettings} disabled={saving} className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </SettingsPanel>

              {/* Test Email */}
              <SettingsPanel>
                <SectionHeader title="Test Email" description="Send a test message to verify your SMTP configuration." />
                {!showTestEmail ? (
                  <Button variant="outline" size="sm" onClick={() => setShowTestEmail(true)} disabled={!smtpHost}>
                    <Send className="mr-2 h-3.5 w-3.5" />
                    Send Test Email
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={testEmailTo}
                      onChange={(e) => setTestEmailTo(e.target.value)}
                      placeholder="recipient@example.com"
                      type="email"
                      className="max-w-xs"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleTestEmail(); }}
                    />
                    <Button size="sm" onClick={handleTestEmail} disabled={testingEmail || !testEmailTo.trim()} className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">
                      {testingEmail ? 'Sending...' : 'Send'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowTestEmail(false); setTestEmailTo(''); }} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10">
                      Cancel
                    </Button>
                  </div>
                )}
              </SettingsPanel>
            </div>
          )}

          {/* ─── Payments ───────────────────────────── */}
          {activeTab === 'payments' && (
            <div className="space-y-3">
              <div className="mb-4">
                <p className="font-body text-sm text-muted-foreground">
                  Enable and configure payment gateways for processing purchases.
                </p>
              </div>

              {GATEWAY_ORDER.map((provider) => {
                const gw = gateways.find((g) => g.provider === provider);
                const fields = GATEWAY_FIELDS[provider];
                const config = gatewayConfigs[provider] || {};
                const meta = GATEWAY_META[provider];
                if (!gw || !fields) return null;

                return (
                  <div
                    key={provider}
                    className={cn(
                      'rounded-xl border transition-all duration-300 overflow-hidden',
                      gw.isEnabled
                        ? 'border-border/20 bg-card/40 backdrop-blur-sm'
                        : 'border-border/10 bg-card/20',
                    )}
                  >
                    {/* Gateway header */}
                    <div className="flex items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br',
                          meta.color,
                        )}>
                          {(() => { const Logo = GatewayLogo[provider]; return Logo ? <Logo className={cn('h-5 w-5', meta.accent)} /> : <CreditCard className={cn('h-4 w-4', meta.accent)} />; })()}
                        </div>
                        <div>
                          <h3 className="font-heading text-sm font-semibold text-foreground/90">{gw.displayName || meta.name}</h3>
                          {gw.isEnabled ? (
                            <span className="font-mono text-xs text-emerald-400">Configured</span>
                          ) : (
                            <a
                              href={meta.docsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-cyan-400 transition-colors"
                            >
                              Setup guide <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleGateway(gw)}
                        className={cn(
                          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-background',
                          gw.isEnabled ? 'bg-emerald-500' : 'bg-zinc-700',
                        )}
                        role="switch"
                        aria-checked={gw.isEnabled}
                        aria-label={`Toggle ${gw.displayName || meta.name}`}
                      >
                        <span
                          className={cn(
                            'pointer-events-none inline-block h-5 w-5 translate-y-0.5 transform rounded-full bg-white shadow-sm transition-transform duration-200',
                            gw.isEnabled ? 'translate-x-[22px]' : 'translate-x-0.5',
                          )}
                        />
                      </button>
                    </div>

                    {/* Config fields */}
                    {gw.isEnabled && (
                      <div className="border-t border-border/20 px-5 pb-5 pt-4">
                        <a
                          href={meta.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mb-4 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {meta.docsLabel}
                        </a>
                        <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
                          {fields.map((field) => (
                            <div key={field.key}>
                              <FieldLabel>{field.label}</FieldLabel>
                              <Input
                                type={field.type || 'text'}
                                placeholder={field.placeholder}
                                value={config[field.key] || ''}
                                onChange={(e) =>
                                  setGatewayConfigs((prev) => ({
                                    ...prev,
                                    [provider]: { ...prev[provider], [field.key]: e.target.value },
                                  }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleSaveGateway(gw, gatewayConfigs[provider] || {})}
                            disabled={savingGateway === provider}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15"
                          >
                            {savingGateway === provider ? 'Saving...' : 'Save Configuration'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── License ────────────────────────────── */}
          {activeTab === 'license' && (
            <div className="space-y-5">
              {/* Status card */}
              {licenseStatus && (
                <div className={cn('rounded-xl border p-5', lc.border, lc.bg)}>
                  <div className="flex items-center gap-4">
                    <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', lc.bg)}>
                      <LicenseIcon className={cn('h-6 w-6', lc.text)} />
                    </div>
                    <div>
                      <p className={cn('font-heading text-lg font-semibold', lc.text)}>{lc.label}</p>
                      <p className="font-body text-sm text-muted-foreground">{lc.description}</p>
                    </div>
                  </div>

                  {licenseStatus.initError && (
                    <div className="mt-4 rounded-lg bg-rose-500/10 px-3.5 py-2.5 font-body text-sm text-rose-400">
                      {licenseStatus.initError}
                    </div>
                  )}

                  {licenseStatus.status !== 'active' && licenseStatus.gracePeriodEndsAt && (
                    <div className={cn(
                      'mt-4 rounded-lg px-3.5 py-2.5 font-body text-sm',
                      licenseStatus.locked
                        ? 'bg-rose-500/10 text-rose-400'
                        : 'bg-amber-500/10 text-amber-400',
                    )}>
                      {licenseStatus.locked
                        ? 'Panel is locked. Enter a valid license key below to unlock.'
                        : `Panel will lock on ${new Date(licenseStatus.gracePeriodEndsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}
                    </div>
                  )}
                </div>
              )}

              {/* License details */}
              {licenseStatus && licenseStatus.status !== 'no_license' && (
                <SettingsPanel>
                  <SectionHeader title="License Details" />
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {settings?.licenseKey && (
                      <div>
                        <FieldLabel>License Key</FieldLabel>
                        <p className="mt-0.5 font-mono text-xs">{maskLicenseKey(settings.licenseKey)}</p>
                      </div>
                    )}
                    {licenseStatus.product && (
                      <div>
                        <FieldLabel>Product</FieldLabel>
                        <p className="mt-0.5 font-body text-sm">{licenseStatus.product}</p>
                      </div>
                    )}
                    {licenseStatus.tier && (
                      <div>
                        <FieldLabel>Tier</FieldLabel>
                        <p className="mt-0.5 font-body text-sm capitalize">{licenseStatus.tier}</p>
                      </div>
                    )}
                    <div>
                      <FieldLabel>Expires</FieldLabel>
                      <p className="mt-0.5 font-mono text-xs">
                        {licenseStatus.expiresAt
                          ? new Date(licenseStatus.expiresAt).toLocaleDateString(undefined, {
                              year: 'numeric', month: 'long', day: 'numeric',
                            })
                          : 'Never'}
                      </p>
                    </div>
                    {licenseStatus.features.length > 0 && (
                      <div className="col-span-2">
                        <FieldLabel>Features</FieldLabel>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {licenseStatus.features.map((f) => (
                            <Badge key={f} variant="default" className="bg-cyan-500/15 text-cyan-400 border-cyan-500/20 font-mono text-xs">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </SettingsPanel>
              )}

              {/* Activate license */}
              <SettingsPanel>
                <SectionHeader
                  title={licenseStatus?.status === 'no_license' ? 'Activate License' : 'Change License Key'}
                  description="Enter a valid license key to activate or update your subscription."
                />
                <div className="flex gap-2">
                  <Input
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="LF-XXXX-XXXX-XXXX-XXXX"
                    type="password"
                    className="font-mono"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleActivateLicense(); }}
                  />
                  <Button onClick={handleActivateLicense} disabled={activatingLicense || !licenseKey.trim()} className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">
                    <KeyRound className="mr-2 h-3.5 w-3.5" />
                    {activatingLicense ? 'Validating...' : 'Activate'}
                  </Button>
                </div>
              </SettingsPanel>
            </div>
          )}

          {/* ─── Backup ─────────────────────────────── */}
          {activeTab === 'backup' && (
            <SettingsPanel>
              <SectionHeader title="Database Backup" description="Download a full SQL dump of your database for safekeeping." />
              <div className="flex items-center gap-4 rounded-lg border border-border/20 bg-card/60 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/15 to-teal-500/10">
                  <Database className="h-5 w-5 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <p className="font-heading text-sm font-semibold text-foreground/90">PostgreSQL Dump</p>
                  <p className="font-body text-xs text-muted-foreground">Exports all tables, users, and configuration</p>
                </div>
                <Button variant="outline" onClick={handleBackup} disabled={downloadingBackup}>
                  {downloadingBackup ? (
                    <>
                      <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    'Download Backup'
                  )}
                </Button>
              </div>
            </SettingsPanel>
          )}

          {/* ─── Updates ────────────────────────────── */}
          {activeTab === 'updates' && (
            <div className="space-y-5">
              <SettingsPanel>
                <SectionHeader title="Update Source" description="Configure the GitHub repository to check for platform updates." />
                <div>
                  <FieldLabel>Repository URL</FieldLabel>
                  <Input
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    placeholder="https://github.com/user/repo"
                  />
                </div>
                <div className="mt-6 flex justify-end border-t border-border/20 pt-5">
                  <Button onClick={handleSaveSettings} disabled={saving} className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </SettingsPanel>

              <SettingsPanel>
                <SectionHeader title="System Updates" description="Check for and install the latest platform updates." />
                <Button variant="outline" onClick={() => setUpdateDialogOpen(true)}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Manage Updates
                </Button>
              </SettingsPanel>
            </div>
          )}
        </div>
      </div>

      <UpdateWizard open={updateDialogOpen} onOpenChange={setUpdateDialogOpen} />
    </div>
  );
}
