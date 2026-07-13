---
name: help
description: List Redmine DevRelay slash commands with short descriptions
---

# Redmine DevRelay help

Do **not** call Redmine MCP tools. Only show available slash commands.

| 명령 | 설명 |
| --- | --- |
| `/redmine:help` | 이 도움말 (명령 목록) |
| `/redmine:test-connection` | Redmine 연결·현재 사용자 확인 |
| `/redmine:list-projects` | 프로젝트 목록 (검색어 가능) |
| `/redmine:my-issues` | 내게 할당된 열린 이슈 |
| `/redmine:issue` | 이슈 상세 + journals (이슈 id 전달) |
| `/redmine:create-issue` | 이슈 생성 (프로젝트 필수, dry-run 후 확인) |
| `/redmine:add-comment` | 댓글 추가 (dry-run 후 확인) |
| `/redmine:update-status` | 상태 변경 statusId (dry-run 후 확인) |

Note: write commands require dry-run then explicit user confirmation before `confirm=true`.
