# Official Plugins Directory — submission runbook

> **Status (2026-07-24): deferred.** Official Plugins Directory listing is paused (Platform prepaid billing gate). Public Fly apps (`devrelay-redmine-mcp`, `devrelay-redmine-demo`) were torn down. Distribution is Git marketplace / STDIO `npx redmine-devrelay` only. HTTP `--http` code and this runbook remain for a future self-host or Directory retry.

Copy-paste materials and portal checklist for listing **Redmine DevRelay**. Demo Redmine setup: [demo-redmine.md](./demo-redmine.md). Design context: `docs/superpowers/specs/2026-07-24-official-plugin-directory-submission-design.md`.

Do **not** submit until: public demo Redmine is live, Privacy/Terms URLs resolve, MCP HTTPS + domain verification work, and Task 9 manual checks pass. URLs below that point at `*.fly.dev` are historical until hosting is recreated.

---

## Deploy notes (Task 7 Docker / Fly scaffold)

Remote MCP lives in `packages/redmine-mcp`. The image **must** be built from the **monorepo root** (workspace lockfile + both packages).

### Docker (root context)

```powershell
# From repo root
docker build -f packages/redmine-mcp/Dockerfile -t redmine-devrelay .
docker run --rm -p 8080:8080 `
  -e OPENAI_APPS_CHALLENGE_TOKEN="<from-portal>" `
  redmine-devrelay
```

- Process listens HTTP on **8080** (`node dist/index.js --http`).
- Production default: **`HTTP_ALLOW_ENV_FALLBACK=0`** (BYOK headers required). Do not enable env fallback on a public host.

### Fly.io example

Scaffold: `packages/redmine-mcp/fly.toml` (rename `app`, attach custom domain later).

```powershell
# From repo root — not from packages/redmine-mcp
fly deploy --config packages/redmine-mcp/fly.toml
fly secrets set OPENAI_APPS_CHALLENGE_TOKEN="<from-portal>"
```

`[build]` in `fly.toml` already points at `packages/redmine-mcp/Dockerfile` and `.dockerignore` with **root** context.

### Production MCP URL

```text
https://devrelay-redmine-mcp.fly.dev/mcp
```

Also verify:

- `GET https://devrelay-redmine-mcp.fly.dev/healthz`
- `GET https://devrelay-redmine-mcp.fly.dev/privacy` and `/terms`
- `GET https://devrelay-redmine-mcp.fly.dev/.well-known/openai-apps-challenge` → plain-text challenge token

CSP: prefer **server-side-only** Redmine fetches from the MCP process (no browser wildcard to customer Redmine origins). Portal CSP field: MCP host only unless you add a separate UI later.

Filled portal copy + test cases: [portal-submission-draft.md](./portal-submission-draft.md).

Never commit Fly/API secrets or demo Redmine keys.

---

## Listing (portal copy)

| Field | Value |
| --- | --- |
| **Name** | `Redmine DevRelay` |
| **Category** | Productivity |
| **Website** | `https://github.com/HuijungYoon/devrelay` |
| **Support** | `https://github.com/HuijungYoon/devrelay/issues` |
| **Privacy** | `https://devrelay-redmine-mcp.fly.dev/privacy` |
| **Terms** | `https://devrelay-redmine-mcp.fly.dev/terms` |

### Short description

```text
Connect ChatGPT / Codex to your Redmine via MCP: list issues, inspect history, and draft writes with a dry-run confirm gate. Bring your own Redmine URL and API key (BYOK); no shared vault.
```

### Long description

```text
Redmine DevRelay is an MCP plugin for Redmine issue tracking. Read tools cover connection tests, project listing, issue search (including assignedTo=me), and issue detail with journals. Write tools (create issue, update, comments, attachments, status) default to dry-run: you get a previewToken, then confirm with that token—no silent applies. Notes must be plain text; Textile/Markdown markup is blocked.

For Directory use, the hosted path is Streamable HTTP MCP with per-request BYOK headers (X-Redmine-Url, X-Redmine-Api-Key). The existing Git marketplace / STDIO install (npx redmine-devrelay) remains available for local Codex. Point the plugin at your own Redmine; a public demo instance is provided only for review.
```

---

## Starter prompts (3+)

1. `Test my Redmine connection and show who I am.`
2. `List my open Redmine issues and summarize the top three by priority.`
3. `Draft (dry-run only) a new bug in project <id> titled "Login timeout" assigned to me.`
4. *(optional)* `Open issue <id-with-journals> and summarize the journal history.`

Replace `<id>` / `<id-with-journals>` with values from [demo-redmine.md](./demo-redmine.md) seed data.

---

## Positive tests (5)

Finalize IDs against the demo seed before paste into the portal.

| # | Action | Expected |
| --- | --- | --- |
| 1 | Connection test (`redmine_test_connection` / equivalent) | Returns current user **login** and **id** |
| 2 | Search with `assignedTo=me` | **≥1** open issue |
| 3 | `get_issue` on seeded issue **`<id-with-journals>`** with journals | Response includes a **journals** array (non-empty) |
| 4 | `create_issue` **dry-run** (no confirm) on project **`<project-id>`** | Returns **`previewToken`**; **no** new issue id created |
| 5 | `add_comment` dry-run on **`<id>`**, then `confirm=true` **with** that `previewToken` | Journal/comment **added** on confirm |

Suggested paste block (fill placeholders):

```text
1. Call redmine_test_connection → expect login and id for the demo user.
2. Call redmine_search_issues with assignedTo=me → expect ≥1 open issue.
3. Call redmine_get_issue on <id-with-journals> including journals → expect journals array present.
4. Call redmine_create_issue dry-run (confirm unset/false) on project <project-id> → expect previewToken and no new issue id.
5. Call redmine_add_comment dry-run on issue <id>, then confirm=true with that previewToken → expect journal added.
```

---

## Negative tests (3)

| # | Action | Expected |
| --- | --- | --- |
| 1 | Write tool with `confirm=true` **without** a prior dry-run `previewToken` | Validation / gate error; no apply |
| 2 | Notes/comment with markup (e.g. `h3. Heading` or Markdown `#` / `**bold**`) | **Blocked** (`blocked: true` or equivalent); no `previewToken` |
| 3 | MCP HTTP call **without** BYOK headers (`X-Redmine-Url` / `X-Redmine-Api-Key`) when fallback is off | **401** or clear config error; **must not** echo the API key |

```text
1. confirm=true on first call / without previewToken → validation error.
2. notes containing "h3. …" (or Markdown heading/bold) → blocked, no previewToken.
3. Omit BYOK headers against production MCP → 401 / clear config error; response body must not contain the API key.
```

---

## Portal steps

1. Open Apps Management with **Write** access and a **verified** publisher identity.
2. **Create plugin → With MCP**.
3. Enter production MCP URL: `https://devrelay-redmine-mcp.fly.dev/mcp`.
4. Set `OPENAI_APPS_CHALLENGE_TOKEN` on the host to the portal challenge value; complete **domain verification** (`/.well-known/openai-apps-challenge`).
5. **Scan Tools**; confirm tool annotations (read vs destructive / confirm guidance) look correct.
6. Upload skills ZIP from `plugins/codex` (zip skills / plugin assets as the portal expects). **Strip `.mcp.json`** from the ZIP if the portal warns about marketplace MCP config.
7. Paste starter prompts, **5 positive + 3 negative** tests, and demo Redmine credentials (URL + API key from the password manager — not from git). See [portal-submission-draft.md](./portal-submission-draft.md).
8. **Submit for Review**. **Publish only after approval.**

---

## Pre-submit gate (Task 9)

Before claiming Directory-ready:

- Local or hosted HTTP: `/healthz` and `/.well-known/openai-apps-challenge` succeed.
- STDIO path still waits on stdin (Git marketplace unbroken).
- `pnpm --filter redmine-devrelay-client test` and `pnpm --filter redmine-devrelay test` pass.
- Demo Redmine + Privacy/Terms + custom domain are **real**, not placeholders.
