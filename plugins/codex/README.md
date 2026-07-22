# Codex — Redmine plugin

Redmine 조회·쓰기 via `redmine-devrelay@0.5.0` (dry-run → 확인 후 적용).

## Env

```bash
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=...
```

`.mcp.json`은 `npx -y redmine-devrelay@0.5.0`를 사용합니다.

## Recommended approval policy

조회는 `approve`, 쓰기는 `prompt` 권장.

```toml
[plugins."redmine".mcp_servers.redmine]
enabled = true
default_tools_approval_mode = "prompt"

[plugins."redmine".mcp_servers.redmine.tools.redmine_test_connection]
approval_mode = "approve"
[plugins."redmine".mcp_servers.redmine.tools.redmine_list_projects]
approval_mode = "approve"
[plugins."redmine".mcp_servers.redmine.tools.redmine_list_project_members]
approval_mode = "approve"
[plugins."redmine".mcp_servers.redmine.tools.redmine_search_users]
approval_mode = "approve"
[plugins."redmine".mcp_servers.redmine.tools.redmine_search_issues]
approval_mode = "approve"
[plugins."redmine".mcp_servers.redmine.tools.redmine_get_issue]
approval_mode = "approve"
```

## Skills

| Skill | 동작 |
| --- | --- |
| `help` | 명령 목록 |
| `test-connection` | 연결 확인 |
| `list-projects` | 프로젝트 목록 |
| `my-issues` | 내 열린 이슈 |
| `issue` | 이슈 상세 + journals |
| `create-issue` | 이슈 생성 (dry-run → 확인) |
| `update-issue` | 이슈 수정 (dry-run → 확인) |
| `add-comment` | 댓글 (dry-run → 확인) |
| `update-status` | 상태 변경 (dry-run → 확인) |
