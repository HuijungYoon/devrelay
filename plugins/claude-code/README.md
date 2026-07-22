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
