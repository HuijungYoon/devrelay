---
description: 하위일감 생성·부모 변경·연결 해제 (dry-run 후 확인)
---

Use the **subtask** skill.

새 하위일감은 `redmine_create_issue` + `parentIssueId`, 부모 변경은 `redmine_update_issue` + `parentIssueId`, 연결 해제는 `parentIssueId: null` (일감 자체는 삭제되지 않음). dry-run 후 사용자 OK 시 `confirm=true` + `previewToken`.
