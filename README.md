# SentinelX AI

> **Self-hosted vulnerability-scanning orchestration platform**

SentinelX AI is a self-hosted, multi-tenant platform that orchestrates open-source security scanners (Nmap, Nuclei, OWASP ZAP, Trivy, Semgrep) behind a single API, queue, and reporting layer. It normalizes their output into a common vulnerability model, tracks findings and SLAs per organization, and layers AI-assisted triage on top. It is scanner-wrapping orchestration — not a from-scratch scan engine — and only the scanners listed under [Implemented Scanners](#implemented-scanners) actually run today.

> ⚠️ **Authorization & scope.** Scans only run against assets your organization owns and has recorded as ACTIVE in its inventory (see [Authorization & scope](#authorization--scope)). Only scan systems you own or are explicitly authorized to test — unauthorized scanning is illegal in most jurisdictions.

---

## Architecture Overview

```
sentinelx/
├── apps/
│   ├── api-gateway/          # NestJS REST + GraphQL + WebSocket API
│   └── web/                  # Next.js 14 frontend
├── packages/
│   ├── database/             # Prisma schema + client + migrations
│   ├── shared/               # Types, utilities, constants, validators
│   ├── scanner-sdk/          # Scanner plugin interface + implementations
│   └── ai-sdk/               # AI provider abstraction layer
├── infrastructure/
│   ├── helm/                 # Kubernetes Helm charts
│   ├── monitoring/           # Prometheus + Grafana configuration
│   ├── nginx/                # NGINX configuration
│   ├── postgres/             # PostgreSQL initialization
│   └── terraform/            # Infrastructure as Code
└── .github/
    └── workflows/            # CI/CD pipelines
```

## Primary Features

| Module | Description |
|--------|-------------|
| **Asset Discovery** | Network scanning, cloud discovery, automatic asset fingerprinting |
| **Vulnerability Assessment** | CVSS scoring, SLA tracking, risk prioritization |
| **Web Application Security** | DAST scanning with OWASP ZAP |
| **API Security** | REST/GraphQL API vulnerability testing |
| **Cloud Security** | AWS/Azure/GCP misconfiguration assessment (ScoutSuite, Prowler) — *planned, not yet implemented* |
| **Container Security** | Docker/OCI image scanning with Trivy |
| **Kubernetes Security** | K8s cluster hardening assessment |
| **Source Code Analysis** | SAST with Semgrep + custom rules |
| **Secret Detection** | Hardcoded credentials and API key detection |
| **AI Security Copilot** | GPT-4o/Claude-powered security assistant with RAG |
| **Compliance Management** | SOC2, ISO27001, PCI DSS, HIPAA, NIST, OWASP |
| **Penetration Testing** | Orchestrated pen testing with evidence collection |
| **Threat Intelligence** | IOC feeds, CVE enrichment, MITRE ATT&CK mapping |
| **Risk Management** | Organizational risk scoring and tracking |
| **Executive Dashboards** | Real-time security posture visualization |
| **Reporting Engine** | PDF/Word/Excel/HTML/JSON report generation |
| **Marketplace** | Plugin SDK and community extensions |

## Tech Stack

### Backend
- **Runtime**: Node.js 20 + TypeScript 5.5 (strict mode)
- **Framework**: NestJS 10
- **Database**: PostgreSQL 16 + pgvector + pg_trgm
- **ORM**: Prisma 5
- **Cache**: Redis 7
- **Queue**: RabbitMQ 3.13
- **Search**: OpenSearch 2.14
- **Storage**: MinIO
- **Real-time**: Socket.io
- **Auth**: JWT + OAuth2 + OIDC + MFA

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.5
- **Styling**: TailwindCSS + shadcn/ui
- **State**: Zustand + TanStack Query
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **Animation**: Framer Motion

### AI
- **Providers**: OpenAI GPT-4o, Anthropic Claude, Ollama (local)
- **Features**: RAG, function calling, streaming, conversation memory
- **Embeddings**: pgvector + text-embedding-3-small

### Infrastructure
- **Containers**: Docker + Docker Compose
- **Orchestration**: Kubernetes + Helm
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana + Loki + Tempo
- **IaC**: Terraform

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker + Docker Compose
- (Optional) Nmap, Nuclei, Trivy, Semgrep binaries

### 1. Clone and install

```bash
git clone https://github.com/your-org/sentinelx.git
cd sentinelx
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values — especially secrets
```

**Required secrets (generate securely):**
```bash
# JWT Secret (min 32 chars)
openssl rand -hex 32

# Encryption Key (must be exactly 64 hex chars = 32 bytes AES-256)
openssl rand -hex 32

# Cookie Secret
openssl rand -base64 32
```

### 3. Start infrastructure

```bash
# Start PostgreSQL, Redis, RabbitMQ, MinIO, OpenSearch
docker compose up -d postgres redis rabbitmq minio opensearch

# Wait for services to be healthy
docker compose ps
```

### 4. Initialize database

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed initial data (plans, prompts, super admin)
pnpm db:seed
```

### 5. Start development servers

```bash
# Start all services in parallel
pnpm dev

# Or start individually:
pnpm dev:api    # API Gateway on :3001
pnpm dev:web    # Next.js frontend on :3000
```

### 6. Access the platform

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **API** | http://localhost:3001 |
| **API Docs** | http://localhost:3001/api/docs |
| **RabbitMQ** | http://localhost:15672 (sentinelx/sentinelx_rabbit_password) |
| **MinIO** | http://localhost:9001 (sentinelx_minio/sentinelx_minio_password) |

**Default Super Admin:**
- Email: `admin@sentinelx.io`
- Password: `SentinelX@Admin2024!` ⚠️ Change immediately!

## Scanners

### Implemented Scanners

These are the only scanners wired into the scan executor (`scanners` map in `apps/api-gateway/src/modules/scan/scan-executor.service.ts`). They are the scanners that actually run:

| Scanner | Type | Coverage |
|---------|------|----------|
| **Nmap** | Network | Port scanning, OS detection, NSE scripts |
| **Nuclei** | Multi | Template-based vulnerability detection |
| **OWASP ZAP** | Web App | DAST, spider, active scan |
| **Trivy** | Container | Container/IaC vulnerability scanning |
| **Semgrep** | SAST | Static code analysis |

### Planned / not yet implemented

These scanners are referenced in the data model and roadmap but are **not** wired into the executor. Requesting one of them as a scanner outside `DEMO_MODE` will fail the scan (no executor is registered for it):

| Scanner | Type | Coverage |
|---------|------|----------|
| **Masscan** | Network | High-speed port scanning |
| **Rustscan** | Network | Fast port discovery |
| **OpenVAS** | Vulnerability | CVE-based vulnerability assessment |
| **Nikto** | Web App | Web server misconfiguration |
| **SQLMap** | Injection | SQL injection detection |
| **ScoutSuite** | Cloud | AWS/Azure/GCP security assessment |
| **Prowler** | Cloud | CIS benchmark compliance |
| **MobSF** | Mobile | Android/iOS application security |
| **Lynis** | OS | Unix/Linux system hardening |
| **OSQuery** | Endpoint | Endpoint security monitoring |
| **Falco** | Runtime | Kubernetes runtime security |

## Authorization & scope

SentinelX will not scan arbitrary hosts. Before any scanner job is dispatched, every requested target is checked against the requesting organization's asset inventory:

- A target is accepted only if it matches an **ACTIVE**, non-deleted `Asset` owned by the organization (by hostname/FQDN, IP address, or repository URL).
- If any target has no owning asset, the **entire scan is rejected** with a `403 Forbidden` naming the out-of-scope target(s) — nothing is partially run.
- CIDR ranges are not currently scope-verifiable (the asset model records no owned ranges) and are rejected; scan the individual owned hosts instead.

> Ownership is currently inferred from `AssetStatus = ACTIVE`. Explicit domain-ownership verification (DNS TXT / file token) is planned.
>
> **Legal caveat:** Only scan systems you own or are explicitly authorized to test. Unauthorized scanning is illegal in most jurisdictions and is the user's responsibility.

## Compliance Frameworks

- SOC 2 Type I & II
- ISO 27001:2022
- PCI DSS v4.0
- HIPAA
- GDPR
- NIST Cybersecurity Framework
- NIST SP 800-53
- MITRE ATT&CK
- OWASP ASVS 4.0
- CIS Controls v8
- OWASP Top 10
- DISA STIG
- FedRAMP

## Development

### Running tests

```bash
pnpm test:unit          # Unit tests
pnpm test:integration   # Integration tests (requires services)
pnpm test:e2e           # End-to-end tests (requires running app)
pnpm test:coverage      # Coverage report
```

### Database management

```bash
pnpm db:studio          # Prisma Studio GUI
pnpm db:migrate         # Create and run new migration
pnpm db:reset           # Reset database (development only!)
pnpm db:seed            # Seed initial data
```

### Code quality

```bash
pnpm lint               # ESLint
pnpm lint:fix           # Fix ESLint issues
pnpm format             # Prettier format
pnpm typecheck          # TypeScript type checking
```

## Production Deployment

### Docker Compose (single server)

```bash
docker compose -f docker-compose.prod.yml up -d
```

### Kubernetes (Helm)

```bash
# Add required secrets
kubectl create secret generic sentinelx-secrets \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=JWT_SECRET="..." \
  # ... other secrets

# Deploy with Helm
helm upgrade --install sentinelx ./infrastructure/helm/sentinelx \
  --namespace sentinelx-prod \
  --create-namespace \
  --values ./infrastructure/helm/values/production.yaml

# Run database migrations
kubectl exec -n sentinelx-prod deployment/sentinelx-api -- \
  npx prisma migrate deploy
```

## Security

SentinelX AI is built with security-first principles:

- **Zero Trust** architecture
- **OWASP Top 10** protections built-in
- **JWT** + **OAuth2** + **OIDC** authentication
- **MFA** support (TOTP, SMS, Email, Hardware Keys)
- **RBAC** + **ABAC** authorization
- **AES-256-GCM** encryption at rest
- **TLS 1.3** in transit
- **Rate limiting** on all endpoints
- **CSP**, **CORS**, **HSTS** headers
- **SQL injection** prevention (Prisma + parameterized queries)
- **XSS** prevention (Content Security Policy + output encoding)
- **CSRF** protection
- **SSRF** prevention
- **Command injection** prevention (sanitized scanner inputs)
- **Audit logging** for all privileged actions
- **Secret scanning** in CI/CD pipeline
- **Container vulnerability scanning** on every build
- **SAST** with Semgrep on every PR

## License

Proprietary — SentinelX AI © 2024. All rights reserved.
