---
description: Redmine 일감 여러 개를 같은 상태로 (한 번의 dry-run 표 → 확인 → 적용)
---

Use the **bulk-status** skill. Collect issue ids (confirm the list if it came from a search), status by name or id, optional plain-text notes; dry-run `redmine_bulk_update_status`, show the rows table, then confirm=true only after user OK.
