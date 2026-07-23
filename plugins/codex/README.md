# Codex — Redmine DevRelay

Redmine 조회·쓰기 via `redmine-devrelay@0.5.0` (dry-run → 확인 → `confirm=true` + `previewToken`).

## Install

Requires Codex CLI with `codex plugin marketplace` / `codex plugin add`; upgrade if your build lacks those commands (e.g. 0.107.0 without `plugin`).

### Git marketplace

```bash
codex plugin marketplace add HuijungYoon/devrelay
codex plugin add redmine-devrelay@devrelay
```

Feature-branch test: `codex plugin marketplace add HuijungYoon/devrelay --ref <branch>` then the same install. Prefer a full checkout (avoid `--sparse .agents/plugins` alone — it can omit `plugins/codex`).

### Local marketplace (repo root)

```bash
git clone https://github.com/HuijungYoon/devrelay.git
cd devrelay
codex plugin marketplace add .
codex plugin add redmine-devrelay@devrelay
```

Then start a new Codex session / reload plugins if needed.

### Migration from old plugin id

If you previously installed this plugin as `redmine`, uninstall/remove it and install `redmine-devrelay@devrelay`.

## Env

```bash
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=...
```

Optional: `REDMINE_ALLOWED_HOSTS`, `REDMINE_CA_CERT_PATH`.

`.mcp.json` uses `npx -y redmine-devrelay@0.5.0`.

## Recommended approval policy

조회는 `approve`, 쓰기는 `prompt` 권장.

```toml
[plugins."redmine-devrelay".mcp_servers.redmine]
enabled = true
default_tools_approval_mode = "prompt"

[plugins."redmine-devrelay".mcp_servers.redmine.tools.redmine_test_connection]
approval_mode = "approve"
[plugins."redmine-devrelay".mcp_servers.redmine.tools.redmine_list_projects]
approval_mode = "approve"
[plugins."redmine-devrelay".mcp_servers.redmine.tools.redmine_list_project_members]
approval_mode = "approve"
[plugins."redmine-devrelay".mcp_servers.redmine.tools.redmine_search_users]
approval_mode = "approve"
[plugins."redmine-devrelay".mcp_servers.redmine.tools.redmine_search_issues]
approval_mode = "approve"
[plugins."redmine-devrelay".mcp_servers.redmine.tools.redmine_get_issue]
approval_mode = "approve"
```

## Skills

| Skill | 동작 |
| --- | --- |
| `help` | 명령 목록 + 설치/환경 요약 |
| `test-connection` | 연결 확인 |
| `list-projects` | 프로젝트 목록 |
| `my-issues` | 내 열린 이슈 |
| `issue` | 이슈 상세 + journals |
| `create-issue` | 이슈 생성 (dry-run → 확인, 첨부 가능) |
| `update-issue` | 이슈 수정 (dry-run → 확인) |
| `add-comment` | 댓글 (dry-run → 확인) |
| `add-attachment` | 파일 첨부 (dry-run → 확인) |
| `update-status` | 상태 변경 (dry-run → 확인) |
