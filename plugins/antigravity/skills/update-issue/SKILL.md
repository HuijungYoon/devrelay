---
name: redmine:update-issue
description: Update Redmine issue fields after before/after dry-run confirmation
---

# Update Redmine issue

**미리보기 → 확인 → 적용.** 원시 REST 우회 금지.

1. 이슈 번호 + 바꿀 필드 수집 (유형/상태/우선순위/날짜/진척도/담당자/일감관리자/제목 등)
2. `description`은 **일반 텍스트 줄바꿈**으로 넣으면 됨 (`<p>` 자동 변환). HTML을 직접 쓰지 않아도 됨
3. `redmine_update_issue` with `confirm` false → `changes[]` **이전→이후** 표를 보여 준다
4. 사용자 OK 후에만 `confirm: true`
5. 일감관리자(`watchers`)를 넣으면 **전체 교체**; 생략하면 유지
6. 상태만 바꿀 때는 `redmine_update_status`도 가능하나, 여러 필드면 `update_issue` 사용
