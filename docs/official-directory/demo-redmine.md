# Public demo Redmine (Directory review)

> **Deferred (2026-07-24).** Demo Fly app torn down with Directory pause. Keep this as recreate checklist only.

OpenAI Plugins Directory reviewers must reach a Redmine instance over the public internet with an API key that works without MFA or VPN. This document is the ops checklist for that **demo** instance only.

Internal / corporate Redmine stays for local validation. Do **not** point Directory review at it.

Related: [submission-runbook.md](./submission-runbook.md) (portal materials and MCP deploy notes).

## Why internal Redmine cannot be used

Directory review and automated checks run from OpenAI’s side of the network:

- **MFA / email / SMS gates** on login or API key creation block reviewers.
- **VPN or private network** (RFC1918, company SSO, IP allowlists) makes the host unreachable.
- Shared admin keys or secrets committed to git are out of policy (see `docs/security.md`).

Use a dedicated public demo: disposable data, reviewer-scoped API key, no production tickets.

## Provisioning options

Pick one path. HTTPS with a valid certificate is required.

### Option A — Docker Redmine on a public VPS

1. Run official Redmine (or Bitnami) behind HTTPS (Caddy / nginx + Let’s Encrypt).
2. Open only 443 (and SSH for ops). Do not expose MySQL/Postgres publicly.
3. Enable REST API: **Administration → Settings → API → Enable REST web service**.
4. Create a non-admin **demo** user for review; grant membership on the seed project.

Example shape (adjust image/tag and volumes to your host):

```bash
# Illustrative only — harden DB passwords and TLS on the real VPS.
docker run -d --name redmine-demo -p 3000:3000 redmine:latest
# Terminate TLS at a reverse proxy in front of :3000.
```

### Option B — Managed host with public HTTPS

Use a managed Redmine / Redmine-compatible SaaS (or PaaS app) that already serves public HTTPS. Same requirements: REST API on, demo user, seed project, API key without MFA/email gates for that account.

Record the canonical base URL as `https://<demo-redmine-host>` (no trailing path confusion; match what you paste into BYOK / portal fields).

## Seed data

Finalize numeric IDs after seeding; paste the real values into [submission-runbook.md](./submission-runbook.md) positive tests before Submit for Review.

| Fixture | Requirement |
| --- | --- |
| Project | One public (or demo-visible) project, e.g. identifier `demo` |
| Open issues | **3** open issues **assigned to the demo user** (priorities varied so “top three by priority” is meaningful) |
| Journals | **At least one** of those issues has **≥1 journal** (comment/history) so `get_issue` with journals returns a non-empty `journals` array |
| Tracker / status | Prefer a Bug (or default) tracker and Open status so create/comment dry-runs look realistic |

Suggested titles (optional):

1. `Demo: connection smoke` (Normal)
2. `Demo: priority sample` (High)
3. `Demo: journals sample` (Normal) — add one plain-text journal note

## Reviewer API key

1. Sign in as the demo user (or create keys under that user).
2. **My account → API access key** (or Administration equivalent).
3. Confirm the account has **no MFA / email confirmation / VPN** requirement for API use.
4. Grant project roles sufficient for: list/search issues, get issue (+ journals), create issue, add comment (writes still go through MCP dry-run → confirm).

## Credential handling — never commit

Store **demo Redmine URL** and **API key** only in:

- A password manager (1Password / Bitwarden / etc.), and/or
- OpenAI portal **demo credentials** fields at submission time

Never put real keys in git, `.env` committed to the repo, issue trackers, or these docs. Placeholders only:

```text
REDMINE_URL=https://<demo-redmine-host>
REDMINE_API_KEY=<demo-api-key-not-in-git>
```

Rotate the key after review if the instance will stay online.
