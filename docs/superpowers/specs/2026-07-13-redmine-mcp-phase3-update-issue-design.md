# Redmine MCP Phase 3 Design — Update Issue + Richer Create Preview

**Date:** 2026-07-13  
**Status:** Approved (2026-07-13)  
**Watchers on update:** **replace-all** when `watchers` is provided; omit = unchanged  
**Predecessor:** `docs/superpowers/specs/2026-07-13-redmine-mcp-phase2-write-design.md`  
**Also:** `docs/superpowers/specs/2026-07-13-create-issue-watchers-design.md`

## 1. Goal

All Redmine **mutations** go through **미리보기 → 확인 → 적용** (`confirm` dry-run gate). Agents must not bypass MCP with raw REST for fields that lack tools.

Add:

1. **`redmine_update_issue`** — multi-field update with **이전→이후** preview  
2. Keep **`redmine_update_status`** (slash / simple status UX)  
3. Expand **`redmine_create_issue`** so dry-run shows **유형·상태·우선순위·시작일·진척도** (and existing assignee/watchers)

## 2. Decisions

| Decision | Choice |
| --- | --- |
| Tool shape | **C:** `redmine_update_issue` + keep `redmine_update_status` |
| Safety | `confirm` default `false`; no write HTTP until `true` |
| Preview | Always include issue id, fields touched, **before → after** (update) or **wouldApply** (create) |
| Status on update | Allowed on both `update_issue` and `update_status` |
| Tracker / priority / status ids | Numeric ids (name resolution optional later via project metadata if needed) |
| Assignee / watchers | Same resolution as create (`me` / id / name via project members) |
| Version | npm **0.3.0** (minor: new write surface) |

## 3. Confirm gate (all writes)

1. Agent gathers intent → calls tool with `confirm` omitted/`false`  
2. Show user a clear preview (Korean OK in skills)  
3. Only after explicit OK → same args + `confirm: true`  
4. Skills + server instructions forbid raw API / inventing tools

Dry-run response shape:

```ts
// update
{ dryRun: true, issueId, changes: [{ field, from, to }, ...] }

// create (existing + richer wouldApply)
{ dryRun: true, wouldApply: { projectId, subject, trackerId, statusId, priorityId, startDate, doneRatio, assignedTo, watchers, ... } }
```

## 4. `redmine_create_issue` (extend)

| Field | Required | Notes |
| --- | --- | --- |
| `projectId` | yes | |
| `subject` | yes | |
| `description` | no | |
| `trackerId` | no | 유형 |
| `statusId` | no | 상태 (create 시 New 기본이면 생략 가능) |
| `priorityId` | no | 우선순위 |
| `startDate` | no | `YYYY-MM-DD` |
| `doneRatio` | no | 0–100, 진척도 |
| `dueDate` | no | optional stretch |
| `estimatedHours` | no | optional stretch |
| `assignedTo` | no | 담당자 |
| `watchers` | no | 일감관리자 |
| `confirm` | no | default false |

API: `POST /issues.json` — map to `tracker_id`, `status_id`, `priority_id`, `start_date`, `done_ratio`, etc.

**Skill UX:** After project/subject/assignee/watchers, also ask or fill **유형·상태·우선순위·시작일·진척도** when user cares; always include whatever will be sent in dry-run preview (defaults shown if Redmine would apply them — prefer explicit values in `wouldApply`).

## 5. `redmine_update_issue` (new)

| Field | Required | Notes |
| --- | --- | --- |
| `issueId` | yes | |
| `subject` | no | |
| `description` | no | |
| `trackerId` | no | 유형 |
| `statusId` | no | 상태 |
| `priorityId` | no | 우선순위 |
| `startDate` | no | |
| `dueDate` | no | |
| `doneRatio` | no | 0–100 |
| `assignedTo` | no | 담당자 (`me`/id/name); `null` clear if Redmine allows |
| `watchers` | no | **replace** 일감관리자 set (ids/names); empty array = clear all watchers if supported |
| `notes` | no | journal note with the change |
| `confirm` | no | default false |

**Dry-run behavior:**

1. `GET` issue (include enough to read current tracker/status/priority/assigned_to/done_ratio/start_date)  
2. Resolve names → ids  
3. Build `changes[]` with `{ field, from, to }` only for fields present in input  
4. No PUT until `confirm: true`

**Apply:** single `PUT /issues/{id}.json` with only changed fields (+ optional notes).  
Watchers: Redmine create uses `watcher_user_ids`; for update prefer documented approach (PUT watchers and/or `/watchers` API) — implementation picks the reliable path and documents it.

At least one mutable field required besides `issueId`/`confirm`/`notes`.

## 6. Existing tools

| Tool | Change |
| --- | --- |
| `redmine_update_status` | Keep; skills may prefer `update_issue` when bundling with other fields |
| `redmine_add_comment` | Unchanged |
| `redmine_list_project_members` | Used for assignee/watchers resolution |

## 7. Plugins

- Skill/command: `/update-issue` — gather fields → dry-run with before/after table → confirm  
- Update `/create-issue` skill to collect/show tracker, status, priority, startDate, doneRatio in preview  
- `/help` lists new command  
- Server instructions: never bypass confirm; never raw REST for these fields

## 8. Out of scope (this phase)

- Custom fields  
- Attachments  
- Name resolution for tracker/status/priority (ids only unless trivial list APIs added later)  
- Bulk multi-issue update  

## 9. Success examples

- “#23840 유형 버그, 진척도 20%, 담당자 나, 일감관리자 윤석준” → dry-run table → OK → apply  
- “이슈 만들어줘” → project → subject → 담당자/일감관리자 → 유형·우선순위·시작일·진척도 확인 → dry-run → create  
- Missing MCP field → **add tool**, do not call Redmine REST directly from the agent

## 10. Watchers on update (approved)

**replace-all** when `watchers` is provided; omit field = leave unchanged.
