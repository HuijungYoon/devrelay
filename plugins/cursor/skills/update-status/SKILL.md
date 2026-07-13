---
name: update-status
description: Update Redmine issue status by statusId after dry-run confirmation
---

# Update Redmine status

1. Extract issue id and numeric `statusId` (names are not supported).
2. Call `redmine_update_status` with `confirm` false/omitted. Show dry-run preview.
3. After user approval, call with `confirm: true`.
4. Never print API keys.
