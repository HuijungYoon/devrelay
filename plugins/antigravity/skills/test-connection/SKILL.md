---
name: redmine:test-connection
description: Verify Redmine URL and API key by fetching the current user
---

# Redmine connection check

Use MCP tools only. Never invent write operations. Never print API keys.

1. Call `redmine_test_connection`.
2. On success, report login, display name, and id.
3. On failure, show the tool error message; do not retry with different credentials.
