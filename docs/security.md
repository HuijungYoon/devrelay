# Security

- Use per-user API keys only (never a shared admin key).
- Pass keys via environment variables — never CLI args, manifests, or git.
- Do not commit `.env` files.
- Prefer HTTPS. Prefer `REDMINE_ALLOWED_HOSTS` for public hostnames.
- `REDMINE_PREVIEW_STORE_DIR` (optional) holds one file per previewToken. Point it at a directory only the server processes can read; the files carry a payload hash and expiry, never the payload or the API key.
- Phase 2+ write tools default to dry-run and return `previewToken`; apply only when `confirm=true` **and** a matching `previewToken` from that dry-run (TTL 10m, single use).
- Audit logs (stderr) record tool name, host, success/failure, timing, dryRun — never API keys, notes, or issue bodies.
