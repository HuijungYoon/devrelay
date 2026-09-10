---
name: redmine:weekly-report
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

## 3. 보고서 형식 — 표로 낸다

**보고서 본문은 마크다운 표로 만든다.** 불릿 목록으로 나열하지 않는다. 아래 표 골격을 그대로 쓰고, 열은 실제로 값이 있는 것만 남긴다 (예: 완료기한이 전부 비어 있으면 그 열을 뺀다).

```
# 주간보고 (YYYY-MM-DD ~ YYYY-MM-DD) — 이름

프로젝트: 이름   (여러 개면 프로젝트별로 아래 표를 반복)

## 요약

| 구분 | 건수 | 비고 |
| --- | --- | --- |
| 완료 | n | #id 제목 |
| 진행 중 | n | |
| 신규 등록 | n | |
| 계획 변경 | n | |
| 작업시간 | n.n h | |

## 진행 현황

| 일감 | 제목 | 유형 | 상태 | 진척도 | 완료기한 |
| --- | --- | --- | --- | --- | --- |
| #id | 제목 | 기능추가 | 테스트 | 70% → **90%** (MM-DD) | YYYY-MM-DD |

## 이번 주 한 일

| 일감 | # | 내용 |
| --- | --- | --- |
| #id | 1 | journal에 적힌 한 줄 |

## 계획 변경

| 일감 | 항목 | 이전 | 이후 | 비고 |
| --- | --- | --- | --- | --- |
| #id | 시작일 | YYYY-MM-DD | YYYY-MM-DD | 1주 미룸 |

## 이슈 · 리스크

| 구분 | 대상 | 내용 |
| --- | --- | --- |
| 기한 | #id | 완료기한 MM-DD, 남은 작업 있음 |
| 지연 | #id | 착수 예정이었으나 미착수 |
| 기록 | 전체 | 작업시간 기록 없음 |

## 작업시간

| 일감 | 활동 | 시간 |
| --- | --- | --- |
| #id | 개발 | n.n |
| **합계** | | **n.n h** |

## 다음 주 예정 (MM-DD ~ MM-DD)

| 일감 | 제목 | 기준 | 날짜 |
| --- | --- | --- | --- |
| #id | 제목 | 완료기한 | YYYY-MM-DD |
| #id | 제목 | 시작일 | YYYY-MM-DD |
```

표 작성 규칙:

- **진행 현황** 표 하나에 완료·진행 중·신규를 상태 열로 함께 담고, 완료된 것을 위로 정렬한다
- 진척도가 이번 주에 바뀌었으면 `이전% → **이후%** (MM-DD)`로 적어 변화가 보이게 한다
- **이번 주 한 일**은 journal `notes`에 적힌 항목을 한 줄씩 행으로 나눈다. 한 일감뿐이면 제목을 `## 이번 주 한 일 — #id`로 쓰고 `일감` 열을 뺀다. 남은 작업은 표 아래 `남은 작업:` 한 줄로 붙인다
- 셀 안에서는 줄바꿈을 쓰지 않는다. 길면 `·`로 잇거나 행을 나눈다
- 일감 번호는 `#id`로 쓴다 (Redmine 이슈 URL을 알면 링크로)
- 표로 만들 열이 없는 짧은 내용(예: `남은 작업:`, 보고서 맨 끝 한 줄 안내)만 표 밖에 평문으로 둔다
- 비어 있는 섹션은 표를 만들지 않고 `없음` 한 줄로 남긴다
- 사용자 정의 문구·과장 금지 — Redmine에 있는 사실만
- `totalHours`는 돌려받은 행의 합이니 `hasMore: true`면 `limit`을 늘려 다시 조회한 뒤 합산
- 팀 보고용으로 다듬어 달라면 톤만 바꾸고 표 구조와 사실은 유지

API Key 출력 금지.
