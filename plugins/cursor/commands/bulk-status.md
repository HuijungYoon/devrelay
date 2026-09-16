---
description: Redmine 일감 여러 개를 한 번의 dry-run 표로 변경 (상태 일괄, 또는 진행률·댓글 등 건별)
---

Use the **bulk-status** skill. 같은 상태로만 옮기면 `redmine_bulk_update_status`, 필드가 섞이거나 일감마다 댓글이 다르면 `redmine_bulk_update_issue` (issues[]는 건별, common은 공통, 행이 common을 이김). 목록이 검색에서 나왔으면 먼저 확인받고, dry-run 표를 보여 준 뒤 사용자 OK 후에만 confirm=true.
