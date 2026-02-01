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
      <rect width="40" height="40" rx="10" fill="#0D9488" />
      <path
        d="M20 8L12 14v8c0 5.52 3.42 10.68 8 12 4.58-1.32 8-6.48 8-12v-8l-8-6z"
        fill="#F0FDFA"
        fillOpacity="0.9"
      />
      <path
        d="M20 12l-5 3.75v5c0 3.45 2.14 6.68 5 7.5 2.86-.82 5-4.05 5-7.5v-5L20 12z"
        fill="#0D9488"
      />
      <path
        d="M18 20l2 2 4-4"
        stroke="#F0FDFA"
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
      className={`group relative rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur transition-all duration-300 hover:border-teal-500/40 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-teal-500/5`}
    >
      <div className="mb-4 inline-flex rounded-xl bg-teal-500/10 p-3 text-teal-400 transition-colors group-hover:bg-teal-500/20">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat counter                                                      */
/* ------------------------------------------------------------------ */
function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-white md:text-4xl">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{label}</div>
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
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  /* If logged in, they'll be redirected above; show nothing in the gap */
  if (user) return null;

  /* ---------------------------------------------------------------- */
  /*  Landing page for unauthenticated visitors                       */
  /* ---------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-[#060B18] text-white antialiased">
      {/* ============================================================ */}
      {/*  NAV                                                         */}
      {/* ============================================================ */}
      <nav className="glass fixed top-0 z-50 w-full border-b border-white/5 bg-[#060B18]/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">
              VPN&nbsp;<span className="text-teal-400">Platform</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-slate-400 transition hover:text-white">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-slate-400 transition hover:text-white">
              How It Works
            </a>
            <a href="#resellers" className="text-sm text-slate-400 transition hover:text-white">
              Resellers
            </a>
            <a href="#security" className="text-sm text-slate-400 transition hover:text-white">
              Security
            </a>
            <Link
              href="/login"
              className="rounded-lg bg-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-teal-500/20 transition hover:bg-teal-400"
            >
              Sign In
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-slate-300"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-white/5 bg-[#060B18]/95 px-4 pb-4 pt-2 md:hidden glass">
            <a href="#features" className="block py-2 text-sm text-slate-300" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="block py-2 text-sm text-slate-300" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#resellers" className="block py-2 text-sm text-slate-300" onClick={() => setMobileMenuOpen(false)}>Resellers</a>
            <a href="#security" className="block py-2 text-sm text-slate-300" onClick={() => setMobileMenuOpen(false)}>Security</a>
            <Link
              href="/login"
              className="mt-2 block rounded-lg bg-teal-500 px-5 py-2.5 text-center text-sm font-semibold text-white"
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
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-teal-500/10 blur-[120px] animate-pulse-glow" />
        <div className="absolute right-0 top-40 h-[400px] w-[400px] rounded-full bg-orange-500/5 blur-[100px]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6 sm:pb-28 sm:pt-32 lg:px-8 lg:pb-36 lg:pt-40">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-4 py-1.5 text-sm text-teal-300">
              <Zap className="h-3.5 w-3.5" />
              Built on OpenVPN Community Server
            </div>

            {/* Headline */}
            <h1 className="animate-fade-up animation-delay-100 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Enterprise VPN,{' '}
              <span className="text-gradient bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400">
                Zero Complexity
              </span>
            </h1>

            <p className="animate-fade-up animation-delay-200 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
              Deploy, manage, and scale a full VPN infrastructure with multi-tier reseller support,
              hard concurrency enforcement, and built-in billing&mdash;all from a single dashboard.
            </p>

            {/* CTAs */}
            <div className="animate-fade-up animation-delay-300 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="group flex items-center gap-2 rounded-xl bg-teal-500 px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-teal-500/25 transition hover:bg-teal-400 hover:shadow-teal-400/30"
              >
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#features"
                className="flex items-center gap-2 rounded-xl border border-slate-700 px-8 py-3.5 text-base font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                See Features
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Hero visual — stylized dashboard mockup */}
          <div className="animate-fade-up animation-delay-500 relative mx-auto mt-16 max-w-5xl sm:mt-20">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-b from-teal-500/20 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/90 shadow-2xl">
              {/* Title bar */}
              <div className="flex items-center gap-2 border-b border-slate-700/60 bg-slate-800/60 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-500/70" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                <div className="h-3 w-3 rounded-full bg-green-500/70" />
                <div className="ml-4 text-xs text-slate-500">VPN Platform — Admin Dashboard</div>
              </div>
              {/* Mock content */}
              <div className="grid grid-cols-12 gap-4 p-6">
                {/* Sidebar mock */}
                <div className="col-span-3 hidden space-y-3 lg:block">
                  {['Dashboard', 'Users', 'Resellers', 'VPN Nodes', 'Packages', 'Billing', 'Audit Log'].map(
                    (item, i) => (
                      <div
                        key={item}
                        className={`rounded-lg px-3 py-2 text-xs font-medium ${
                          i === 0
                            ? 'bg-teal-500/15 text-teal-400'
                            : 'text-slate-500 hover:text-slate-400'
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
                    <div className="rounded-xl border border-slate-700/40 bg-slate-800/50 p-3">
                      <div className="text-xs text-slate-500">Active Users</div>
                      <div className="mt-1 text-xl font-bold text-teal-400">1,247</div>
                    </div>
                    <div className="rounded-xl border border-slate-700/40 bg-slate-800/50 p-3">
                      <div className="text-xs text-slate-500">VPN Nodes</div>
                      <div className="mt-1 text-xl font-bold text-emerald-400">18</div>
                    </div>
                    <div className="rounded-xl border border-slate-700/40 bg-slate-800/50 p-3">
                      <div className="text-xs text-slate-500">Sessions</div>
                      <div className="mt-1 text-xl font-bold text-cyan-400">843</div>
                    </div>
                    <div className="rounded-xl border border-slate-700/40 bg-slate-800/50 p-3">
                      <div className="text-xs text-slate-500">Revenue</div>
                      <div className="mt-1 text-xl font-bold text-orange-400">$24.8k</div>
                    </div>
                  </div>
                  {/* Chart placeholder */}
                  <div className="flex h-40 items-end gap-1 rounded-xl border border-slate-700/40 bg-slate-800/50 px-6 pb-4 pt-8 sm:h-48">
                    {[35, 50, 45, 60, 55, 70, 65, 80, 75, 90, 85, 95, 88, 92, 96].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-teal-600 to-teal-400 opacity-80 transition-all hover:opacity-100"
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
      <AnimatedSection id="stats" className="border-y border-slate-800 bg-slate-900/50">
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
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-300">
              CAPABILITIES
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to run a{' '}
              <span className="text-teal-400">VPN business</span>
            </h2>
            <p className="mt-4 text-lg text-slate-400">
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
      <AnimatedSection id="how-it-works" className="border-t border-slate-800 bg-slate-900/30 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              HOW IT WORKS
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              From zero to VPN provider in{' '}
              <span className="text-emerald-400">three steps</span>
            </h2>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {/* Step 01 */}
            <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
              <div className="text-5xl font-black text-teal-500/15">01</div>
              <div className="mt-2 inline-flex rounded-xl bg-teal-500/10 p-3 text-teal-400">
                <Server className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">Deploy the Platform</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Spin up the stack with Docker Compose. The API, dashboard, and database come preconfigured. Point your domain and you&apos;re live.
              </p>
            </div>
            {/* Step 02 */}
            <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
              <div className="text-5xl font-black text-emerald-500/15">02</div>
              <div className="mt-2 inline-flex rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
                <Globe className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">Register VPN Nodes</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Install the lightweight node agent on your OpenVPN servers. They auto-register via heartbeat and appear in your dashboard.
              </p>
            </div>
            {/* Step 03 */}
            <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
              <div className="text-5xl font-black text-cyan-500/15">03</div>
              <div className="mt-2 inline-flex rounded-xl bg-cyan-500/10 p-3 text-cyan-400">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">Sell &amp; Manage</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Create resellers, define packages, set connection limits. Your resellers onboard their own users with full self-service.
              </p>
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
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-300">
                RESELLER PROGRAM
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Build your own VPN brand,{' '}
                <span className="text-orange-400">your way</span>
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-400">
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
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-400" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: visual — reseller tree */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-orange-500/10 to-teal-500/10 blur-2xl" />
              <div className="relative rounded-2xl border border-slate-700/60 bg-slate-900/90 p-6">
                <div className="text-xs font-medium text-slate-500 mb-4">Reseller Hierarchy</div>
                {/* Root */}
                <div className="flex items-center gap-3 rounded-xl bg-teal-500/10 border border-teal-500/20 p-3">
                  <Shield className="h-5 w-5 text-teal-400" />
                  <div>
                    <div className="text-sm font-semibold text-white">Your Brand VPN</div>
                    <div className="text-xs text-slate-400">Admin / Root Provider</div>
                  </div>
                </div>
                {/* Level 1 */}
                <div className="ml-6 mt-2 border-l-2 border-slate-700 pl-6 space-y-2">
                  <div className="flex items-center gap-3 rounded-xl bg-orange-500/10 border border-orange-500/20 p-3">
                    <Users className="h-5 w-5 text-orange-400" />
                    <div>
                      <div className="text-sm font-semibold text-white">Regional Partner A</div>
                      <div className="text-xs text-slate-400">Reseller &middot; 142 users &middot; $2.4k credit</div>
                    </div>
                  </div>
                  {/* Level 2 */}
                  <div className="ml-6 border-l-2 border-slate-700 pl-6 space-y-2">
                    <div className="flex items-center gap-3 rounded-lg bg-slate-800/60 border border-slate-700/40 p-2.5">
                      <Users className="h-4 w-4 text-cyan-400" />
                      <div>
                        <div className="text-xs font-semibold text-white">Sub-Reseller X</div>
                        <div className="text-xs text-slate-500">38 users</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-slate-800/60 border border-slate-700/40 p-2.5">
                      <Users className="h-4 w-4 text-cyan-400" />
                      <div>
                        <div className="text-xs font-semibold text-white">Sub-Reseller Y</div>
                        <div className="text-xs text-slate-500">67 users</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-orange-500/10 border border-orange-500/20 p-3">
                    <Users className="h-5 w-5 text-orange-400" />
                    <div>
                      <div className="text-sm font-semibold text-white">Regional Partner B</div>
                      <div className="text-xs text-slate-400">Reseller &middot; 89 users &middot; $1.1k credit</div>
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
      <AnimatedSection id="security" className="border-t border-slate-800 bg-slate-900/30 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
              SECURITY
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Security that&rsquo;s not an{' '}
              <span className="text-red-400">afterthought</span>
            </h2>
            <p className="mt-4 text-lg text-slate-400">
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
                className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
              >
                <div className="flex-shrink-0 rounded-xl bg-red-500/10 p-3 text-red-400 h-fit">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{item.description}</p>
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
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              TECH STACK
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built on proven{' '}
              <span className="text-cyan-400">technology</span>
            </h2>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
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
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center transition hover:border-slate-700 hover:bg-slate-900/70"
              >
                <div className="text-sm font-semibold text-white">{tech.name}</div>
                <div className="mt-0.5 text-xs text-slate-500">{tech.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ============================================================ */}
      {/*  CTA                                                         */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden border-t border-slate-800 py-24 sm:py-32">
        <div className="absolute inset-0 bg-grid" />
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/8 blur-[100px]" />

        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Ready to launch your{' '}
            <span className="text-gradient bg-gradient-to-r from-teal-400 to-emerald-400">
              VPN platform
            </span>
            ?
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Sign in to access your dashboard, manage nodes, and start onboarding users.
          </p>
          <div className="mt-10">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 rounded-xl bg-teal-500 px-10 py-4 text-lg font-semibold text-white shadow-xl shadow-teal-500/25 transition hover:bg-teal-400 hover:shadow-teal-400/30"
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
      <footer className="border-t border-slate-800 bg-[#040810]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2.5">
              <Logo className="h-7 w-7" />
              <span className="text-sm font-semibold text-slate-400">
                VPN Platform
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <a href="#features" className="transition hover:text-slate-300">Features</a>
              <a href="#security" className="transition hover:text-slate-300">Security</a>
              <a href="#resellers" className="transition hover:text-slate-300">Resellers</a>
              <Link href="/login" className="transition hover:text-slate-300">Sign In</Link>
            </div>
            <div className="text-xs text-slate-600">
              &copy; {new Date().getFullYear()} VPN Platform. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
