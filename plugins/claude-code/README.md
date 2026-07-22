# Claude Code — Redmine plugin

Redmine 조회·쓰기 via `redmine-devrelay@0.5.0` (dry-run → 확인 후 적용).

## Prerequisites

```bash
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=...
```

`.mcp.json`은 `npx -y redmine-devrelay@0.5.0`를 사용합니다.

## Local test (repo build)

`.mcp.json`을 잠시 로컬 빌드로:

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

| 명령 | 동작 |
| --- | --- |
| `/redmine:help` | 명령 목록 |
| `/redmine:test-connection` | 연결 확인 |
| `/redmine:list-projects` | 프로젝트 목록 |
| `/redmine:my-issues` | 내 열린 이슈 |
| `/redmine:issue` | 이슈 상세 |
| `/redmine:create-issue` | 이슈 생성 (dry-run → 확인) |
| `/redmine:update-issue` | 이슈 수정 (dry-run → 확인) |
| `/redmine:add-comment` | 댓글 (dry-run → 확인) |
| `/redmine:update-status` | 상태 변경 (dry-run → 확인) |
