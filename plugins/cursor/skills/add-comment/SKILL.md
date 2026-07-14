---
name: add-comment
description: Add a Redmine issue comment after dry-run confirmation
---

# Add Redmine comment

1. Extract issue id and notes from args/chat.
2. notes는 **일반 텍스트 줄바꿈**으로 작성 (`\n` → `<br />` 자동). HTML `<br />`를 직접 넣지 않아도 됨
3. Call `redmine_add_comment` with `confirm` false/omitted. Show dry-run preview.
4. After user approval, call with `confirm: true`.
5. Never print API keys.
