---
name: help
description: List Redmine DevRelay slash commands / skills with short descriptions
---

# Redmine DevRelay help

Do **not** call Redmine MCP tools. Only show available skills/commands and short setup notes.

## Install (Codex)

Requires CLI with `codex plugin marketplace` / `codex plugin install` (upgrade if missing, e.g. 0.107.0).

```bash
codex plugin marketplace add HuijungYoon/devrelay
codex plugin install redmine-devrelay@devrelay
```

Local (repo root): `codex plugin marketplace add .` then the same install.  
Env: `REDMINE_URL`, `REDMINE_API_KEY`. Details: plugin README.

## Skills

| Skill | 설명 |
| --- | --- |
| `help` | 이 도움말 (명령 목록) |
| `test-connection` | Redmine 연결·현재 사용자 확인 |
| `list-projects` | 프로젝트 목록 (검색어 가능) |
| `my-issues` | 내게 할당된 열린 이슈 |
| `issue` | 이슈 상세 + journals |
| `create-issue` | 이슈 생성 (유형·상태·우선순위·시작일·진척도·첨부 포함 미리보기) |
| `update-issue` | 이슈 수정 (이전→이후 미리보기 후 확인) |
| `add-comment` | 댓글 추가 (dry-run 후 확인) |
| `add-attachment` | 파일 첨부 (dry-run 후 확인) |
| `update-status` | 상태 변경 statusId (dry-run 후 확인) |

Note: write skills require dry-run then explicit user confirmation before `confirm=true` + `previewToken`.
