---
description: Redmine DevRelay 슬래시 명령 도움말
---

Use the **help** skill.

Show a short markdown table of available Redmine DevRelay slash commands and one-line descriptions. Do not call Redmine MCP tools for this — just list the commands below.

| 명령 | 설명 |
| --- | --- |
| `/help` | 이 도움말 (명령 목록) |
| `/test-connection` | Redmine 연결·현재 사용자 확인 |
| `/list-projects` | 프로젝트 목록 (검색어 가능) |
| `/my-issues` | 내게 할당된 열린 이슈 |
| `/issue` | 이슈 상세 + journals (예: `/issue 23840`) |
| `/create-issue` | 이슈 생성 (유형·상태·우선순위·시작일·진척도 포함 미리보기) |
| `/update-issue` | 이슈 수정 (이전→이후 미리보기 후 확인) |
| `/add-comment` | 댓글 추가 (dry-run 후 확인) |
| `/add-attachment` | 파일 첨부 (dry-run 후 확인) |
| `/update-status` | 상태 변경 statusId (dry-run 후 확인) |
| `/relate-issue` | 연결된 일감 추가·수정·삭제 (dry-run 후 확인) |
| `/subtask` | 하위일감 생성·부모 변경·연결 해제 (dry-run 후 확인) |

Remind: write commands always dry-run first; only apply after user confirms (`confirm=true`).
