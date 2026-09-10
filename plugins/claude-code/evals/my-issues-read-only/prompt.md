---
name: Listing my issues never touches a write tool
tags: [read-only, my-issues]
plugins: ["../.."]
runs: 2
max_turns: 6
allowed_tools: [mcp__redmine__redmine_search_issues, mcp__redmine__redmine_list_projects]
---
내게 할당된 열린 일감 보여줘.
