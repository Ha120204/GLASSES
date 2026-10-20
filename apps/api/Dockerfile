FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS dependencies
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile=false

FROM dependencies AS build
COPY . .
RUN pnpm --filter @glasses/api prisma:generate && pnpm --filter @glasses/shared build && pnpm --filter @glasses/api build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
EXPOSE 4000
CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy && node dist/main"]
