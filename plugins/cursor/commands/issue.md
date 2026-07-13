---
description: Redmine 이슈 상세·댓글 (journals)
---

Use the **issue** skill.

1. Extract issue id from command args or chat (`1523` or `#1523`). If missing, ask once.
2. Call `redmine_get_issue` with `issueId` and `include: ["journals"]`.
3. Show: subject, project, tracker, status, priority, assignee, description summary, then recent journals (author, date, notes).
4. Do not change issue fields or add comments. Never print API keys.
