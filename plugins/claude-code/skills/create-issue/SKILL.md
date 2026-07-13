---
name: create-issue
description: Create a Redmine issue after dry-run confirmation
---

# Create Redmine issue

**프로젝트부터 확정한다.** `projectId` 없이 dry-run/생성으로 가지 않는다.

1. **프로젝트 (필수, 최우선)** — 없으면 `redmine_list_projects` 후 고르게 한다.
2. **subject** (필수)와 description 등.
3. **담당자 (`assignedTo`)** — 보통 `"me"`. 이름/id도 가능.
4. **일감관리자 (`watchers`)** — **지정 필드로 묻는다** (특정 인물 고정 금지).
   - 없으면 `redmine_list_project_members`로 후보를 보여 주고 고르게 한다 (다중 가능).
   - create 시 `watchers: ["이름" | userId, ...]` 로 전달.
   - 미지정이면 생략.
5. dry-run → 사용자 OK 후 `confirm: true`.
6. API Key 출력 금지. 첫 호출에 `confirm=true` 금지.
