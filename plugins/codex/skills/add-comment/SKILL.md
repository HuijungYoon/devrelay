---
name: add-comment
description: Add a Redmine issue comment after dry-run confirmation
---

# Add Redmine comment

1. Extract issue id and notes from args/chat.
2. Call `redmine_add_comment` with `confirm` false/omitted. Show dry-run preview.
3. After user approval, call with `confirm: true`.
4. Never print API keys.
