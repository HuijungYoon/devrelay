# Redmine MCP Phase 2 Write Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add create-issue, add-comment, and update-status write tools with a `confirm` dry-run gate, plus matching slash skills, and publish as `redmine-devrelay@0.2.0`.

**Architecture:** Extend `redmine-devrelay-client` with non-retrying POST/PUT helpers and three write methods. MCP handlers enforce `confirm !== true` → dry-run only (no client write calls). Plugins gain `/create-issue`, `/add-comment`, `/update-status` and update `/help`.

**Tech Stack:** Node 20+, pnpm workspaces, TypeScript, Vitest, Zod, `@modelcontextprotocol/sdk`, undici/fetch.

**Spec:** `docs/superpowers/specs/2026-07-13-redmine-mcp-phase2-write-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/redmine-client/src/http.ts` | Add `postJson` / `putJson` (no retries); keep `getJson` retries |
| `packages/redmine-client/tests/http.test.ts` | Assert POST/PUT send body + no retry on 503 |
| `packages/redmine-client/src/types.ts` | `CreateIssueInput`, write result types |
| `packages/redmine-client/src/issues.ts` or `writes.ts` | Prefer new `src/writes.ts` for create/comment/status builders |
| `packages/redmine-client/src/client.ts` | Expose `createIssue`, `addComment`, `updateIssueStatus` |
| `packages/redmine-client/src/index.ts` | Export new types/functions |
| `packages/redmine-client/tests/writes.test.ts` | Mock HTTP for write methods |
| `packages/redmine-mcp/src/tools/schemas.ts` | Zod + JSON schemas for 3 write tools |
| `packages/redmine-mcp/src/tools/writes.ts` | Handlers with confirm gate |
| `packages/redmine-mcp/src/server.ts` | Register tools, update instructions, audit `dryRun` |
| `packages/redmine-mcp/src/logging.ts` | Optional `dryRun?: boolean` on audit |
| `packages/redmine-mcp/tests/schemas.test.ts` | Parse write schemas |
| `packages/redmine-mcp/tests/tools.writes.test.ts` | confirm false/true behavior |
| `plugins/cursor/commands/*.md` + `skills/*` | Slash + skills |
| `plugins/claude-code/skills/*`, `plugins/codex/skills/*` | Same workflows |
| `plugins/*/README.md`, `plugins/cursor/.../plugin.json` | Docs + description |
| `plugins/*/.mcp.json` | Pin `@0.2.0` |
| `packages/*/package.json` | Version `0.2.0` |
| `README.md`, `docs/installation.md`, `docs/security.md` | Phase 2 notes |

---

### Task 1: HTTP mutating helpers (no retry)

**Files:**
- Modify: `packages/redmine-client/src/http.ts`
- Modify: `packages/redmine-client/tests/http.test.ts`

- [ ] **Step 1: Write failing tests for postJson/putJson**

Append to `packages/redmine-client/tests/http.test.ts`:

```typescript
  it("postJson sends JSON body with Content-Type and does not retry 503", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const http = new RedmineHttp(baseConfig, { retryBackoffMs: 1 });
    await expect(
      http.postJson("/issues.json", { issue: { subject: "x", project_id: 1 } })
    ).rejects.toMatchObject({ code: "REDMINE_UNKNOWN_ERROR", httpStatus: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      issue: { subject: "x", project_id: 1 },
    });
  });

  it("putJson uses PUT and returns JSON on 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ issue: { id: 9 } }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const http = new RedmineHttp(baseConfig);
    const data = await http.putJson<{ issue: { id: number } }>(
      "/issues/9.json",
      { issue: { notes: "hi" } }
    );
    expect(data.issue.id).toBe(9);
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter redmine-devrelay-client exec vitest run tests/http.test.ts
```

Expected: FAIL — `postJson` / `putJson` missing.

- [ ] **Step 3: Implement postJson/putJson**

In `RedmineHttp`:

1. Change private `request` to accept `method` and optional body:

```typescript
  private async request(
    url: string,
    options: { method?: string; body?: string } = {}
  ): Promise<Response> {
    const method = options.method ?? "GET";
    const body = options.body;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": this.config.userAgent,
      "X-Redmine-API-Key": this.config.apiKey,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const init: RequestInit & { dispatcher?: Dispatcher } = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.requestTimeoutMs),
    };
    if (body !== undefined) init.body = body;
    if (this.dispatcher) init.dispatcher = this.dispatcher;
    return fetch(url, init);
  }
```

2. Update `getJson` loop to call `this.request(url)` (GET default).

3. Add single-shot mutators:

```typescript
  async postJson<T>(path: string, payload: unknown): Promise<T> {
    return this.sendJson<T>(path, "POST", payload);
  }

  async putJson<T>(path: string, payload: unknown): Promise<T> {
    return this.sendJson<T>(path, "PUT", payload);
  }

  private async sendJson<T>(
    path: string,
    method: "POST" | "PUT",
    payload: unknown
  ): Promise<T> {
    const url = this.buildUrl(path);
    try {
      const response = await this.request(url, {
        method,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const bodyText = await response.text();
        this.mapStatus(response.status, bodyText);
      }
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof RedmineError) throw this.maskError(err);
      throw this.mapNetworkError(err);
    }
  }
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter redmine-devrelay-client exec vitest run tests/http.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/redmine-client/src/http.ts packages/redmine-client/tests/http.test.ts
git commit -m "feat(client): add non-retrying postJson and putJson"
```

---

### Task 2: Client write methods

**Files:**
- Create: `packages/redmine-client/src/writes.ts`
- Create: `packages/redmine-client/tests/writes.test.ts`
- Modify: `packages/redmine-client/src/types.ts`
- Modify: `packages/redmine-client/src/client.ts`
- Modify: `packages/redmine-client/src/index.ts`
- Modify: `packages/redmine-client/src/http.ts` (`mapStatus` 404 → prefer `REDMINE_ISSUE_NOT_FOUND` when path matches `/issues/`)

- [ ] **Step 1: Add types**

In `types.ts`:

```typescript
export type CreateIssueInput = {
  projectId: number;
  subject: string;
  description?: string;
  trackerId?: number;
  priorityId?: number;
  assignedTo?: "me" | number;
};

export type CreateIssueResult = {
  id: number;
  subject: string;
  project: { id: number; name: string } | null;
  status: { id: number; name: string } | null;
};

export type AddCommentResult = {
  issueId: number;
  updated: true;
};

export type UpdateStatusResult = {
  issueId: number;
  status: { id: number; name: string } | null;
};
```

- [ ] **Step 2: Write failing writes.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedmineClient } from "../src/client.js";
import { RedmineHttp } from "../src/http.js";
import type { RedmineConfig } from "../src/config.js";

const config: RedmineConfig = {
  baseUrl: "https://redmine.example.com",
  apiKey: "k",
  connectTimeoutMs: 5000,
  requestTimeoutMs: 15000,
  maxResultCount: 100,
  logLevel: "info",
  userAgent: "redmine-mcp/0.2.0",
};

describe("write methods", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("createIssue POSTs issue payload", async () => {
    const postJson = vi.fn().mockResolvedValue({
      issue: {
        id: 42,
        subject: "Bug",
        project: { id: 1, name: "P" },
        status: { id: 1, name: "New" },
      },
    });
    const http = { postJson, putJson: vi.fn() } as unknown as RedmineHttp;
    const client = new RedmineClient(http, config);
    const result = await client.createIssue({
      projectId: 1,
      subject: "Bug",
      description: "d",
      assignedTo: "me",
    });
    expect(postJson).toHaveBeenCalledWith("/issues.json", {
      issue: {
        project_id: 1,
        subject: "Bug",
        description: "d",
        assigned_to_id: "me",
      },
    });
    expect(result.id).toBe(42);
  });

  it("addComment PUTs notes", async () => {
    const putJson = vi.fn().mockResolvedValue({});
    const http = { postJson: vi.fn(), putJson } as unknown as RedmineHttp;
    const client = new RedmineClient(http, config);
    await client.addComment(7, "hello");
    expect(putJson).toHaveBeenCalledWith("/issues/7.json", {
      issue: { notes: "hello" },
    });
  });

  it("updateIssueStatus PUTs status_id and optional notes", async () => {
    const putJson = vi.fn().mockResolvedValue({
      issue: { id: 7, status: { id: 4, name: "Test" } },
    });
    const http = { postJson: vi.fn(), putJson } as unknown as RedmineHttp;
    const client = new RedmineClient(http, config);
    const result = await client.updateIssueStatus(7, 4, "done");
    expect(putJson).toHaveBeenCalledWith("/issues/7.json", {
      issue: { status_id: 4, notes: "done" },
    });
    expect(result.status?.id).toBe(4);
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

```bash
pnpm --filter redmine-devrelay-client exec vitest run tests/writes.test.ts
```

- [ ] **Step 4: Implement writes.ts + client methods**

`packages/redmine-client/src/writes.ts`:

```typescript
import type { RedmineHttp } from "./http.js";
import type {
  AddCommentResult,
  CreateIssueInput,
  CreateIssueResult,
  UpdateStatusResult,
} from "./types.js";

type RawIssue = {
  issue: {
    id: number;
    subject?: string;
    project?: { id: number; name: string } | null;
    status?: { id: number; name: string } | null;
  };
};

export async function createIssue(
  http: RedmineHttp,
  input: CreateIssueInput
): Promise<CreateIssueResult> {
  const issue: Record<string, unknown> = {
    project_id: input.projectId,
    subject: input.subject,
  };
  if (input.description !== undefined) issue.description = input.description;
  if (input.trackerId !== undefined) issue.tracker_id = input.trackerId;
  if (input.priorityId !== undefined) issue.priority_id = input.priorityId;
  if (input.assignedTo !== undefined) issue.assigned_to_id = input.assignedTo;

  const data = await http.postJson<RawIssue>("/issues.json", { issue });
  return {
    id: data.issue.id,
    subject: data.issue.subject ?? input.subject,
    project: data.issue.project ?? null,
    status: data.issue.status ?? null,
  };
}

export async function addComment(
  http: RedmineHttp,
  issueId: number,
  notes: string
): Promise<AddCommentResult> {
  await http.putJson(`/issues/${issueId}.json`, { issue: { notes } });
  return { issueId, updated: true };
}

export async function updateIssueStatus(
  http: RedmineHttp,
  issueId: number,
  statusId: number,
  notes?: string
): Promise<UpdateStatusResult> {
  const issue: Record<string, unknown> = { status_id: statusId };
  if (notes !== undefined) issue.notes = notes;
  const data = await http.putJson<RawIssue>(`/issues/${issueId}.json`, {
    issue,
  });
  return {
    issueId,
    status: data.issue?.status ?? { id: statusId, name: String(statusId) },
  };
}
```

Wire on `RedmineClient`:

```typescript
  createIssue(input: CreateIssueInput) {
    return createIssue(this.http, input);
  }
  addComment(issueId: number, notes: string) {
    return addComment(this.http, issueId, notes);
  }
  updateIssueStatus(issueId: number, statusId: number, notes?: string) {
    return updateIssueStatus(this.http, issueId, statusId, notes);
  }
```

Export types from `index.ts`.

In `mapStatus`, if `status === 404` and caller path includes issues, throw `REDMINE_ISSUE_NOT_FOUND`. Simplest approach: change default 404 code to `REDMINE_ISSUE_NOT_FOUND` when message/path is issue-related — pass optional context into `mapStatus` from `sendJson`/`getJson`, or map 404 to `REDMINE_ISSUE_NOT_FOUND` always for mutating issue URLs inside `sendJson` by checking `path.includes("/issues/")`.

- [ ] **Step 5: Run writes + http tests — PASS**

```bash
pnpm --filter redmine-devrelay-client exec vitest run tests/writes.test.ts tests/http.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/redmine-client
git commit -m "feat(client): add createIssue, addComment, updateIssueStatus"
```

---

### Task 3: MCP write schemas

**Files:**
- Modify: `packages/redmine-mcp/src/tools/schemas.ts`
- Modify: `packages/redmine-mcp/tests/schemas.test.ts`

- [ ] **Step 1: Failing schema tests**

```typescript
  it("createIssue requires projectId and subject", () => {
    expect(safeParseCreateIssue({}).success).toBe(false);
    expect(
      safeParseCreateIssue({ projectId: 1, subject: "x" }).success
    ).toBe(true);
  });

  it("addComment requires notes", () => {
    expect(safeParseAddComment({ issueId: 1 }).success).toBe(false);
    expect(
      safeParseAddComment({ issueId: 1, notes: "n", confirm: true }).success
    ).toBe(true);
  });

  it("updateStatus requires statusId", () => {
    expect(safeParseUpdateStatus({ issueId: 1 }).success).toBe(false);
    expect(
      safeParseUpdateStatus({ issueId: 1, statusId: 4 }).success
    ).toBe(true);
  });
```

- [ ] **Step 2: Run — FAIL**

```bash
pnpm --filter redmine-devrelay exec vitest run tests/schemas.test.ts
```

- [ ] **Step 3: Add zod schemas**

```typescript
export const createIssueInputSchema = z
  .object({
    projectId: positiveInt,
    subject: z.string().min(1),
    description: z.string().optional(),
    trackerId: positiveInt.optional(),
    priorityId: positiveInt.optional(),
    assignedTo: z.union([z.literal("me"), positiveInt]).optional(),
    confirm: z.boolean().optional(),
  })
  .strict();

export const addCommentInputSchema = z
  .object({
    issueId: positiveInt,
    notes: z.string().min(1),
    confirm: z.boolean().optional(),
  })
  .strict();

export const updateStatusInputSchema = z
  .object({
    issueId: positiveInt,
    statusId: positiveInt,
    notes: z.string().optional(),
    confirm: z.boolean().optional(),
  })
  .strict();
```

Add `safeParse*` helpers and entries on `toolJsonSchemas` via `zodToJsonSchema` (same pattern as existing tools — copy how `redmine_get_issue` is registered in this file).

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/redmine-mcp/src/tools/schemas.ts packages/redmine-mcp/tests/schemas.test.ts
git commit -m "feat(mcp): add zod schemas for write tools"
```

---

### Task 4: MCP write handlers + confirm gate

**Files:**
- Create: `packages/redmine-mcp/src/tools/writes.ts`
- Create: `packages/redmine-mcp/tests/tools.writes.test.ts`

- [ ] **Step 1: Failing handler tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  handleCreateIssue,
  handleAddComment,
  handleUpdateStatus,
} from "../src/tools/writes.js";

describe("write handlers confirm gate", () => {
  it("createIssue dry-run does not call client", async () => {
    const createIssue = vi.fn();
    const result = await handleCreateIssue(
      { createIssue } as never,
      { projectId: 1, subject: "S", confirm: false }
    );
    expect(createIssue).not.toHaveBeenCalled();
    expect(result).toEqual({
      dryRun: true,
      wouldApply: {
        projectId: 1,
        subject: "S",
      },
    });
  });

  it("createIssue confirm calls client", async () => {
    const createIssue = vi.fn().mockResolvedValue({ id: 5, subject: "S" });
    const result = await handleCreateIssue(
      { createIssue } as never,
      { projectId: 1, subject: "S", confirm: true }
    );
    expect(createIssue).toHaveBeenCalled();
    expect(result.dryRun).toBe(false);
    expect(result.result).toEqual({ id: 5, subject: "S" });
  });

  it("addComment dry-run skips client", async () => {
    const addComment = vi.fn();
    await handleAddComment(
      { addComment } as never,
      { issueId: 1, notes: "n" }
    );
    expect(addComment).not.toHaveBeenCalled();
  });

  it("updateStatus confirm calls client", async () => {
    const updateIssueStatus = vi
      .fn()
      .mockResolvedValue({ issueId: 1, status: { id: 4, name: "T" } });
    const result = await handleUpdateStatus(
      { updateIssueStatus } as never,
      { issueId: 1, statusId: 4, confirm: true }
    );
    expect(updateIssueStatus).toHaveBeenCalledWith(1, 4, undefined);
    expect(result.dryRun).toBe(false);
  });
});
```

- [ ] **Step 2: Run — FAIL**

```bash
pnpm --filter redmine-devrelay exec vitest run tests/tools.writes.test.ts
```

- [ ] **Step 3: Implement handlers**

```typescript
import type { RedmineClient } from "redmine-devrelay-client";
import type {
  AddCommentInput,
  CreateIssueInput,
  UpdateStatusInput,
} from "./schemas.js";

export async function handleCreateIssue(
  client: RedmineClient,
  input: CreateIssueInput
) {
  const wouldApply = {
    projectId: input.projectId,
    subject: input.subject,
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.trackerId !== undefined ? { trackerId: input.trackerId } : {}),
    ...(input.priorityId !== undefined ? { priorityId: input.priorityId } : {}),
    ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo } : {}),
  };
  if (!input.confirm) {
    return { dryRun: true as const, wouldApply };
  }
  const result = await client.createIssue(wouldApply);
  return { dryRun: false as const, result };
}

export async function handleAddComment(
  client: RedmineClient,
  input: AddCommentInput
) {
  const wouldApply = { issueId: input.issueId, notes: input.notes };
  if (!input.confirm) {
    return { dryRun: true as const, wouldApply };
  }
  const result = await client.addComment(input.issueId, input.notes);
  return { dryRun: false as const, result };
}

export async function handleUpdateStatus(
  client: RedmineClient,
  input: UpdateStatusInput
) {
  const wouldApply = {
    issueId: input.issueId,
    statusId: input.statusId,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
  if (!input.confirm) {
    return { dryRun: true as const, wouldApply };
  }
  const result = await client.updateIssueStatus(
    input.issueId,
    input.statusId,
    input.notes
  );
  return { dryRun: false as const, result };
}
```

Export input types from schemas (`export type CreateIssueInput = z.infer<...>` etc.).

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/redmine-mcp/src/tools/writes.ts packages/redmine-mcp/tests/tools.writes.test.ts packages/redmine-mcp/src/tools/schemas.ts
git commit -m "feat(mcp): add write handlers with confirm dry-run gate"
```

---

### Task 5: Wire server, audit dryRun, instructions

**Files:**
- Modify: `packages/redmine-mcp/src/server.ts`
- Modify: `packages/redmine-mcp/src/logging.ts`
- Modify: `packages/redmine-mcp/package.json` (version hint later; server name version string → `0.2.0`)

- [ ] **Step 1: Extend logAudit**

```typescript
export function logAudit(entry: {
  tool: string;
  host: string;
  userId?: number;
  ok: boolean;
  httpStatus?: number;
  durationMs: number;
  errorCode?: string;
  dryRun?: boolean;
}): void {
```

- [ ] **Step 2: Update INSTRUCTIONS and TOOLS**

```typescript
const INSTRUCTIONS = `Redmine read tools may be used without write confirmation.
Write tools (redmine_create_issue, redmine_add_comment, redmine_update_status) default to dry-run.
Only pass confirm=true after the user explicitly approves the dry-run preview.
Do not print API keys or credentials.
Do not invent write operations beyond the three write tools.
Prefer redmine_search_issues with assignedTo=me for "my open issues".`;
```

Register three tools with schemas from `toolJsonSchemas`.

In switch, add cases; when logging success for write tools, set `dryRun: Boolean(result && typeof result === "object" && "dryRun" in result && (result as {dryRun:boolean}).dryRun)`.

Bump server version metadata to `0.2.0`.

- [ ] **Step 3: Build + full package tests**

```bash
pnpm --filter redmine-devrelay-client build
pnpm --filter redmine-devrelay build
pnpm --filter redmine-devrelay-client test
pnpm --filter redmine-devrelay test
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/redmine-mcp
git commit -m "feat(mcp): register write tools and update server instructions"
```

---

### Task 6: Cursor / Claude / Codex skills and slash commands

**Files:**
- Create: `plugins/cursor/commands/create-issue.md`, `add-comment.md`, `update-status.md`
- Create: `plugins/cursor/skills/create-issue/SKILL.md`, `add-comment/SKILL.md`, `update-status/SKILL.md`
- Modify: `plugins/cursor/commands/help.md`, `plugins/cursor/skills/help/SKILL.md`
- Mirror skills under `plugins/claude-code/skills/` and `plugins/codex/skills/`
- Modify: plugin READMEs + `plugins/cursor/.cursor-plugin/plugin.json` description

- [ ] **Step 1: Write create-issue skill (Cursor)**

`plugins/cursor/skills/create-issue/SKILL.md`:

```markdown
---
name: create-issue
description: Create a Redmine issue after dry-run confirmation
---

# Create Redmine issue

1. Resolve `projectId`: if user gave a name, call `redmine_list_projects` and pick best match (ask if ambiguous). Never create without projectId.
2. Call `redmine_create_issue` with `confirm` omitted/false. Show `wouldApply` to the user.
3. Only after explicit user approval, call again with `confirm: true`.
4. Never print API keys. Do not set confirm=true on the first call.
```

Command file `plugins/cursor/commands/create-issue.md`:

```markdown
---
description: Redmine 이슈 생성 (dry-run 후 확인)
---

Use the **create-issue** skill. Resolve project, dry-run, then confirm=true only after user OK.
```

- [ ] **Step 2: add-comment + update-status skills/commands**

Same pattern: dry-run first; `update-status` requires numeric `statusId`.

- [ ] **Step 3: Update help tables** to include the three write commands and note: “쓰기 명령은 dry-run 후 확인 필요”.

- [ ] **Step 4: Mirror for Claude (`/redmine:…`) and Codex skills**

- [ ] **Step 5: Commit**

```bash
git add plugins
git commit -m "feat(plugins): add write slash skills and update help"
```

---

### Task 7: Docs + version 0.2.0 + mcp.json pins

**Files:**
- Modify: `packages/redmine-client/package.json` → `"version": "0.2.0"`
- Modify: `packages/redmine-mcp/package.json` → `"version": "0.2.0"`
- Modify: `plugins/claude-code/.mcp.json`, `plugins/codex/.mcp.json`, `plugins/cursor/mcp.json` → `redmine-devrelay@0.2.0`
- Modify: `README.md`, `docs/installation.md`, `docs/security.md` (write + confirm note)
- Modify: `.cursor-plugin/marketplace.json` description if needed

- [ ] **Step 1: Bump versions and pins**

- [ ] **Step 2: README short Phase 2 section** listing write tools + confirm

- [ ] **Step 3: security.md** — write tools require confirm; audit never logs notes/bodies

- [ ] **Step 4: Commit**

```bash
git add packages/*/package.json plugins README.md docs/installation.md docs/security.md .cursor-plugin
git commit -m "chore: bump redmine-devrelay to 0.2.0 and document Phase 2 writes"
```

---

### Task 8: Publish npm 0.2.0 (manual gate)

- [ ] **Step 1: Ensure Node 20+** (`node -v`)

- [ ] **Step 2: Publish client then mcp**

```bash
pnpm --filter redmine-devrelay-client publish --access public --no-git-checks
pnpm --filter redmine-devrelay publish --access public --no-git-checks
npm view redmine-devrelay version
```

Expected: `0.2.0` with dependency `redmine-devrelay-client@0.2.0`.

- [ ] **Step 3: Optional smoke** — Node 22+, env with Redmine, call `redmine_create_issue` with `confirm:false` via local dist (must not create issue).

---

## Spec coverage checklist

| Spec item | Task |
| --- | --- |
| create / comment / status tools | 3–5 |
| confirm dry-run gate | 4–5 |
| statusId only | 3–4, 6 |
| projectId required + name resolve in skill | 3, 6 |
| no POST/PUT retry | 1 |
| audit without bodies | 5, 7 |
| slash + help | 6 |
| npm 0.2.0 | 7–8 |
| out of scope (attachments, status names, etc.) | not scheduled |

## Placeholder / consistency self-review

- No TBD steps; method names `createIssue` / `addComment` / `updateIssueStatus` consistent across tasks.
- Package filter names: `redmine-devrelay-client` / `redmine-devrelay` (published names; folder paths remain `packages/redmine-client` / `packages/redmine-mcp`).

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-13-redmine-mcp-phase2-write.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session with executing-plans and checkpoints  

Which approach?
