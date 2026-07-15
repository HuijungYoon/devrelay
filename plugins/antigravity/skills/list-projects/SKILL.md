---
name: redmine:list-projects
description: List accessible Redmine projects, optionally filtered by search text
---

# List Redmine projects

Use MCP tools only. Never invent write operations.

1. Call `redmine_list_projects` with optional `search` from the user and a reasonable `limit` (default 50).
2. Present a markdown table: `| ID | Name | Identifier | Status |`
3. On errors, show the tool error message.
