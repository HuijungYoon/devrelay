---
name: my-issues
description: List open Redmine issues assigned to me
---

# My open Redmine issues

Use MCP tools only. Never invent write operations. Never print API keys.

1. If the user named a project, call `redmine_list_projects` with that search text and pick the best match (ask if ambiguous).
2. Call `redmine_search_issues` with:
   - `assignedTo`: `"me"`
   - `status`: `"open"`
   - `projectId` if resolved
   - reasonable `limit` (default 50)
3. Present a markdown table: `| ID | Subject | Status | Priority | Due | Updated |`
   - `dueDate`·`doneRatio`는 검색 결과에 이미 들어 있습니다. 표를 채우려고 이슈마다 `redmine_get_issue`를 부르지 마세요
4. On errors, show the tool error message; do not retry with different credentials.
