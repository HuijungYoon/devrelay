# Cursor plugin — Redmine DevRelay

Install target for `/add-plugin redmine-devrelay` after Marketplace listing.

## Components

- **MCP:** `npx -y redmine-devrelay@0.1.0`
- **Skills / slash commands:**

| Slash | 동작 |
| --- | --- |
| `/help` | 슬래시 명령 목록·간단 설명 |
| `/test-connection` | Redmine 연결·현재 사용자 확인 |
| `/list-projects` | 프로젝트 목록 (검색어 가능) |
| `/my-issues` | 내게 할당된 열린 이슈 |
| `/issue` | 이슈 상세 + journals (예: `/issue 23840`) |
| `/create-issue` | 이슈 생성 (프로젝트·담당자 확인, dry-run 후 확인) |
| `/add-comment` | 댓글 추가 (dry-run 후 확인) |
| `/update-status` | 상태 변경 statusId (dry-run 후 확인) |

## Required env (set in Cursor MCP settings after install)

```text
REDMINE_URL=https://your-redmine.example.com
REDMINE_API_KEY=...
REDMINE_ALLOWED_HOSTS=your-redmine.example.com
```

For private LAN HTTP (e.g. `http://192.168.1.20/redmine`), set `REDMINE_ALLOWED_HOSTS` to that host IP.

## Local test (before Marketplace approval)

Cursor → Settings → Plugins / Customize, or clone this repo and point a team/local marketplace at:

```text
.cursor-plugin/marketplace.json
```

Plugin path: `plugins/cursor`

## Publish to Cursor Marketplace

1. Push this repo (including `plugins/cursor` + `.cursor-plugin/marketplace.json`) to GitHub.
2. Submit at https://cursor.com/marketplace/publish
3. After review, users can run:

```text
/add-plugin redmine-devrelay
```
