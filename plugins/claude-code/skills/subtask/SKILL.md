---
name: subtask
description: Add, move, or detach Redmine subtasks (하위일감) after dry-run confirmation
---

# 하위일감 (subtasks)

**미리보기 → 확인 → 적용.** `confirm=true`는 사용자 승인 이후에만.

1. **목록** `redmine_get_issue { issueId, include: ["children"] }` 또는 `redmine_search_issues { parentIssueId }`
2. **새 하위일감 생성** `redmine_create_issue { projectId, subject, parentIssueId }`
   - 담당자·일감관리자 규칙은 `/create-issue`와 동일: **작업자 기본 `"me"`**, **일감관리자는 한 번 질문**
3. **기존 일감을 하위로 편입 / 부모 변경** `redmine_update_issue { issueId, parentIssueId: <부모 id> }`
4. **하위 연결 해제** `redmine_update_issue { issueId, parentIssueId: null }`
   - 부모 연결만 끊고 **일감 자체는 삭제되지 않는다** (Redmine 화면의 하위일감 `x`와 동일)
   - 사용자가 "하위일감 삭제"라고 하면 이 동작으로 안내한다. 일감을 실제로 지우는 기능은 이 플러그인에 없음 (Redmine 웹에서 직접)
5. dry-run `changes[]`에서 `parentIssueId` 이전→이후 확인 → OK → `confirm: true` + **`previewToken`**
6. 자기 자신을 부모로 넣으면 거절됨. 다른 프로젝트 일감을 부모로 두는 것은 Redmine의 cross-project subtasks 설정에 따라 거절될 수 있다
