# Cursor plugin — Redmine DevRelay

Install target for `/add-plugin redmine-devrelay` after Marketplace listing.

**MCP 패키지:** `redmine-devrelay@0.4.0` (조회 + 쓰기, dry-run 확인 게이트)

## Components

- **MCP:** `npx -y redmine-devrelay@0.4.0`
- **Skills / slash commands:**

| Slash | 동작 |
| --- | --- |
| `/help` | 슬래시 명령 목록·간단 설명 |
| `/test-connection` | Redmine 연결·현재 사용자 확인 |
| `/list-projects` | 프로젝트 목록 (검색어 가능) |
| `/my-issues` | 내게 할당된 열린 이슈 |
| `/issue` | 이슈 상세 + journals (예: `/issue 23840`) |
| `/create-issue` | 이슈 생성 (프로젝트·담당자·관리자·첨부, dry-run 후 확인) |
| `/update-issue` | 이슈 수정 (이전→이후 표, dry-run 후 확인) |
| `/add-comment` | 댓글 추가 (dry-run 후 확인) |
| `/add-attachment` | 파일 첨부 (dry-run 후 확인) |
| `/update-status` | 상태 변경 `statusId` (dry-run 후 확인) |

description/댓글은 **평문 줄바꿈**으로 작성하면 됩니다 (`<p>` / `<br />` 자동).

## Required env (set in Cursor MCP settings after install)

```text
REDMINE_URL=https://your-redmine.example.com
REDMINE_API_KEY=...
```

선택: `REDMINE_ALLOWED_HOSTS`, `REDMINE_CA_CERT_PATH`  
사설망 HTTP 예: `REDMINE_URL=http://192.168.10.50/redmine`

## Local test (before Marketplace approval)

Cursor → Settings → Plugins / Customize, or clone this repo and point a team/local marketplace at:

```text
.cursor-plugin/marketplace.json
```

Plugin path: `plugins/cursor` · `mcp.json`은 `redmine-devrelay@0.4.0`를 가리킵니다.

## Publish to Cursor Marketplace

1. Push this repo (including `plugins/cursor` + `.cursor-plugin/marketplace.json`) to GitHub.
2. Submit at https://cursor.com/marketplace/publish
3. After review, users can run:

```text
/add-plugin redmine-devrelay
```
