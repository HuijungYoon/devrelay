# redmine-devrelay

Cursor · Claude Code · Codex용 **Redmine MCP 서버**입니다.

- **GitHub:** https://github.com/HuijungYoon/devrelay
- **npm client:** [redmine-devrelay-client](https://www.npmjs.com/package/redmine-devrelay-client)

## 빠른 시작

```bash
npx -y redmine-devrelay@0.2.6
```

환경변수: `REDMINE_URL`, `REDMINE_API_KEY` (사설 IP HTTP는 allowlist 불필요)

## MCP 도구

**조회:** `redmine_test_connection`, `redmine_list_projects`, `redmine_list_project_members`, `redmine_search_users`, `redmine_search_issues`, `redmine_get_issue`

**쓰기:** `redmine_create_issue`, `redmine_add_comment`, `redmine_update_status` (dry-run 기본)

### `redmine_create_issue`

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `projectId` | yes | 프로젝트 id |
| `subject` | yes | 제목 |
| `assignedTo` | no | **담당자** — `"me"` / id / 이름 |
| `watchers` | no | **일감관리자** — `["이름"\|id, ...]` 배열 (누구든 지정, 다중) |
| `confirm` | no | `false`=미리보기, `true`=생성 |

예: 담당자=나, 일감관리자=윤석준 → `{ assignedTo: "me", watchers: ["윤석준"] }`  
일감관리자 후보: `redmine_list_project_members`

## License

MIT
