---
description: 연결된 일감 추가·수정·삭제 (dry-run 후 확인)
---

Use the **relate-issue** skill.

`redmine_list_issue_relations`로 `relationId` 확인 → 추가/수정/삭제 dry-run → 사용자 OK 후 `confirm=true` + `previewToken`. 삭제는 링크만 끊고 두 일감은 남는다.
