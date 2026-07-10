---
name: pr-description-writer
description: Use for writing PR-ready Markdown documents for the Cloud HMI M2I project from commit summaries, issue descriptions, work logs, or change lists. Trigger this skill when the user asks for a PR 본문, PR 문서, merge request description, 변경 요약 문서, release-note style summary, or a polished write-up before opening a PR.
---

# PR Description Writer Skill

Use this skill to turn rough implementation notes into a PR-ready document for the `ui-ngx` workspace.

## Instructions

1. Write in Korean by default unless the user explicitly asks for English.

2. Assume the input may be messy.
   - Accept issue title, commit notes, bullet lists, screenshots notes, test notes, or partial sentences.
   - Rewrite them into clean PR Markdown without copying awkward phrasing verbatim.

3. Keep the output practical and paste-ready.
   - The user should be able to paste the result directly into GitLab or GitHub PR description.
   - Prefer clear headings, short paragraphs, and flat bullet lists.

4. Always start with a concise PR title suggestion when enough context exists.
   - Preferred pattern:
     - `[#23011] 장치 관리 시스템 추가 프로세스 개편 및 Access Token 인증 체계 개편`
   - If there is no issue number, omit the bracketed issue token instead of inventing one.

5. Include the core PR sections required by this project whenever the input supports them.
   - `배경/문제`
   - `변경 내용`
   - `선택한 방식 및 고려사항`
   - `영향 범위`
   - `리스크 및 확인 포인트`
   - `테스트/검증`
   - `롤백/대응 방안`

6. If the source notes are feature-rich, organize `변경 내용` into numbered themes.
   - Good examples:
     - `1. 장치 인증 및 관리 방식 개편`
     - `2. 장치 추가 및 수정 플로우 개선`
     - `3. 입력 유효성 검사 및 데이터 정합성`
     - `4. 액세스 토큰 입력 UX 고도화`
     - `5. 기타 UI/UX 수정`

7. Rewrite implementation notes into reviewer-friendly language.
   - Describe user-visible behavior changes first.
   - Mention internal handling improvements only when they matter for review, risk, or regression scope.
   - Avoid low-signal file-by-file changelogs unless the user explicitly asks for them.

8. Preserve engineering accuracy.
   - Do not claim a test passed unless the user or workspace evidence confirms it.
   - If test evidence is missing, write it honestly:
     - `테스트는 미실행 상태이며 추가 확인이 필요합니다.`
   - If risk is unclear, state the likely regression surface instead of pretending there is none.

9. Reflect the product context in the document.
   - This is a production ThingsBoard-based customization.
   - Prefer wording that highlights backward compatibility, operational impact, validation scope, and rollback safety.

10. When relevant, classify the change using the upstream strategy.
    - `upstream-compatible`
    - `product extension`
    - `upstream override`
    - If the classification matters, place it in `영향 범위` or `선택한 방식 및 고려사항`.

11. For UI-focused `ui-ngx` changes, bias the document toward reviewable behavior.
    - UI labels and translation keys changed
    - validation timing changed
    - dialog or form flow changed
    - token formatting or cursor behavior changed
    - duplicate validation or error exposure changed

12. When the user provides a long bullet list, compress repeated ideas.
    - Merge overlapping items.
    - Keep the final document concise enough for reviewer scanning.
    - Preserve important edge cases and bug-fix details.

13. Use the following default PR document template unless the user asks for a shorter version:

```md
## 제목
[#이슈번호] 작업 제목

## 배경/문제
- 왜 이 변경이 필요한지
- 기존 동작의 문제점 또는 운영상 불편

## 변경 내용
### 1. 큰 변경 주제
- 핵심 변경 사항
- 사용자/운영자 관점 영향

### 2. 큰 변경 주제
- 핵심 변경 사항

## 선택한 방식 및 고려사항
- 왜 이 접근을 선택했는지
- 대안 대비 trade-off
- upstream-compatible / product extension / upstream override 중 해당 분류

## 영향 범위
- 영향을 받는 화면, 기능, API, 번역, 검증 로직 등

## 리스크 및 확인 포인트
- 회귀 가능성이 있는 지점
- 리뷰 시 중점 확인 사항

## 테스트/검증
- 수행한 테스트
- 미실행 항목이 있으면 명시

## 롤백/대응 방안
- 문제 발생 시 되돌릴 수 있는 범위
- 임시 완화 방법 또는 확인 절차
```

14. If the user asks for a lighter summary, return this compact format:

```md
## 제목
[#이슈번호] 작업 제목

## 요약
- 변경 목적
- 핵심 변경 2~4개
- 주요 리스크 또는 테스트 상태
```

15. For issue-driven notes like the example below, convert them into polished PR prose while preserving the structure.
    - issue number in title
    - numbered major sections
    - bullets under each section
    - explicit validation and rollback notes at the end

16. Do not fabricate branch names, commit hashes, test commands, or deployment facts.
    - If they are missing, omit them or mark them as pending confirmation.
