---
description: 내게 할당된 열린 Redmine 이슈
---

Use the **my-issues** skill.

1. If the user named a project in args, call `redmine_list_projects` with that search and pick the best match (ask if ambiguous).
2. Call `redmine_search_issues` with `assignedTo: "me"`, `status: "open"`, optional `projectId`, `limit` default 50.
3. Present a markdown table: `| ID | Subject | Status | Priority | Due | Updated |`
4. On errors, show the tool error; do not invent issues. Never print API keys.
