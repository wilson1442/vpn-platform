FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN apk add --no-cache openssl

# -- Dependencies --
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# -- Build shared --
FROM deps AS build-shared
WORKDIR /app
COPY packages/shared/ ./packages/shared/
COPY tsconfig.base.json ./
RUN pnpm --filter @vpn/shared build

# -- Build API --
FROM build-shared AS build
WORKDIR /app
COPY apps/api/ ./apps/api/
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api run build

# -- Production --
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
