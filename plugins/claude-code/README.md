# Claude Code — Redmine plugin (Phase 1)

Read-only Redmine access via `redmine-devrelay@0.1.0`.

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

Build first: `pnpm --filter redmine-devrelay build`

## Load plugin

```bash
claude --plugin-dir ./plugins/claude-code
```

Slash commands:

- `/redmine:help` — 명령 목록·간단 설명
- `/redmine:test-connection` — 연결 확인
- `/redmine:list-projects` — 프로젝트 목록
- `/redmine:my-issues` — 내 열린 이슈
- `/redmine:issue` — 이슈 상세 (이슈 id 전달)
