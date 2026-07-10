# Security

- Use per-user API keys only (never a shared admin key).
- Pass keys via environment variables — never CLI args, manifests, or git.
- Do not commit `.env` files.
- Prefer HTTPS. Local Docker may use `http://localhost` only when the host is in `REDMINE_ALLOWED_HOSTS`.
- Set `REDMINE_ALLOWED_HOSTS` in production to prevent SSRF.
- Use `REDMINE_CA_CERT_PATH` for private CAs. There is no SSL-verify-disable switch.
- Audit logs (stderr) record tool name, host, success/failure, timing — never API keys or issue bodies.
