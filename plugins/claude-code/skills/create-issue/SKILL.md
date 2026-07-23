---
name: create-issue
description: Create a Redmine issue after dry-run confirmation
---

# Create Redmine issue

**미리보기 → 확인 → 적용.** `confirm=true`는 사용자 승인 이후에만.

1. **프로젝트** (필수) — 없으면 `redmine_list_projects`
2. **subject** (+ description) — description은 **일반 텍스트 줄바꿈**으로 작성. 클라이언트는 `<p>`/`</p>`로 변환함 (HTML 직접 넣지 않아도 됨)
3. **담당자** `assignedTo` (보통 `"me"`)
4. **일감관리자** `watchers` — 필드에 요구됨 (멤버 목록). 미확정이면 생략
5. **첨부** `attachments` (선택) — `[{ path, filename?, description? }]`, dry-run에 크기 표시. 최대 5개·파일당 10MB
6. **유형·상태·우선순위·시작일·진척도** — `trackerId` / `statusId` / `priorityId` / `startDate` / `doneRatio` (모르면 id 확인). dry-run `wouldApply`에 **반드시** 포함해 보여 준다
7. dry-run 결과로 보여 주기 → OK → `confirm: true` + `previewToken`
8. API Key 출력 금지
