# Cursor plugin — Redmine DevRelay

Install target for `/add-plugin redmine-devrelay` after Marketplace listing.

## Components

- **MCP:** `npx -y redmine-devrelay@0.1.0`
- **Skills:** `my-issues`, `issue`
- **Commands:** `/my-issues`, `/issue`

## Required env (set in Cursor MCP settings after install)

```text
REDMINE_URL=https://your-redmine.example.com
REDMINE_API_KEY=...
REDMINE_ALLOWED_HOSTS=your-redmine.example.com
```

For private LAN HTTP (e.g. `http://192.168.1.20/redmine`), set `REDMINE_ALLOWED_HOSTS` to that host IP.

## Local test (before Marketplace approval)

Cursor → Settings → Plugins / Customize, or clone this repo and point a team/local marketplace at:

```text
.cursor-plugin/marketplace.json
```

Plugin path: `plugins/cursor`

## Publish to Cursor Marketplace

1. Push this repo (including `plugins/cursor` + `.cursor-plugin/marketplace.json`) to GitHub.
2. Submit at https://cursor.com/marketplace/publish
3. After review, users can run:

```text
/add-plugin redmine-devrelay
```
