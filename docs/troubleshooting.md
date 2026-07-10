# Troubleshooting

| Symptom | Check |
| --- | --- |
| `REDMINE_AUTHENTICATION_ERROR` | API key, REST API enabled |
| `REDMINE_CONNECTION_ERROR` | URL, VPN, firewall |
| `REDMINE_TLS_ERROR` | `REDMINE_CA_CERT_PATH` |
| `REDMINE_VALIDATION_ERROR` on startup | `REDMINE_URL` / `REDMINE_API_KEY` / allowlist |
| MCP tools missing | Plugin loaded? `npx` can reach registry? Build local dist? |
| stdout polluted | Logs must go to stderr only |

Local Docker:

```bash
export REDMINE_URL=http://localhost:3000
export REDMINE_ALLOWED_HOSTS=localhost
```
