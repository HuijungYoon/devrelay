# redmine-agent-integration

Monorepo for Redmine MCP Phase 1 (read-only):

- `@m2i/redmine-client` — Redmine REST client
- `@m2i/redmine-mcp` — STDIO MCP server (4 read tools)
- `plugins/claude-code` — Claude plugin + `/redmine:my-issues`, `/redmine:issue`
- `plugins/codex` — Codex plugin + matching skills

## Quick start

```bash
pnpm install
pnpm --filter @m2i/redmine-client build
pnpm --filter @m2i/redmine-mcp build
```

Copy `.env.example` and set `REDMINE_URL` / `REDMINE_API_KEY`.

Docs: `docs/installation.md`, `docs/security.md`, `docs/troubleshooting.md`, `docs/development.md`.

Design: `docs/superpowers/specs/2026-07-10-redmine-mcp-phase1-design.md`
