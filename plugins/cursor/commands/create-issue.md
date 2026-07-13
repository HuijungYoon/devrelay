---
description: Redmine 이슈 생성 (프로젝트·담당자 확인, dry-run 후 확인)
---

Use the **create-issue** skill.

1. **먼저 프로젝트** — id/이름이 없으면 `redmine_list_projects` 후 고르게 한다. `projectId` 없이 create 금지.
2. subject 수집.
3. **일감 담당자** — `assignedTo: "me"` / 이름(예: 윤석준) / user id / 미지정. create 시 `assignedTo`로 전달.
4. dry-run → 사용자 OK 후에만 `confirm=true`.
