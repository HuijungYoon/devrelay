# Claude Code Marketplace — Redmine DevRelay Design

**Date:** 2026-07-22  
**Status:** Approved for implementation planning  
**Branch:** `feat/claude-code-marketplace`  
**Target:** Claude Code plugin packaging + self-hosted marketplace + community submit prep  
**MCP pin:** `redmine-devrelay@0.5.0` (no npm version bump)

## 1. Goal

Claude Code users can install DevRelay’s Redmine plugin via:

1. **Direct install** from this GitHub repo as a marketplace catalog (`/plugin marketplace add` → `/plugin install`)
2. **Community marketplace prep** — validate locally and document the Anthropic submission form inputs (actual form submit is human-owned)

Today the plugin only loads with `claude --plugin-dir ./plugins/claude-code`. Cursor already has `.cursor-plugin/marketplace.json`; Claude Code has no equivalent catalog.

## 2. Decisions (brainstorm)

| Topic | Choice |
| --- | --- |
| Scope | Self-hosted marketplace **and** community submit prep (option B/C) |
| Plugin public name | `redmine-devrelay` (align with Cursor + npm) |
| Marketplace catalog name | `devrelay` (align with Cursor) |
| Approach | Monorepo root marketplace pointing at `./plugins/claude-code` |
| Official Discover / `claude-plugins-official` | Out of scope (Anthropic discretion; community form does not add it) |
| Actual Anthropic form click / approval wait | Out of scope (document only) |
| MCP / client code | Unchanged |

## 3. Approach (selected)

**Monorepo root marketplace** (Approach 1):

- Add `.claude-plugin/marketplace.json` at repo root listing one plugin
- Rename Claude plugin manifest `name` from `redmine` → `redmine-devrelay`
- Keep `--plugin-dir` as local-dev fallback
- Document direct install + community submission checklist/draft copy

Rejected: separate submit-only repo (sync tax); docs-only without catalog (misses install UX).

## 4. Layout

```text
devrelay/
├── .claude-plugin/
│   └── marketplace.json          # NEW — catalog name "devrelay"
├── .cursor-plugin/
│   └── marketplace.json          # unchanged
└── plugins/claude-code/
    ├── .claude-plugin/plugin.json  # name → redmine-devrelay, version 0.5.0
    ├── .mcp.json                   # unchanged pin @0.5.0
    ├── README.md                   # install paths + slash table
    └── skills/…                    # unchanged bodies; docs reflect new namespace
```

### 4.1 `.claude-plugin/marketplace.json`

- `name`: `devrelay`
- `owner`: same as Cursor marketplace (`M2I`, `hjyoon@mxon.co.kr`)
- `plugins[]` one entry:
  - `name`: `redmine-devrelay`
  - `source`: `./plugins/claude-code`
  - `description`: read + write with dry-run → confirm gate (not read-only)
  - `version`: `0.5.0`
  - keywords/category optional; mirror Cursor where useful

### 4.2 `plugins/claude-code/.claude-plugin/plugin.json`

- `name`: `redmine-devrelay` (**breaking** slash namespace: `/redmine:…` → `/redmine-devrelay:…`)
- `description`: reflect 0.5.0 read/write + confirm gate
- `version`: `0.5.0`
- `author` / `license`: keep; add `repository` / `homepage` pointing at `https://github.com/HuijungYoon/devrelay` if schema allows

### 4.3 Docs

| File | Change |
| --- | --- |
| `docs/installation.md` | Claude section: marketplace add/install first; `--plugin-dir` fallback; env vars first |
| `README.md` | One-line Claude install path |
| `plugins/claude-code/README.md` | Full install table; slash commands under `/redmine-devrelay:…` |
| `docs/claude-code-marketplace-submit.md` | **NEW** — validate command, two submit URLs, paste-ready repo URL + blurb + env requirements + note that Discover sync can lag |

## 5. User flows

### 5.1 Direct install

```text
export REDMINE_URL=…
export REDMINE_API_KEY=…
/plugin marketplace add HuijungYoon/devrelay
/plugin install redmine-devrelay@devrelay
/reload-plugins
/redmine-devrelay:test-connection
```

### 5.2 Local development

```text
claude --plugin-dir ./plugins/claude-code
```

### 5.3 Community submit prep (human)

1. Push public `main` (or merge this branch) including marketplace + plugin
2. Run `claude plugin validate ./plugins/claude-code`
3. Open claude.ai or Console submit form; paste GitHub URL + path `plugins/claude-code`
4. Wait for automated review / nightly catalog sync — not part of this PR’s Done

## 6. Error handling / notes

- Missing `REDMINE_URL` / `REDMINE_API_KEY`: MCP fails at start — docs put env setup before install commands
- Namespace rename breaks existing `--plugin-dir` users on `/redmine:…` — one-line breaking note in `plugins/claude-code/README.md` and `docs/installation.md`
- Community “Published” ≠ immediate Discover listing — direct marketplace remains the reliable path
- Plugin install copies plugin directory only — no references outside `plugins/claude-code` (already satisfied; MCP via `npx`)

## 7. Testing / Done

**Checklist**

1. JSON valid for marketplace + plugin manifests; owner/brand consistent with Cursor
2. `claude plugin validate ./plugins/claude-code` passes
3. Smoke (when Claude Code available): marketplace add (path or GitHub) → install → `/redmine-devrelay:help`
4. Docs cross-check: install commands, namespace, env, submit draft agree
5. No secrets in plugin/marketplace files

**Done**

- Branch `feat/claude-code-marketplace` contains the above
- Direct install documented and structurally possible
- Community submit draft doc included
- No MCP package release required

## 8. Out of scope

- Cursor / Codex / Antigravity plugin changes (beyond optional README cross-link)
- npm package bumps or MCP tool changes
- Automating Anthropic form submission
- Entry into `claude-plugins-official`
- Separate plugin-only repository
