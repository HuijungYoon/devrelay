---
name: relate-issue
description: Add, change, or remove Redmine issue relations (연결된 일감) after dry-run confirmation
---

# 연결된 일감 (relations)

**미리보기 → 확인 → 적용.** `confirm=true`는 사용자 승인 이후에만.

1. **현재 목록** `redmine_list_issue_relations { issueId }` — `relationId`는 여기서만 얻는다 (수정·삭제에 필수)
2. **추가** `redmine_add_issue_relation { issueId, issueToId, relationType }`
   - `relationType`: `relates`(관련됨) · `duplicates`/`duplicated`(중복) · `blocks`/`blocked`(차단) · `precedes`/`follows`(선행/후속) · `copied_to`/`copied_from`(복사)
   - 사용자가 종류를 말하지 않으면 `relates`로 갈지 **물어본다**
   - `delay`(일 단위)는 `precedes`/`follows`에서만 허용 — 다른 종류에 넣으면 거절됨
3. **수정** `redmine_update_issue_relation { relationId, issueToId?, relationType?, delay? }`
   - Redmine에 관계 수정 API가 없어 **삭제 후 재생성**으로 동작. dry-run `changes[]`에 이전→이후가 나온다
   - 생략한 필드는 기존 값이 그대로 넘어간다
4. **삭제** `redmine_remove_issue_relation { relationId }` — **링크만 끊고 두 일감은 그대로 남는다**
5. dry-run 결과로 보여 주기 → OK → `confirm: true` + **`previewToken`** (첫 호출에 confirm=true 불가)
6. 상위/하위(부모-자식)는 relation이 아니라 `parentIssueId` — `/subtask` 참고
