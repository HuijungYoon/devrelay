---
name: redmine:update-status
description: Update Redmine issue status by name or statusId after dry-run confirmation
---

# Update Redmine status

1. 이슈 번호 + `statusId` — **id 또는 상태 이름**을 그대로 넘기면 서버가 해석합니다 (`"진행"`, `"완료"`).
   - dry-run `wouldApply`의 `statusId`/`statusLabel`로 무엇으로 해석됐는지 확인하고 사용자에게 보여 줍니다
   - 이름이 안 맞으면 에러 `check`에 실제 후보(`2:진행, 4:테스트…`)가 들어옵니다. 그 이름으로 다시 부르세요 — id를 추측하지 마세요
   - 그 이슈에서 실제로 허용되는 다음 상태만 보려면 `redmine_get_issue { include: ["allowed_statuses"] }`
2. Optional `notes`는 **평문만** (Textile/Markdown 금지).
3. Call `redmine_update_status` with `confirm` omitted/false → dry-run + `previewToken`.
4. dry-run이 `blocked: true`면 notes를 평문으로 고친 뒤 재시도.
5. After user approval: `confirm: true` + same fields + `previewToken` (첫 호출 confirm 금지).
6. Never print API keys.
