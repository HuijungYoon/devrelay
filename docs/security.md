# Security

- Use per-user API keys only (never a shared admin key).
- Pass keys via environment variables — never CLI args, manifests, or git.
- Do not commit `.env` files.
- Prefer HTTPS. Prefer `REDMINE_ALLOWED_HOSTS` for public hostnames.
- Phase 2 write tools (`redmine_create_issue`, `redmine_add_comment`, `redmine_update_status`) default to dry-run; only apply when `confirm=true`.
- Audit logs (stderr) record tool name, host, success/failure, timing, dryRun — never API keys, notes, or issue bodies.
