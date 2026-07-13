# Redmine MCP Phase 2 Design — Write Tools

**Date:** 2026-07-13  
**Status:** Draft for user review (brainstorm approved)  
**Predecessor:** `docs/superpowers/specs/2026-07-10-redmine-mcp-phase1-design.md`  
**Scope:** Phase 2 write MVP (create / comment / status) with confirm gate

## 1. Goal

Extend DevRelay so agents can **safely mutate** Redmine: create issues, add comments, and change status — only after an explicit confirm step. Preserve Phase 1 read tools and never log secrets or note bodies.

Success looks like:

- “WEB-HMI에 버그 이슈 초안 만들어줘” → dry-run preview → user OK → create
- `/add-comment 23840 재현 확인했습니다` → dry-run → confirm → journal added
- `/update-status 23840 4` (status id) → dry-run → confirm → status updated
- `confirm=false` (default) never calls Redmine write APIs
- API keys and comment/description bodies never appear in audit logs

## 2. Decisions (from brainstorm)

| Decision | Choice |
| --- | --- |
| Write ops | Create issue + add comment + update status |
| Safety | `confirm` default `false` = dry-run; `true` = apply |
| Status identity | **statusId (number) only** — no name resolution |
| Project on create | **Required** `projectId`; slash UX may resolve name via `redmine_list_projects` |
| Packaging | Extend existing `redmine-devrelay-client` / `redmine-devrelay` (not a separate write package) |
| Slash commands | `/create-issue`, `/add-comment`, `/update-status` + `/help` update |
| Version | npm **0.2.0** (minor) |

## 3. Architecture

```
Claude / Codex / Cursor plugins (skills + slash)
        │ MCP STDIO
        ▼
   redmine-devrelay   (+ 3 write tools, confirm gate in handlers)
        │
        ▼
   redmine-devrelay-client  (+ createIssue, addComment, updateIssueStatus)
        │ HTTPS or private-LAN http
        ▼
   Redmine REST API
```

- Write confirmation is enforced in **MCP handlers** (and mirrored in skills). Client methods always perform the HTTP call when invoked; handlers must not call them when `confirm !== true`.
- POST/PUT: **no automatic retries** (same as Phase 1 follow-on note).

## 4. MCP Tools

### 4.1 Common

Every write tool input includes:

- `confirm` — boolean, optional, default `false`

Responses:

- Dry-run: `{ dryRun: true, wouldApply: { ...normalizedPayload } }`
- Apply: `{ dryRun: false, result: { ... } }` (issue summary / journal ack / updated status)

Server instructions update:

- Read tools usable without write confirmation
- Write tools: always dry-run first; only call with `confirm: true` after user approval
- Do not invent write operations beyond the three tools

### 4.2 `redmine_create_issue`

| Field | Required | Notes |
| --- | --- | --- |
| `projectId` | yes | Positive int |
| `subject` | yes | Non-empty string |
| `description` | no | |
| `trackerId` | no | |
| `priorityId` | no | |
| `assignedTo` | no | `"me"` or user id |
| `confirm` | no | default false |

API: `POST /issues.json` with `{ issue: { project_id, subject, ... } }`.

### 4.3 `redmine_add_comment`

| Field | Required | Notes |
| --- | --- | --- |
| `issueId` | yes | |
| `notes` | yes | Non-empty |
| `confirm` | no | default false |

API: `PUT /issues/{id}.json` with `{ issue: { notes } }`.

### 4.4 `redmine_update_status`

| Field | Required | Notes |
| --- | --- | --- |
| `issueId` | yes | |
| `statusId` | yes | Numeric status id only |
| `notes` | no | Optional journal with status change |
| `confirm` | no | default false |

API: `PUT /issues/{id}.json` with `{ issue: { status_id, notes? } }`.

## 5. Client API

Add to `redmine-devrelay-client`:

- `createIssue(input)`
- `addComment(issueId, notes)`
- `updateIssueStatus(issueId, statusId, notes?)`

Map Redmine errors to existing codes (`REDMINE_PERMISSION_DENIED`, `REDMINE_VALIDATION_ERROR`, `REDMINE_ISSUE_NOT_FOUND`, etc.). Do not log request bodies.

HTTP layer: support JSON body on POST/PUT (if not already complete); still no retry on mutating methods.

## 6. Plugins / slash / skills

| Slash (Cursor) | Claude-style | Behavior |
| --- | --- | --- |
| `/create-issue` | `/redmine:create-issue` | Resolve project (name→`list_projects`→`projectId` if needed); dry-run; ask; `confirm: true` |
| `/add-comment` | `/redmine:add-comment` | Parse issue id + notes; dry-run; ask; confirm |
| `/update-status` | `/redmine:update-status` | Parse issue id + statusId; dry-run; ask; confirm |
| `/help` | `/redmine:help` | Include the three write commands + note that writes need confirm |

Codex: matching skills with the same workflow.

Skills must never skip dry-run or set `confirm: true` without user confirmation in the conversation.

## 7. Security & audit

- Per-user API keys only (unchanged)
- Audit log fields: tool name, host, ok, durationMs, `dryRun`/`confirm` — **never** API key, notes, description, or full issue body
- Public hostnames: prefer `REDMINE_ALLOWED_HOSTS` (RFC1918 http remains allowed without allowlist per current client policy)

## 8. Testing

- Unit: client write methods build correct paths/bodies; mutating calls not retried
- Unit: MCP handlers — `confirm=false` does not invoke client write methods; `confirm=true` does
- Schema: zod/json schema for the three tools
- Optional integration (`REDMINE_INTEGRATION=1`): create → comment → status on Docker/local Redmine, cleanup or dedicated project

## 9. Out of scope

- Attachments, rich custom fields, delete issue
- Dedicated tools for assignee-only / priority-only updates
- Status **name** → id resolution
- Separate write-only MCP package
- Automatic retries on POST/PUT

## 10. Rollout

1. Implement client + MCP + tests
2. Update Cursor/Claude/Codex skills, commands, `/help`
3. Docs: installation, security, README Phase 2 note
4. Publish `redmine-devrelay-client@0.2.0` and `redmine-devrelay@0.2.0`
5. Point plugin `.mcp.json` / marketplace mcp args at `@0.2.0`

## 11. Open points (resolved in brainstorm)

- Write set: A (create + comment + status) ✓
- Confirm model: A (confirm gate) ✓
- Slash: B (all three + help) ✓
- Status: B (id only) ✓
- Create requires project; name resolution in skill UX ✓
