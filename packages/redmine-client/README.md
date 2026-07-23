# redmine-devrelay-client

[![Korean](https://img.shields.io/badge/lang-한국어-blue)](README.ko.md)

Redmine REST client used by the [redmine-devrelay](https://www.npmjs.com/package/redmine-devrelay) MCP server.

- **Version:** `0.5.1` (aligned with the MCP server)
- **GitHub:** https://github.com/HuijungYoon/devrelay
- **MCP server:** [redmine-devrelay](https://www.npmjs.com/package/redmine-devrelay)

```bash
npm install redmine-devrelay-client@0.5.1
```

## Features

- Issue read / create / update / comment / status change / **attachment upload**
- Project and member lists, user search (`searchUsers`)
- Resolve assignee and watchers by name or id
- Private IPv4 HTTP, preserve base paths such as `/redmine`
- HTML body formatting
  - `formatDescriptionForRedmine` — plain lines → `<p>…</p>`
  - `formatNotesForRedmine` — `\n` → `<br />`
  - `detectNotesMarkup` — detect Textile/Markdown (used to block MCP notes)
- Attachments: `inspectAttachments` / `uploadFile` / `addIssueAttachments` (max 5 files · 10MiB)

## License

MIT
