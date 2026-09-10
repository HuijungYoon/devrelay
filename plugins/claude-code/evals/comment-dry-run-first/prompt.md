---
name: Comment goes through dry-run and waits for approval
tags: [write-gate, add-comment]
plugins: ["../.."]
runs: 2
max_turns: 6
allowed_tools: [mcp__redmine__redmine_add_comment, mcp__redmine__redmine_get_issue]
---
일감 24067에 "확인했습니다. 내일 배포 예정입니다" 라고 댓글 달아줘.
