---
name: redmine:add-comment
description: Add a Redmine issue comment after dry-run confirmation
---

# Add Redmine comment

1. Extract issue id and notes from args/chat.
2. notes??**?¼ë°˜ ?ìŠ¤??ì¤„ë°”ê¿?*?¼ë¡œ ?‘ì„± (`\n` ??`<br />` ?ë™). HTML `<br />`ë¥?ì§ì ‘ ?£ì? ?Šì•„????
3. Call `redmine_add_comment` with `confirm` false/omitted. Show dry-run preview.
4. After user approval, call with `confirm: true`.
5. Never print API keys.
