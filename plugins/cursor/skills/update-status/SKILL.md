---
name: update-status
description: Update Redmine issue status by statusId after dry-run confirmation
---

# Update Redmine status

1. Extract issue id and numeric `statusId` (names are not supported).
2. Optional `notes`는 **평문만** (Textile/Markdown 금지).
3. Call `redmine_update_status` with `confirm` omitted/false → dry-run + `previewToken`.
4. dry-run이 `blocked: true`면 notes를 평문으로 고친 뒤 재시도.
5. After user approval: `confirm: true` + same fields + `previewToken` (첫 호출 confirm 금지).
6. Never print API keys.
