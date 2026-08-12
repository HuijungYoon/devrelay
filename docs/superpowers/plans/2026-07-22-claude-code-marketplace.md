# Claude Code Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `plugins/claude-code` installable via `/plugin marketplace add HuijungYoon/devrelay` + `/plugin install redmine-devrelay@devrelay`, and document Anthropic community marketplace submit prep.

**Architecture:** Add a repo-root `.claude-plugin/marketplace.json` catalog (`devrelay`) that points at `./plugins/claude-code`. Rename the Claude plugin manifest to `redmine-devrelay` (aligned with Cursor/npm). Update install docs and add a human submit checklist. No MCP/npm code changes.

**Tech Stack:** Claude Code plugin manifests, JSON marketplace catalog, Markdown docs, existing `redmine-devrelay@0.5.0` on npm via `.mcp.json`.

**Spec:** `docs/superpowers/specs/2026-07-22-claude-code-marketplace-design.md`

## Global Constraints

- MCP pin stays `redmine-devrelay@0.5.0` — do not bump npm packages
- Marketplace catalog `name`: `devrelay`
- Plugin public `name`: `redmine-devrelay` (breaking: slash `/redmine:…` → `/redmine-devrelay:…`)
- Owner matches Cursor marketplace: `M2I` / `hjyoon@mxon.co.kr`
- GitHub: `https://github.com/HuijungYoon/devrelay`
- No secrets in repo; `${REDMINE_*}` placeholders OK in `.mcp.json`
- Out of scope: Cursor/Codex/Antigravity changes, Anthropic form click, `claude-plugins-official`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `.claude-plugin/marketplace.json` | Claude Code marketplace catalog listing `redmine-devrelay` |
| `plugins/claude-code/.claude-plugin/plugin.json` | Plugin identity (`redmine-devrelay`, v0.5.0) |
| `plugins/claude-code/README.md` | Env → marketplace install → local fallback → slash table |
| `docs/installation.md` | Claude Code section rewrite |
| `README.md` | Claude Code quick-start install lines |
| `docs/claude-code-marketplace-submit.md` | Community submit checklist + paste-ready copy |
| `plugins/claude-code/.mcp.json` | Unchanged (pin @0.5.0) |
| `docs/superpowers/specs/2026-07-22-claude-code-marketplace-design.md` | Spec (already committed) |

---

### Task 1: Plugin manifest rename + marketplace catalog

**Files:**
- Modify: `plugins/claude-code/.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`

**Interfaces:**
- Consumes: Spec §4.1–4.2; Cursor owner fields from `.cursor-plugin/marketplace.json`
- Produces: installable plugin id `redmine-devrelay` under marketplace id `devrelay`

- [ ] **Step 1: Write a small Node assert script (fail before files exist / old name)**

Create temp check (run from repo root; do not commit this script — delete after Task 1 or keep only as one-off):

```bash
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('plugins/claude-code/.claude-plugin/plugin.json','utf8')); if(p.name!=='redmine-devrelay') process.exit(1); if(p.version!=='0.5.0') process.exit(2);"
```

Expected **before** edit: exit code `1` (name still `redmine`).

- [ ] **Step 2: Replace `plugins/claude-code/.claude-plugin/plugin.json` with**

```json
{
  "name": "redmine-devrelay",
  "description": "Redmine read/write via redmine-devrelay MCP (dry-run → confirm) and slash skills for Claude Code.",
  "version": "0.5.0",
  "author": { "name": "M2I" },
  "homepage": "https://github.com/HuijungYoon/devrelay",
  "repository": "https://github.com/HuijungYoon/devrelay",
  "license": "MIT"
}
```

If `claude plugin validate` later rejects `homepage` or `repository`, remove those two fields and keep the rest.

- [ ] **Step 3: Create `.claude-plugin/marketplace.json`**

```json
{
  "name": "devrelay",
  "owner": {
    "name": "M2I",
    "email": "hjyoon@mxon.co.kr"
  },
  "metadata": {
    "description": "DevRelay plugins for Claude Code — Redmine MCP and issue skills",
    "version": "0.5.0"
  },
  "plugins": [
    {
      "name": "redmine-devrelay",
      "source": "./plugins/claude-code",
      "description": "Connect Claude Code to Redmine: test connection, list projects, search my open issues, view issue detail, and create/update/comment/attach with dry-run confirm gate.",
      "version": "0.5.0",
      "keywords": ["redmine", "mcp", "issues"],
      "category": "developer-tools"
    }
  ]
}
```

- [ ] **Step 4: Re-run the Node assert from Step 1**

Expected: exit code `0`.

Also verify marketplace JSON parses and lists the plugin:

```bash
node -e "const m=require('./.claude-plugin/marketplace.json'); if(m.name!=='devrelay') process.exit(1); if(m.plugins[0].name!=='redmine-devrelay') process.exit(2); if(m.plugins[0].source!=='./plugins/claude-code') process.exit(3); console.log('ok');"
```

Expected: prints `ok`.

- [ ] **Step 5: Commit**

```bash
git add plugins/claude-code/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "feat(claude): marketplace catalog and redmine-devrelay plugin id"
```

---

### Task 2: Claude plugin README (install + breaking namespace)

**Files:**
- Modify: `plugins/claude-code/README.md` (full rewrite of install/slash sections)

**Interfaces:**
- Consumes: Task 1 names (`redmine-devrelay@devrelay`, slash `/redmine-devrelay:…`)
- Produces: user-facing install instructions for Task 3 cross-links

- [ ] **Step 1: Replace `plugins/claude-code/README.md` with**

```markdown
# Claude Code — Redmine plugin

Redmine 조회·쓰기 via `redmine-devrelay@0.5.0` (dry-run → 확인 후 적용).

**Breaking:** plugin id is `redmine-devrelay` (was `redmine`). Slash commands are `/redmine-devrelay:…` (was `/redmine:…`).

## Prerequisites

```bash
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=...
```

Optional: `REDMINE_ALLOWED_HOSTS`, `REDMINE_CA_CERT_PATH` (see `docs/installation.md`).

`.mcp.json` uses `npx -y redmine-devrelay@0.5.0`.

## Install from marketplace (recommended)

From Claude Code (after this repo is on GitHub with `.claude-plugin/marketplace.json`):

```text
/plugin marketplace add HuijungYoon/devrelay
/plugin install redmine-devrelay@devrelay
/reload-plugins
```

Then try `/redmine-devrelay:test-connection`.

Local path marketplace (this clone):

```text
/plugin marketplace add ./
/plugin install redmine-devrelay@devrelay
```

(Use the repo root that contains `.claude-plugin/marketplace.json`.)

## Local load (dev fallback)

```bash
claude --plugin-dir ./plugins/claude-code
```

## Local test (repo build)

Temporarily point `.mcp.json` at a local build:

```json
{
  "mcpServers": {
    "redmine": {
      "command": "node",
      "args": ["../../packages/redmine-mcp/dist/index.js"],
      "env": {
        "REDMINE_URL": "${REDMINE_URL}",
        "REDMINE_API_KEY": "${REDMINE_API_KEY}"
      }
    }
  }
}
```

Build first: `pnpm --filter redmine-devrelay build`

## Slash commands

| 명령 | 동작 |
| --- | --- |
| `/redmine-devrelay:help` | 명령 목록 |
| `/redmine-devrelay:test-connection` | 연결 확인 |
| `/redmine-devrelay:list-projects` | 프로젝트 목록 |
| `/redmine-devrelay:my-issues` | 내 열린 이슈 |
| `/redmine-devrelay:issue` | 이슈 상세 |
| `/redmine-devrelay:create-issue` | 이슈 생성 (dry-run → 확인) |
| `/redmine-devrelay:update-issue` | 이슈 수정 (dry-run → 확인) |
| `/redmine-devrelay:add-comment` | 댓글 (dry-run → 확인) |
| `/redmine-devrelay:add-attachment` | 첨부 (dry-run → 확인) |
| `/redmine-devrelay:update-status` | 상태 변경 (dry-run → 확인) |

Community marketplace submission checklist: `docs/claude-code-marketplace-submit.md`.
```

- [ ] **Step 2: Grep for stale `/redmine:` (without `-devrelay`) in this README**

```bash
rg "/redmine:[a-z]" plugins/claude-code/README.md
```

Expected: no matches (empty).

- [ ] **Step 3: Commit**

```bash
git add plugins/claude-code/README.md
git commit -m "docs(claude): marketplace install and redmine-devrelay slash names"
```

---

### Task 3: Root install docs (`docs/installation.md` + `README.md`)

**Files:**
- Modify: `docs/installation.md` — section `## 5. Claude Code`
- Modify: `README.md` — subsection `### 4. Claude Code`

**Interfaces:**
- Consumes: Task 2 install commands
- Produces: root docs that match plugin README

- [ ] **Step 1: Replace `docs/installation.md` section `## 5. Claude Code` with**

```markdown
## 5. Claude Code

**Breaking:** slash namespace is `/redmine-devrelay:…` (was `/redmine:…`).

Set `REDMINE_URL` / `REDMINE_API_KEY` first (section 3).

Marketplace install:

```text
/plugin marketplace add HuijungYoon/devrelay
/plugin install redmine-devrelay@devrelay
/reload-plugins
```

Local clone / path marketplace:

```text
/plugin marketplace add /path/to/devrelay
/plugin install redmine-devrelay@devrelay
```

Dev fallback (no marketplace):

```bash
claude --plugin-dir ./plugins/claude-code
```

Slash 예: `/redmine-devrelay:help`, `/redmine-devrelay:my-issues`, `/redmine-devrelay:create-issue`.  
쓰기는 **미리보기 → 확인 → 적용**.

Community submit prep: `docs/claude-code-marketplace-submit.md`.
```

Keep surrounding section numbers (6 Codex, 7 Cursor, …) unchanged.

- [ ] **Step 2: Replace `README.md` subsection `### 4. Claude Code` with**

```markdown
### 4. Claude Code

`plugins/claude-code/.mcp.json`은 `redmine-devrelay@0.5.0`를 사용합니다.

```text
/plugin marketplace add HuijungYoon/devrelay
/plugin install redmine-devrelay@devrelay
```

로컬 폴백: `claude --plugin-dir ./plugins/claude-code`

- `/mcp`로 연결 확인
- `/redmine-devrelay:create-issue`, `/redmine-devrelay:update-issue` 등 또는 자연어
```

- [ ] **Step 3: Grep root docs for stale Claude slash names**

```bash
rg "/redmine:(help|my-issues|create-issue|update-issue)" docs/installation.md README.md
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add docs/installation.md README.md
git commit -m "docs: Claude Code marketplace install paths"
```

---

### Task 4: Community submit checklist doc

**Files:**
- Create: `docs/claude-code-marketplace-submit.md`

**Interfaces:**
- Consumes: Task 1 catalog/plugin paths; Anthropic submit URLs from spec
- Produces: human paste-ready submit packet

- [ ] **Step 1: Create `docs/claude-code-marketplace-submit.md` with**

```markdown
# Claude Code — community marketplace submit checklist

Prep only. **Do not automate the form submit.** Actual click + review wait are human-owned.

Direct install (works without community listing):

```text
/plugin marketplace add HuijungYoon/devrelay
/plugin install redmine-devrelay@devrelay
```

## Before submit

1. Public GitHub repo includes:
   - `.claude-plugin/marketplace.json`
   - `plugins/claude-code/` (plugin root with `.claude-plugin/plugin.json`, `.mcp.json`, `skills/`)
2. No API keys or secrets in those files
3. Validate:

```bash
claude plugin validate ./plugins/claude-code
```

Expected: validation success (no errors). If `homepage`/`repository` fields are rejected, remove them from `plugin.json` and re-validate.

## Submit forms

- Claude.ai: https://claude.ai/admin-settings/directory/submissions/plugins/new
- Console: https://platform.claude.com/plugins/submit

## Paste-ready fields

| Field | Value |
| --- | --- |
| GitHub URL | `https://github.com/HuijungYoon/devrelay` |
| Plugin path | `plugins/claude-code` |
| Plugin name | `redmine-devrelay` |
| One-line description | Redmine MCP for Claude Code: list/search issues and create/update/comment/attach with dry-run confirm gate. |
| Env required | `REDMINE_URL`, `REDMINE_API_KEY` (optional `REDMINE_ALLOWED_HOSTS`, `REDMINE_CA_CERT_PATH`) |
| MCP | `npx -y redmine-devrelay@0.5.0` via plugin `.mcp.json` |

## After submit

- Automated review + safety screening may take time
- Community catalog sync can lag (nightly); “Published” in the portal may not mean immediate Discover listing
- Until then, users should use the **direct marketplace** path above
- Official `claude-plugins-official` is separate and not requested by this form
```

- [ ] **Step 2: Confirm file exists and links from plugin README resolve**

```bash
test -f docs/claude-code-marketplace-submit.md && rg "claude-code-marketplace-submit" plugins/claude-code/README.md docs/installation.md
```

Expected: file exists; at least one reference in each of the two docs (installation was updated in Task 3).

- [ ] **Step 3: Commit**

```bash
git add docs/claude-code-marketplace-submit.md
git commit -m "docs: Claude Code community marketplace submit checklist"
```

---

### Task 5: Validate + smoke checklist

**Files:**
- None required (verification only). Fix manifests only if validate fails (same files as Task 1).

**Interfaces:**
- Consumes: all prior tasks
- Produces: evidence for Done checklist in the spec

- [ ] **Step 1: JSON + name invariants**

```bash
node -e "const p=require('./plugins/claude-code/.claude-plugin/plugin.json'); const m=require('./.claude-plugin/marketplace.json'); if(p.name!=='redmine-devrelay'||p.version!=='0.5.0') process.exit(1); if(m.name!=='devrelay'||m.plugins[0].source!=='./plugins/claude-code') process.exit(2); const mcp=require('./plugins/claude-code/.mcp.json'); if(!mcp.mcpServers.redmine.args.includes('redmine-devrelay@0.5.0')) process.exit(3); console.log('invariants ok');"
```

Expected: `invariants ok`.

- [ ] **Step 2: Run Claude validate**

```bash
claude plugin validate ./plugins/claude-code
```

Expected: success. If Claude CLI is unavailable in the environment, record that in the PR description and still ship docs/manifests; do not invent a pass.

- [ ] **Step 3: Optional smoke (when Claude Code interactive is available)**

```text
/plugin marketplace add ./
/plugin install redmine-devrelay@devrelay
/reload-plugins
/redmine-devrelay:help
```

Expected: help skill runs. Skip if non-interactive CI; note skip in PR.

- [ ] **Step 4: Secret scan (quick)**

```bash
rg -i "api[_-]?key|password|secret" .claude-plugin/marketplace.json plugins/claude-code/.claude-plugin/plugin.json plugins/claude-code/.mcp.json
```

Expected: only placeholder env var names like `REDMINE_API_KEY` in `.mcp.json`, no literal secrets.

- [ ] **Step 5: Final commit only if Step 2 forced manifest tweaks; otherwise no empty commit**

If validate required removing `homepage`/`repository`:

```bash
git add plugins/claude-code/.claude-plugin/plugin.json
git commit -m "fix(claude): drop plugin.json fields rejected by validate"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Root `.claude-plugin/marketplace.json` (`devrelay`) | Task 1 |
| Plugin rename + version 0.5.0 + description | Task 1 |
| `plugins/claude-code/README.md` install + breaking note + slash table | Task 2 |
| `docs/installation.md` + root `README.md` | Task 3 |
| `docs/claude-code-marketplace-submit.md` | Task 4 |
| validate + smoke + no secrets | Task 5 |
| Keep `--plugin-dir` fallback | Tasks 2–3 |
| No MCP/npm bump; no Cursor/Codex/Antigravity | Global Constraints |
| Out of scope: form click / official marketplace | Task 4 docs only |

No placeholders left in steps. Names consistent: marketplace `devrelay`, plugin `redmine-devrelay`, pin `@0.5.0`.
