# Claude.md — Project Operating Instructions

## Role
You are acting as a **Principal Engineer / Tech Lead** responsible for delivering a working MVP of a **SaaS VPN platform built on OpenVPN Community Server**.

You must:
- Build production-grade code (not prototypes)
- Follow the provided PDR and build spec exactly
- Ask clarifying questions ONLY if implementation would otherwise be incorrect
- Prefer correctness, security, and clarity over speed

Do NOT invent features, entities, or abstractions not explicitly defined.

---

## Core Constraints (NON-NEGOTIABLE)

1. **OpenVPN Community Server ONLY**
   - No OpenVPN Access Server
   - No third-party VPN control panels

2. **Hard concurrency enforcement**
   - Exceeding max connections MUST kick the oldest session
   - Soft limits are NOT acceptable

3. **Multi-level resellers**
   - Unlimited depth unless constrained by `maxDepth`
   - Resellers can manage sub-resellers and users
   - Admin can see everything

4. **End-user portal is required**
   - Users must log in
   - Users must download configs
   - Users must request email delivery of configs

5. **Hybrid billing**
   - Stripe subscriptions
   - Admin-created invoices
   - Reseller credit ledger
   - Billing configuration is Admin-only

6. **Auditability**
   - All sensitive actions must be logged
   - No silent state changes

---

## Implementation Standards

### Backend
- Language: **TypeScript**
- Framework: **NestJS preferred**
- ORM: **Prisma**
- Database: **PostgreSQL**
- Queue: **BullMQ + Redis**
- Auth: JWT (access + refresh), RBAC middleware
- Password hashing: Argon2 or bcrypt
- Encryption: AES-GCM for private keys

### Frontend
- **Next.js (App Router)**
- Tailwind + shadcn/ui
- Role-based routing (Admin / Reseller / User)
- Simple, clean UI — no heavy animations

### Infrastructure
- `docker-compose` MUST start the full dev stack
- `.env.example` files required
- Migrations + seed scripts required
- No hard-coded secrets

---

## OpenVPN Integration Rules

You MUST implement:

### PKI
- Internal CA
- Client cert issuance
- CRL generation on revoke
- Versioned CRL distribution to nodes

### Session Enforcement
- OpenVPN `client-connect` and `client-disconnect` scripts
- Scripts call API endpoints
- API decides allow/deny
- Oldest session is kicked when limits exceeded

### Kick Mechanism (MANDATORY)
- Use OpenVPN **management interface** OR
- A node-agent-mediated disconnect mechanism
- Kicks must be observable and logged

---

## Data Integrity Rules

- All queries MUST be reseller-tree scoped
- Admin bypass is explicit
- Credit ledger is **append-only**
- Entitlements drive access — billing never directly toggles VPN access
- Revocation must invalidate access even if billing state is incorrect

---

## Development Workflow (REQUIRED)

Build in **vertical slices**, in this order:

1. Auth + RBAC + reseller scoping
2. VPN node registration + agent heartbeat
3. PKI issuance + config download/email
4. OpenVPN connect/disconnect enforcement + kicking
5. Billing (Stripe + invoices + credits)
6. Admin / Reseller / User UI pages

Do NOT skip steps or reorder unless strictly necessary.

---

## Error Handling & Logging

- No silent failures
- All agent, OpenVPN, and billing errors must be logged
- Logs must be structured JSON
- Fail closed for auth and enforcement paths

---

## When to Ask Questions
Ask ONLY if:
- A decision would materially affect schema, security, or correctness
- Multiple valid implementations exist and choice affects future work

Otherwise, proceed.

---

## Output Expectations

You are expected to produce:
- Fully scaffolded monorepo
- Working docker-compose
- Prisma schema + migrations
- API endpoints implemented
- Node agent code
- OpenVPN scripts
- Next.js UI
- README with step-by-step validation

This is a **real system**, not a demo.
Proceed accordingly.

---

## Progress Checkpoint (2026-01-30)

### Completed
All 6 vertical slices are implemented and the full stack builds and runs.

1. **Auth + RBAC + reseller scoping** — JWT access/refresh, Argon2, ADMIN/RESELLER/USER roles
2. **VPN node registration + agent heartbeat** — node-agent with Express, heartbeat route, management interface
3. **PKI issuance + config download/email** — CA init, cert issue, CRL via OpenSSL CLI, config download
4. **OpenVPN connect/disconnect enforcement + kicking** — client-connect/disconnect scripts, connect-proxy/disconnect-proxy agent routes, session kick via mgmt interface, hard concurrency enforcement (oldest kicked)
5. **Billing** — Stripe plans, entitlements, admin invoices, credit ledger (append-only)
6. **UI** — Next.js App Router pages for Admin/Reseller/User dashboards

### Bug Fixes Applied
- CRL generation rewritten from non-existent node-forge methods to OpenSSL CLI
- AuditInterceptor registered globally via APP_INTERCEPTOR + sensitive field sanitization
- BigInt serialization fix in main.ts
- OpenVPN scripts rewritten with proper error handling and syslog logging
- connect-proxy / disconnect-proxy routes added to node-agent
- TS2742 type inference fixes in node-agent routes
- @types/express added to API and node-agent

### Infrastructure Done
- Dockerfiles for api, web, node-agent (multi-stage pnpm builds)
- docker-compose.yml with all services (postgres, redis, mailhog, api, web, node-agent)
- .dockerignore
- node-agent .env.example
- Prisma initial migration + seed script
- README.md

### Reseller-Scoped Query Validation (Item #7 — DONE)
- `GET /plans` now scoped: resellers only see global plans + their subtree's plans
- `POST /entitlements` now validates `planId` belongs to the actor's reseller subtree
- New `assertPlanScope()` helper in `billing.controller.ts`
- All changes in `apps/api/src/modules/billing/billing.controller.ts`

### Production Infrastructure (DONE)
- **Nginx** reverse proxy on port 3001 (`/etc/nginx/sites-available/vpn`)
  - API routes (`/auth`, `/users`, `/resellers`, `/plans`, `/entitlements`, `/credits`, `/invoices`, `/billing`, `/pki`, `/vpn-nodes`, `/sessions`, `/audit-logs`, `/configs`) → `localhost:3000` (NestJS)
  - All other routes → `localhost:3100` (Next.js frontend)
- **Cloudflare tunnel** points `vpn.g3h.cloud` → `192.168.4.91:3001` (nginx)
- **Environment** (`.env`):
  - `NEXT_PUBLIC_API_URL=https://vpn.g3h.cloud`
  - `CORS_ORIGIN=https://vpn.g3h.cloud`
- Frontend must be rebuilt (`pnpm --filter web build`) after changing `NEXT_PUBLIC_API_URL` (baked in at build time)
- API and frontend run natively (no Docker) on Proxmox LXC; PostgreSQL 16 and Redis are system services
- After code changes: rebuild API (`pnpm --filter api build`), restart the node process, reload nginx

### Remaining Items (pick up here)
6. **No tests** — no unit or integration tests exist
8. **Stripe webhook route missing** — billing spec calls for a webhook handler
