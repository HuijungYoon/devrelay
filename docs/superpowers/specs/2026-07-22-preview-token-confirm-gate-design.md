# Preview Token Confirm Gate Design

**Date:** 2026-07-22  
**Status:** Approved (approach A)  
**Related:** notes plain-text markup block  

## Goal

Agents cannot apply Redmine writes with `confirm: true` unless they first completed a matching dry-run. Pasted text must not count as approval by itself.

## Flow

1. `confirm` false/omit → compute canonical payload (tool-specific fields, exclude `confirm` / `previewToken`) → store entry → return `{ dryRun: true, previewToken, ...preview }`
2. `confirm: true` → require `previewToken`; lookup; verify tool + payload match; apply; invalidate token
3. Missing / expired / mismatch → `REDMINE_VALIDATION_ERROR`, no write

## Details

| Item | Choice |
| --- | --- |
| Storage | In-process `Map` (MCP process memory) |
| TTL | 10 minutes |
| Token | opaque random (`crypto.randomUUID`) |
| Tools | create_issue, update_issue, add_comment, add_attachment, update_status |
| Blocked notes | no `previewToken` issued |
| Schema | `previewToken?: string`; **required when `confirm === true`** |

## Out of scope

- Persistent store across MCP restarts (restart clears tokens — OK)
- Changing dry-run default behavior for reads
