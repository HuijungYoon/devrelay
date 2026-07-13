---
name: create-issue
description: Create a Redmine issue after dry-run confirmation
---

# Create Redmine issue

**미리보기 → 확인 → 적용.** `confirm=true`는 사용자 승인 후에만.

1. **프로젝트** (필수) — 없으면 `redmine_list_projects`
2. **subject** (+ description)
3. **담당자** `assignedTo` (보통 `"me"`)
4. **일감관리자** `watchers` — 필드에 누구든 (멤버 목록). 미지정이면 생략
5. **유형·상태·우선순위·시작일·진척도** — `trackerId` / `statusId` / `priorityId` / `startDate` / `doneRatio` (모르면 id 확인 후). dry-run `wouldApply`에 **반드시** 포함해 보여 준다
6. dry-run → 표로 보여 주기 → OK 후 `confirm: true`
7. API Key 출력 금지
