# redmine-devrelay

[![Korean](https://img.shields.io/badge/lang-한국어-blue)](README.ko.md)

**Redmine MCP server** for Cursor · Claude Code · Codex.

- **Version:** `0.5.1`
- **GitHub:** https://github.com/HuijungYoon/devrelay
- **Client:** [redmine-devrelay-client](https://www.npmjs.com/package/redmine-devrelay-client) (same version)

## Quick start

```bash
npx -y redmine-devrelay@0.5.1
```

| Env var | Description |
| --- | --- |
| `REDMINE_URL` | Redmine base URL (may include `/redmine` path) |
| `REDMINE_API_KEY` | REST API key |
| `REDMINE_ALLOWED_HOSTS` | (optional) Host allowlist. Private IPv4 HTTP is allowed separately |
| `REDMINE_CA_CERT_PATH` | (optional) Private CA PEM |

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
| **0.5.1** | Codex marketplace install CLI alignment (`ON_USE`, `plugin add`) + pin |
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
