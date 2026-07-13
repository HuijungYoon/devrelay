---
name: help
description: List Redmine DevRelay slash commands with short descriptions
---

# Redmine DevRelay help

Do **not** call Redmine MCP tools. Only show available slash commands.

Present this markdown table (Korean labels OK):

| 명령 | 설명 |
| --- | --- |
| `/help` | 이 도움말 (명령 목록) |
| `/test-connection` | Redmine 연결·현재 사용자 확인 |
| `/list-projects` | 프로젝트 목록 (검색어 가능) |
| `/my-issues` | 내게 할당된 열린 이슈 |
| `/issue` | 이슈 상세 + journals (예: `/issue 23840`) |

Add one short note: Phase 1 is **read-only** (no issue create/update/comments).
