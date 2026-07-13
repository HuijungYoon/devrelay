---
description: Redmine 프로젝트 목록 조회
---

Use the **list-projects** skill.

1. If the user passed a search keyword as args, call `redmine_list_projects` with that `search` text.
2. Otherwise call `redmine_list_projects` with a reasonable `limit` (default 50).
3. Present a markdown table: `| ID | Name | Identifier | Status |`
4. On errors, show the tool error; do not invent projects.
