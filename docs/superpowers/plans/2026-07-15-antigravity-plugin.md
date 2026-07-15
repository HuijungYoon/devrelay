# Antigravity Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `plugins/antigravity/` so Antigravity IDE and CLI can install DevRelay as a native plugin with `redmine-devrelay@0.4.0` MCP and `/redmine:…` slash skills.

**Architecture:** Add a dedicated Antigravity plugin package (official `plugin.json` + `mcp_config.json` + `skills/`). Copy skill bodies from Claude Code; set frontmatter `name` to `redmine:<skill>` for Claude-style slash commands. Document clone+path and local install. No npm package or MCP code changes.

**Tech Stack:** Antigravity CLI (`agy`) plugin layout, Markdown skills, JSON manifests, existing `redmine-devrelay@0.4.0` on npm.

**Spec:** `docs/superpowers/specs/2026-07-15-antigravity-plugin-design.md`

## Global Constraints

- MCP pin: `redmine-devrelay@0.4.0` (no version bump)
- Plugin manifest `name`: `redmine-devrelay` (pattern `^[a-zA-Z0-9-_]+$` only)
- Do not add undeclared fields to `plugin.json` (`additionalProperties: false`)
- Skills content source: `plugins/claude-code/skills/`
- Slash target: `/redmine:…`; if `agy plugin validate` rejects `:`, fall back to `redmine-…` and document both
- No secrets in repo; `${REDMINE_*}` placeholders OK in `mcp_config.json`
- Out of scope: marketplace, hooks/agents/rules, shared skills sync script

---

## File Structure

| File | Responsibility |
| --- | --- |
| `plugins/antigravity/plugin.json` | Antigravity plugin identity |
| `plugins/antigravity/mcp_config.json` | STDIO MCP → `npx redmine-devrelay@0.4.0` |
| `plugins/antigravity/README.md` | Install, env, slash table, fallbacks |
| `plugins/antigravity/skills/*/SKILL.md` | Ten skills with `name: redmine:…` |
| `README.md` | Mention Antigravity surface + short install |
| `docs/installation.md` | Antigravity subsection |
| `docs/superpowers/specs/2026-07-15-antigravity-plugin-design.md` | Spec (already committed) |

---

### Task 1: Scaffold `plugin.json` + `mcp_config.json`

**Files:**
- Create: `plugins/antigravity/plugin.json`
- Create: `plugins/antigravity/mcp_config.json`

**Interfaces:**
- Consumes: Antigravity plugin schema (`name`, optional `description`)
- Produces: installable manifest + MCP config used by Tasks 2–4

- [ ] **Step 1: Create `plugins/antigravity/plugin.json`**

```json
{
  "$schema": "https://antigravity.google/schemas/v1/plugin.json",
  "name": "redmine-devrelay",
  "description": "Redmine read/write via redmine-devrelay MCP (dry-run confirm gate) and /redmine: slash skills."
}
```

- [ ] **Step 2: Create `plugins/antigravity/mcp_config.json`**

```json
{
  "mcpServers": {
    "redmine": {
      "command": "npx",
      "args": ["-y", "redmine-devrelay@0.4.0"],
      "env": {
        "REDMINE_URL": "${REDMINE_URL}",
        "REDMINE_API_KEY": "${REDMINE_API_KEY}",
        "REDMINE_ALLOWED_HOSTS": "${REDMINE_ALLOWED_HOSTS}"
      }
    }
  }
}
```

- [ ] **Step 3: Smoke-check JSON parses**

Run (PowerShell):

```powershell
Get-Content plugins/antigravity/plugin.json -Raw | ConvertFrom-Json | Out-Null
Get-Content plugins/antigravity/mcp_config.json -Raw | ConvertFrom-Json | Out-Null
Write-Output "JSON OK"
```

Expected: `JSON OK` with no parse errors.

- [ ] **Step 4: Commit**

```powershell
git add plugins/antigravity/plugin.json plugins/antigravity/mcp_config.json
git commit -m "feat(antigravity): scaffold plugin.json and mcp_config"
```

---

### Task 2: Copy skills and set `/redmine:…` names

**Files:**
- Create: `plugins/antigravity/skills/help/SKILL.md`
- Create: `plugins/antigravity/skills/test-connection/SKILL.md`
- Create: `plugins/antigravity/skills/list-projects/SKILL.md`
- Create: `plugins/antigravity/skills/my-issues/SKILL.md`
- Create: `plugins/antigravity/skills/issue/SKILL.md`
- Create: `plugins/antigravity/skills/create-issue/SKILL.md`
- Create: `plugins/antigravity/skills/update-issue/SKILL.md`
- Create: `plugins/antigravity/skills/add-comment/SKILL.md`
- Create: `plugins/antigravity/skills/add-attachment/SKILL.md`
- Create: `plugins/antigravity/skills/update-status/SKILL.md`

**Interfaces:**
- Consumes: Claude skill bodies under `plugins/claude-code/skills/*/SKILL.md`
- Produces: Antigravity skills whose frontmatter `name` is `redmine:<folder>`

- [ ] **Step 1: Copy skill trees from Claude Code**

Run from repo root (PowerShell):

```powershell
$skills = @(
  "help","test-connection","list-projects","my-issues","issue",
  "create-issue","update-issue","add-comment","add-attachment","update-status"
)
foreach ($s in $skills) {
  New-Item -ItemType Directory -Force -Path "plugins/antigravity/skills/$s" | Out-Null
  Copy-Item "plugins/claude-code/skills/$s/SKILL.md" "plugins/antigravity/skills/$s/SKILL.md"
}
```

- [ ] **Step 2: Rewrite frontmatter `name` to `redmine:…`**

For each `plugins/antigravity/skills/*/SKILL.md`, change only the `name:` line:

| File | `name:` becomes |
| --- | --- |
| help | `redmine:help` |
| test-connection | `redmine:test-connection` |
| list-projects | `redmine:list-projects` |
| my-issues | `redmine:my-issues` |
| issue | `redmine:issue` |
| create-issue | `redmine:create-issue` |
| update-issue | `redmine:update-issue` |
| add-comment | `redmine:add-comment` |
| add-attachment | `redmine:add-attachment` |
| update-status | `redmine:update-status` |

Leave `description:` and body unchanged (Claude 0.4.0 semantics).

Example header for create-issue:

```markdown
---
name: redmine:create-issue
description: Create a Redmine issue after dry-run confirmation
---
```

- [ ] **Step 3: Verify all ten names**

```powershell
Select-String -Path plugins/antigravity/skills/*/SKILL.md -Pattern '^name:'
```

Expected: exactly ten lines, each `name: redmine:…` matching the table above. No bare `name: create-issue` etc.

- [ ] **Step 4: Optional `agy` validate (if `agy` is on PATH)**

```bash
agy plugin validate ./plugins/antigravity
```

Expected: success. If it fails because of `:` in skill names, rewrite all ten `name:` values to hyphen form (`redmine-create-issue`, …) and re-run until validate passes. Record which scheme was used for Task 3 README.

If `agy` is not installed, skip this step and note "validate deferred" in the commit message body; README still documents the colon scheme as target plus hyphen fallback.

- [ ] **Step 5: Commit**

```powershell
git add plugins/antigravity/skills
git commit -m "feat(antigravity): add redmine slash skills from Claude Code"
```

---

### Task 3: Plugin README

**Files:**
- Create: `plugins/antigravity/README.md`

**Interfaces:**
- Consumes: Task 1–2 layout and whichever slash naming scheme passed validate
- Produces: Install/ops doc for IDE + CLI users

- [ ] **Step 1: Write `plugins/antigravity/README.md`**

Use this content (adjust slash column if hyphen fallback was required):

```markdown
# Antigravity plugin — Redmine DevRelay

IDE + CLI plugin for Google Antigravity (`agy`). MCP: `redmine-devrelay@0.4.0` (read + write, dry-run confirm gate).

## Prerequisites

- Node.js 20+ (for `npx`)
- Antigravity IDE and/or Antigravity CLI (`agy`)
- Env: `REDMINE_URL`, `REDMINE_API_KEY` (optional `REDMINE_ALLOWED_HOSTS`, `REDMINE_CA_CERT_PATH`)

## Install

```bash
# Local (from this repo)
agy plugin install ./plugins/antigravity
agy plugin validate ./plugins/antigravity
agy plugin list

# From GitHub (monorepo — clone then path)
git clone https://github.com/HuijungYoon/devrelay.git
agy plugin install ./devrelay/plugins/antigravity
```

## MCP env

`mcp_config.json` pins `npx -y redmine-devrelay@0.4.0` and passes `REDMINE_*`.

If Antigravity does not expand `${REDMINE_URL}` / `${REDMINE_API_KEY}`:

1. Put real values in shared `~/.gemini/config/mcp_config.json`, or
2. Edit the staged plugin MCP config under `~/.gemini/antigravity-cli/plugins/redmine-devrelay/` (do not commit secrets).

## Slash skills

| Slash | Action |
| --- | --- |
| `/redmine:help` | Command list |
| `/redmine:test-connection` | Connection / current user |
| `/redmine:list-projects` | Projects |
| `/redmine:my-issues` | My open issues |
| `/redmine:issue` | Issue detail + journals |
| `/redmine:create-issue` | Create (dry-run → confirm) |
| `/redmine:update-issue` | Update (dry-run → confirm) |
| `/redmine:add-comment` | Comment (dry-run → confirm) |
| `/redmine:add-attachment` | Attach files (dry-run → confirm) |
| `/redmine:update-status` | Status only (dry-run → confirm) |

If skill names had to drop `:`, use `/redmine-create-issue` style instead (same folders).

## Skills sync note

Skill **bodies** are copied from `plugins/claude-code/skills/`. When updating Claude skills, update this copy too.

## Writes

Always preview → user OK → `confirm=true`. Never print API keys.
```

- [ ] **Step 2: Commit**

```powershell
git add plugins/antigravity/README.md
git commit -m "docs(antigravity): add plugin install and slash guide"
```

---

### Task 4: Root README + installation docs

**Files:**
- Modify: `README.md`
- Modify: `docs/installation.md`

**Interfaces:**
- Consumes: `plugins/antigravity/` public install commands from Task 3
- Produces: Discoverable Antigravity section next to Cursor/Claude/Codex

- [ ] **Step 1: Update root `README.md` surfaces**

In the opening line, extend the surface list to include Antigravity, e.g.:

```markdown
Codex · Claude Code · Cursor · Antigravity에서 **자연어와 슬래시 명령**으로 …
```

In the architecture diagram / `plugins/` table, add:

```markdown
| `plugins/antigravity` | Antigravity IDE/CLI 플러그인 |
```

Add a short section after Cursor/Claude (new numbered or named section):

```markdown
### Antigravity

```bash
agy plugin install ./plugins/antigravity
```

GitHub: clone repo then `agy plugin install ./devrelay/plugins/antigravity`.  
Slash: `/redmine:help`, `/redmine:my-issues`, … — see `plugins/antigravity/README.md`.
```

Also update the storage-structure line that lists `plugins/cursor|claude-code|codex/` to include `antigravity`.

- [ ] **Step 2: Update `docs/installation.md`**

After Cursor section (before "Connection check"), insert:

```markdown
## 8. Antigravity

```bash
agy plugin install ./plugins/antigravity
agy plugin list
```

From GitHub:

```bash
git clone https://github.com/HuijungYoon/devrelay.git
agy plugin install ./devrelay/plugins/antigravity
```

Set `REDMINE_URL` / `REDMINE_API_KEY`. If `${…}` in plugin `mcp_config.json` is not expanded, configure `~/.gemini/config/mcp_config.json` (see `plugins/antigravity/README.md`).

Slash 예: `/redmine:help`, `/redmine:my-issues`, `/redmine:create-issue`.  
쓰기는 **미리보기 → 확인 → 적용**.

## 9. Connection check
```

Renumber the old "8. Connection check" to **9**.

- [ ] **Step 3: Quick grep for consistency**

```powershell
Select-String -Path README.md,docs/installation.md -Pattern "antigravity|Antigravity"
```

Expected: multiple hits including install path `plugins/antigravity`.

- [ ] **Step 4: Commit**

```powershell
git add README.md docs/installation.md
git commit -m "docs: document Antigravity plugin install"
```

---

### Task 5: End-to-end checklist (manual)

**Files:** none (verification only)

- [ ] **Step 1: File inventory**

```powershell
Test-Path plugins/antigravity/plugin.json
Test-Path plugins/antigravity/mcp_config.json
Test-Path plugins/antigravity/README.md
(Get-ChildItem plugins/antigravity/skills -Directory).Count
```

Expected: first three `$true`, skills count `10`.

- [ ] **Step 2: `agy` install smoke (if available)**

```bash
agy plugin install ./plugins/antigravity
agy plugin list
```

Expected: `redmine-devrelay` listed.

In Antigravity IDE or CLI agent with env set:

1. Ask for `redmine_test_connection` or run `/redmine:test-connection`
2. Run `/redmine:my-issues` (or hyphen fallback)

Expected: MCP responds; write skills still dry-run first.

If `agy` unavailable: record checklist as “structure-only verified” and stop.

- [ ] **Step 3: Final commit only if docs tweaked during checklist**

If README needed a hyphen-fallback note after real validate, commit that doc fix:

```powershell
git add plugins/antigravity/README.md
git commit -m "docs(antigravity): record slash naming after validate"
```

Otherwise no commit.

---

## Spec coverage (self-review)

| Spec section | Task |
| --- | --- |
| §3–4 package layout | Task 1–2 |
| §4.1 plugin.json | Task 1 |
| §4.2 mcp_config.json + env fallback docs | Task 1 + Task 3 |
| §4.3 skills + slash + colon fallback | Task 2–3, Task 5 |
| §5 install local/GitHub | Task 3–4 |
| §6 root README + installation.md | Task 4 |
| §7 out of scope | Not implemented (intentional) |

## Placeholder scan

No TBD/TODO steps; all file paths and command output expectations are concrete.
