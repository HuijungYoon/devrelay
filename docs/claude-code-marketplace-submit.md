# Claude Code — community marketplace submit checklist

Prep only. **Do not automate the form submit.** Actual click + review wait are human-owned.

Direct install (works without community listing):

```text
/plugin marketplace add HuijungYoon/devrelay
/plugin install redmine-devrelay@devrelay
```

## Before submit

1. Public GitHub repo includes:
   - `.claude-plugin/marketplace.json`
   - `plugins/claude-code/` (plugin root with `.claude-plugin/plugin.json`, `.mcp.json`, `skills/`)
2. No API keys or secrets in those files
3. Validate:

```bash
claude plugin validate ./plugins/claude-code
```

Expected: validation success (no errors). If `homepage`/`repository` fields are rejected, remove them from `plugin.json` and re-validate.

## Submit forms

- Claude.ai: https://claude.ai/admin-settings/directory/submissions/plugins/new
- Console: https://platform.claude.com/plugins/submit

## Paste-ready fields

| Field | Value |
| --- | --- |
| GitHub URL | `https://github.com/HuijungYoon/devrelay` |
| Plugin path | `plugins/claude-code` |
| Plugin name | `redmine-devrelay` |
| One-line description | Redmine MCP for Claude Code: list/search issues and create/update/comment/attach with dry-run confirm gate. |
| Env required | `REDMINE_URL`, `REDMINE_API_KEY` (optional `REDMINE_ALLOWED_HOSTS`, `REDMINE_CA_CERT_PATH`) |
| MCP | `npx -y redmine-devrelay@0.5.0` via plugin `.mcp.json` |

## After submit

- Automated review + safety screening may take time
- Community catalog sync can lag (nightly); "Published" in the portal may not mean immediate Discover listing
- Until then, users should use the **direct marketplace** path above
- Official `claude-plugins-official` is separate and not requested by this form
