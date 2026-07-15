# Antigravity Plugin — Redmine DevRelay Design

**Date:** 2026-07-15  
**Status:** Approved for implementation planning  
**Target:** `plugins/antigravity/` (no npm version bump)  
**MCP pin:** `redmine-devrelay@0.4.0`

## 1. Goal

Antigravity IDE and Antigravity CLI (`agy`) can install DevRelay as a **native plugin** so agents get Redmine MCP tools and slash skills (`/redmine:…`), matching Claude Code / Cursor capability at `0.4.0` (read + write with confirm gate, including attachments).

## 2. Decisions (brainstorm)

| Topic | Choice |
| --- | --- |
| Surfaces | IDE + CLI (shared plugin package) |
| Install UX | GitHub clone + path **and** local `agy plugin install ./plugins/antigravity` |
| Skills source | Copy from `plugins/claude-code/skills/` (no shared-skills sync script yet) |
| Slash style | Claude-style `/redmine:…` (e.g. `/redmine:create-issue`) |
| Packaging | Dedicated `plugins/antigravity/` (mirror Claude/Cursor layout) |
| Marketplace | Out of scope (no Antigravity curated store submission) |

## 3. Approach (selected)

**Dedicated plugin directory** under `plugins/antigravity/` with Antigravity’s required layout:

- `plugin.json` — required manifest (`name`, optional `description`; schema: `https://antigravity.google/schemas/v1/plugin.json`)
- `mcp_config.json` — MCP server definition
- `skills/**/SKILL.md` — become slash commands in the agent TUI / IDE
- `README.md` — install, env, slash table, validation

No new MCP tools, no client changes, no version bump.

## 4. Package layout

```text
plugins/antigravity/
├── plugin.json
├── mcp_config.json
├── README.md
└── skills/
    ├── help/SKILL.md
    ├── test-connection/SKILL.md
    ├── list-projects/SKILL.md
    ├── my-issues/SKILL.md
    ├── issue/SKILL.md
    ├── create-issue/SKILL.md
    ├── update-issue/SKILL.md
    ├── add-comment/SKILL.md
    ├── add-attachment/SKILL.md
    └── update-status/SKILL.md
```

### 4.1 `plugin.json`

- `name`: `redmine-devrelay` (alphanumeric / hyphen / underscore only; matches Cursor plugin id)
- `description`: short Redmine read/write MCP + slash skills blurb
- Include `$schema` when useful for editor validation
- Do **not** add undeclared fields (`additionalProperties: false` on official schema)

### 4.2 `mcp_config.json`

Same meaning as Claude/Cursor:

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

**Env interpolation fallback:** If Antigravity does not expand `${…}`, README must document either (a) putting literal values in plugin / shared `~/.gemini/config/mcp_config.json`, or (b) setting process env and omitting empty optional keys as needed. No secrets committed.

### 4.3 Skills

- Body: copy from Claude Code skills (0.4.0 semantics, dry-run → confirm, HTML plain-text rules, attachments limits).
- Frontmatter `name`: `redmine:<skill>` so slash becomes `/redmine:create-issue`, etc.
- Folder names may stay without colon (e.g. `skills/create-issue/SKILL.md`); the slash identity is the frontmatter `name`.

| Skill folder | Slash (target) |
| --- | --- |
| help | `/redmine:help` |
| test-connection | `/redmine:test-connection` |
| list-projects | `/redmine:list-projects` |
| my-issues | `/redmine:my-issues` |
| issue | `/redmine:issue` |
| create-issue | `/redmine:create-issue` |
| update-issue | `/redmine:update-issue` |
| add-comment | `/redmine:add-comment` |
| add-attachment | `/redmine:add-attachment` |
| update-status | `/redmine:update-status` |

**Colon fallback:** If `agy plugin validate` rejects `:` in skill names, use hyphenated names (`redmine-create-issue` → `/redmine-create-issue`) and document both target and actual slash in README. Prefer colon if validate passes.

## 5. Install & verification

### Local (development)

```bash
agy plugin install ./plugins/antigravity
agy plugin validate ./plugins/antigravity
agy plugin list
```

### GitHub (user install)

Monorepo: remote install that only accepts a repo **root** as a plugin is **not** assumed.

Primary documented flow:

```bash
git clone https://github.com/HuijungYoon/devrelay.git
agy plugin install ./devrelay/plugins/antigravity
```

If/when `agy` supports a subpath flag for remote install, add it to README without removing the clone+path flow.

### Success criteria

1. `agy plugin list` shows `redmine-devrelay` (or configured `name`).
2. Redmine MCP tools appear for IDE and CLI agents (connection tools at minimum).
3. Slash `/redmine:my-issues` (or fallback name) loads the skill and uses MCP after env is set.
4. Write skills still require dry-run → user approval → `confirm=true`.

### Out of this design’s verification

Automated CI against Antigravity binary is optional; manual validate + smoke on a machine with `agy` is enough for v1.

## 6. Docs updates (in scope)

| File | Change |
| --- | --- |
| `plugins/antigravity/README.md` | Install, env, slash table, validate, env fallback |
| Root `README.md` | Add Antigravity to surfaces list + short install section |
| `docs/installation.md` | Antigravity subsection parallel to Cursor/Claude/Codex |

One-line maintainer note: skills source of truth for content is Claude Code; keep Antigravity copy in sync when skill text changes.

## 7. Out of scope

- Antigravity official marketplace / curated directory submission
- New MCP/client features or `0.5.0` bump
- Shared skills monorepo + codegen/sync script
- `hooks.json`, `agents/`, `rules/`
- Changing Cursor/Claude/Codex plugins beyond README cross-links if needed

## 8. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| `${ENV}` not expanded | Document literal / shared config path |
| Skill `name` colon rejected | Hyphen fallback + README dual notation |
| GitHub one-liner cannot target subdirectory | Document clone + `plugins/antigravity` path as canonical |
| IDE vs CLI skill path drift in product | Prefer plugin install (official bundle) over manual skill copy |

## 9. Implementation follow-up

After this spec is approved as written, create an implementation plan (`docs/superpowers/plans/…`) covering: scaffold files, copy/rename skills, README + root docs, validate checklist.
