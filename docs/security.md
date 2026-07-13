# Security

- Use per-user API keys only (never a shared admin key).
- Pass keys via environment variables — never CLI args, manifests, or git.
- Do not commit `.env` files.
- Prefer HTTPS. `http` is allowed only for allowlisted loopback/`redmine` hosts or RFC1918 private IPs (e.g. `192.168.x.x`) via `REDMINE_ALLOWED_HOSTS`.
- Set `REDMINE_ALLOWED_HOSTS` in production to prevent SSRF.
- Use `REDMINE_CA_CERT_PATH` for private CAs. There is no SSL-verify-disable switch.
- Audit logs (stderr) record tool name, host, success/failure, timing — never API keys or issue bodies.
