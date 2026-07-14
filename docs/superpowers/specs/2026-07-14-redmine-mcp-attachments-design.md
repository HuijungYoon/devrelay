# Redmine MCP — Issue Attachments Design

**Date:** 2026-07-14  
**Status:** Approved for implementation planning  
**Target version:** `0.4.0` (minor — new write capability)  
**Packages:** `redmine-devrelay-client`, `redmine-devrelay`

## 1. Goal

Agents can attach local files when **creating** an issue and when adding files to an **existing** issue, using the same confirm gate as other writes.

## 2. Decisions (brainstorm)

| Topic | Choice |
| --- | --- |
| Scope | Create + dedicated add tool (not every write tool) |
| Input shape | `{ path, filename?, description? }` (no base64) |
| Dry-run | Metadata only (path, filename, size); upload only on `confirm=true` |
| Approach | `attachments` on create + new `redmine_add_attachment` |

## 3. Redmine API flow

1. `POST /uploads.json` with raw file body → `{ upload: { token } }`  
   Header: `Content-Type: application/octet-stream` (filename via query/`Content-Disposition` as Redmine expects).
2. Attach tokens to issue:
   - **Create:** `POST /issues.json` with `issue.uploads: [{ token, filename, description? }, ...]`
   - **Existing:** `PUT /issues/{id}.json` with the same `uploads` array

Client must not treat empty PUT success bodies as failure (Redmine often returns 200/204 with no JSON).

## 4. MCP tools

### Shared type

```ts
type AttachmentInput = {
  path: string;          // required local filesystem path
  filename?: string;     // default: basename(path)
  description?: string;  // optional Redmine attachment description
};
```

### `redmine_create_issue`

- Add optional `attachments?: AttachmentInput[]`
- Dry-run `wouldApply` includes inspected attachment previews
- On confirm: upload all files → create issue including `uploads`

### `redmine_add_attachment` (new)

| Field | Required | Notes |
| --- | --- | --- |
| `issueId` | yes | Target issue |
| `attachments` | yes | Non-empty array |
| `confirm` | no | Default false = dry-run |

- Dry-run: `{ issueId, attachments: [{ path, filename, sizeBytes }] }`
- Confirm: upload all → single PUT with all tokens (all-or-nothing attach step)

### Not in this phase

- `redmine_update_issue` attachment field
- Base64 / in-memory bytes
- Native OS/Cursor file-picker UI
- Delete/list-only attachment tools (get_issue already supports `include=attachments`)

## 5. Validation & limits

| Rule | Value |
| --- | --- |
| Max files per request | 5 |
| Max size per file | 10 MiB |
| Path | Must resolve to an existing regular file |
| Symlinks | Resolve then require regular file; reject if missing/unsafe |

Validate **before** any upload on confirm (and on dry-run for preview). If validation fails, no uploads and no issue create/update.

## 6. Confirm gate

Unchanged product rule: dry-run by default; mutate only when `confirm=true` after user approval.

Dry-run must **not** call `/uploads.json`.

Partial failure: if upload N fails after 1..N-1 succeeded, stop; do not create issue / do not PUT remaining tokens. Document that orphan upload tokens may exist server-side until Redmine GC (acceptable for v1).

## 7. Client surface

`redmine-devrelay-client`:

- `uploadFile({ path, filename? }) → { token, filename, sizeBytes }`
- `createIssue` accepts optional attachment inputs (or pre-uploaded tokens — prefer path inputs at MCP layer, tokens at low-level write)
- `addIssueAttachments({ issueId, uploads: [{ token, filename, description? }] })` or fold into `updateIssue`

Prefer MCP reading paths + calling client `uploadFile` then create/update with tokens so tests can mock HTTP clearly.

## 8. Plugins / skills

- Update `create-issue` skill: optional attachments; show sizes in preview table
- Add `add-attachment` skill (Cursor / Claude / Codex)
- `/help` lists new command
- Pin MCP package to `0.4.0` after publish

## 9. Security & logging

- Do not log file contents or API keys
- Audit may log tool name, file count, total bytes, paths **basename only** (optional: omit full paths in logs)
- No path traversal into reading non-files; reject directories

## 10. Testing

- Unit: size/count/path validation; dry-run never uploads
- Unit: upload request shape; create/update body includes `uploads`
- Unit: empty PUT body does not throw
- Optional integration: attach small fixture file on Docker/LAN Redmine

## 11. Rollout

1. Client upload + create/add attach
2. MCP schemas + handlers + tests
3. Skills + README + installation pin
4. Publish `0.4.0` (client then MCP)
5. Point plugin `mcp.json` at `@0.4.0`

## 12. Success examples

- “이슈 만들고 `C:/tmp/a.png` 첨부해줘” → dry-run with size → OK → create with attachment
- “#23864에 `./log.txt` 붙여줘” → `redmine_add_attachment` dry-run → OK → upload + PUT
