# Codex Marketplace Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `redmine-devrelay` installable in Codex via Git marketplace (`HuijungYoon/devrelay`) and local `codex plugin marketplace add .`, with plugin metadata/docs updated to 0.5.0.

**Architecture:** Add repo-scoped `.agents/plugins/marketplace.json` pointing at `./plugins/codex`. Refresh `.codex-plugin/plugin.json` id to `redmine-devrelay` and 0.5.0 copy. Keep `.mcp.json` pinned to `npx -y redmine-devrelay@0.5.0`. Document Git + local install; no MCP package changes.

**Tech Stack:** Codex plugin manifests (`.codex-plugin/plugin.json`, `.agents/plugins/marketplace.json`), existing Codex skills, npm `redmine-devrelay@0.5.0`, Markdown docs.

**Spec:** `docs/superpowers/specs/2026-07-22-codex-marketplace-install-design.md`

## Global Constraints

- MCP pin: `redmine-devrelay@0.5.0` (no npm version bump; do not edit `packages/**`)
- Plugin `name`: `redmine-devrelay` (replace legacy Codex `redmine`)
- Marketplace `name`: `devrelay`; install id: `redmine-devrelay@devrelay`
- Policy: `installation: AVAILABLE`, `authentication: ON_FIRST_USE` (if CLI rejects auth value, omit `authentication` or use `ON_INSTALL` and document)
- `source.path` must be `./plugins/codex` (relative to repo root, `./`-prefixed)
- Skills bodies under `plugins/codex/skills/**` unchanged unless a broken id reference is found
- Out of scope: OpenAI curated Plugin Directory submission, separate marketplace repo
- Work on branch: `codex/marketplace-install`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `.agents/plugins/marketplace.json` | Codex marketplace catalog entry for `redmine-devrelay` |
| `plugins/codex/.codex-plugin/plugin.json` | Plugin identity, version, install-surface copy |
| `plugins/codex/.mcp.json` | Unchanged MCP STDIO pin (verify only) |
| `plugins/codex/README.md` | Git + local install, env, approval policy keys, migration |
| `docs/installation.md` | Codex section with concrete CLI commands |
| `README.md` | Codex subsection with same install commands |

---

### Task 1: Add Codex marketplace catalog

**Files:**
- Create: `.agents/plugins/marketplace.json`

**Interfaces:**
- Consumes: Spec §4.1 marketplace shape
- Produces: Marketplace named `devrelay` exposing plugin `redmine-devrelay` at `./plugins/codex`

- [ ] **Step 1: Create directory and marketplace file**

Create `.agents/plugins/marketplace.json` with exactly:

```json
{
  "name": "devrelay",
  "interface": {
    "displayName": "DevRelay"
  },
  "plugins": [
    {
      "name": "redmine-devrelay",
      "source": {
        "source": "local",
        "path": "./plugins/codex"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_FIRST_USE"
      },
      "category": "Productivity"
    }
  ]
}
```

- [ ] **Step 2: Validate JSON parses**

Run (PowerShell):

```powershell
Get-Content .agents/plugins/marketplace.json -Raw | ConvertFrom-Json | ConvertTo-Json -Depth 10
Test-Path .\plugins\codex\.codex-plugin\plugin.json
```

Expected: JSON prints without error; `Test-Path` is `True`.

- [ ] **Step 3: Commit**

```bash
git add .agents/plugins/marketplace.json
git commit -m "feat(codex): add repo marketplace catalog for redmine-devrelay"
```

---

### Task 2: Refresh Codex plugin manifest to 0.5.0

**Files:**
- Modify: `plugins/codex/.codex-plugin/plugin.json`
- Verify (no edit): `plugins/codex/.mcp.json`

**Interfaces:**
- Consumes: Marketplace entry name `redmine-devrelay` from Task 1
- Produces: Plugin manifest whose `name` matches marketplace plugin name; `capabilities` include Read and Write

- [ ] **Step 1: Replace `plugins/codex/.codex-plugin/plugin.json`**

Write the full file:

```json
{
  "name": "redmine-devrelay",
  "version": "0.5.0",
  "description": "Redmine read/write via redmine-devrelay MCP (dry-run → confirm + previewToken) and bundled skills.",
  "author": { "name": "M2I" },
  "license": "MIT",
  "homepage": "https://github.com/HuijungYoon/devrelay",
  "repository": "https://github.com/HuijungYoon/devrelay",
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "interface": {
    "displayName": "Redmine DevRelay",
    "shortDescription": "Redmine issues with confirm-gated writes",
    "longDescription": "Search, view, create, and update Redmine issues from Codex via redmine-devrelay@0.5.0. Writes use dry-run preview, then confirm=true with previewToken.",
    "developerName": "M2I",
    "category": "Productivity",
    "capabilities": ["Read", "Write"],
    "websiteURL": "https://github.com/HuijungYoon/devrelay"
  }
}
```

- [ ] **Step 2: Assert MCP pin unchanged**

Run (PowerShell):

```powershell
Get-Content plugins/codex/.mcp.json -Raw | ConvertFrom-Json | ConvertTo-Json -Depth 5
Select-String -Path plugins/codex/.mcp.json -Pattern 'redmine-devrelay@0\.5\.0'
Get-Content plugins/codex/.codex-plugin/plugin.json -Raw | ConvertFrom-Json | Select-Object name, version
```

Expected: `.mcp.json` still contains `redmine-devrelay@0.5.0`; plugin `name` is `redmine-devrelay`; `version` is `0.5.0`.

- [ ] **Step 3: Commit**

```bash
git add plugins/codex/.codex-plugin/plugin.json
git commit -m "feat(codex): rename plugin to redmine-devrelay and refresh 0.5.0 metadata"
```

---

### Task 3: Document Git + local Codex install in plugin README

**Files:**
- Modify: `plugins/codex/README.md`

**Interfaces:**
- Consumes: Marketplace name `devrelay`, plugin id `redmine-devrelay`, MCP `@0.5.0`
- Produces: User-facing install commands and approval TOML keyed to `redmine-devrelay`

- [ ] **Step 1: Rewrite `plugins/codex/README.md`**

Replace the entire file with:

```markdown
# Codex — Redmine DevRelay

Redmine 조회·쓰기 via `redmine-devrelay@0.5.0` (dry-run → 확인 → `confirm=true` + `previewToken`).

## Install

### Git marketplace

```bash
codex plugin marketplace add HuijungYoon/devrelay
codex plugin install redmine-devrelay@devrelay
```

Feature-branch test: `codex plugin marketplace add HuijungYoon/devrelay --ref <branch>` then the same install. Prefer a full checkout (avoid `--sparse .agents/plugins` alone — it can omit `plugins/codex`).

### Local marketplace (repo root)

```bash
git clone https://github.com/HuijungYoon/devrelay.git
cd devrelay
codex plugin marketplace add .
codex plugin install redmine-devrelay@devrelay
```

Then start a new Codex session / reload plugins if needed.

### Migration from old plugin id

If you previously installed this plugin as `redmine`, uninstall/remove it and install `redmine-devrelay@devrelay`.

## Env

```bash
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=...
```

Optional: `REDMINE_ALLOWED_HOSTS`, `REDMINE_CA_CERT_PATH`.

`.mcp.json` uses `npx -y redmine-devrelay@0.5.0`.

## Recommended approval policy

조회는 `approve`, 쓰기는 `prompt` 권장.

```toml
[plugins."redmine-devrelay".mcp_servers.redmine]
enabled = true
default_tools_approval_mode = "prompt"

[plugins."redmine-devrelay".mcp_servers.redmine.tools.redmine_test_connection]
approval_mode = "approve"
[plugins."redmine-devrelay".mcp_servers.redmine.tools.redmine_list_projects]
approval_mode = "approve"
[plugins."redmine-devrelay".mcp_servers.redmine.tools.redmine_list_project_members]
approval_mode = "approve"
[plugins."redmine-devrelay".mcp_servers.redmine.tools.redmine_search_users]
approval_mode = "approve"
[plugins."redmine-devrelay".mcp_servers.redmine.tools.redmine_search_issues]
approval_mode = "approve"
[plugins."redmine-devrelay".mcp_servers.redmine.tools.redmine_get_issue]
approval_mode = "approve"
```

## Skills

| Skill | 동작 |
| --- | --- |
| `help` | 명령 목록 |
| `test-connection` | 연결 확인 |
| `list-projects` | 프로젝트 목록 |
| `my-issues` | 내 열린 이슈 |
| `issue` | 이슈 상세 + journals |
| `create-issue` | 이슈 생성 (dry-run → 확인) |
| `update-issue` | 이슈 수정 (dry-run → 확인) |
| `add-comment` | 댓글 (dry-run → 확인) |
| `add-attachment` | 파일 첨부 (dry-run → 확인) |
| `update-status` | 상태 변경 (dry-run → 확인) |
```

- [ ] **Step 2: Sanity-check README mentions both install paths**

Run (PowerShell):

```powershell
Select-String -Path plugins/codex/README.md -Pattern 'marketplace add HuijungYoon/devrelay','marketplace add \.','redmine-devrelay@devrelay','Migration from old plugin id'
```

Expected: all four patterns match.

- [ ] **Step 3: Commit**

```bash
git add plugins/codex/README.md
git commit -m "docs(codex): document Git and local marketplace install"
```

---

### Task 4: Align root installation docs

**Files:**
- Modify: `docs/installation.md` (section `## 6. Codex`)
- Modify: `README.md` (section `### 5. Codex`)

**Interfaces:**
- Consumes: Same commands as Task 3 README
- Produces: Consistent install instructions across repo docs

- [ ] **Step 1: Replace `docs/installation.md` Codex section**

Find:

```markdown
## 6. Codex

Load `plugins/codex` per Codex plugin docs.  
Skills: `help`, `my-issues`, `issue`, `create-issue`, `update-issue`, `add-comment`, `update-status` 등.
```

Replace with:

```markdown
## 6. Codex

Git marketplace:

```bash
codex plugin marketplace add HuijungYoon/devrelay
codex plugin install redmine-devrelay@devrelay
```

Local (repo root):

```bash
codex plugin marketplace add .
codex plugin install redmine-devrelay@devrelay
```

Set `REDMINE_URL` / `REDMINE_API_KEY`. Skills: `help`, `test-connection`, `list-projects`, `my-issues`, `issue`, `create-issue`, `update-issue`, `add-comment`, `add-attachment`, `update-status`.  
Details: `plugins/codex/README.md`.
```

- [ ] **Step 2: Replace `README.md` Codex subsection**

Find:

```markdown
### 5. Codex

`plugins/codex`를 로드합니다. 조회는 approve, 쓰기는 prompt 권장. 자세한 내용은 `plugins/codex/README.md`.
```

Replace with:

```markdown
### 5. Codex

```bash
codex plugin marketplace add HuijungYoon/devrelay
codex plugin install redmine-devrelay@devrelay
```

로컬 개발: 레포 루트에서 `codex plugin marketplace add .` 후 동일 install.  
조회는 approve, 쓰기는 prompt 권장. 자세한 내용: `plugins/codex/README.md`.
```

- [ ] **Step 3: Grep for stale Codex install wording**

Run (PowerShell):

```powershell
Select-String -Path docs/installation.md,README.md,plugins/codex/README.md -Pattern 'per Codex plugin docs|plugins/codex`를 로드'
Select-String -Path docs/installation.md,README.md,plugins/codex/README.md -Pattern 'redmine-devrelay@devrelay'
```

Expected: first search has no matches; second finds matches in all three files.

- [ ] **Step 4: Commit**

```bash
git add docs/installation.md README.md
git commit -m "docs: document Codex marketplace install in installation guides"
```

---

### Task 5: Verify marketplace wiring (CLI if available)

**Files:**
- None required (verification only). If `authentication: ON_FIRST_USE` is rejected by CLI, modify `.agents/plugins/marketplace.json` policy per Global Constraints and amend docs in the same commit.

**Interfaces:**
- Consumes: Tasks 1–4 artifacts
- Produces: Confirmed local add/list/install path, or documented manual checklist when `codex` is missing

- [ ] **Step 1: Check whether Codex CLI exists**

Run:

```powershell
codex --version
```

If command not found: skip to Step 4 (manual checklist only) and still complete Step 5 commit message noting CLI was unavailable.

- [ ] **Step 2: Local marketplace add + list (CLI present)**

From repo root:

```bash
codex plugin marketplace add .
codex plugin marketplace list
```

Expected: an entry named `devrelay` (or display showing this marketplace root).

If add fails because of `authentication: ON_FIRST_USE`:

1. Edit `.agents/plugins/marketplace.json` — remove the `authentication` key (keep `installation: AVAILABLE`) **or** set `"authentication": "ON_INSTALL"`.
2. Re-run add.
3. Update `plugins/codex/README.md` only if the documented policy field was mentioned (it is not required in user install steps).
4. Include the marketplace.json fix in the Task 5 commit.

- [ ] **Step 3: Install plugin (CLI present)**

```bash
codex plugin install redmine-devrelay@devrelay
```

Expected: install succeeds. Optional follow-up with env set: ask Codex to run `redmine_test_connection`.

If the install subcommand spelling differs on your Codex version, use the working form from `codex plugin --help` / `/plugins` UI and update README + `docs/installation.md` + root `README.md` in the same commit so all three stay identical.

- [ ] **Step 4: Record verification outcome**

Create nothing permanent unless CLI forced a manifest/doc fix. For the PR/handoff note, record one of:

- `CLI verified: marketplace add . + install redmine-devrelay@devrelay OK`
- `CLI unavailable: manifests/docs landed; manual checklist remains in spec §7`

- [ ] **Step 5: Commit only if Step 2–3 required file changes**

```bash
git status
# If marketplace.json and/or docs changed:
git add .agents/plugins/marketplace.json plugins/codex/README.md docs/installation.md README.md
git commit -m "fix(codex): align marketplace policy with Codex CLI"
```

If no file changes, do not create an empty commit.

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| `.agents/plugins/marketplace.json` with `./plugins/codex` | Task 1 |
| Plugin id `redmine-devrelay`, version/copy 0.5.0, Read+Write | Task 2 |
| `.mcp.json` unchanged @0.5.0 | Task 2 verify |
| Git + local install docs in `plugins/codex/README.md` | Task 3 |
| Migration note old `redmine` id | Task 3 |
| Approval policy keys updated | Task 3 |
| `docs/installation.md` Codex section | Task 4 |
| Root `README.md` Codex subsection | Task 4 |
| CLI verification / auth fallback | Task 5 |
| No MCP/npm bump, skills untouched | Global Constraints |
| Branch `codex/marketplace-install` | Already created; continue on it |

## Placeholder / consistency check

- Install id consistently `redmine-devrelay@devrelay`
- Marketplace name consistently `devrelay`
- Capabilities exactly `["Read", "Write"]` per Codex Build plugins example
- No TBD/TODO left in tasks
