---
name: Search passes status and tracker names as-is
tags: [read-only, search-issues, names]
plugins: ["../.."]
runs: 2
max_turns: 6
allowed_tools: [mcp__redmine__redmine_search_issues, mcp__redmine__redmine_list_metadata, mcp__redmine__redmine_list_projects]
---
진행 상태인 버그 유형 일감만 찾아줘.
