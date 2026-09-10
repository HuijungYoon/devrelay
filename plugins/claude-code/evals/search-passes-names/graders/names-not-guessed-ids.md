---
type: tool_used
tool: mcp__redmine__redmine_search_issues
input_match: "(trackerId\"?\\s*:\\s*\"버그\"|status\"?\\s*:\\s*\"진행\")"
min: 1
---
The search must carry the status/tracker names the user said ("진행", "버그"), not guessed numeric ids.
