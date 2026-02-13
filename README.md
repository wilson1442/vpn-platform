# VPN Platform

A production-grade SaaS VPN management platform built on OpenVPN Community Server with multi-level reseller support, hard concurrency enforcement, hybrid billing (Stripe + admin invoicing), PKI certificate management, and full role-based dashboards.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Production Deployment](#production-deployment)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Security](#security)
- [Validation Checklist](#validation-checklist)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Key Design Decisions](#key-design-decisions)

## Quick Start

Run the interactive installer with a single command:

```bash
wget -qO- https://raw.githubusercontent.com/wilson1442/vpn-platform/main/install.sh | bash
```

Or using curl:

```bash
curl -sSL https://raw.githubusercontent.com/wilson1442/vpn-platform/main/install.sh | bash
```

The installer will guide you through:
- Installation type (Docker or Native)
- Domain configuration
- SMTP settings
- Admin account creation
- Database setup
- Automatic secret generation

All configuration is logged to `install-notes.log` (with sensitive values masked).

## Architecture

```
vpn-platform/
├── apps/
│   ├── api/             # NestJS backend (port 3000)
│   ├── web/             # Next.js frontend (port 3100)
│   └── node-agent/      # Express agent for OpenVPN nodes (port 3001)
├── packages/
│   └── shared/          # Shared types, Zod schemas, constants
├── docker-compose.yml   # Dev infrastructure (Postgres, Redis, MailHog)
├── turbo.json           # Monorepo build orchestration
└── pnpm-workspace.yaml
```

## Tech Stack

| Layer       | Technology                                                    |
|-------------|---------------------------------------------------------------|
| Backend     | NestJS 10, TypeScript 5.7, Prisma ORM, PostgreSQL 16         |
| Frontend    | Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui   |
| Queue       | BullMQ + Redis 7                                              |
| Auth        | JWT (access + refresh rotation), Argon2 hashing, RBAC        |
| PKI         | node-forge (CA/certs), OpenSSL CLI (CRL generation)           |
| Encryption  | AES-256-GCM for private keys at rest                          |
| Billing     | Stripe 17, append-only credit ledger                          |
| VPN Nodes   | SSH2 provisioning, OpenVPN management interface               |
| Monorepo    | pnpm 9 workspaces, Turborepo                                 |
| Containers  | Docker, Docker Compose                                        |

## Features

- **Multi-level Reseller Tree** — Unlimited depth reseller hierarchy with scoped data access
- **Hard Concurrency Enforcement** — Oldest session kicked when user exceeds connection limit
- **PKI Management** — Internal CA, client certificate issuance, CRL generation and distribution
- **Hybrid Billing** — Stripe subscriptions for end users + admin invoicing with credit ledger for resellers
- **Credit Packages** — Admin-defined credit packages that resellers can purchase (name, credits, price)
- **Payment Gateways** — Configurable payment providers: Stripe, PayPal, Authorize.net, Venmo, Cash App, Zelle
- **VPN Node Provisioning** — Register nodes, SSH-based OpenVPN installation, health monitoring via heartbeat
- **Config Delivery** — `.ovpn` file generation with embedded certs, download or email delivery
- **Session Tracking** — Real-time connection monitoring with traffic stats (bytes sent/received)
- **Real-time Dashboard** — Live bandwidth charts, CPU/RAM/network gauges per node, aggregate stats
- **Audit Logging** — Immutable audit trail of all sensitive actions
- **Role-based Dashboards** — Separate admin, reseller, and end-user interfaces

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9
- **Docker** & **Docker Compose** (for development infrastructure)
- **OpenSSL** (for CRL generation — pre-installed on most Linux distributions)
- **PostgreSQL 16** (provided via Docker or install natively for production)
- **Redis 7** (provided via Docker or install natively for production)

### Installing pnpm

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

## Installation

> **Recommended:** Use the [Quick Start](#quick-start) installer for automated setup.

For manual installation, follow the steps below:

### 1. Clone the repository

```bash
git clone https://github.com/wilson1442/vpn-platform.git
cd vpn-platform
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and replace placeholder values with secure secrets:

```bash
# Generate secure JWT secrets
openssl rand -base64 48   # Use output for JWT_ACCESS_SECRET
openssl rand -base64 48   # Use output for JWT_REFRESH_SECRET

# Generate PKI encryption key (64 hex chars = 32 bytes)
openssl rand -hex 32      # Use output for PKI_ENCRYPTION_KEY
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Start infrastructure services

```bash
docker compose up -d
```

This starts:
| Service    | Port | Description                      |
|------------|------|----------------------------------|
| PostgreSQL | 5432 | Primary database                 |
| Redis      | 6379 | Cache and job queue              |
| MailHog    | 1025 | SMTP server (dev)                |
| MailHog UI | 8025 | Email viewer at `localhost:8025` |

Verify services are healthy:

```bash
docker compose ps
```

### 5. Set up the database

```bash
# Generate the Prisma client
pnpm db:generate

# Run all migrations
pnpm db:migrate

# Seed the admin user
pnpm db:seed
```

Default admin credentials:
- **Email:** `admin@vpn-platform.local`
- **Password:** `admin123!@#`

### 6. Start development servers

```bash
pnpm dev
```

This starts all apps in parallel via Turborepo:

| App        | URL                    |
|------------|------------------------|
| API        | http://localhost:3000   |
| Web        | http://localhost:3100   |
| MailHog UI | http://localhost:8025   |

## Production Deployment

### Build all packages

```bash
pnpm build
```

### Run the API

```bash
node apps/api/dist/main.js
```

### Run the frontend (standalone Next.js)

```bash
node apps/web/.next/standalone/server.js
```

### Run the node-agent (on each VPN server)

```bash
AGENT_TOKEN=<token> \
AGENT_API_BASE_URL=https://your-api-url \
AGENT_PORT=3001 \
MGMT_PORT=7505 \
CRL_PATH=/etc/openvpn/crl.pem \
node apps/node-agent/dist/index.js
```

### Docker (full stack)

```bash
docker compose up -d --build
```

### Reverse Proxy (Nginx)

Example Nginx configuration routing API and frontend traffic:

```nginx
server {
    listen 443 ssl;
    server_name vpn.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # API routes
    location ~ ^/(auth|users|resellers|vpn-nodes|pki|sessions|billing|packages|entitlements|credits|credit-packages|payment-gateways|invoices|configs|audit-logs|settings|stats) {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend (everything else)
    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## API Reference

### Authentication

| Method | Endpoint         | Auth | Description                |
|--------|------------------|------|----------------------------|
| POST   | `/auth/login`    | No   | Login with email/password  |
| POST   | `/auth/refresh`  | No   | Refresh access token       |
| POST   | `/auth/logout`   | JWT  | Revoke refresh token       |

### Users

| Method | Endpoint       | Auth       | Description                    |
|--------|----------------|------------|--------------------------------|
| GET    | `/users`       | JWT+RBAC   | List users (reseller-scoped)   |
| POST   | `/users`       | JWT+RBAC   | Create user                    |
| PATCH  | `/users/:id`   | JWT+RBAC   | Update user                    |
| DELETE | `/users/:id`   | JWT+RBAC   | Deactivate user                |

### Resellers

| Method | Endpoint              | Auth       | Description            |
|--------|-----------------------|------------|------------------------|
| GET    | `/resellers`          | JWT+RBAC   | List resellers         |
| POST   | `/resellers`          | JWT+Admin  | Create reseller        |
| GET    | `/resellers/:id/tree` | JWT+RBAC   | Get reseller subtree   |

### VPN Nodes

| Method | Endpoint                  | Auth       | Description                       |
|--------|---------------------------|------------|-----------------------------------|
| GET    | `/vpn-nodes`              | JWT+Admin  | List all nodes                    |
| POST   | `/vpn-nodes`              | JWT+Admin  | Register node                     |
| POST   | `/vpn-nodes/:id/install`  | JWT+Admin  | SSH install OpenVPN (SSE stream)  |
| POST   | `/vpn-nodes/heartbeat`    | AgentToken | Node-agent heartbeat              |

### PKI

| Method | Endpoint               | Auth       | Description                   |
|--------|------------------------|------------|-------------------------------|
| POST   | `/pki/ca/init`         | JWT+Admin  | Initialize certificate authority |
| POST   | `/pki/certs`           | JWT+RBAC   | Issue client certificate      |
| POST   | `/pki/certs/:id/revoke`| JWT+RBAC   | Revoke certificate            |
| GET    | `/pki/crl`             | AgentToken | Get current CRL               |

### Sessions

| Method | Endpoint                 | Auth       | Description               |
|--------|--------------------------|------------|---------------------------|
| POST   | `/sessions/connect`      | AgentToken | Record VPN connect        |
| POST   | `/sessions/disconnect`   | AgentToken | Record VPN disconnect     |
| POST   | `/sessions/:id/kick`     | JWT+RBAC   | Kick active session       |
| GET    | `/sessions`              | JWT+RBAC   | List sessions (scoped)    |

### Billing

| Method | Endpoint          | Auth       | Description              |
|--------|-------------------|------------|--------------------------|
| GET    | `/packages`       | JWT+RBAC   | List packages            |
| POST   | `/packages`       | JWT+RBAC   | Create package           |
| POST   | `/entitlements`   | JWT+RBAC   | Assign package to user   |
| POST   | `/credits/add`    | JWT+Admin  | Add credits to reseller  |
| POST   | `/credits/deduct` | JWT+Admin  | Deduct credits           |
| GET    | `/credits/logs`   | JWT+RBAC   | Credit transaction logs  |
| POST   | `/invoices`       | JWT+Admin  | Create invoice           |
| PATCH  | `/invoices/:id`   | JWT+Admin  | Update invoice status    |

### Credit Packages

| Method | Endpoint                | Auth       | Description                |
|--------|-------------------------|------------|----------------------------|
| GET    | `/credit-packages`      | JWT+RBAC   | List credit packages       |
| POST   | `/credit-packages`      | JWT+Admin  | Create credit package      |
| PATCH  | `/credit-packages/:id`  | JWT+Admin  | Update credit package      |
| DELETE | `/credit-packages/:id`  | JWT+Admin  | Delete credit package      |

### Payment Gateways

| Method | Endpoint                          | Auth       | Description                  |
|--------|-----------------------------------|------------|------------------------------|
| GET    | `/payment-gateways`               | JWT+Admin  | List all gateways            |
| POST   | `/payment-gateways`               | JWT+Admin  | Create gateway               |
| PATCH  | `/payment-gateways/:id`           | JWT+Admin  | Update gateway config        |
| DELETE | `/payment-gateways/:id`           | JWT+Admin  | Delete gateway               |
| POST   | `/payment-gateways/seed-defaults` | JWT+Admin  | Seed default gateway entries |

### Config Delivery

| Method | Endpoint                  | Auth     | Description            |
|--------|---------------------------|----------|------------------------|
| GET    | `/configs/:certId`        | JWT      | Download .ovpn config  |
| POST   | `/configs/:certId/email`  | JWT      | Email .ovpn config     |

### Audit & Settings

| Method | Endpoint            | Auth       | Description            |
|--------|---------------------|------------|------------------------|
| GET    | `/audit-logs`       | JWT+RBAC   | List audit entries     |
| GET    | `/settings/public`  | None       | Get public settings    |
| PATCH  | `/settings`         | JWT+Admin  | Update settings        |

## Data Model

The platform uses 15 core entities managed through Prisma:

| Entity               | Description                                              |
|----------------------|----------------------------------------------------------|
| User                 | Accounts with ADMIN / RESELLER / USER roles              |
| RefreshToken         | JWT refresh token storage with rotation                  |
| Reseller             | Multi-level reseller tree (self-referencing `parentId`)  |
| VpnNode              | Registered OpenVPN servers                               |
| CertificateAuthority | Root CA certificate and CRL storage                      |
| Certificate          | Issued client certificates                               |
| VpnSession           | Active/historical VPN connections with traffic stats     |
| Package              | Billing plans with connection and device limits          |
| Entitlement          | User-to-plan assignments                                 |
| CreditLedgerEntry    | Append-only reseller credit history                      |
| CreditPackage        | Purchasable credit bundles for resellers                 |
| PaymentGateway       | Payment provider configurations (Stripe, PayPal, etc.)  |
| Invoice              | Billing invoices                                         |
| AppSettings          | Global application configuration                         |
| AuditLog             | Immutable action audit trail                             |

## Security

- **JWT with refresh rotation** — Short-lived access tokens + long-lived refresh tokens with automatic rotation and revocation
- **Argon2 password hashing** — Memory-hard algorithm resistant to GPU/ASIC attacks
- **AES-256-GCM encryption at rest** — Private keys encrypted before database storage
- **Role-based access control** — ADMIN, RESELLER, USER with reseller scope isolation
- **Agent token auth** — Separate authentication for node-to-API communication
- **Serializable transactions** — Session connect uses serializable isolation + row locking to prevent race conditions
- **Immutable audit logging** — All sensitive actions recorded with actor, target, IP, and metadata
- **CRL distribution** — Certificate revocations pushed to all VPN nodes

## Validation Checklist

After installation, walk through these steps to verify the platform is working:

### Step 1: Auth + Login

1. Open http://localhost:3100 — should redirect to `/login`
2. Log in with `admin@vpn-platform.local` / `admin123!@#`
3. Should redirect to `/admin` dashboard
4. Verify the sidebar shows Admin navigation

### Step 2: Create Reseller and User

1. Go to **Admin > Resellers** — create a reseller (creates a RESELLER-role user)
2. Go to **Admin > Users** — create a USER-role user, assign to the reseller
3. Log out, log in as the reseller — verify reseller sees only their scoped users
4. Log out, log in as the user — verify user dashboard loads

### Step 3: Plans and Entitlements

1. As admin, go to **Admin > Plans** — create a plan (e.g., "Basic", maxConnections: 2)
2. As admin, go to **Admin > Users** — assign the plan to the user (creates entitlement)
3. Verify the user now has an active entitlement

### Step 4: VPN Node Registration

1. As admin, go to **Admin > VPN Nodes** — register a node
2. Note the `agentToken` — this is used by the node-agent to authenticate
3. Start the node-agent on the VPN server:
   ```bash
   AGENT_TOKEN=<token> AGENT_API_BASE_URL=http://<api-host>:3000 \
   AGENT_PORT=3001 MGMT_PORT=7505 \
   pnpm --filter node-agent dev
   ```
4. Verify the node shows "Online" in the admin panel (heartbeat every 30s)

### Step 5: PKI + Certificate Issuance

1. As admin, call `POST /pki/ca/init` to initialize the Certificate Authority
2. Issue a certificate for the user: `POST /pki/certs` with `{ userId, commonName }`
3. As the user, go to **User > Configs** — should see their certificate listed
4. Click "Download" to get the `.ovpn` config file
5. Click "Email" to send via email (check MailHog at port 8025)

### Step 6: OpenVPN Session Enforcement

1. Configure OpenVPN server to use `client-connect` and `client-disconnect` scripts
2. Connect a VPN client — verify session appears in **Admin > Sessions**
3. Connect a second client with the same user — if over the entitlement limit, the oldest session is kicked automatically
4. Verify the kicked session shows `kickedReason: "concurrency"`

### Step 7: Billing

1. As admin, go to **Admin > Billing** — create an invoice for a reseller
2. Mark the invoice as PAID — verify credits are added to the reseller's ledger
3. As the reseller, go to **Reseller > Credits** — verify balance and transaction history
4. (Optional) Configure Stripe keys in `.env` to enable Stripe checkout

### Step 8: Audit Logging

1. As admin, go to **Admin > Audit Log**
2. Verify that login, user creation, cert issuance, and session events are logged
3. Filter by action or actor to confirm audit trail completeness

## Environment Variables

### API & Web

| Variable                | Description                                       | Default                                               |
|-------------------------|---------------------------------------------------|-------------------------------------------------------|
| `DATABASE_URL`          | PostgreSQL connection string                      | `postgresql://vpn:vpn_secret@localhost:5432/vpn_platform` |
| `REDIS_URL`             | Redis connection string                           | `redis://localhost:6379`                              |
| `JWT_ACCESS_SECRET`     | JWT signing secret (min 32 chars)                 | —                                                     |
| `JWT_REFRESH_SECRET`    | JWT refresh signing secret (min 32 chars)         | —                                                     |
| `PKI_ENCRYPTION_KEY`    | 64 hex chars for AES-256-GCM encryption           | —                                                     |
| `SMTP_HOST`             | SMTP server host                                  | `localhost`                                           |
| `SMTP_PORT`             | SMTP server port                                  | `1025`                                                |
| `SMTP_FROM`             | From address for emails                           | `noreply@vpn-platform.local`                          |
| `STRIPE_SECRET_KEY`     | Stripe secret key (optional)                      | —                                                     |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret (optional)                  | —                                                     |
| `AGENT_API_BASE_URL`    | API URL that node-agents connect to               | `http://api:3000`                                     |
| `NEXT_PUBLIC_API_URL`   | API URL for the frontend (baked at build time)    | `http://localhost:3000`                               |
| `CORS_ORIGIN`           | Allowed CORS origin                               | —                                                     |

### Node Agent

| Variable              | Description                                       | Default                 |
|-----------------------|---------------------------------------------------|-------------------------|
| `AGENT_TOKEN`         | Token from VPN node registration                  | —                       |
| `AGENT_API_BASE_URL`  | API base URL                                      | —                       |
| `AGENT_PORT`          | Port the agent listens on                         | `3001`                  |
| `MGMT_HOST`           | OpenVPN management interface host                 | `127.0.0.1`            |
| `MGMT_PORT`           | OpenVPN management interface port                 | `7505`                  |
| `CRL_PATH`            | Path to write CRL file                            | `/etc/openvpn/crl.pem` |

## Development

```bash
# Run all apps with hot reload
pnpm dev

# Generate Prisma client after schema changes
pnpm db:generate

# Create a new migration
pnpm --filter api exec prisma migrate dev --name <migration_name>

# Push schema without migration (dev only)
pnpm db:push

# Build all packages
pnpm build

# Restart dev environment (kills stale processes)
./restart-dev.sh
```

## Key Design Decisions

- **Hard concurrency enforcement:** Oldest session is automatically kicked when the user exceeds their connection limit. No soft limits or grace periods.
- **Serializable transactions:** Session connect uses `SERIALIZABLE` isolation + row-level locking to prevent race conditions during concurrent connections.
- **Append-only credit ledger:** Credit entries are never modified, only appended. Each entry records `balanceAfter` for auditability.
- **Encryption at rest:** Certificate private keys are encrypted with AES-256-GCM before database storage.
- **OpenSSL for CRL:** CRL generation uses the OpenSSL CLI for reliability, as node-forge does not support CRL creation.
- **Reseller tree scoping:** All data access queries are recursively scoped to the reseller's subtree. Admin has explicit bypass.
- **Vertical slice architecture:** Each feature is implemented end-to-end (database, API, frontend) as an independent slice.

## License

Proprietary. All rights reserved.
