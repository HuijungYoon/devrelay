# Design: Create-issue assignee + 일감관리자 (watchers)

**Date:** 2026-07-13  
**Status:** Approved  
**Version target:** 0.2.6

## Goal

When creating an issue:

- **담당자** (`assignedTo`) — usually `"me"`, optional other user
- **일감관리자** — Redmine UI label for the multi-select list (API: `watcher_user_ids`); **not hardcoded** — any project member(s) by id or name

## API / tools

1. `redmine_list_project_members` — `GET /projects/:id/memberships.json` (avoids `/users.json` 403)
2. `redmine_create_issue` adds:
   - `watchers?: Array<"me" | number | string>` — resolved to user ids, sent as `watcher_user_ids`

## Skill UX

1. Project → subject → 담당자 → **일감관리자(선택, 다중)** → dry-run → confirm
