# Redmine MCP Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let agents attach local files on issue create and via a new `redmine_add_attachment` tool, with confirm-gated uploads, shipping as `0.4.0`.

**Architecture:** Client validates/reads local files and `POST /uploads.json` for tokens; create/add attach issue bodies with `uploads[]`. MCP never uploads on dry-run—only inspects path/filename/sizeBytes for previews. Confirm uploads all tokens first, then create issue or PUT attachments (stop before issue write if any upload fails).

**Tech Stack:** Node 20+, pnpm, TypeScript, Vitest, Zod, MCP SDK, undici/`fetch` for binary POST.

**Spec:** `docs/superpowers/specs/2026-07-14-redmine-mcp-attachments-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/redmine-client/src/attachments.ts` | Inspect + upload helpers; size/count limits |
| `packages/redmine-client/src/types.ts` | Attachment + upload result types; create `uploads` |
| `packages/redmine-client/src/http.ts` | `postBinary` (no JSON retry); empty PUT/POST body safe parse |
| `packages/redmine-client/src/writes.ts` | `createIssue` `uploads`; `addIssueAttachments` |
| `packages/redmine-client/src/client.ts` | Expose `uploadFile`, `addIssueAttachments` |
| `packages/redmine-client/src/index.ts` | Re-exports |
| `packages/redmine-client/tests/attachments.test.ts` | Validation + upload request shape |
| `packages/redmine-client/tests/writes.test.ts` | Create/add with `uploads` |
| `packages/redmine-client/tests/http.test.ts` | Empty success body does not throw |
| `packages/redmine-mcp/src/tools/schemas.ts` | Attachment zod + create + addAttachment |
| `packages/redmine-mcp/src/tools/writes.ts` | Preview inspect; confirm upload+write |
| `packages/redmine-mcp/src/server.ts` | Register `redmine_add_attachment` |
| `packages/redmine-mcp/tests/schemas.test.ts` | Schema coverage |
| `packages/redmine-mcp/tests/tools.writes.test.ts` | Dry-run no upload; confirm calls |
| `plugins/*/skills/create-issue`, `add-attachment`, `help` | UX |
| `plugins/cursor/commands/add-attachment.md` | Slash |
| `packages/*/package.json`, READMEs, `docs/installation.md`, mcp pins | `0.4.0` |

---

### Task 1: HTTP empty body + `postBinary`

**Files:**
- Modify: `packages/redmine-client/src/http.ts`
- Modify: `packages/redmine-client/tests/http.test.ts`

- [ ] **Step 1: Failing test — empty 200 body**

```typescript
it("putJson returns undefined on empty 200 body", async () => {
  // mock fetch Response: ok, status 200, text() => ""
  // expect(await http.putJson("/issues/1.json", { issue: {} })).toBeUndefined();
});
```

- [ ] **Step 2: Fix `sendJson` parse**

After `response.ok`, if status is 204 **or** body text is empty/whitespace, return `undefined` instead of `response.json()`.

```typescript
const bodyText = await response.text();
if (response.status === 204 || !bodyText.trim()) {
  return undefined;
}
return JSON.parse(bodyText) as T;
```

(Keep existing error mapping for non-ok using `bodyText`.)

- [ ] **Step 3: Add `postBinary`**

```typescript
async postBinary<T>(
  path: string,
  body: Buffer | Uint8Array,
  headers: Record<string, string>,
  query?: Record<string, string | number | undefined>
): Promise<T> {
  // GET-style buildUrl with query; request POST with body Buffer
  // NO automatic retries (mutating)
  // parse JSON response; throw RedmineError on !ok
}
```

Wire `request()` to accept `BodyInit` / `Buffer` without forcing `Content-Type: application/json` when custom headers set Content-Type.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter redmine-devrelay-client test
```

Expected: PASS including new empty-body case.

- [ ] **Step 5: Commit**

```bash
git add packages/redmine-client/src/http.ts packages/redmine-client/tests/http.test.ts
git commit -m "fix(client): tolerate empty write responses and add postBinary"
```

---

### Task 2: Attachment inspect + upload

**Files:**
- Create: `packages/redmine-client/src/attachments.ts`
- Modify: `packages/redmine-client/src/types.ts`
- Modify: `packages/redmine-client/src/index.ts`
- Create: `packages/redmine-client/tests/attachments.test.ts`

- [ ] **Step 1: Types**

```typescript
export type AttachmentInput = {
  path: string;
  filename?: string;
  description?: string;
};

export type AttachmentPreview = {
  path: string;
  filename: string;
  sizeBytes: number;
  description?: string;
};

export type UploadedAttachment = {
  token: string;
  filename: string;
  description?: string;
  sizeBytes: number;
};

export const ATTACHMENT_MAX_FILES = 5;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MiB
```

- [ ] **Step 2: Failing tests**

```typescript
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  inspectAttachments,
  uploadFile,
  ATTACHMENT_MAX_BYTES,
} from "../src/attachments.js";

it("inspectAttachments returns basename and size", () => {
  const dir = mkdtempSync(join(tmpdir(), "rd-"));
  const p = join(dir, "a.txt");
  writeFileSync(p, "hello");
  const previews = inspectAttachments([{ path: p }]);
  expect(previews[0]).toMatchObject({
    filename: "a.txt",
    sizeBytes: 5,
  });
  rmSync(dir, { recursive: true });
});

it("inspectAttachments rejects more than 5 files", () => {
  expect(() =>
    inspectAttachments(
      Array.from({ length: 6 }, (_, i) => ({ path: `/nope/${i}` })),
    ),
  ).toThrow(/5/);
});

it("uploadFile POSTs octet-stream with filename query", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rd-"));
  const p = join(dir, "shot.png");
  writeFileSync(p, Buffer.from([1, 2, 3]));
  const postBinary = vi.fn().mockResolvedValue({
    upload: { token: "tok.1", id: 1 },
  });
  const http = { postBinary } as unknown as RedmineHttp;
  const out = await uploadFile(http, { path: p });
  expect(postBinary).toHaveBeenCalledWith(
    "/uploads.json",
    expect.any(Buffer),
    expect.objectContaining({
      "Content-Type": "application/octet-stream",
    }),
    { filename: "shot.png" },
  );
  expect(out.token).toBe("tok.1");
  rmSync(dir, { recursive: true });
});
```

- [ ] **Step 3: Implement `attachments.ts`**

```typescript
import { readFileSync, realpathSync, statSync } from "node:fs";
import { basename } from "node:path";
import { RedmineError } from "./errors.js";
import type { RedmineHttp } from "./http.js";
import type {
  AttachmentInput,
  AttachmentPreview,
  UploadedAttachment,
} from "./types.js";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_FILES } from "./types.js";

export function inspectAttachments(
  inputs: AttachmentInput[],
): AttachmentPreview[] {
  if (inputs.length === 0) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: "attachments must be a non-empty array when provided",
      check: ["Pass at least one attachment"],
    });
  }
  if (inputs.length > ATTACHMENT_MAX_FILES) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `At most ${ATTACHMENT_MAX_FILES} attachments per request`,
      check: [`Reduce attachments to ≤ ${ATTACHMENT_MAX_FILES}`],
    });
  }
  return inputs.map((input) => {
    let resolved: string;
    try {
      resolved = realpathSync(input.path);
    } catch {
      throw new RedmineError({
        code: "REDMINE_VALIDATION_ERROR",
        message: `Attachment not found: ${basename(input.path)}`,
        check: ["Check the file path exists on the MCP host"],
      });
    }
    const st = statSync(resolved);
    if (!st.isFile()) {
      throw new RedmineError({
        code: "REDMINE_VALIDATION_ERROR",
        message: `Attachment is not a regular file: ${basename(resolved)}`,
        check: ["Pass a file path, not a directory"],
      });
    }
    if (st.size > ATTACHMENT_MAX_BYTES) {
      throw new RedmineError({
        code: "REDMINE_VALIDATION_ERROR",
        message: `Attachment exceeds ${ATTACHMENT_MAX_BYTES} bytes: ${basename(resolved)}`,
        check: ["Use a smaller file (max 10 MiB)"],
      });
    }
    const filename = input.filename?.trim() || basename(resolved);
    return {
      path: resolved,
      filename,
      sizeBytes: st.size,
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
    };
  });
}

export async function uploadFile(
  http: RedmineHttp,
  input: AttachmentInput,
): Promise<UploadedAttachment> {
  const [preview] = inspectAttachments([input]);
  const buf = readFileSync(preview.path);
  const data = await http.postBinary<{ upload: { token: string } }>(
    "/uploads.json",
    buf,
    { "Content-Type": "application/octet-stream" },
    { filename: preview.filename },
  );
  if (!data?.upload?.token) {
    throw new RedmineError({
      code: "REDMINE_UNKNOWN_ERROR",
      message: "Redmine upload returned no token",
      check: ["Retry upload", "Check Redmine file size limits"],
    });
  }
  return {
    token: data.upload.token,
    filename: preview.filename,
    sizeBytes: preview.sizeBytes,
    ...(preview.description !== undefined
      ? { description: preview.description }
      : {}),
  };
}

export async function uploadAttachments(
  http: RedmineHttp,
  inputs: AttachmentInput[],
): Promise<UploadedAttachment[]> {
  const previews = inspectAttachments(inputs);
  const out: UploadedAttachment[] = [];
  for (const p of previews) {
    out.push(
      await uploadFile(http, {
        path: p.path,
        filename: p.filename,
        description: p.description,
      }),
    );
  }
  return out;
}
```

Note: `inspectAttachments` used for dry-run may be called with optional create attachments that are empty — MCP should skip inspect when `attachments` omitted; when present require length ≥ 1 (schema `.min(1)`).

Adjust empty-array rule: **schema** enforces min 1 when field present; `inspectAttachments` can allow empty only if never called that way — keep throw on empty for safety.

- [ ] **Step 4: Export from `index.ts`**

Export `inspectAttachments`, `uploadFile`, `uploadAttachments`, types, constants.

- [ ] **Step 5: Run tests + commit**

```bash
pnpm --filter redmine-devrelay-client test
git add packages/redmine-client/src/attachments.ts packages/redmine-client/src/types.ts packages/redmine-client/src/index.ts packages/redmine-client/tests/attachments.test.ts
git commit -m "feat(client): inspect and upload Redmine attachments"
```

---

### Task 3: createIssue uploads + addIssueAttachments

**Files:**
- Modify: `packages/redmine-client/src/types.ts` (`CreateIssueInput.uploads?`)
- Modify: `packages/redmine-client/src/writes.ts`
- Modify: `packages/redmine-client/src/client.ts`
- Modify: `packages/redmine-client/tests/writes.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
it("createIssue includes uploads tokens", async () => {
  const postJson = vi.fn().mockResolvedValue({
    issue: { id: 1, subject: "S", project: null, status: null },
  });
  const http = { postJson, putJson: vi.fn() } as unknown as RedmineHttp;
  const client = new RedmineClient(http, config);
  await client.createIssue({
    projectId: 1,
    subject: "S",
    uploads: [{ token: "t1", filename: "a.txt", description: "d" }],
  });
  expect(postJson).toHaveBeenCalledWith("/issues.json", {
    issue: expect.objectContaining({
      uploads: [{ token: "t1", filename: "a.txt", description: "d" }],
    }),
  });
});

it("addIssueAttachments PUTs uploads", async () => {
  const putJson = vi.fn().mockResolvedValue(undefined);
  const http = { postJson: vi.fn(), putJson } as unknown as RedmineHttp;
  const client = new RedmineClient(http, config);
  await client.addIssueAttachments({
    issueId: 7,
    uploads: [{ token: "t2", filename: "b.png" }],
  });
  expect(putJson).toHaveBeenCalledWith("/issues/7.json", {
    issue: { uploads: [{ token: "t2", filename: "b.png" }] },
  });
});
```

- [ ] **Step 2: Implement**

In `createIssue`, if `input.uploads?.length`, set `issue.uploads` to mapped `{ token, filename, description? }`.

```typescript
export type AddIssueAttachmentsInput = {
  issueId: number;
  uploads: Array<{ token: string; filename: string; description?: string }>;
};

export async function addIssueAttachments(
  http: RedmineHttp,
  input: AddIssueAttachmentsInput,
): Promise<{ issueId: number; uploadedCount: number }> {
  await http.putJson(`/issues/${input.issueId}.json`, {
    issue: {
      uploads: input.uploads.map((u) => ({
        token: u.token,
        filename: u.filename,
        ...(u.description !== undefined ? { description: u.description } : {}),
      })),
    },
  });
  return { issueId: input.issueId, uploadedCount: input.uploads.length };
}
```

Expose on `RedmineClient`. Prefer path-based upload at MCP; client create accepts **tokens only**.

- [ ] **Step 3: Test + commit**

```bash
pnpm --filter redmine-devrelay-client test
git commit -m "feat(client): attach upload tokens on create and addIssueAttachments"
```

---

### Task 4: MCP schemas

**Files:**
- Modify: `packages/redmine-mcp/src/tools/schemas.ts`
- Modify: `packages/redmine-mcp/tests/schemas.test.ts`

- [ ] **Step 1: Attachment zod**

```typescript
export const attachmentInputSchema = z
  .object({
    path: z.string().min(1),
    filename: z.string().min(1).optional(),
    description: z.string().optional(),
  })
  .strict();

const attachmentsField = z
  .array(attachmentInputSchema)
  .min(1)
  .max(5)
  .optional();
```

Add `attachments: attachmentsField` to `createIssueInputSchema`.

```typescript
export const addAttachmentInputSchema = z
  .object({
    issueId: positiveInt,
    attachments: z.array(attachmentInputSchema).min(1).max(5),
    confirm: z.boolean().optional(),
  })
  .strict();
```

Add JSON Schema fragments for MCP tool registration (`addAttachmentJsonSchema`) mirroring other tools; include `attachments` on create JSON schema.

- [ ] **Step 2: Tests**

```typescript
it("createIssue accepts attachments", () => {
  expect(
    parseCreateIssueInput({
      projectId: 1,
      subject: "S",
      attachments: [{ path: "C:/tmp/a.png", filename: "a.png" }],
    }).success,
  ).toBe(true);
});

it("addAttachment requires attachments", () => {
  expect(parseAddAttachmentInput({ issueId: 1 }).success).toBe(false);
});
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mcp): schemas for create/add attachments"
```

---

### Task 5: MCP handlers + server wire-up

**Files:**
- Modify: `packages/redmine-mcp/src/tools/writes.ts`
- Modify: `packages/redmine-mcp/src/server.ts`
- Modify: `packages/redmine-mcp/tests/tools.writes.test.ts`

- [ ] **Step 1: Helper in writes.ts**

```typescript
import {
  inspectAttachments,
  uploadAttachments,
} from "redmine-devrelay-client";

function attachmentWouldApply(attachments: AttachmentInput[] | undefined) {
  if (!attachments?.length) return undefined;
  return inspectAttachments(attachments).map((a) => ({
    path: a.path,
    filename: a.filename,
    sizeBytes: a.sizeBytes,
    ...(a.description !== undefined ? { description: a.description } : {}),
  }));
}
```

- [ ] **Step 2: Extend `handleCreateIssue`**

Dry-run: include `attachments: attachmentWouldApply(input.attachments)` in `wouldApply` (call inspect even on dry-run so missing files fail early).

Confirm:

```typescript
let uploads;
if (input.attachments?.length) {
  uploads = await uploadAttachments(client["http"] /* BAD */);
}
```

**Do not** reach into private http. Instead add client methods:

```typescript
// client.ts
inspectAttachments(inputs: AttachmentInput[]) {
  return inspectAttachments(inputs);
}
uploadAttachments(inputs: AttachmentInput[]) {
  return uploadAttachments(this.http, inputs);
}
```

Confirm create:

```typescript
const uploads = input.attachments?.length
  ? await client.uploadAttachments(input.attachments)
  : undefined;
const result = await client.createIssue({
  ...createInput,
  ...(uploads
    ? {
        uploads: uploads.map((u) => ({
          token: u.token,
          filename: u.filename,
          description: u.description,
        })),
      }
    : {}),
});
```

- [ ] **Step 3: `handleAddAttachment`**

```typescript
export async function handleAddAttachment(client, input) {
  const preview = inspectAttachments(input.attachments).map(...);
  if (!input.confirm) {
    return { dryRun: true, wouldApply: { issueId: input.issueId, attachments: preview } };
  }
  const uploads = await client.uploadAttachments(input.attachments);
  const result = await client.addIssueAttachments({
    issueId: input.issueId,
    uploads: uploads.map((u) => ({
      token: u.token,
      filename: u.filename,
      description: u.description,
    })),
  });
  return { dryRun: false, result };
}
```

- [ ] **Step 4: Register tool on server**

Name: `redmine_add_attachment`. Description mentions dry-run + confirm. Update server instructions text to list the new write tool.

- [ ] **Step 5: Handler tests**

```typescript
it("createIssue dry-run includes attachment sizes and does not upload", async () => {
  // mock client.inspectAttachments / uploadAttachments / createIssue
  // confirm false → uploadAttachments not called
});

it("addAttachment confirm uploads then addIssueAttachments", async () => {
  // uploadAttachments called then addIssueAttachments
});
```

- [ ] **Step 6: Run all MCP tests + commit**

```bash
pnpm --filter redmine-devrelay test
git commit -m "feat(mcp): create/add attachment tools with confirm gate"
```

---

### Task 6: Plugins / skills / docs / version 0.4.0

**Files:**
- Modify: `plugins/*/skills/create-issue/SKILL.md`
- Create: `plugins/*/skills/add-attachment/SKILL.md` (cursor, claude-code, codex)
- Modify: `plugins/*/skills/help/SKILL.md`
- Create: `plugins/cursor/commands/add-attachment.md`
- Modify: READMEs, `docs/installation.md`, `plugins/*/mcp.json`, `.mcp.json`
- Modify: `packages/*/package.json` → `0.4.0`

- [ ] **Step 1: create-issue skill bullet**

Add: optional `attachments` as `{ path, filename?, description? }`; show sizes in dry-run table; do not invent uploads.

- [ ] **Step 2: add-attachment skill**

Same confirm flow as add-comment; require issueId + paths.

- [ ] **Step 3: help tables + cursor command**

- [ ] **Step 4: Bump to 0.4.0** and pin `redmine-devrelay@0.4.0` in mcp configs; update version history lines in package READMEs.

- [ ] **Step 5: Commit**

```bash
git commit -m "docs: skills and 0.4.0 pins for attachments"
```

---

### Task 7: Publish (manual gate)

- [ ] **Step 1:** Ensure clean tree; `pnpm -r test` and build
- [ ] **Step 2:** Publish client then MCP

```bash
pnpm --filter redmine-devrelay-client publish --access public --no-git-checks
pnpm --filter redmine-devrelay publish --access public --no-git-checks
npm view redmine-devrelay version
```

Expected: `0.4.0` with dependency `redmine-devrelay-client@0.4.0`.

- [ ] **Step 3:** Push commits if not already; tell user to set Cursor MCP to `@0.4.0`

---

## Spec coverage checklist

| Spec item | Task |
| --- | --- |
| `/uploads.json` then create/PUT uploads | 2–3, 5 |
| create `attachments` + `redmine_add_attachment` | 4–5 |
| `{ path, filename?, description? }` | 2, 4 |
| Dry-run metadata only | 5 |
| Max 5 / 10 MiB / regular file | 2 |
| Empty PUT body safe | 1 |
| Skills + help + 0.4.0 | 6–7 |
| No update_issue attachments / base64 | out of scope |

## Placeholder / consistency notes

- Client create accepts **upload tokens**; MCP owns paths + `uploadAttachments`.
- Constant names: `ATTACHMENT_MAX_FILES` / `ATTACHMENT_MAX_BYTES` everywhere.
- Tool name: always `redmine_add_attachment`.
