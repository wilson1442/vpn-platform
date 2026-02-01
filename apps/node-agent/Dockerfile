FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# -- Dependencies --
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/node-agent/package.json ./apps/node-agent/
RUN pnpm install --frozen-lockfile

# -- Build shared --
FROM deps AS build-shared
WORKDIR /app
COPY packages/shared/ ./packages/shared/
COPY tsconfig.base.json ./
RUN pnpm --filter @vpn/shared build

# -- Build agent --
FROM build-shared AS build
WORKDIR /app
COPY apps/node-agent/ ./apps/node-agent/
RUN pnpm --filter node-agent run build

# -- Production --
FROM base AS runner
RUN apk add --no-cache curl bash
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/node-agent/dist ./apps/node-agent/dist
COPY --from=build /app/apps/node-agent/package.json ./apps/node-agent/
COPY --from=build /app/apps/node-agent/src/scripts ./apps/node-agent/scripts

WORKDIR /app/apps/node-agent
EXPOSE 3001
CMD ["node", "dist/index.js"]
