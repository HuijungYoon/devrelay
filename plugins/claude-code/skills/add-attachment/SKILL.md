---
name: add-attachment
description: Attach local files to a Redmine issue after dry-run confirmation
---

# Add Redmine attachment

**미리보기 → 확인 → 적용.**

1. issue id + 로컬 파일 경로 수집 (`attachments: [{ path, filename?, description? }]`)
2. `redmine_add_attachment` dry-run — 파일명·크기 표시 (업로드 없음)
3. 사용자 OK 후 `confirm: true`
4. 한 요청 최대 5개, 파일당 10MB
5. API Key 출력 금지

- **dry-run과 confirm을 같은 응답에서 연달아 부르지 마세요.** 미리보기를 보여 주고 **사용자 답을 받은 뒤 다음 턴에서만** `confirm: true`. `previewToken`은 승인의 증거가 아니라 "같은 payload로 dry-run이 있었다"는 증거일 뿐입니다.
