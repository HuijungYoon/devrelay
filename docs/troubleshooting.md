# Troubleshooting

| Symptom | Check |
| --- | --- |
| `REDMINE_AUTHENTICATION_ERROR` | API key, REST API enabled |
| `REDMINE_CONNECTION_ERROR` | URL, VPN, firewall |
| `REDMINE_TLS_ERROR` | `REDMINE_CA_CERT_PATH` |
| `REDMINE_VALIDATION_ERROR` on startup | `REDMINE_URL` / `REDMINE_API_KEY` / allowlist |
| MCP tools missing | Plugin loaded? `npx` can reach registry? Build local dist? Restart after a plugin update |
| MCP server `CONNECTION_CLOSED` | The server needs Node 20+. Check what `npx` actually runs — a version manager (Volta/nvm) may pin an older default. `claude mcp list` shows the health of each entry |
| `REDMINE_PERMISSION_DENIED` on members / users | This install may forbid `/projects/:id/memberships.json` and `/users.json`. `redmine_list_project_members` falls back to recent assignees (`source: "issues"`); `/users/:id.json` still works per user |
| `REDMINE_PERMISSION_DENIED` on categories | `redmine_list_metadata` reports it under `unavailable`; pass a numeric `categoryId` |
| Description saved as one blob | Bodies are HTML here. Let the client convert (`createIssue`/`updateIssue` take plain text); do not hand-build the payload |
| stdout polluted | Logs must go to stderr only |

Local Docker:

```bash
export REDMINE_URL=http://localhost:3000
export REDMINE_ALLOWED_HOSTS=localhost
```
