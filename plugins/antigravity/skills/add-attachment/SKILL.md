---
name: redmine:add-attachment
description: Attach local files to a Redmine issue after dry-run confirmation
---

# Add Redmine attachment

**미리보기 → 확인 → 적용.**

1. issue id + 로컬 파일 경로 수집 (`attachments: [{ path, filename?, description? }]`)
2. `redmine_add_attachment` dry-run — 파일명·크기 표시 (업로드 없음)
3. 사용자 OK 후 `confirm: true`
4. 한 요청 최대 5개, 파일당 10MB
5. API Key 출력 금지
