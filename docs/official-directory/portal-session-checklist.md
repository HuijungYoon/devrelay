# OpenAI portal — fill-in checklist (live session)

> **Deferred (2026-07-24).** Directory submit paused; Fly MCP/demo torn down. Keep for a future retry. Live install path: Codex Git marketplace / `npx redmine-devrelay` (STDIO).

Portal: https://platform.openai.com/apps-manage/  
Docs: https://learn.chatgpt.com/docs/submit-plugins  
Skills ZIP (no `.mcp.json`): `dist-portal/redmine-devrelay-skills.zip`  
Full draft: [portal-submission-draft.md](./portal-submission-draft.md)

## Before the form

1. Org role: **Apps Management = Write**
2. **Developer Identity** verified (individual or business)
3. Keep demo API key ready (password manager) — not from git

## Create draft

1. **Create plugin** → **With MCP** (app-plus-skills)
2. Paste listing fields below
3. MCP URL → Scan Tools → domain challenge → set Fly secret → Verify
4. Upload skills ZIP
5. Prompts + 5/3 tests + demo credentials
6. Submit for Review (do not Publish until approved)

---

## Copy-paste: listing

**Name:** `Redmine DevRelay`  
**Category:** Productivity  
**Website:** `https://github.com/HuijungYoon/devrelay`  
**Support:** `https://github.com/HuijungYoon/devrelay/issues`  
**Privacy:** `https://devrelay-redmine-mcp.fly.dev/privacy`  
**Terms:** `https://devrelay-redmine-mcp.fly.dev/terms`

**Short description:**

```text
Connect ChatGPT / Codex to your Redmine via MCP: list issues, inspect history, and draft writes with a dry-run confirm gate. Bring your own Redmine URL and API key (BYOK); no shared vault.
```

**Long description:**

```text
Redmine DevRelay is an MCP plugin for Redmine issue tracking. Read tools cover connection tests, project listing, issue search (including assignedTo=me), and issue detail with journals. Write tools (create issue, update, comments, attachments, status) default to dry-run: you get a previewToken, then confirm with that token—no silent applies. Notes must be plain text; Textile/Markdown markup is blocked.

For Directory use, the hosted path is Streamable HTTP MCP with per-request BYOK headers (X-Redmine-Url, X-Redmine-Api-Key). The existing Git marketplace / STDIO install (npx redmine-devrelay) remains available for local Codex. Point the plugin at your own Redmine; a public demo instance is provided only for review.
```

---

## Copy-paste: MCP

**MCP server URL:** `https://devrelay-redmine-mcp.fly.dev/mcp`

**Auth:** BYOK headers (not OAuth). Demo credentials for reviewers:

```text
Redmine URL: https://devrelay-redmine-demo.fly.dev
API key:     <paste from password manager>
```

When the portal shows a **domain challenge token**, run locally:

```powershell
fly secrets set OPENAI_APPS_CHALLENGE_TOKEN="<paste-token-here>" -a devrelay-redmine-mcp
```

Then click **Verify Domain**. Confirm:

`https://devrelay-redmine-mcp.fly.dev/.well-known/openai-apps-challenge`

**CSP (exact hosts):** `https://devrelay-redmine-mcp.fly.dev`  
(Redmine is fetched server-side only.)

---

## Copy-paste: starter prompts

```text
Test my Redmine connection and show who I am.
List my open Redmine issues and summarize the top three by priority.
Draft (dry-run only) a new bug in project 1 titled "Login timeout" assigned to me.
Open issue 3 and summarize the journal history.
```

---

## Copy-paste: positive tests (5)

```text
1. Call redmine_test_connection → expect login "demo" and a numeric id.
2. Call redmine_search_issues with assignedTo=me → expect ≥1 open issue (seed has 3).
3. Call redmine_get_issue on id 3 including journals → expect non-empty journals array.
4. Call redmine_create_issue dry-run (confirm unset/false) on projectId 1 → expect previewToken and no new issue id.
5. Call redmine_add_comment dry-run on issue 1, then confirm=true with that previewToken → expect journal added.
```

---

## Copy-paste: negative tests (3)

```text
1. confirm=true on first call / without previewToken → validation error; no apply.
2. notes containing "h3. Heading" (or Markdown # / **bold**) → blocked; no previewToken.
3. Omit BYOK headers against https://devrelay-redmine-mcp.fly.dev/mcp → 401 / clear config error; body must not contain an API key.
```

---

## Copy-paste: release notes

```text
Initial Plugins Directory submission of Redmine DevRelay (app-plus-skills).
Hosted Streamable HTTP MCP with BYOK (X-Redmine-Url / X-Redmine-Api-Key), confirm-gated writes, and bundled Codex skills.
Includes a public demo Redmine for review (disposable seed data). Local Git marketplace STDIO install remains available via HuijungYoon/devrelay.
```

---

## After challenge token (tell the agent)

Paste the portal challenge token here and ask to run `fly secrets set` — then re-check Verify Domain.
