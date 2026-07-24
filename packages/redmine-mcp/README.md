# redmine-devrelay

[![Korean](https://img.shields.io/badge/lang-한국어-blue)](README.ko.md)

**Redmine MCP server** for Cursor · Claude Code · Codex.

- **Version:** `0.6.0`
- **GitHub:** https://github.com/HuijungYoon/devrelay
- **Client:** [redmine-devrelay-client](https://www.npmjs.com/package/redmine-devrelay-client) (same version)

## Quick start (STDIO)

STDIO is the default transport. Local IDE plugins use this path.

```bash
npx -y redmine-devrelay@0.6.0
```

| Env var | Description |
| --- | --- |
| `REDMINE_URL` | Redmine base URL (may include `/redmine` path) |
| `REDMINE_API_KEY` | REST API key |
| `REDMINE_ALLOWED_HOSTS` | (optional) Host allowlist. Private IPv4 HTTP is allowed separately |
| `REDMINE_CA_CERT_PATH` | (optional) Private CA PEM |

## HTTP mode (`--http`) · BYOK

For remote / Streamable HTTP deployments. The Codex Git marketplace keeps STDIO `npx` and does **not** switch to a remote URL.

```bash
npx -y redmine-devrelay@0.6.0 --http
# or after build
pnpm --filter redmine-devrelay start:http
# port: --port 9090 or PORT (default 8080)
```

Endpoints:

| Path | Description |
| --- | --- |
| `POST /mcp` | MCP Streamable HTTP |
| `GET /healthz` | Health check |
| `GET /.well-known/openai-apps-challenge` | OpenAI Apps challenge (see below) |

### BYOK headers (per request)

In production, pass Redmine credentials on each request:

| Header | Description |
| --- | --- |
| `X-Redmine-Url` | Redmine base URL |
| `X-Redmine-Api-Key` | REST API key |

Missing headers → `401` (`BYOK required`).

### `OPENAI_APPS_CHALLENGE_TOKEN`

When set, `GET /.well-known/openai-apps-challenge` returns the token as plain text. Unset → `404`.

### `HTTP_ALLOW_ENV_FALLBACK=1` (demo only)

When `1`, missing BYOK headers fall back to process env `REDMINE_URL` / `REDMINE_API_KEY`.

**Warning:** env credentials are shared by every client of that HTTP process. Demo/local only — turn off in production and use `X-Redmine-Url` / `X-Redmine-Api-Key` per request.

Invalid URL / config validation failures → `400` (API key never included in the response). Missing headers → `401`.

### HTTP session limits

| Env var | Default | Description |
| --- | --- | --- |
| `MCP_MAX_SESSIONS` | `100` | Concurrent session cap; new `initialize` returns `503` when full |
| `MCP_SESSION_TTL_MS` | `1800000` (30m) | Idle TTL; expired sessions pruned on access |

## Write rules

**dry-run → confirm → `confirm=true` + `previewToken`.**  
You cannot apply without the `previewToken` from the dry-run response (TTL 10 minutes, single-use).

This Redmine uses **HTML bodies**. Pass plain text and the client converts it.

| Field | Auto conversion |
| --- | --- |
| `description` | Plain text lines → `<p>…</p>` (left as-is if already HTML) |
| `notes` / comments | Newlines → `<br />`. **Plain text only** — Textile/Markdown is `blocked` in dry-run |

## Read APIs

| Tool | Description |
| --- | --- |
| `redmine_test_connection` | Verify connection as the current user with URL and API key |
| `redmine_list_projects` | List accessible projects |
| `redmine_list_project_members` | List project members (for assignee / watchers) |
| `redmine_search_users` | Search all users (may require permission) |
| `redmine_search_issues` | Search issues (default: open; supports `assignedTo: "me"`) |
| `redmine_get_issue` | Issue detail (includes journals, etc.) |

## Write APIs

| Tool | Description |
| --- | --- |
| `redmine_create_issue` | Create issue. Dry-run returns `wouldApply` preview |
| `redmine_update_issue` | Update issue. Dry-run returns before→after `changes[]` |
| `redmine_add_comment` | Add comment (plain text only; Textile/Markdown blocked) |
| `redmine_add_attachment` | Attach a local file to an existing issue |
| `redmine_update_status` | Change issue status (`statusId`) only |

### Optional create / update fields

| Field | Meaning |
| --- | --- |
| `trackerId` | Tracker |
| `statusId` | Status |
| `priorityId` | Priority |
| `startDate` / `dueDate` | Start / due date (`YYYY-MM-DD`) |
| `doneRatio` | Done ratio (0–100) |
| `assignedTo` | Assignee (`"me"` / id / name) |
| `watchers` | Watchers (id or name array; full replace on update) |
| `attachments` | Local files `[{ path, filename?, description? }]` (create / add_attachment) |
| `confirm` | `false` (default) = preview (+ `previewToken`), `true` = apply (`previewToken` required) |
| `previewToken` | Token from dry-run. Invalid if payload changes |

## Changelog (summary)

| Version | Notes |
| --- | --- |
| **0.6.0** | Streamable HTTP + BYOK headers, `--http` CLI, OpenAI Apps challenge, demo-only env fallback |
| **0.5.2** | English npm README; Claude Code marketplace install (`redmine-devrelay` plugin id) |
| 0.5.1 | Codex marketplace install CLI alignment (`ON_USE`, `plugin add`) + pin |
| 0.5.0 | Block Textile/Markdown in notes, `previewToken` confirm gate |
| 0.4.1 | Docs/example IP cleanup, Antigravity plugin pin |
| 0.4.0 | Attachments: create `attachments` + `redmine_add_attachment` |
| 0.3.3 | Sync npm README, plugin pins, install docs |
| 0.3.2 | Auto-convert plain description → `<p>` HTML |
| 0.3.1 | notes `\n` → `<br />` |
| 0.3.0 | `update_issue`, expanded create fields and preview |
| 0.2.x | create / comment / status, members · watchers, private HTTP |
| 0.1.x | Read-only (Phase 1) |

## License

MIT
