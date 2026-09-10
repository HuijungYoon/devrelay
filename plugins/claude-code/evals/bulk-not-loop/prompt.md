---
name: Several issues → one bulk dry-run, no per-issue loop, no confirm
tags: [write-gate, bulk-status]
plugins: ["../.."]
runs: 2
max_turns: 6
allowed_tools: [mcp__redmine__redmine_bulk_update_status, mcp__redmine__redmine_update_status, mcp__redmine__redmine_list_metadata]
---
24110, 24083, 23238 세 개 다 완료로 바꿔줘.
