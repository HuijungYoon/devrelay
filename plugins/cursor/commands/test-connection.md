---
description: Redmine 연결 확인 (현재 사용자)
---

Use the **test-connection** skill.

1. Call MCP tool `redmine_test_connection` (no arguments).
2. Show login, display name, and user id on success.
3. On failure, show the tool error message only — do not invent credentials or retry with different keys.
4. Never print API keys.
