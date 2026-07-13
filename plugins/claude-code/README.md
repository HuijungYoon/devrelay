# Claude Code — Redmine plugin (Phase 1)

Read-only Redmine access via `redmine-mcp@0.1.0`.

## Prerequisites

```bash
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=...
```

## Local test (before npm publish)

Temporarily change `.mcp.json` to:

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

Build first: `pnpm --filter redmine-mcp build`

## Load plugin

```bash
claude --plugin-dir ./plugins/claude-code
```

Slash commands:

- `/redmine:my-issues`
- `/redmine:issue` (pass an issue id)
