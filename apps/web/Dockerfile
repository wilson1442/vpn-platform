FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# -- Dependencies --
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# -- Build shared --
FROM deps AS build-shared
WORKDIR /app
COPY packages/shared/ ./packages/shared/
COPY tsconfig.base.json ./
RUN pnpm --filter @vpn/shared build

# -- Build web --
FROM build-shared AS build
WORKDIR /app
COPY apps/web/ ./apps/web/
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web run build

# -- Production --
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3100
ENV PORT=3100
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
