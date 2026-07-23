# DevRelay / redmine-devrelay

[![Korean](https://img.shields.io/badge/lang-한국어-blue)](README.ko.md)

MCP integration that lets you query, create, and update Redmine issues with **natural language and slash commands** in Codex · Claude Code · Cursor · Antigravity.

Agents do not call the Redmine REST API directly. They go through the shared MCP server [`redmine-devrelay`](https://www.npmjs.com/package/redmine-devrelay). Write APIs enforce a **dry-run → confirm → `confirm=true` + `previewToken`** gate.

**Current release: `0.5.2`** (`redmine-devrelay` / `redmine-devrelay-client`)

## Shipped so far (Phase 1–5)

| Phase | Scope | Version |
| --- | --- | --- |
| 1 | Connection, projects, issue read | 0.1.x |
| 2 | Create issue / comment / status change (+ assignee & watchers) | 0.2.x |
| 3 | `update_issue`, expanded create fields, HTML body line breaks | 0.3.x |
| 4 | Issue **attachments** (create + `add_attachment`) | 0.4.x |
| 5 | Plain-text notes enforcement, **`previewToken` confirm gate** | **0.5.x** |

### 0.5.x highlights

- Block Textile/Markdown in `notes` during dry-run (`blocked` + matches)
- Write applies require `previewToken` from dry-run (TTL 10 minutes, single-use)
- First call cannot use `confirm=true`

### 0.4.x highlights

- `attachments: [{ path, filename?, description? }]` on create
- `redmine_add_attachment` — attach a local file to an existing issue
- Dry-run returns path, filename, and size only; upload happens only with `confirm=true`

### 0.3.x highlights

- `redmine_update_issue` — apply after dry-run with before→after `changes[]`
- create/update: tracker, status, priority, dates, done ratio, assignee (`assignedTo`), watchers
- `redmine_list_project_members` / `redmine_search_users`
- Private-network HTTP (`http://192.168.x.x/...`) allowed; `/redmine` base path preserved
- **Automatic HTML body conversion** (this Redmine is not Textile)
  - description: plain lines → `<p>…</p>`
  - notes/comments: `\n` → `<br />` (plain text only; Textile/Markdown blocked in dry-run)

Not yet: custom fields, tracker/status name resolution, bulk updates.

## What can you do?

- “Show my open issues on Cloud HMI”
- “Show #1523 details and recent comments”
- “Create an issue” → confirm project, subject, assignee, watchers → dry-run → apply
- “Change description/progress on #23870” → before/after preview → confirm → apply
- “Add a comment” → preview → confirm

Slash examples (Cursor):

| Command | Action |
| --- | --- |
| `/help` | Command list |
| `/test-connection` | Connection and current user |
| `/list-projects` | Project list |
| `/my-issues` | My open issues |
| `/issue 1523` | Issue detail + journals |
| `/create-issue` | Create issue (dry-run → confirm) |
| `/update-issue` | Update issue (dry-run → confirm) |
| `/add-comment` | Comment (dry-run → confirm) |
| `/add-attachment` | Attach file (dry-run → confirm) |
| `/update-status` | Status only (dry-run → confirm) |

## Architecture

```
Claude Code / Codex / Cursor / Antigravity  (plugins + skills)
        │ MCP STDIO
        ▼
   redmine-devrelay@0.5.2   (tool schemas, STDIO, npm)
        │
        ▼
   redmine-devrelay-client@0.5.2  (REST, auth, HTML formatting, writes)
        │ HTTPS or private-IP HTTP
        ▼
   Redmine REST API
```

| Path | Role |
| --- | --- |
| `packages/redmine-client` | npm: `redmine-devrelay-client@0.5.2` |
| `packages/redmine-mcp` | npm: `redmine-devrelay@0.5.2` |
| `plugins/cursor` | Cursor plugin |
| `plugins/claude-code` | Claude Code plugin + skills |
| `plugins/codex` | Codex plugin + skills |
| `plugins/antigravity` | Antigravity IDE/CLI plugin |

### MCP tools

**Read**

| Tool | Description |
| --- | --- |
| `redmine_test_connection` | Verify current user with URL and API key |
| `redmine_list_projects` | List accessible projects |
| `redmine_list_project_members` | Project members (pick assignee/watchers) |
| `redmine_search_users` | Search all users (may require permission) |
| `redmine_search_issues` | Search issues (`assignedTo: "me"`, open by default) |
| `redmine_get_issue` | Issue detail (includes `journals`, etc.) |

**Write** (`confirm` defaults to `false` = preview)

| Tool | Description |
| --- | --- |
| `redmine_create_issue` | Create · `wouldApply` preview (optional `attachments`) |
| `redmine_update_issue` | Update · before→after `changes[]` |
| `redmine_add_comment` | Comment (`\n` → `<br />`) |
| `redmine_add_attachment` | Attach a local file to an existing issue |
| `redmine_update_status` | Change `statusId` only |

See [`packages/redmine-mcp/README.md`](packages/redmine-mcp/README.md) for field details and HTML rules.

## Prerequisites

1. **Node.js 20+** (22 LTS recommended), **pnpm**
2. Redmine REST API enabled  
   Administration → Settings → API → REST web service
3. Your account **API key** (My account → API access key)
4. Network access to the Redmine URL from your machine (VPN if on a corporate network)

## Quick start

### 1. Run via npm (recommended)

```bash
npx -y redmine-devrelay@0.5.2
```

Local build:

```bash
pnpm install
pnpm --filter redmine-devrelay-client build
pnpm --filter redmine-devrelay build
```

### 2. Environment variables

See `.env.example`. Do not commit keys to git.

```bash
# Windows PowerShell
$env:REDMINE_URL = "https://redmine.example.com"
$env:REDMINE_API_KEY = "your-api-key"
```

```bash
# Bash
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=your-api-key
```

Optional:

| Variable | Description |
| --- | --- |
| `REDMINE_ALLOWED_HOSTS` | Host allowlist (can omit when empty). Private IPv4 is allowed separately |
| `REDMINE_CA_CERT_PATH` | Private CA PEM |

Private network example: `REDMINE_URL=http://192.168.10.50/redmine`  
Local Docker: `http://localhost:3000` + `REDMINE_ALLOWED_HOSTS=localhost` (`docker/redmine/README.md`)

### 3. Cursor

```text
/add-plugin redmine-devrelay
```

Or connect `npx -y redmine-devrelay@0.5.2` in `plugins/cursor/mcp.json` / MCP settings, then set `REDMINE_URL` / `REDMINE_API_KEY`.

### 4. Claude Code

```text
/plugin marketplace add HuijungYoon/devrelay
/plugin install redmine-devrelay@devrelay
/reload-plugins
```

Local fallback: `claude --plugin-dir ./plugins/claude-code`

- Check connection with `/mcp`
- Slash namespace is `/redmine-devrelay:…` (e.g. `/redmine-devrelay:create-issue`) or natural language
- Details: `plugins/claude-code/README.md`

### 5. Codex

Requires a CLI that supports `codex plugin marketplace` / `codex plugin add` (upgrade if missing, e.g. 0.107.0).

```bash
codex plugin marketplace add HuijungYoon/devrelay
codex plugin add redmine-devrelay@devrelay
```

For local development: from the repo root, `codex plugin marketplace add .` then the same install.  
Set `REDMINE_URL` / `REDMINE_API_KEY`. Prefer approve for reads and prompt for writes.  
Details: `plugins/codex/README.md`.

### 6. Antigravity

```bash
agy plugin install ./plugins/antigravity
```

From GitHub: clone the repo, then `agy plugin install ./devrelay/plugins/antigravity`.  
Slash: `/redmine:help`, `/redmine:my-issues`, … — see `plugins/antigravity/README.md`.

### 7. MCP Inspector

```bash
npx @modelcontextprotocol/inspector node packages/redmine-mcp/dist/index.js
```

## Usage tips

- Writes always go **dry-run → confirm → `confirm=true` + `previewToken`**. Do not bypass via raw REST.
- Put description/comments as **plain text with newlines**; the client converts to HTML.
- Keep API keys in environment variables only. Never print them in chat or logs.
- `assignedTo` = assignee, `watchers` = watchers. On update, `watchers` is a **full replacement**.

## Repository layout

```
packages/redmine-client/   # npm: redmine-devrelay-client@0.5.2
packages/redmine-mcp/      # npm: redmine-devrelay@0.5.2
plugins/cursor|claude-code|codex|antigravity/
docker/redmine/            # Redmine for integration tests
docs/superpowers/          # Phase designs and implementation plans
```

## Docs

| Doc | Contents |
| --- | --- |
| [packages/redmine-mcp/README.md](packages/redmine-mcp/README.md) | MCP tools, writes, HTML rules |
| [docs/installation.md](docs/installation.md) | Install, env vars, plugins |
| [docs/security.md](docs/security.md) | API key, hosts, audit |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Connection / auth / TLS |
| [docs/development.md](docs/development.md) | Build, test, Inspector |
| [docs/superpowers/specs/2026-07-10-redmine-mcp-phase1-design.md](docs/superpowers/specs/2026-07-10-redmine-mcp-phase1-design.md) | Phase 1 |
| [docs/superpowers/specs/2026-07-13-redmine-mcp-phase2-write-design.md](docs/superpowers/specs/2026-07-13-redmine-mcp-phase2-write-design.md) | Phase 2 |
| [docs/superpowers/specs/2026-07-13-redmine-mcp-phase3-update-issue-design.md](docs/superpowers/specs/2026-07-13-redmine-mcp-phase3-update-issue-design.md) | Phase 3 |

## License / publish

MIT · npm: [`redmine-devrelay@0.5.2`](https://www.npmjs.com/package/redmine-devrelay), [`redmine-devrelay-client@0.5.2`](https://www.npmjs.com/package/redmine-devrelay-client)
