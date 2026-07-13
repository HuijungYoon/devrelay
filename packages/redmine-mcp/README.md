# redmine-devrelay

Cursor · Claude Code · Codex용 **Redmine MCP 서버**입니다.  
이슈 조회와 생성·댓글·상태 변경을 MCP 도구로 제공합니다.

- **GitHub:** https://github.com/HuijungYoon/devrelay
- **npm client:** [redmine-devrelay-client](https://www.npmjs.com/package/redmine-devrelay-client)

## 빠른 시작

```bash
npx -y redmine-devrelay@0.2.5
```

환경변수:

| 변수 | 설명 |
| --- | --- |
| `REDMINE_URL` | Redmine 베이스 URL (`http://192.168.x.x` 사설 IP는 allowlist 불필요) |
| `REDMINE_API_KEY` | REST API Key |
| `REDMINE_ALLOWED_HOSTS` | 선택 — 공개 호스트 제한 / `localhost` HTTP용 |

## MCP 도구

**조회:** `redmine_test_connection`, `redmine_list_projects`, `redmine_search_users`, `redmine_search_issues`, `redmine_get_issue`

**쓰기 (dry-run 기본, `confirm=true` 시 적용):** `redmine_create_issue`, `redmine_add_comment`, `redmine_update_status`

### `redmine_create_issue` 파라미터

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `projectId` | yes | 프로젝트 id |
| `subject` | yes | 제목 |
| `description` | no | 본문 |
| `trackerId` / `priorityId` | no | 트래커/우선순위 id |
| `assignedTo` | no | **일감 담당자** — `"me"`, user id, 또는 이름/로그인(예: `"윤석준"`) |
| `confirm` | no | `false`(기본)=미리보기, `true`=생성 |

이름 담당자는 서버가 Redmine users API로 id로 해석합니다. 모호하면 `redmine_search_users`로 id를 고르세요.

## License

MIT
