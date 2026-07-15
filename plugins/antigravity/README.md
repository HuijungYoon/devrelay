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
