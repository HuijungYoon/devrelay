# Codex — Redmine plugin (Phase 1)

Read-only Redmine access via `redmine-mcp@0.1.0`.

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

- `my-issues` — open issues assigned to me
- `issue` — issue detail + journals
