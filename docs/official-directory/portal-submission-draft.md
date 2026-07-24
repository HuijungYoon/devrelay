# Portal submission draft — Redmine DevRelay

Copy into the OpenAI Plugins Directory form. **Do not put API keys in git**; use your password manager for demo credentials.

Related: [submission-runbook.md](./submission-runbook.md), [demo-redmine.md](./demo-redmine.md).

---

## Live endpoints (current)

| Item | URL |
| --- | --- |
| Production MCP | `https://devrelay-redmine-mcp.fly.dev/mcp` |
| Health | `https://devrelay-redmine-mcp.fly.dev/healthz` |
| Privacy | `https://devrelay-redmine-mcp.fly.dev/privacy` |
| Terms | `https://devrelay-redmine-mcp.fly.dev/terms` |
| Challenge | `https://devrelay-redmine-mcp.fly.dev/.well-known/openai-apps-challenge` *(404 until portal token is set via Fly secrets)* |
| Demo Redmine | `https://devrelay-redmine-demo.fly.dev` |

---

## Listing fields

| Field | Value |
| --- | --- |
| Plugin name | `Redmine DevRelay` |
| Category | Productivity |
| Website | `https://github.com/HuijungYoon/devrelay` |
| Support | `https://github.com/HuijungYoon/devrelay/issues` |
| Privacy Policy URL | `https://devrelay-redmine-mcp.fly.dev/privacy` |
| Terms URL | `https://devrelay-redmine-mcp.fly.dev/terms` |
| Developer identity | Verified individual or business (M2I) in OpenAI Platform |

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

## Auth / demo credentials (portal only)

Paste into the portal demo fields — **not** into git:

```text
Demo Redmine URL: https://devrelay-redmine-demo.fly.dev
Demo API key:     <from password manager — demo user API key>
Web login (optional for humans): demo / <password in password manager>
BYOK headers for MCP:
  X-Redmine-Url: https://devrelay-redmine-demo.fly.dev
  X-Redmine-Api-Key: <same demo API key>
```

Production MCP must keep `HTTP_ALLOW_ENV_FALLBACK=0` (BYOK only).

---

## Starter prompts

1. `Test my Redmine connection and show who I am.`
2. `List my open Redmine issues and summarize the top three by priority.`
3. `Draft (dry-run only) a new bug in project 1 titled "Login timeout" assigned to me.`
4. `Open issue 3 and summarize the journal history.`

---

## Positive tests (5)

Seed on demo: project `demo` id **1**; issues **1** connection smoke, **2** priority sample, **3** journals sample (has journal).

```text
1. Call redmine_test_connection → expect login "demo" and a numeric id.
2. Call redmine_search_issues with assignedTo=me → expect ≥1 open issue (seed has 3).
3. Call redmine_get_issue on id 3 including journals → expect non-empty journals array.
4. Call redmine_create_issue dry-run (confirm unset/false) on projectId 1 → expect previewToken and no new issue id.
5. Call redmine_add_comment dry-run on issue 1, then confirm=true with that previewToken → expect journal added.
```

---

## Negative tests (3)

```text
1. confirm=true on first call / without previewToken → validation error; no apply.
2. notes containing "h3. Heading" (or Markdown # / **bold**) → blocked; no previewToken.
3. Omit BYOK headers against https://devrelay-redmine-mcp.fly.dev/mcp → 401 / clear config error; body must not contain an API key.
```

---

## MCP / portal technical

1. Submission type: **With MCP** (app-plus-skills).
2. MCP URL: `https://devrelay-redmine-mcp.fly.dev/mcp`
3. After portal shows challenge token:

```powershell
fly secrets set OPENAI_APPS_CHALLENGE_TOKEN="<portal-token>" -a devrelay-redmine-mcp
```

4. Verify: `GET https://devrelay-redmine-mcp.fly.dev/.well-known/openai-apps-challenge` returns the token as plain text.
5. Scan Tools — expect annotated tools (reads readOnly; writes openWorld, dry-run gate).
6. CSP: MCP host only (`devrelay-redmine-mcp.fly.dev`); Redmine calls are server-side.
7. Skills ZIP: package `plugins/codex` (manifest + `skills/**`). Strip `.mcp.json` if the portal warns.
8. Submit for Review → Publish only after approval.

---

## Release notes (initial)

```text
Initial Plugins Directory submission of Redmine DevRelay (app-plus-skills).
Hosted Streamable HTTP MCP with BYOK (X-Redmine-Url / X-Redmine-Api-Key), confirm-gated writes, and bundled Codex skills.
Includes a public demo Redmine for review (disposable seed data). Local Git marketplace STDIO install remains available via HuijungYoon/devrelay.
```

---

## Still on you before Submit

- [ ] OpenAI Platform: verified developer identity + Apps Management Write
- [ ] Set challenge token secret on Fly after portal issues it
- [ ] Paste demo API key from password manager into portal (never commit)
- [ ] Skim Privacy/Terms HTML; adjust publisher legal name if needed
- [ ] Build skills ZIP and upload
