---
name: issue
description: Show Redmine issue detail and recent comments
---

# Redmine issue detail

1. Extract issue id from arguments or chat (`1523` or `#1523`). If missing, ask once for the issue number.
2. Call `redmine_get_issue` with `issueId` and `include: ["journals"]`.
3. Show: subject, project, tracker, status, priority, assignee, description (summary), then recent journals (author, date, notes).
4. Do not change issue fields or add comments.
