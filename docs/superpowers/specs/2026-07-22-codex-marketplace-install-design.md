# Codex Marketplace Install — Redmine DevRelay Design

**Date:** 2026-07-22  
**Status:** Approved for implementation planning  
**Branch (planned):** `codex/marketplace-install`  
**Target:** `.agents/plugins/marketplace.json` + `plugins/codex/` meta/docs  
**MCP pin:** `redmine-devrelay@0.5.0` (no npm version bump)

## 1. Goal

Codex CLI / agent users can install DevRelay as a native Codex plugin via:

1. **Git-hosted marketplace** — `codex plugin marketplace add HuijungYoon/devrelay` then install `redmine-devrelay`
2. **Local marketplace root** — clone (or open) the monorepo, `codex plugin marketplace add .`, then the same install

After install, skills + MCP (`npx -y redmine-devrelay@0.5.0`) work with `REDMINE_URL` / `REDMINE_API_KEY`, matching Claude Code / Cursor / Antigravity capability at 0.5.0 (read + write with dry-run → confirm + `previewToken`).

## 2. Decisions (brainstorm)

| Topic | Choice |
| --- | --- |
| Distribution | Git marketplace **and** local path install (not official OpenAI curated directory) |
| Scope | Marketplace wiring + docs + Codex plugin metadata refresh (not skill body rewrites, not MCP code) |
| Plugin id | `redmine-devrelay` (align with Cursor / Antigravity; replace legacy Codex `name: redmine`) |
| Install policy | `AVAILABLE` (user runs install explicitly) |
| Auth policy | `ON_FIRST_USE` (env-based credentials; no OAuth app) |
| Packaging | Monorepo root `.agents/plugins/marketplace.json` → `./plugins/codex` |
| Approach | Repo-root Codex marketplace (not a separate slim marketplace repo) |

## 3. Approach (selected)

Add a **repo-scoped Codex marketplace** at `$REPO_ROOT/.agents/plugins/marketplace.json` per [Build plugins](https://developers.openai.com/codex/plugins/build):

- Marketplace `source.path` is relative to the **marketplace root** (repo root), must be `./`-prefixed, and must stay inside that root.
- Existing plugin already has `.codex-plugin/plugin.json`, `.mcp.json`, and `skills/`.
- Refresh plugin manifest copy and version labels to 0.5.0; keep MCP args pinned to `@0.5.0`.
- Document both Git and local `codex plugin marketplace add` flows; remove vague “per Codex plugin docs” wording.

Out of scope: OpenAI curated Plugin Directory submission, new MCP tools, skill content sync scripts, npm publish.

## 4. Package layout

```text
devrelay/                                      ← marketplace root
├── .agents/plugins/marketplace.json           ← NEW
├── docs/installation.md                       ← Codex section update
├── README.md                                  ← Codex install line if present
└── plugins/codex/
    ├── .codex-plugin/plugin.json              ← name/version/interface refresh
    ├── .mcp.json                              ← unchanged (0.5.0 pin)
    ├── README.md                              ← Git + local install
    └── skills/**/SKILL.md                     ← unchanged this iteration
```

### 4.1 `.agents/plugins/marketplace.json`

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

Install identifier (typical): `redmine-devrelay@devrelay`.

If Codex CLI rejects `authentication: ON_FIRST_USE` for env-only plugins, fall back to omitting `authentication` or using `ON_INSTALL` — record the working value in docs after first CLI validation.

### 4.2 `plugins/codex/.codex-plugin/plugin.json`

| Field | Target |
| --- | --- |
| `name` | `redmine-devrelay` |
| `version` | `0.5.0` |
| `description` / `interface.longDescription` | Redmine read + write via MCP; dry-run → user confirm → `confirm=true` + `previewToken` |
| `interface.displayName` | `Redmine DevRelay` (or `Redmine`) |
| `interface.shortDescription` | Short blurb including write-with-confirm |
| `interface.capabilities` | Reflect read + write (use Codex-allowed capability strings; adjust if CLI rejects) |
| `skills` | `./skills/` |
| `mcpServers` | `./.mcp.json` |
| `author` / `license` | Keep M2I / MIT unless aligning email with Cursor manifest |

**Breaking note for existing installs:** users who installed under the old id `redmine` should uninstall/remove and reinstall as `redmine-devrelay`. Document one line in Codex README.

### 4.3 `.mcp.json`

No change:

```json
{
  "redmine": {
    "command": "npx",
    "args": ["-y", "redmine-devrelay@0.5.0"],
    "env_vars": ["REDMINE_URL", "REDMINE_API_KEY", "REDMINE_ALLOWED_HOSTS", "REDMINE_CA_CERT_PATH"]
  }
}
```

### 4.4 Documentation

**`plugins/codex/README.md`**

- Env vars
- Git: `codex plugin marketplace add HuijungYoon/devrelay` → `codex plugin install redmine-devrelay@devrelay` → reload/new session as needed
- Local: from repo root `codex plugin marketplace add .` → same install
- Optional note: `--ref <branch>` when testing a feature branch; full clone preferred (`--sparse` alone may omit `plugins/codex`)
- Recommended tool approval policy (existing read=approve / write=prompt table)
- Skills table
- Migration: old plugin name `redmine` → `redmine-devrelay`

**`docs/installation.md` § Codex**

Replace “Load `plugins/codex` per Codex plugin docs” with the same two concrete paths.

**Root `README.md`**

If a Codex install bullet exists, point to the same commands.

## 5. Install UX (user-facing)

```bash
# Git
codex plugin marketplace add HuijungYoon/devrelay
codex plugin install redmine-devrelay@devrelay

# Local (repo root)
codex plugin marketplace add .
codex plugin install redmine-devrelay@devrelay

export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=...
# Then ask the agent to run redmine_test_connection / help skill
```

Exact subcommand spelling (`plugin install` vs UI `/plugins`) should match the Codex version used when writing docs; prefer CLI forms that match current Build plugins docs.

## 6. Error handling / edge cases

| Case | Handling |
| --- | --- |
| Marketplace add without `marketplace.json` | Fail at add; ensure file is committed on the branch users add |
| Path traversal / wrong `source.path` | Keep `./plugins/codex` only |
| Missing env after install | Skills/README tell user to set URL + key; connection skill fails clearly via MCP |
| Stale `redmine` plugin id | Document uninstall + reinstall |
| Capability/category enum mismatch | Fix to CLI-accepted values during implementation verification |

## 7. Testing / verification

1. JSON validity for `marketplace.json` and `plugin.json`
2. Local: `codex plugin marketplace add .` → marketplace list shows `devrelay`
3. `codex plugin install redmine-devrelay@devrelay` succeeds
4. With env set: MCP starts `redmine-devrelay@0.5.0`; `redmine_test_connection` works
5. Optional: after push, `codex plugin marketplace add HuijungYoon/devrelay --ref codex/marketplace-install` and repeat install

If Codex CLI is unavailable in the implementation environment: keep a manual checklist in the plan/docs and still land schema-correct manifests + docs.

## 8. Success criteria

- Git marketplace add + install enables Redmine skills/MCP in Codex without hand-editing `config.toml`
- Local `marketplace add .` + install works for development
- Docs alone are enough to install (no “see Codex docs” placeholder)
- Plugin manifest is not stuck on Phase 1 read-only copy
- No MCP package version bump required for this work

## 9. Implementation notes

- Create branch `codex/marketplace-install` from current line before code changes
- Do not change skill markdown bodies unless a path/name reference to plugin id `redmine` breaks discovery (unlikely if discovery is folder + SKILL frontmatter)
- After implementation, follow with `writing-plans` → execute plan; commit design first, then implementation commits separately
