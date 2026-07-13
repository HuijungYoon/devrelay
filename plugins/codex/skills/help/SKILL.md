---
name: help
description: List Redmine DevRelay slash commands / skills with short descriptions
---

# Redmine DevRelay help

Do **not** call Redmine MCP tools. Only show available skills/commands.

| Skill | 설명 |
| --- | --- |
| `help` | 이 도움말 (명령 목록) |
| `test-connection` | Redmine 연결·현재 사용자 확인 |
| `list-projects` | 프로젝트 목록 (검색어 가능) |
| `my-issues` | 내게 할당된 열린 이슈 |
| `issue` | 이슈 상세 + journals |
| `create-issue` | 이슈 생성 (담당자·일감관리자 지정, dry-run 후 확인) |
| `add-comment` | 댓글 추가 (dry-run 후 확인) |
| `update-status` | 상태 변경 statusId (dry-run 후 확인) |

Note: write skills require dry-run then explicit user confirmation before `confirm=true`.
