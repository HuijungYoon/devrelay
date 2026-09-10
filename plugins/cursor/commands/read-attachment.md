---
description: Redmine 이슈 첨부 내려받아 읽기 (attachmentId → 로컬 경로 + 텍스트)
---

Use the **read-attachment** skill. List the issue's attachments with `redmine_get_issue include=["attachments"]`, let the user pick one, then `redmine_get_attachment { attachmentId }` and read the returned `path` (or the inline `text`).
