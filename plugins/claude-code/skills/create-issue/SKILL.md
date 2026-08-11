---
name: create-issue
description: Create a Redmine issue after dry-run confirmation
---

# Create Redmine issue

**미리보기 → 확인 → 적용.** `confirm=true`는 사용자 승인 이후에만.

1. **프로젝트** (필수) — 없으면 `redmine_list_projects`
2. **subject** (+ description) — description은 **일반 텍스트 줄바꿈**으로 작성. 클라이언트는 `<p>`/`</p>`로 변환함 (HTML 직접 넣지 않아도 됨)
3. **담당자(작업자)** `assignedTo` — **기본값 `"me"`**. 따로 묻지 않고 요청자 본인으로 넣는다. 사용자가 다른 사람을 명시한 경우에만 그 값 사용
4. **일감관리자** `watchers` — 필드에 요구됨. **dry-run 전에 반드시 한 번 물어본다** (기본값 없음, 임의 추측 금지)
   - `redmine_list_project_members`로 후보를 뽑아 이름과 함께 질문 (후보 3~4명이면 `AskUserQuestion`으로 제시)
   - "없음/모름/생략" 답이면 `watchers` 비우고 dry-run에 `일감관리자: 미지정`으로 표기
   - 같은 대화에서 이미 지정했으면 그 값을 재사용하고 다시 묻지 않는다
5. **상위 일감** `parentIssueId` (선택) — 넣으면 그 일감의 **하위일감**으로 생성됨 (`/subtask`)
6. **첨부** `attachments` (선택) — `[{ path, filename?, description? }]`, dry-run에 크기 표시. 최대 5개·파일당 10MB
7. **유형·상태·우선순위·시작일·진척도** — `trackerId` / `statusId` / `priorityId` / `startDate` / `doneRatio` (모르면 id 확인). dry-run `wouldApply`에 **반드시** 포함해 보여 준다
8. dry-run 결과로 보여 주기 → OK → `confirm: true` + `previewToken`
9. API Key 출력 금지
