'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import {
  Shield,
  Users,
  Globe,
  Zap,
  Lock,
  BarChart3,
  Server,
  CreditCard,
  ChevronRight,
  Menu,
  X,
  Activity,
  Key,
  FileText,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Tiny SVG logo component                                           */
/* ------------------------------------------------------------------ */
function Logo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" rx="10" fill="#0e7490" />
      <path
        d="M20 8L12 14v8c0 5.52 3.42 10.68 8 12 4.58-1.32 8-6.48 8-12v-8l-8-6z"
        fill="#ecfeff"
        fillOpacity="0.9"
      />
      <path
        d="M20 12l-5 3.75v5c0 3.45 2.14 6.68 5 7.5 2.86-.82 5-4.05 5-7.5v-5L20 12z"
        fill="#0e7490"
      />
      <path
        d="M18 20l2 2 4-4"
        stroke="#ecfeff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Section wrapper with scroll-triggered animation                   */
/* ------------------------------------------------------------------ */
function AnimatedSection({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.12 },
    );
    const el = document.getElementById(id || '');
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [id]);

  return (
    <section
      id={id}
      className={`${className} transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature card                                                      */
/* ------------------------------------------------------------------ */
function FeatureCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  delay: string;
}) {
  return (
    <div
      className={`group relative rounded-2xl border border-cyan-900/30 bg-[#0a0f1a]/80 p-6 backdrop-blur transition-all duration-300 hover:border-cyan-500/30 hover:bg-[#0c1220]/90 hover:shadow-lg hover:shadow-cyan-500/5`}
    >
      {/* Accent left border */}
      <div className="absolute left-0 top-6 bottom-6 w-[2px] rounded-full bg-gradient-to-b from-cyan-400/60 via-cyan-500/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="mb-4 inline-flex rounded-xl bg-cyan-500/10 p-3 text-cyan-400 transition-colors group-hover:bg-cyan-500/15 relative">
        {/* Inner glow */}
        <div className="absolute inset-0 rounded-xl bg-cyan-400/5 blur-sm" />
        <Icon className="h-6 w-6 relative z-10" />
      </div>
      <h3 className="font-heading mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="font-body text-sm leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat counter                                                      */
/* ------------------------------------------------------------------ */
function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400 md:text-4xl">{value}</div>
      <div className="font-body mt-1 text-sm text-slate-500 tracking-wide uppercase">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (user.role === 'ADMIN') router.replace('/admin');
      else if (user.role === 'RESELLER') router.replace('/reseller');
      else router.replace('/user');
    }
  }, [user, loading, router]);

  /* While checking auth, show nothing (will redirect fast) */
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#060810]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
          <p className="font-mono text-sm text-cyan-400/60">Initializing...</p>
        </div>
      </div>
    );
  }

  /* If logged in, they'll be redirected above; show nothing in the gap */
  if (user) return null;

  /* ---------------------------------------------------------------- */
  /*  Landing page for unauthenticated visitors                       */
  /* ---------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-[#060810] text-white antialiased">
      {/* Subtle background grid overlay */}
      <div className="fixed inset-0 z-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(34,211,238,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.4) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />

      {/* ============================================================ */}
      {/*  NAV                                                         */}
      {/* ============================================================ */}
      <nav className="fixed top-0 z-50 w-full border-b border-cyan-500/10 bg-[#060810]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="font-heading text-lg font-bold tracking-tight">
              VPN&nbsp;<span className="text-cyan-400">Platform</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="font-body text-sm text-slate-500 transition hover:text-cyan-400">
              Features
            </a>
            <a href="#how-it-works" className="font-body text-sm text-slate-500 transition hover:text-cyan-400">
              How It Works
            </a>
            <a href="#resellers" className="font-body text-sm text-slate-500 transition hover:text-cyan-400">
              Resellers
            </a>
            <a href="#security" className="font-body text-sm text-slate-500 transition hover:text-cyan-400">
              Security
            </a>
            <Link
              href="/login"
              className="font-heading rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-500 hover:to-teal-500 hover:shadow-cyan-400/25"
            >
              Sign In
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-slate-400 hover:text-cyan-400 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-cyan-500/10 bg-[#060810]/95 backdrop-blur-xl px-4 pb-4 pt-2 md:hidden">
            <a href="#features" className="block py-2 text-sm text-slate-400 hover:text-cyan-400" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="block py-2 text-sm text-slate-400 hover:text-cyan-400" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#resellers" className="block py-2 text-sm text-slate-400 hover:text-cyan-400" onClick={() => setMobileMenuOpen(false)}>Resellers</a>
            <a href="#security" className="block py-2 text-sm text-slate-400 hover:text-cyan-400" onClick={() => setMobileMenuOpen(false)}>Security</a>
            <Link
              href="/login"
              className="mt-2 block rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-2.5 text-center text-sm font-semibold text-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign In
            </Link>
          </div>
        )}
      </nav>

      {/* ============================================================ */}
      {/*  HERO                                                        */}
      {/* ============================================================ */}
      <header className="relative overflow-hidden pt-16">
        {/* Background effects */}
        <div className="absolute inset-0 bg-grid" />
        {/* Animated gradient mesh */}
        <div className="absolute left-1/2 top-0 h-[700px] w-[1000px] -translate-x-1/2 rounded-full bg-cyan-500/8 blur-[150px] animate-pulse-glow" />
        <div className="absolute left-1/4 top-20 h-[400px] w-[400px] rounded-full bg-teal-500/5 blur-[120px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
        <div className="absolute right-1/4 top-40 h-[300px] w-[300px] rounded-full bg-emerald-500/4 blur-[100px] animate-pulse-glow" style={{ animationDelay: '4s' }} />
        {/* Subtle radial lines from center */}
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] opacity-[0.04]" style={{
          backgroundImage: `conic-gradient(from 0deg, transparent, rgba(34,211,238,0.6) 2deg, transparent 4deg, transparent 30deg, rgba(34,211,238,0.6) 32deg, transparent 34deg, transparent 60deg, rgba(34,211,238,0.6) 62deg, transparent 64deg, transparent 90deg, rgba(34,211,238,0.6) 92deg, transparent 94deg, transparent 120deg, rgba(34,211,238,0.6) 122deg, transparent 124deg, transparent 150deg, rgba(34,211,238,0.6) 152deg, transparent 154deg, transparent 180deg, rgba(34,211,238,0.6) 182deg, transparent 184deg, transparent 210deg, rgba(34,211,238,0.6) 212deg, transparent 214deg, transparent 240deg, rgba(34,211,238,0.6) 242deg, transparent 244deg, transparent 270deg, rgba(34,211,238,0.6) 272deg, transparent 274deg, transparent 300deg, rgba(34,211,238,0.6) 302deg, transparent 304deg, transparent 330deg, rgba(34,211,238,0.6) 332deg, transparent 334deg)`,
        }} />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6 sm:pb-28 sm:pt-32 lg:px-8 lg:pb-36 lg:pt-40">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-4 py-1.5 text-sm font-mono text-cyan-400">
              <Zap className="h-3.5 w-3.5" />
              Built on OpenVPN Community Server
            </div>

            {/* Headline */}
            <h1 className="font-heading animate-fade-up animation-delay-100 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Enterprise VPN,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400">
                Zero Complexity
              </span>
            </h1>

            <p className="font-body animate-fade-up animation-delay-200 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
              Deploy, manage, and scale a full VPN infrastructure with multi-tier reseller support,
              hard concurrency enforcement, and built-in billing&mdash;all from a single dashboard.
            </p>

            {/* CTAs */}
            <div className="animate-fade-up animation-delay-300 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-cyan-500/20 transition hover:from-cyan-500 hover:to-teal-500 hover:shadow-cyan-400/25"
              >
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#features"
                className="flex items-center gap-2 rounded-xl border border-cyan-900/40 px-8 py-3.5 text-base font-semibold text-slate-300 transition hover:border-cyan-700/40 hover:text-cyan-400"
              >
                See Features
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Hero visual -- stylized dashboard mockup */}
          <div className="animate-fade-up animation-delay-500 relative mx-auto mt-16 max-w-5xl sm:mt-20">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-b from-cyan-500/15 via-teal-500/5 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-cyan-500/15 bg-[#0a0f1a]/95 shadow-2xl shadow-cyan-500/5">
              {/* Title bar */}
              <div className="flex items-center gap-2 border-b border-cyan-500/10 bg-[#0c1220]/80 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-rose-500/70" />
                <div className="h-3 w-3 rounded-full bg-amber-500/70" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/70" />
                <div className="ml-4 font-mono text-xs text-slate-600">vpn-platform://admin/dashboard</div>
              </div>
              {/* Mock content */}
              <div className="grid grid-cols-12 gap-4 p-6">
                {/* Sidebar mock */}
                <div className="col-span-3 hidden space-y-1 lg:block">
                  {['Dashboard', 'Users', 'Resellers', 'VPN Nodes', 'Packages', 'Billing', 'Audit Log'].map(
                    (item, i) => (
                      <div
                        key={item}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                          i === 0
                            ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                      >
                        {item}
                      </div>
                    ),
                  )}
                </div>
                {/* Main area */}
                <div className="col-span-12 space-y-4 lg:col-span-9">
                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-cyan-500/10 bg-[#0c1220]/60 p-3">
                      <div className="font-mono text-[10px] text-slate-600 uppercase tracking-wider">Active Users</div>
                      <div className="mt-1 font-mono text-xl font-bold text-cyan-400">1,247</div>
                    </div>
                    <div className="rounded-xl border border-teal-500/10 bg-[#0c1220]/60 p-3">
                      <div className="font-mono text-[10px] text-slate-600 uppercase tracking-wider">VPN Nodes</div>
                      <div className="mt-1 font-mono text-xl font-bold text-teal-400">18</div>
                    </div>
                    <div className="rounded-xl border border-cyan-500/10 bg-[#0c1220]/60 p-3">
                      <div className="font-mono text-[10px] text-slate-600 uppercase tracking-wider">Sessions</div>
                      <div className="mt-1 font-mono text-xl font-bold text-cyan-300">843</div>
                    </div>
                    <div className="rounded-xl border border-amber-500/10 bg-[#0c1220]/60 p-3">
                      <div className="font-mono text-[10px] text-slate-600 uppercase tracking-wider">Revenue</div>
                      <div className="mt-1 font-mono text-xl font-bold text-amber-400">$24.8k</div>
                    </div>
                  </div>
                  {/* Chart placeholder */}
                  <div className="flex h-40 items-end gap-1 rounded-xl border border-cyan-500/10 bg-[#0c1220]/60 px-6 pb-4 pt-8 sm:h-48">
                    {[35, 50, 45, 60, 55, 70, 65, 80, 75, 90, 85, 95, 88, 92, 96].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-cyan-600 via-teal-500 to-emerald-400 opacity-70 transition-all hover:opacity-100"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/*  STATS BAR                                                   */}
      {/* ============================================================ */}
      <AnimatedSection id="stats" className="border-y border-cyan-500/10 bg-[#080c18]/80">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
          <StatBlock value="OpenVPN" label="Protocol Foundation" />
          <StatBlock value="256-bit" label="AES Encryption" />
          <StatBlock value="Unlimited" label="Reseller Depth" />
          <StatBlock value="Real-time" label="Session Enforcement" />
        </div>
      </AnimatedSection>

      {/* ============================================================ */}
      {/*  FEATURES                                                    */}
      {/* ============================================================ */}
      <AnimatedSection id="features" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-xs font-mono font-medium text-cyan-400 tracking-widest">
              CAPABILITIES
            </div>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to run a{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">VPN business</span>
            </h2>
            <p className="font-body mt-4 text-lg text-slate-400">
              From certificate management to Stripe billing, every piece is built in and ready to go.
            </p>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={Key}
              title="Internal PKI"
              description="Full certificate authority — issue, revoke, and manage client certificates with automatic CRL generation. No external CA required."
              delay="0"
            />
            <FeatureCard
              icon={Users}
              title="Multi-Tier Resellers"
              description="Unlimited depth reseller tree with hierarchical data isolation. Each reseller manages their own users and sub-resellers."
              delay="100"
            />
            <FeatureCard
              icon={Activity}
              title="Hard Concurrency Control"
              description="Real-time session enforcement. When a user exceeds their connection limit, the oldest session is automatically kicked."
              delay="200"
            />
            <FeatureCard
              icon={Server}
              title="Multi-Node Architecture"
              description="Agent-based VPN node management with heartbeat monitoring. Register nodes, distribute configs, track health from one dashboard."
              delay="300"
            />
            <FeatureCard
              icon={CreditCard}
              title="Hybrid Billing"
              description="Stripe subscriptions for automated payments, plus admin-created invoices and an append-only credit ledger for reseller accounts."
              delay="400"
            />
            <FeatureCard
              icon={BarChart3}
              title="Audit Logging"
              description="Comprehensive, tamper-evident audit trail of every sensitive action — user creation, certificate revocation, billing events, and more."
              delay="500"
            />
            <FeatureCard
              icon={Globe}
              title="Config Distribution"
              description="Generate and email .ovpn configuration files directly to end users, or let them download from their self-service portal."
              delay="600"
            />
            <FeatureCard
              icon={Shield}
              title="Role-Based Access"
              description="Granular RBAC with three tiers: Admin, Reseller, and User. Every API endpoint enforces role and scope checks."
              delay="700"
            />
            <FeatureCard
              icon={Lock}
              title="Argon2 Authentication"
              description="Passwords hashed with Argon2id. JWT access and refresh tokens with automatic rotation and secure logout."
              delay="800"
            />
          </div>
        </div>
      </AnimatedSection>

      {/* ============================================================ */}
      {/*  HOW IT WORKS                                                */}
      {/* ============================================================ */}
      <AnimatedSection id="how-it-works" className="border-t border-cyan-500/10 bg-[#080c18]/50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/5 px-3 py-1 text-xs font-mono font-medium text-teal-400 tracking-widest">
              HOW IT WORKS
            </div>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              From zero to VPN provider in{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">three steps</span>
            </h2>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {/* Step 01 */}
            <div className="relative rounded-2xl border border-cyan-900/30 bg-[#0a0f1a]/80 p-8 overflow-hidden">
              <div className="font-mono text-5xl font-black text-cyan-500/10">01</div>
              <div className="mt-2 inline-flex rounded-xl bg-cyan-500/10 p-3 text-cyan-400 relative">
                <div className="absolute inset-0 rounded-xl bg-cyan-400/5 blur-sm" />
                <Server className="h-6 w-6 relative z-10" />
              </div>
              <h3 className="font-heading mt-4 text-xl font-semibold text-white">Deploy the Platform</h3>
              <p className="font-body mt-2 text-sm leading-relaxed text-slate-400">
                Spin up the stack with Docker Compose. The API, dashboard, and database come preconfigured. Point your domain and you&apos;re live.
              </p>
              {/* Decorative circuit line */}
              <div className="absolute bottom-0 right-0 w-20 h-20 opacity-10">
                <div className="absolute bottom-4 right-4 w-2 h-2 rounded-full bg-cyan-400" />
                <div className="absolute bottom-4 right-6 w-8 h-[1px] bg-cyan-400" />
                <div className="absolute bottom-4 right-14 w-[1px] h-8 bg-cyan-400" />
              </div>
            </div>
            {/* Step 02 */}
            <div className="relative rounded-2xl border border-cyan-900/30 bg-[#0a0f1a]/80 p-8 overflow-hidden">
              <div className="font-mono text-5xl font-black text-teal-500/10">02</div>
              <div className="mt-2 inline-flex rounded-xl bg-teal-500/10 p-3 text-teal-400 relative">
                <div className="absolute inset-0 rounded-xl bg-teal-400/5 blur-sm" />
                <Globe className="h-6 w-6 relative z-10" />
              </div>
              <h3 className="font-heading mt-4 text-xl font-semibold text-white">Register VPN Nodes</h3>
              <p className="font-body mt-2 text-sm leading-relaxed text-slate-400">
                Install the lightweight node agent on your OpenVPN servers. They auto-register via heartbeat and appear in your dashboard.
              </p>
              <div className="absolute bottom-0 right-0 w-20 h-20 opacity-10">
                <div className="absolute bottom-4 right-4 w-2 h-2 rounded-full bg-teal-400" />
                <div className="absolute bottom-4 right-6 w-8 h-[1px] bg-teal-400" />
                <div className="absolute bottom-4 right-14 w-[1px] h-8 bg-teal-400" />
              </div>
            </div>
            {/* Step 03 */}
            <div className="relative rounded-2xl border border-cyan-900/30 bg-[#0a0f1a]/80 p-8 overflow-hidden">
              <div className="font-mono text-5xl font-black text-emerald-500/10">03</div>
              <div className="mt-2 inline-flex rounded-xl bg-emerald-500/10 p-3 text-emerald-400 relative">
                <div className="absolute inset-0 rounded-xl bg-emerald-400/5 blur-sm" />
                <Users className="h-6 w-6 relative z-10" />
              </div>
              <h3 className="font-heading mt-4 text-xl font-semibold text-white">Sell &amp; Manage</h3>
              <p className="font-body mt-2 text-sm leading-relaxed text-slate-400">
                Create resellers, define packages, set connection limits. Your resellers onboard their own users with full self-service.
              </p>
              <div className="absolute bottom-0 right-0 w-20 h-20 opacity-10">
                <div className="absolute bottom-4 right-4 w-2 h-2 rounded-full bg-emerald-400" />
                <div className="absolute bottom-4 right-6 w-8 h-[1px] bg-emerald-400" />
                <div className="absolute bottom-4 right-14 w-[1px] h-8 bg-emerald-400" />
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* ============================================================ */}
      {/*  RESELLER SECTION                                            */}
      {/* ============================================================ */}
      <AnimatedSection id="resellers" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: text */}
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-xs font-mono font-medium text-amber-400 tracking-widest">
                RESELLER PROGRAM
              </div>
              <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                Build your own VPN brand,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">your way</span>
              </h2>
              <p className="font-body mt-4 text-lg leading-relaxed text-slate-400">
                Our multi-tier reseller system lets you white-label the entire platform. Create
                sub-resellers, set custom pricing, manage user limits, and track revenue — all
                scoped to your own tree.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  'Unlimited nesting depth for reseller hierarchies',
                  'Per-reseller credit ledger with full transaction history',
                  'Private package creation for custom pricing tiers',
                  'Scoped dashboards — each reseller sees only their data',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
                    <span className="font-body text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: visual -- reseller tree (circuit diagram style) */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-amber-500/5 via-cyan-500/5 to-teal-500/5 blur-2xl" />
              <div className="relative rounded-2xl border border-cyan-500/15 bg-[#0a0f1a]/95 p-6">
                <div className="font-mono text-[10px] font-medium text-slate-600 mb-4 uppercase tracking-widest">Reseller Hierarchy</div>
                {/* Root */}
                <div className="flex items-center gap-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3">
                  {/* Node indicator */}
                  <div className="relative">
                    <div className="absolute inset-0 rounded-lg bg-cyan-400/20 blur-sm" />
                    <Shield className="h-5 w-5 text-cyan-400 relative z-10" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Your Brand VPN</div>
                    <div className="font-mono text-xs text-slate-500">Admin / Root Provider</div>
                  </div>
                </div>
                {/* Level 1 -- circuit-style connecting lines */}
                <div className="ml-6 mt-0">
                  {/* Connecting line */}
                  <div className="relative border-l-2 border-cyan-500/20 pl-6 space-y-2 pt-2 pb-0">
                    {/* Horizontal connector dot */}
                    <div className="absolute left-[-5px] top-5 w-2 h-2 rounded-full bg-cyan-500/40 ring-2 ring-cyan-500/20" />
                    <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-lg bg-amber-400/20 blur-sm" />
                        <Users className="h-5 w-5 text-amber-400 relative z-10" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">Regional Partner A</div>
                        <div className="font-mono text-xs text-slate-500">Reseller &middot; <span className="text-cyan-400">142</span> users &middot; <span className="text-amber-400">$2.4k</span> credit</div>
                      </div>
                    </div>
                    {/* Level 2 */}
                    <div className="ml-6">
                      <div className="relative border-l-2 border-cyan-500/15 pl-6 space-y-2 pt-0 pb-0">
                        <div className="absolute left-[-5px] top-3 w-2 h-2 rounded-full bg-teal-500/40 ring-2 ring-teal-500/20" />
                        <div className="flex items-center gap-3 rounded-lg bg-[#0c1220]/80 border border-cyan-500/10 p-2.5">
                          <Users className="h-4 w-4 text-teal-400" />
                          <div>
                            <div className="text-xs font-semibold text-white">Sub-Reseller X</div>
                            <div className="font-mono text-xs text-slate-600"><span className="text-teal-400">38</span> users</div>
                          </div>
                        </div>
                        <div className="absolute left-[-5px] top-[52px] w-2 h-2 rounded-full bg-teal-500/40 ring-2 ring-teal-500/20" />
                        <div className="flex items-center gap-3 rounded-lg bg-[#0c1220]/80 border border-cyan-500/10 p-2.5">
                          <Users className="h-4 w-4 text-teal-400" />
                          <div>
                            <div className="text-xs font-semibold text-white">Sub-Reseller Y</div>
                            <div className="font-mono text-xs text-slate-600"><span className="text-teal-400">67</span> users</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute left-[-5px] top-[200px] w-2 h-2 rounded-full bg-cyan-500/40 ring-2 ring-cyan-500/20" />
                    <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-lg bg-amber-400/20 blur-sm" />
                        <Users className="h-5 w-5 text-amber-400 relative z-10" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">Regional Partner B</div>
                        <div className="font-mono text-xs text-slate-500">Reseller &middot; <span className="text-cyan-400">89</span> users &middot; <span className="text-amber-400">$1.1k</span> credit</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* ============================================================ */}
      {/*  SECURITY SECTION                                            */}
      {/* ============================================================ */}
      <AnimatedSection id="security" className="border-t border-cyan-500/10 bg-[#080c18]/50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/5 px-3 py-1 text-xs font-mono font-medium text-rose-400 tracking-widest">
              <Shield className="h-3 w-3" />
              SECURITY
            </div>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Security that&rsquo;s not an{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-amber-400">afterthought</span>
            </h2>
            <p className="font-body mt-4 text-lg text-slate-400">
              Every layer of the stack is designed with security as a first-class concern.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-2">
            {[
              {
                title: 'Internal Certificate Authority',
                description: 'Self-managed PKI with node-forge. Issue, revoke, and rotate client certs without any external dependency.',
                icon: Key,
              },
              {
                title: 'Argon2id Password Hashing',
                description: 'Industry-leading password hashing algorithm, resistant to GPU and ASIC brute-force attacks.',
                icon: Lock,
              },
              {
                title: 'JWT + Refresh Token Rotation',
                description: 'Short-lived access tokens with automatic refresh. Refresh tokens are single-use with secure server-side revocation.',
                icon: Shield,
              },
              {
                title: 'Append-Only Audit Trail',
                description: 'Every sensitive operation is logged immutably. Full traceability for compliance and forensics.',
                icon: FileText,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group flex gap-4 rounded-2xl border border-cyan-900/30 bg-[#0a0f1a]/80 p-6 transition-all duration-300 hover:border-rose-500/20 hover:bg-[#0c1220]/90"
              >
                <div className="flex-shrink-0 relative h-fit">
                  {/* Shield motif background */}
                  <div className="absolute -inset-1 rounded-xl bg-rose-500/5 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative rounded-xl bg-rose-500/10 p-3 text-rose-400 ring-1 ring-rose-500/10">
                    <item.icon className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-white">{item.title}</h3>
                  <p className="font-body mt-1 text-sm leading-relaxed text-slate-400">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ============================================================ */}
      {/*  TECH STACK                                                  */}
      {/* ============================================================ */}
      <AnimatedSection id="stack" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-xs font-mono font-medium text-cyan-400 tracking-widest">
              TECH STACK
            </div>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Built on proven{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400">technology</span>
            </h2>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {[
              { name: 'OpenVPN', desc: 'VPN Protocol' },
              { name: 'NestJS', desc: 'API Framework' },
              { name: 'Next.js', desc: 'Web Dashboard' },
              { name: 'PostgreSQL', desc: 'Database' },
              { name: 'Redis', desc: 'Cache & Queues' },
              { name: 'Prisma', desc: 'ORM' },
              { name: 'Stripe', desc: 'Payments' },
              { name: 'Docker', desc: 'Deployment' },
            ].map((tech) => (
              <div
                key={tech.name}
                className="group rounded-xl border border-cyan-900/20 bg-[#0a0f1a]/60 p-4 text-center transition-all duration-300 hover:border-cyan-500/20 hover:bg-[#0c1220]/80"
              >
                <div className="font-mono text-sm font-semibold text-cyan-400 group-hover:text-cyan-300 transition-colors">{tech.name}</div>
                <div className="font-body mt-0.5 text-xs text-slate-600">{tech.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ============================================================ */}
      {/*  CTA                                                         */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden border-t border-cyan-500/10 py-24 sm:py-32">
        <div className="absolute inset-0 bg-grid" />
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute left-1/3 top-1/3 h-[300px] w-[300px] rounded-full bg-teal-500/3 blur-[80px]" />

        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Ready to launch your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400">
              VPN platform
            </span>
            ?
          </h2>
          <p className="font-body mt-4 text-lg text-slate-400">
            Sign in to access your dashboard, manage nodes, and start onboarding users.
          </p>
          <div className="mt-10">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-10 py-4 text-lg font-semibold text-white shadow-xl shadow-cyan-500/20 transition hover:from-cyan-500 hover:to-teal-500 hover:shadow-cyan-400/25"
            >
              Sign In to Dashboard
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER                                                      */}
      {/* ============================================================ */}
      <footer className="border-t border-cyan-500/10 bg-[#050810]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2.5">
              <Logo className="h-7 w-7" />
              <span className="font-heading text-sm font-semibold text-slate-500">
                VPN Platform
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-600">
              <a href="#features" className="transition hover:text-cyan-400">Features</a>
              <a href="#security" className="transition hover:text-cyan-400">Security</a>
              <a href="#resellers" className="transition hover:text-cyan-400">Resellers</a>
              <Link href="/login" className="transition hover:text-cyan-400">Sign In</Link>
            </div>
            <div className="font-mono text-xs text-slate-700">
              &copy; {new Date().getFullYear()} VPN Platform. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
