---
name: redmine:search-issues
description: Search Redmine issues with filters (due date range, tracker/status/priority by name, version, category, author, watcher, assignee) or full-text search in descriptions and notes
---

# Search Redmine issues (일감 검색)

읽기 전용. `redmine_search_issues`(필터)와 `redmine_search_text`(전문 검색) 두 도구.

## 필터 검색 `redmine_search_issues`

1. **프로젝트** — 사용자가 프로젝트를 말했으면 `redmine_list_projects`로 id를 찾는다. 대상 버전·범주·멤버 **이름**을 쓰려면 `projectId`가 필요하다
2. **이름을 그대로 넘긴다** — `trackerId: "버그"`, `status: "진행중"`, `priorityId: "높음"`, `fixedVersionId: "2026-Q3"`, `categoryId: "프론트엔드"`. 결과의 `resolved`에 무엇으로 해석됐는지 온다. 안 맞으면 에러 `check`의 후보 이름으로 재시도 (id 추측 금지)
3. **사람** — `assignedTo`(담당자) · `authorId`(작성자) · `watcherId`(일감관리자) 모두 `"me"` / id / 이름. 이름은 프로젝트 멤버에서 찾고, 없으면 전체 사용자 검색(권한 필요). 애매하면 후보가 담긴 에러 → 사용자에게 고르게 한다
4. **날짜 범위** (YYYY-MM-DD, 양끝 포함) — `dueAfter`/`dueBefore` 완료기한, `createdAfter`/`createdBefore` 등록일, `updatedAfter`/`updatedBefore` 수정일
   - "이번 주 마감": 이번 주 월~일을 계산해 `dueAfter`+`dueBefore`. "지난 마감": `dueBefore: 오늘`, `status: "open"`
5. `status`는 기본 `open`. 닫힌 것도 보려면 `"all"`
6. 표: `| ID | 제목 | 상태 | 우선순위 | 담당자 | 완료기한 | 진척도 |`. `dueDate`·`doneRatio`는 결과에 있으니 이슈마다 상세를 부르지 않는다

## 전문 검색 `redmine_search_text`

- 제목뿐 아니라 **설명·댓글**에 든 말을 찾을 때: `{ query: "OCR 타임아웃" }`. 프로젝트로 좁히려면 `projectId`. 위키·뉴스까지 보려면 `types: ["issues", "wiki_pages"]`
- 결과는 `title`·`type`(issue / issue closed / wiki-page …)·`description` 발췌·`url`. 일감이면 `id`로 `redmine_get_issue`
- Redmine 3.3 미만은 이 API가 없어 "not available" 에러가 온다 → `redmine_search_issues { subjectContains }`로 대신하고 사용자에게 제목만 검색됐다고 알린다

API Key 출력 금지. 쓰기 도구를 부르지 않는다.
