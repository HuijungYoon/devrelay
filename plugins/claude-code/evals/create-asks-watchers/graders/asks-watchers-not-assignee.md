---
type: llm
criteria: |
  Before creating the issue the assistant asks the user who the 일감관리자 (watcher / manager) should be,
  offering candidate names if it fetched members, or explicitly accepts "none". It does NOT ask who the
  담당자 (assignee) is — the assignee defaults to the requester ("me"). If it already ran a dry-run, the
  preview must show the assignee as me and the watchers as asked/unspecified, and it must wait for approval.
focus: last_message
---
