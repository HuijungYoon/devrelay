# Redmine MCP Phase 3 Update Issue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `redmine_update_issue` with before→after dry-run confirm, enrich `redmine_create_issue` with tracker/status/priority/startDate/doneRatio in create + preview, keep `redmine_update_status`, publish `0.3.0`.

**Architecture:** Client gains `updateIssue` (PUT partial fields + watcher replace). MCP handler GETs current issue for dry-run diffs, resolves assignee/watchers via existing project-member helpers, never writes unless `confirm === true`. Skills enforce preview→ask→apply; no raw REST bypass.

**Tech Stack:** Node 20+, pnpm, TypeScript, Vitest, Zod, MCP SDK (same as Phase 2).

**Spec:** `docs/superpowers/specs/2026-07-13-redmine-mcp-phase3-update-issue-design.md` (Approved; watchers on update = replace-all)

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/redmine-client/src/types.ts` | Extend `CreateIssueInput`; add `UpdateIssueInput` / result |
| `packages/redmine-client/src/writes.ts` | Map new create fields; add `updateIssue` |
| `packages/redmine-client/src/client.ts` | Expose `updateIssue` |
| `packages/redmine-client/tests/writes.test.ts` | Create payload + update PUT + watchers |
| `packages/redmine-mcp/src/tools/schemas.ts` | Extend create schema; add updateIssue schema/JSON |
| `packages/redmine-mcp/src/tools/writes.ts` | `handleUpdateIssue` + create field pass-through; before/after |
| `packages/redmine-mcp/src/server.ts` | Register tool; instructions |
| `packages/redmine-mcp/tests/schemas.test.ts` | Parse new fields |
| `packages/redmine-mcp/tests/tools.writes.test.ts` | Dry-run diffs; confirm PUT |
| `plugins/*/skills/create-issue`, `update-issue`, `help` | UX + preview fields |
| `plugins/cursor/commands/*` | Slash commands |
| `packages/*/package.json`, README | `0.3.0` |
| `docs/installation.md` / root README | Brief Phase 3 note |

---

### Task 1: Client create fields + updateIssue

**Files:**
- Modify: `packages/redmine-client/src/types.ts`
- Modify: `packages/redmine-client/src/writes.ts`
- Modify: `packages/redmine-client/src/client.ts`
- Modify: `packages/redmine-client/tests/writes.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
it("createIssue sends status_id start_date done_ratio", async () => {
  // postJson called with status_id, start_date, done_ratio, tracker_id, priority_id
});

it("updateIssue PUTs only provided fields and watcher_user_ids", async () => {
  // putJson `/issues/7.json` with issue: { done_ratio: 20, assigned_to_id: "me", watcher_user_ids: [99] }
});
```

- [ ] **Step 2: Extend `CreateIssueInput`**

Add optional: `statusId`, `startDate`, `doneRatio` (0–100), keep `trackerId`/`priorityId`/`dueDate?`/`estimatedHours?` if in spec.

- [ ] **Step 3: Add `UpdateIssueInput`**

```typescript
export type UpdateIssueInput = {
  issueId: number;
  subject?: string;
  description?: string;
  trackerId?: number;
  statusId?: number;
  priorityId?: number;
  startDate?: string;
  dueDate?: string;
  doneRatio?: number;
  assignedTo?: "me" | number;
  watcherUserIds?: number[]; // replace-all when provided
  notes?: string;
};
```

- [ ] **Step 4: Implement mapping in `writes.ts`**

Create: set `status_id`, `start_date`, `done_ratio`, etc. when defined.  
Update: build `issue` object with only defined keys; if `watcherUserIds` defined (including `[]`), set `watcher_user_ids`.

- [ ] **Step 5: `client.updateIssue(input)` → `updateIssue(http, input)`**

- [ ] **Step 6: Run `pnpm --filter redmine-devrelay-client test` — pass**

- [ ] **Step 7: Commit** `feat(client): extend create fields and add updateIssue`

---

### Task 2: MCP schemas for create extend + update_issue

**Files:**
- Modify: `packages/redmine-mcp/src/tools/schemas.ts`
- Modify: `packages/redmine-mcp/tests/schemas.test.ts`

- [ ] **Step 1: Failing schema tests**

- create accepts `statusId`, `startDate`, `doneRatio` (0–100)
- updateIssue requires `issueId` + at least one mutable field
- updateIssue rejects empty update (only confirm)

- [ ] **Step 2: Zod**

`createIssueInputSchema`: add `statusId`, `startDate` (`YYYY-MM-DD` regex), `doneRatio` (`z.number().int().min(0).max(100)`), optional `dueDate`/`estimatedHours` if implementing.

`updateIssueInputSchema`: same mutables + `notes` + `confirm`; `.refine` that ≥1 of subject/description/trackerId/statusId/priorityId/startDate/dueDate/doneRatio/assignedTo/watchers is set.

- [ ] **Step 3: `toolJsonSchemas.redmine_update_issue` + extend create JSON schema descriptions (Korean field names in descriptions)**

- [ ] **Step 4: `safeParseUpdateIssue`**

- [ ] **Step 5: Tests pass — commit** `feat(mcp): schemas for update_issue and richer create`

---

### Task 3: handleUpdateIssue + richer create wouldApply

**Files:**
- Modify: `packages/redmine-mcp/src/tools/writes.ts`
- Modify: `packages/redmine-mcp/tests/tools.writes.test.ts`

- [ ] **Step 1: Failing handler tests**

```typescript
it("updateIssue dry-run returns before→after and does not PUT", async () => {
  const getIssue = vi.fn().mockResolvedValue({
    id: 7,
    subject: "Old",
    tracker: { id: 1, name: "Feature" },
    status: { id: 1, name: "New" },
    priority: { id: 2, name: "Normal" },
    assignedTo: { id: 1, name: "Me" },
    doneRatio: 0,
    startDate: "2026-07-01",
  });
  const updateIssue = vi.fn();
  const result = await handleUpdateIssue(
    { getIssue, updateIssue, listProjectMembers: vi.fn(), getCurrentUser: vi.fn() } as never,
    { issueId: 7, doneRatio: 20, trackerId: 2, confirm: false }
  );
  expect(updateIssue).not.toHaveBeenCalled();
  expect(result.dryRun).toBe(true);
  expect(result.changes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ field: "doneRatio", from: 0, to: 20 }),
      expect.objectContaining({ field: "trackerId", from: 1, to: 2 }),
    ])
  );
});

it("updateIssue confirm calls updateIssue with resolved payload", async () => { /* ... */ });

it("createIssue wouldApply includes statusId startDate doneRatio", async () => { /* ... */ });
```

- [ ] **Step 2: Implement `handleUpdateIssue`**

1. `getIssue(issueId)` (ensure detail has tracker/status/priority/assignedTo/doneRatio/startDate — extend normalize if missing)  
2. Resolve `assignedTo` / `watchers` with existing helpers (`projectId` from issue.project.id)  
3. Build `changes: { field, from, to, fromLabel?, toLabel? }[]`  
4. If `!confirm` return `{ dryRun: true, issueId, changes }`  
5. Else `client.updateIssue({...})` return `{ dryRun: false, result, changes }`

- [ ] **Step 3: Pass new create fields into `wouldApply` / `createIssue`**

- [ ] **Step 4: Tests pass — commit** `feat(mcp): update_issue confirm gate with before/after`

---

### Task 4: Wire server + instructions

**Files:**
- Modify: `packages/redmine-mcp/src/server.ts`

- [ ] **Step 1: Register `redmine_update_issue`**

Description: multi-field update; dry-run shows before→after; confirm=true applies. Mentions done_ratio/tracker/assignedTo/watchers/status/priority/dates.

- [ ] **Step 2: Update INSTRUCTIONS**

All writes: preview → user OK → confirm. Prefer `update_issue` for multi-field; `update_status` still valid. Never raw REST.

- [ ] **Step 3: Switch case + audit**

- [ ] **Step 4: Commit** `feat(mcp): register redmine_update_issue`

---

### Task 5: Plugins / skills

**Files:**
- Create: `plugins/cursor/skills/update-issue/SKILL.md`, `plugins/cursor/commands/update-issue.md`
- Create: matching claude-code / codex skills
- Modify: `plugins/*/skills/create-issue/SKILL.md` — ask/show 유형·상태·우선순위·시작일·진척도 in preview
- Modify: help tables

- [ ] **Step 1: create-issue skill** — after assignee/watchers, collect optional tracker/status/priority/startDate/doneRatio; dry-run must list them

- [ ] **Step 2: update-issue skill** — get current via tool dry-run; show table 이전→이후; confirm only after OK

- [ ] **Step 3: help / README pins**

- [ ] **Step 4: Commit** `feat(plugins): update-issue skill and richer create preview`

---

### Task 6: Version 0.3.0 + docs + publish

**Files:**
- `packages/redmine-client/package.json` → `0.3.0`
- `packages/redmine-mcp/package.json` → `0.3.0` (dep client `0.3.0`)
- `packages/redmine-mcp/README.md` — document `redmine_update_issue` + create fields
- Optional: root `README.md`, `docs/installation.md`

- [ ] **Step 1: Bump versions + README**

- [ ] **Step 2: `pnpm --filter redmine-devrelay-client test && pnpm --filter redmine-devrelay test`**

- [ ] **Step 3: Commit** `chore: bump redmine-devrelay to 0.3.0`

- [ ] **Step 4: Push + npm publish client then mcp (only when user asks)**

---

## Verification checklist

- [ ] Create dry-run shows tracker/status/priority/startDate/doneRatio/assignedTo/watchers when set
- [ ] Update dry-run shows before→after; no PUT when confirm false
- [ ] Watchers on update replace-all when provided
- [ ] `redmine_update_status` still works
- [ ] Skills never skip confirm
- [ ] `npx redmine-devrelay@0.3.0` after publish

## Execution note

Prefer **subagent-driven-development** one task at a time with review gates. Do not publish until user approves.
