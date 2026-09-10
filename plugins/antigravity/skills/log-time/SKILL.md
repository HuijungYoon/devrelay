---
name: redmine:log-time
description: Record or list Redmine time entries (작업시간) — log hours on an issue after dry-run confirmation, or list spent time by issue, project, user and date range
---

# Redmine 작업시간 (time entries)

**미리보기 → 확인 → 적용.** 기록은 `redmine_log_time`, 조회는 `redmine_list_time_entries`.

## 기록 ("24067에 오늘 2시간 기록해줘")

1. **대상** — `issueId` (권장) 또는 `projectId`. 둘 중 하나는 필수. 일감 번호가 없으면 `redmine_search_issues { assignedTo: "me" }`로 찾아서 사용자에게 고르게 한다 (추측 금지)
2. **시간** `hours` — 시간 단위 숫자 (`1.5`, `0.25`). "30분"은 `0.5`. 0 초과 24 이하
3. **작업일** `spentOn` — `YYYY-MM-DD`. "오늘"·생략이면 넣지 않는다 (dry-run이 오늘 날짜를 `wouldApply.spentOn`에 채워 보여 준다). "어제"·"지난 금요일"은 날짜로 환산해 넘긴다
4. **작업 분류(활동)** `activityId` — **id 또는 이름** (`"개발"`, `"설계"`, `"테스트"`). 사용자가 말하지 않았으면 **한 번 묻는다** — Redmine에 기본 활동이 없으면 활동 없이 기록이 422로 실패한다. 후보는 `redmine_list_metadata { kinds: ["activities"] }`
   - 이름이 안 맞으면 에러 `check`에 실제 후보(`9:개발, 8:설계…`)가 온다 → 그 이름으로 재시도. id 추측 금지
5. **설명** `comments` — 짧은 평문 한 줄 (구버전 Redmine은 255자 제한). 마크업 금지
6. dry-run 결과를 보여 준다: 일감 번호·제목(`issueSubject`), 시간, 작업일, 활동(`activityLabel`), 설명, 기록 주체는 항상 요청자 본인(`user: "me"`)
7. 사용자 OK 후에만 `confirm: true` + **같은 필드** + `previewToken`
8. 기록은 항상 API Key 소유자 명의로 남는다. 다른 사람 명의로 기록하는 기능은 없다

## 조회 ("이번 주 내 작업시간", "24067에 기록된 시간")

- `redmine_list_time_entries { spentFrom, spentTo }` — 일감·프로젝트·사용자를 하나도 안 주면 **자동으로 `userId: "me"`**
- 특정 일감: `{ issueId }` (모든 사용자의 기록). 특정 프로젝트: `{ projectId }`
- `activityId`도 id·이름 가능. 결과의 `totalHours`는 **돌려준 행의 합**이라 `hasMore: true`면 `limit`을 늘려 다시 조회
- 표로 보여 줄 때: 날짜 · 일감 · 활동 · 시간 · 설명. 마지막에 합계

- **dry-run과 confirm을 같은 응답에서 연달아 부르지 마세요.** 미리보기를 보여 주고 **사용자 답을 받은 뒤 다음 턴에서만** `confirm: true`. `previewToken`은 승인의 증거가 아니라 "같은 payload로 dry-run이 있었다"는 증거일 뿐입니다.
- API Key 출력 금지.
