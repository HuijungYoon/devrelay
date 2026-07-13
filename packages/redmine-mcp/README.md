# redmine-devrelay

Cursor · Claude Code · Codex용 **Redmine MCP 서버**입니다.  
이슈 조회와(선택) 생성·댓글·상태 변경을 MCP 도구로 제공합니다.

- **GitHub:** https://github.com/HuijungYoon/devrelay
- **npm client:** [redmine-devrelay-client](https://www.npmjs.com/package/redmine-devrelay-client)

## 빠른 시작

```bash
npx -y redmine-devrelay@0.2.3
```

환경변수:

| 변수 | 설명 |
| --- | --- |
| `REDMINE_URL` | Redmine 베이스 URL (`http://192.168.x.x` 사설 IP는 allowlist 불필요) |
| `REDMINE_API_KEY` | REST API Key |
| `REDMINE_ALLOWED_HOSTS` | 선택 — 공개 호스트 제한 / `localhost` HTTP용 |

## MCP 도구

**조회:** `redmine_test_connection`, `redmine_list_projects`, `redmine_search_issues`, `redmine_get_issue`

**쓰기 (dry-run 기본, `confirm=true` 시 적용):** `redmine_create_issue`, `redmine_add_comment`, `redmine_update_status`

자세한 설치·보안·플러그인 안내는 저장소 README를 참고하세요.

## License

MIT
