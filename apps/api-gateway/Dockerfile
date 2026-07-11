# ─── API Gateway Dockerfile ────────────────────────────────────
# Multi-stage build for SentinelX API Gateway (NestJS)

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++
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

# ─── Development stage ──────────────────────────────────────────
FROM base AS development
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
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init curl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

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
