---
name: redmine:my-issues
description: List open Redmine issues assigned to me
---

# My open Redmine issues

Use MCP tools only. Never invent write operations.

1. If the user named a project, call `redmine_list_projects` with that search text and pick the best match (ask if ambiguous).
2. Call `redmine_search_issues` with:
   - `assignedTo`: `"me"`
   - `status`: `"open"`
   - `projectId` if resolved
   - reasonable `limit` (default 50)
3. Present a markdown table: `| ID | Subject | Status | Priority | Updated |`
4. On errors, show the tool error message; do not retry with different credentials.
