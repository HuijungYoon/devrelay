# redmine-agent-integration

Monorepo for Redmine MCP Phase 1 (read-only):

- `redmine-devrelay-client` — Redmine REST client
- `redmine-devrelay` — STDIO MCP server (4 read tools)
- `plugins/cursor` — Cursor Marketplace plugin (`/add-plugin redmine-devrelay`)
- `plugins/claude-code` — Claude plugin + `/redmine:my-issues`, `/redmine:issue`
- `plugins/codex` — Codex plugin + matching skills

## Quick start

```bash
pnpm install
pnpm --filter redmine-devrelay-client build
pnpm --filter redmine-devrelay build
```

Copy `.env.example` and set `REDMINE_URL` / `REDMINE_API_KEY` / `REDMINE_ALLOWED_HOSTS`.

Published npm: `npx -y redmine-devrelay@0.1.0`

Cursor plugin: `plugins/cursor` — submit at https://cursor.com/marketplace/publish then `/add-plugin redmine-devrelay`

Docs: `docs/installation.md`, `docs/security.md`, `docs/troubleshooting.md`, `docs/development.md`.

Design: `docs/superpowers/specs/2026-07-10-redmine-mcp-phase1-design.md`
