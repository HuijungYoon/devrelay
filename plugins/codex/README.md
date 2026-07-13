# Codex — Redmine plugin (Phase 1)

Read-only Redmine access via `redmine-devrelay@0.1.0`.

## Env

```bash
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=...
```

## Recommended approval policy

```toml
[plugins."redmine".mcp_servers.redmine]
enabled = true
default_tools_approval_mode = "prompt"

[plugins."redmine".mcp_servers.redmine.tools.redmine_test_connection]
approval_mode = "approve"
[plugins."redmine".mcp_servers.redmine.tools.redmine_list_projects]
approval_mode = "approve"
[plugins."redmine".mcp_servers.redmine.tools.redmine_search_issues]
approval_mode = "approve"
[plugins."redmine".mcp_servers.redmine.tools.redmine_get_issue]
approval_mode = "approve"
```

## Skills

- `help` — list commands with short descriptions
- `test-connection` — verify URL / API key
- `list-projects` — list or search projects
- `my-issues` — open issues assigned to me
- `issue` — issue detail + journals
