---
name: redmine:bulk-status
description: Move several Redmine issues to the same status in one dry-run → confirm round (일괄 상태 변경)
---

# Bulk status change (일괄 상태 변경)

**미리보기 한 번 → 확인 한 번 → 적용.** 일감을 여러 개 말했으면 `redmine_update_status`를 반복하지 말고 이 도구를 쓴다.

1. **대상 일감** `issueIds` — 사용자가 번호를 나열했으면 그대로 (1~50개, 중복 없이). "내 진행중 일감 전부"처럼 조건으로 말했으면 먼저 `redmine_search_issues`로 목록을 뽑아 **번호와 제목을 보여 주고 확인**받은 뒤 그 id들을 넣는다. 조건만 듣고 바로 바꾸지 않는다
2. **상태** `statusId` — **id 또는 이름** (`"완료"`, `"진행중"`). 안 맞으면 에러 `check`의 후보로 재시도, id 추측 금지
3. **댓글** `notes` (선택) — 모든 일감에 같은 문장이 남는다. **평문만** (Textile/Markdown 금지, `blocked`면 평문으로 고쳐 재시도)
4. `redmine_bulk_update_status` dry-run → `rows[]`를 **표로** 보여 준다: `| # | 제목 | 현재 상태 → 변경 후 | 비고 |`
   - `unchanged: true`인 행은 이미 그 상태라 건너뛴다고 표시
   - `error`가 있는 행은 없는 일감이거나 권한이 없는 것 — 적용 시에도 건드리지 않는다. 번호가 틀렸는지 사용자에게 확인
   - `summary`(전체 / 바뀔 것 / 그대로 / 못 읽음)를 함께 말한다
5. 사용자 OK 후에만 `confirm: true` + **같은 issueIds·statusId·notes** + `previewToken`
6. 결과 `updated` / `skipped` / `failed`를 나눠 보고한다. `failed`는 워크플로우가 그 전환을 막은 경우가 흔하다 — 해당 일감의 `redmine_get_issue { include: ["allowed_statuses"] }`로 가능한 상태를 확인해 안내
7. Redmine에는 일괄 API가 없어 서버는 한 건씩 바꾼다. 하나가 실패해도 나머지는 진행되며, 되돌리기는 다시 일괄 변경으로

- **dry-run과 confirm을 같은 응답에서 연달아 부르지 마세요.** 미리보기를 보여 주고 **사용자 답을 받은 뒤 다음 턴에서만** `confirm: true`. `previewToken`은 승인의 증거가 아니라 "같은 payload로 dry-run이 있었다"는 증거일 뿐입니다.
- API Key 출력 금지.
