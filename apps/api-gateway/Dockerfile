# ─── API Gateway Dockerfile ────────────────────────────────────
# Multi-stage build for SentinelX API Gateway (NestJS)

FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PATH}:${PNPM_HOME}"

# ─── Dependencies stage ─────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/scanner-sdk/package.json ./packages/scanner-sdk/
RUN pnpm install --frozen-lockfile --filter=@sentinelx/api-gateway... --filter=@sentinelx/database... --filter=@sentinelx/shared... --filter=@sentinelx/scanner-sdk...

# ─── Scanner CLI tools ──────────────────────────────────────────
# Installs the real scanner binaries scanner-sdk shells out to (nmap,
# nuclei, trivy, semgrep) so scan-executor.service.ts can run real scans
# instead of falling back to the DEMO_MODE simulator. OpenVAS and ZAP are
# full scanning platforms rather than simple CLI tools, so those scan
# types keep using the simulator fallback regardless.
FROM base AS scanner-tools
ARG NUCLEI_VERSION=3.3.7
ARG TRIVY_VERSION=latest
RUN apt-get update && apt-get install -y --no-install-recommends \
      nmap unzip python3-pip \
    && rm -rf /var/lib/apt/lists/*
RUN ARCH="$(dpkg --print-architecture)" \
    && case "$ARCH" in \
         amd64) NUCLEI_ARCH=amd64 ;; \
         arm64) NUCLEI_ARCH=arm64 ;; \
         *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;; \
       esac \
    && curl -sSfL "https://github.com/projectdiscovery/nuclei/releases/download/v${NUCLEI_VERSION}/nuclei_${NUCLEI_VERSION}_linux_${NUCLEI_ARCH}.zip" -o /tmp/nuclei.zip \
    && unzip -o /tmp/nuclei.zip -d /usr/local/bin nuclei \
    && chmod +x /usr/local/bin/nuclei \
    && rm /tmp/nuclei.zip
RUN curl -sSfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \
      | sh -s -- -b /usr/local/bin "${TRIVY_VERSION}"
RUN pip3 install --no-cache-dir --break-system-packages semgrep

# ─── Development stage ──────────────────────────────────────────
FROM scanner-tools AS development
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api-gateway/node_modules ./apps/api-gateway/node_modules
COPY . .
RUN pnpm --filter=@sentinelx/database run generate
EXPOSE 3001 9229
CMD ["pnpm", "--filter=@sentinelx/api-gateway", "run", "dev"]

# ─── Builder stage ──────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter=@sentinelx/database run generate
RUN pnpm --filter=@sentinelx/shared run build
RUN pnpm --filter=@sentinelx/scanner-sdk run build
RUN pnpm --filter=@sentinelx/api-gateway run build

# ─── Production stage ───────────────────────────────────────────
FROM scanner-tools AS production
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nestjs

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=nestjs:nodejs /app/apps/api-gateway/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api-gateway/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/packages/database/src/generated ./node_modules/.prisma
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules

USER nestjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/health/live || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
