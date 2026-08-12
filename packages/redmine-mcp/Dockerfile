# Build from monorepo root (context = repo root):
#   docker build -f packages/redmine-mcp/Dockerfile -t redmine-devrelay .
#   fly deploy --config packages/redmine-mcp/fly.toml
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/redmine-client/package.json packages/redmine-client/package.json
COPY packages/redmine-mcp/package.json packages/redmine-mcp/package.json
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages/redmine-client packages/redmine-client
COPY packages/redmine-mcp packages/redmine-mcp
RUN pnpm --filter redmine-devrelay-client build && pnpm --filter redmine-devrelay build
# Lean production bundle: package + prod deps only (no monorepo / no devDependencies)
RUN pnpm --filter redmine-devrelay deploy --prod /out

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out /app
EXPOSE 8080
CMD ["node", "dist/index.js", "--http"]
