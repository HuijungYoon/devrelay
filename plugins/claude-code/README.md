# Claude Code — Redmine plugin

Redmine read/write via `redmine-devrelay@0.5.2` (dry-run → confirm → apply).

**Breaking:** plugin id is `redmine-devrelay` (was `redmine`). Slash commands are `/redmine-devrelay:…` (was `/redmine:…`).

## Prerequisites

```bash
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=...
```

Optional: `REDMINE_ALLOWED_HOSTS`, `REDMINE_CA_CERT_PATH` (see `docs/installation.md`).

`.mcp.json` uses `npx -y redmine-devrelay@0.5.2`.

## Install from marketplace (recommended)

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

| Command | Action |
| --- | --- |
| `/redmine-devrelay:help` | Command list |
| `/redmine-devrelay:test-connection` | Connection check |
| `/redmine-devrelay:list-projects` | Project list |
| `/redmine-devrelay:my-issues` | My open issues |
| `/redmine-devrelay:issue` | Issue detail |
| `/redmine-devrelay:create-issue` | Create issue (dry-run → confirm) |
| `/redmine-devrelay:update-issue` | Update issue (dry-run → confirm) |
| `/redmine-devrelay:add-comment` | Comment (dry-run → confirm) |
| `/redmine-devrelay:add-attachment` | Attachment (dry-run → confirm) |
| `/redmine-devrelay:update-status` | Status change (dry-run → confirm) |

Community marketplace submission checklist: `docs/claude-code-marketplace-submit.md`.
