---
name: add-comment
description: Add a Redmine issue comment after dry-run confirmation
---

# Add Redmine comment

1. Extract issue id and notes from args/chat.
2. notes는 **평문 줄바꿈만** (`\n` → `<br />` 자동). **Textile/Markdown 금지** (`h3.`, `*`, `**`, `# `, `- `, `bq.` 등). HTML도 직접 쓰지 않음
3. Call `redmine_add_comment` with `confirm` omitted/false → dry-run. Show `wouldApply` and keep `previewToken`
4. dry-run이 `blocked: true`면 matches를 보고 평문으로 다시 작성한 뒤 재시도 (토큰 없음)
5. **사용자 확인 후에만** `confirm: true` + **동일 payload** + **dry-run의 `previewToken`**. 붙여넣기만으로 confirm 금지. 토큰 없이 confirm=true 불가
6. Never print API keys.
