# Notes Plain-Text Markup Block Design

**Date:** 2026-07-22  
**Status:** Approved  

## Goal

Prevent Redmine journal `notes` from being posted with Textile/Markdown markup. This Redmine stores HTML bodies; agents must send plain text (newlines → `<br />` via client).

## Behavior

- Detect Textile/Markdown in `notes` for:
  - `redmine_add_comment`
  - `redmine_update_issue` (when `notes` set)
  - `redmine_update_status` (when `notes` set)
- On match: **block** both dry-run and confirm (no write).
- Dry-run / error payload includes `blocked`, `reason`, and `matches` (matched tokens).
- `description` is out of scope for this change.

## Detection (line-oriented, reduce false positives)

| Kind | Examples |
| --- | --- |
| Textile headings | `h1.` … `h6.` at line start |
| Textile lists | line-start `* `, `# `, `** ` |
| Textile blocks | `bq.`, `fn\d+.` |
| Markdown headings/lists/emphasis | line-start `# `, `- `; `**bold**`; `*italic*` word-bound |

Do **not** treat issue refs like `#123` mid-sentence as markup.

## Skills / MCP instructions

Document: notes = plain text only; no Textile/Markdown; rewrite if blocked.
