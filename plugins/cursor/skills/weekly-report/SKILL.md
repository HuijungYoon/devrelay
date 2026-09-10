---
name: weekly-report
description: Build a weekly work report (주간보고) from Redmine — issues I updated, status changes, comments, time entries and next week's due items, using read-only tools
---

# Weekly report (주간보고)

읽기 전용. 기존 도구만 조합한다. Redmine에 쓰지 않는다 (보고서를 댓글로 올리라는 요청이 있으면 그때 `add-comment` 스킬로 별도 확인).

## 1. 기간

- 기본 **이번 주**: 이번 주 월요일 ~ 오늘. "지난주"면 지난 월요일 ~ 일요일. 사용자가 날짜를 말하면 그대로
- 날짜는 `YYYY-MM-DD`로 계산해 `from`/`to`에 넣는다. 보고서 제목에 기간을 적는다

## 2. 데이터 수집 (병렬로 부를 수 있다)

| 무엇 | 도구 |
| --- | --- |
| 내가 이번 주 건드린 일감 | `redmine_search_issues { assignedTo: "me", status: "all", updatedAfter: from, updatedBefore: to, limit: 100 }` |
| 내가 만든 일감 | `redmine_search_issues { authorId: "me", status: "all", createdAfter: from, createdBefore: to, limit: 50 }` |
| 작업시간 | `redmine_list_time_entries { spentFrom: from, spentTo: to, limit: 200 }` (기본 나) |
| 다음 주 마감 | `redmine_search_issues { assignedTo: "me", dueAfter: 다음 주 월, dueBefore: 다음 주 일 }` |
| 기한 지난 열린 일감 | `redmine_search_issues { assignedTo: "me", dueBefore: 오늘 }` |

- 건드린 일감이 30개 이하면 각각 `redmine_get_issue { include: ["journals"] }`로 기간 내 내 journal을 본다: `notes`(댓글)와 `details`의 `status_id`/`done_ratio` 변화. 30개를 넘으면 상태가 `완료`이거나 `doneRatio`가 큰 것부터 상세를 보고 나머지는 목록 정보만 쓴다
- 프로젝트가 여럿이면 프로젝트별로 묶는다

## 3. 보고서 형식

```
# 주간보고 (YYYY-MM-DD ~ YYYY-MM-DD) — 이름

## 완료
- #id 제목 — 한 줄 (상태 변경 날짜, 작업시간 h)

## 진행 중
- #id 제목 — 진척도 n% · 이번 주 한 일 한 줄 · 다음 할 일

## 신규 / 계획
- #id 제목 — 등록일

## 이슈 · 리스크
- 기한 지난 일감, 막힌 일감(댓글에 "대기"/"blocked" 등), 워크플로우로 못 바꾼 상태

## 작업시간
- 합계 n.n h — 활동별 · 일감별 상위 3개

## 다음 주 예정
- #id 제목 — 완료기한
```

- 각 줄은 짧게. 일감 번호는 `#id`로. 사용자 정의 문구·과장 금지 — Redmine에 있는 사실만
- `totalHours`는 돌려받은 행의 합이니 `hasMore: true`면 `limit`을 늘려 다시 조회한 뒤 합산
- 비어 있는 섹션은 "없음"으로 남긴다. 팀 보고용으로 다듬어 달라면 톤만 바꾸고 사실은 유지

API Key 출력 금지.
