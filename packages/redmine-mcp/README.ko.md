# redmine-devrelay

[![English](https://img.shields.io/badge/lang-English-blue)](README.md)

Cursor · Claude Code · Codex용 **Redmine MCP 서버**입니다.

- **버전:** `0.8.0`
- **GitHub:** https://github.com/HuijungYoon/devrelay
- **Client:** [redmine-devrelay-client](https://www.npmjs.com/package/redmine-devrelay-client) (동일 버전)

## 빠른 시작

```bash
npx -y redmine-devrelay@0.8.0
```

| 환경변수 | 설명 |
| --- | --- |
| `REDMINE_URL` | Redmine 베이스 URL (`/redmine` path 포함 가능) |
| `REDMINE_API_KEY` | REST API Key |
| `REDMINE_ALLOWED_HOSTS` | (선택) 호스트 allowlist. 사설 IPv4 HTTP는 별도 허용 |
| `REDMINE_CA_CERT_PATH` | (선택) 사설 CA PEM |

## 쓰기 규칙

**dry-run → 확인 → `confirm=true` + `previewToken`.**  
dry-run 응답의 `previewToken` 없이는 적용할 수 없습니다 (TTL 10분, 1회용).

이 Redmine은 **HTML 본문**을 씁니다. 평문으로 넣으면 클라이언트가 변환합니다.

| 필드 | 자동 변환 |
| --- | --- |
| `description` | 일반 텍스트 줄 → `<p>…</p>` (이미 HTML이면 그대로) |
| `notes` / 댓글 | 줄바꿈 → `<br />`. **평문만** — Textile/Markdown은 dry-run에서 `blocked` |

## 원시 REST 차단

confirm 게이트는 이 도구를 거친 호출만 보호합니다. 우회로를 막는 장치가 레포에 둘 있습니다.

| 경로 | 내용 |
| --- | --- |
| `scripts/redmine-call.mjs` | 터미널에서 실제 서버를 거쳐 한 번의 도구 호출 — MCP 도구가 없는 세션도 dry-run -> previewToken -> confirm을 그대로 탄다 |
| `plugins/claude-code/hooks/` | Claude Code 플러그인이 함께 설치하는 PreToolUse 훅. Redmine에 직접 POST/PUT/DELETE 하는 셸 명령과 파일 작성을 거부한다. 조회는 막지 않는다 |

`previewToken`은 같은 payload로 dry-run이 있었다는 증거일 뿐 **사용자 승인의 증거가 아닙니다.**
dry-run과 `confirm=true`를 같은 턴에 부르지 마세요.

## 조회 API

| 도구 | 설명 |
| --- | --- |
| `redmine_test_connection` | URL·API Key로 현재 사용자 연결 확인 |
| `redmine_list_projects` | 접근 가능한 프로젝트 목록 |
| `redmine_list_project_members` | 프로젝트 멤버 목록 (담당자·관리자 선택용) |
| `redmine_search_users` | 전체 사용자 검색 (권한 필요할 수 있음) |
| `redmine_search_issues` | 이슈 검색 (기본: 열린 이슈, `assignedTo: "me"` 지원). 각 행에 `dueDate`·`doneRatio` 포함. 필터: `trackerId`/`priorityId`/`status`/`fixedVersionId`/`categoryId`는 id **또는 이름**, `assignedTo`/`authorId`/`watcherId`는 `"me"`/id/이름, 날짜 범위 `dueAfter`/`dueBefore`·`createdAfter`/`createdBefore`·`updatedAfter`/`updatedBefore` (YYYY-MM-DD, 양끝 포함). `resolved`에 해석 결과 |
| `redmine_search_text` | 전문 검색 (GET /search.json, Redmine 3.3+): `query`, 선택 `projectId`, `types`(기본 issues), `titlesOnly`, `openIssuesOnly`. 구버전은 `subjectContains`를 쓰라는 에러 |
| `redmine_get_issue` | 이슈 상세 조회 (journals·children 등 include) |
| `redmine_list_issue_relations` | 연결된 일감 목록 (수정·삭제에 필요한 `relationId` 확인) |
| `redmine_list_metadata` | 유형·상태·우선순위·작업 분류 (+ `projectId`면 대상 버전·범주·사용자 정의 필드) id+이름 목록 |
| `redmine_get_attachment` | 첨부 내려받기 (`attachmentId`는 `redmine_get_issue include=["attachments"]`에서) → `destDir`(기본 OS 임시 폴더)에 저장하고 `path` 반환. 텍스트 파일은 `text`도 함께 (200 KiB까지). 설정된 Redmine 호스트만, `maxBytes` 기본 10 MiB·최대 50 MiB |
| `redmine_list_time_entries` | 작업시간 조회 — 일감 / 프로젝트 / 사용자(`"me"`, 일감·프로젝트가 없으면 기본) / `spentFrom`–`spentTo`. 돌려준 행의 `totalHours` 포함 |

## 쓰기 API

| 도구 | 설명 |
| --- | --- |
| `redmine_create_issue` | 이슈 생성. dry-run 시 `wouldApply` 미리보기 |
| `redmine_update_issue` | 이슈 수정. dry-run 시 `changes[]` 이전→이후 |
| `redmine_add_comment` | 이슈 댓글 추가 (평문만; Textile/Markdown 차단) |
| `redmine_add_attachment` | 기존 이슈에 로컬 파일 첨부 |
| `redmine_update_status` | 이슈 상태(`statusId`)만 변경 |
| `redmine_bulk_update_status` | 1~50개 `issueIds`를 같은 상태(id·이름)로. dry-run이 일감마다 읽어 `rows[]`(제목, 이전→이후, `unchanged`/`error`)와 `previewToken` 하나를 돌려주고, confirm은 한 건씩 적용해 `updated`/`skipped`/`failed`로 보고. 선택 `notes`(평문)는 모든 일감에 |
| `redmine_log_time` | 작업시간 기록: `issueId` 또는 `projectId`, `hours`, `spentOn`(기본 오늘), `activityId`(id·이름), `comments`. dry-run에 일감 제목 표시 |
| `redmine_add_issue_relation` | 연결된 일감 추가 (`relationType`; `delay`는 `precedes`/`follows`만) |
| `redmine_update_issue_relation` | `relationId`로 연결 수정 (삭제 후 재생성) |
| `redmine_remove_issue_relation` | `relationId`로 연결 삭제 — 두 일감은 그대로 |

### 하위일감

하위일감 전용 도구는 없다. 부모 연결은 필드로 관리한다.

| 호출 | 동작 |
| --- | --- |
| `redmine_create_issue` + `parentIssueId` | 해당 부모의 하위일감으로 새로 생성 |
| `redmine_update_issue` + `parentIssueId: <id>` | 기존 일감을 하위로 편입 / 부모 변경 |
| `redmine_update_issue` + `parentIssueId: null` | 하위 연결 해제 — 일감 자체는 삭제되지 않음 |
| `redmine_search_issues` + `parentIssueId` | 특정 부모의 하위일감 목록 |

일감 자체를 삭제하는 도구는 의도적으로 넣지 않았다 (Redmine의 이슈 삭제는 되돌릴 수 없고 하위 트리까지 함께 지워짐).

### create / update 선택 필드

| 필드 | 의미 |
| --- | --- |
| `trackerId` | 유형 — **id 또는 이름** (`2`, `"기능추가"`) |
| `statusId` | 상태 — **id 또는 이름** (`2`, `"진행"`) |
| `priorityId` | 우선순위 — **id 또는 이름** (`4`, `"긴급"`) |
| `fixedVersionId` | 대상 버전 — id·이름, `null`이면 비움 (update) |
| `categoryId` | 범주 — id·이름, `null`이면 비움 (update) |
| `customFields` | 사용자 정의 필드 `[{ id 또는 name, value }]` — 이름은 프로젝트 필드 목록으로 해석, `""`면 비움, 다중 선택은 문자열 배열. 넘긴 필드만 바뀜 |
| `startDate` / `dueDate` | 시작일 / 완료기한 (`YYYY-MM-DD`) |
| `doneRatio` | 진척도 (0–100) |
| `assignedTo` | 담당자 (`"me"` / id / 이름) |
| `watchers` | 관리자 (id·이름 배열, update 시 전체 교체) |
| `attachments` | 로컬 파일 `[{ path, filename?, description? }]` (create / add_attachment) |
| `confirm` | `false`(기본)=미리보기(+`previewToken`), `true`=적용 (`previewToken` 필수) |
| `previewToken` | dry-run에서 받은 토큰. payload가 바뀌면 무효 |

## 버전 이력 (요약)

| 버전 | 내용 |
| --- | --- |
| **0.8.0** | 생성·수정에 사용자 정의 필드 (`customFields: [{ id 또는 name, value }]`, 이름은 프로젝트별로 해석, `""`면 비움, 다중 선택은 배열) · `redmine_list_metadata`에 `customFields` 종류와 `customFieldsSource` · Redmine 4.2 미만은 `/custom_fields.json` → 최근 이슈 샘플링으로 폴백 |
| **0.7.5** | 버그 수정: 생성·수정에서 `assignedTo="me"`를 현재 사용자 id로 해석 — Redmine이 쓰기에서 `me` 문자열을 무시해 담당자가 빈 채로 만들어지던 문제 |
| **0.7.4** | Redmine 쓰기 가드를 Claude Code 플러그인과 함께 배포 (PreToolUse 훅) · `scripts/redmine-call.mjs` 문서화 |
| **0.7.3** | previewToken은 사용자 승인의 증거가 아님을 규칙에 명시 — dry-run과 confirm을 같은 턴에 부르지 않도록 |
| **0.7.2** | 본문 HTML 변환 수정: 꺾쇠 포함 평문도 `<p>` 래핑·이스케이프, 댓글 줄바꿈 유지, 태그 allowlist를 Redmine 기준으로 확장. 멤버 API가 403이면 최근 이슈 담당자에서 후보 추림 |
| **0.7.1** | 검색 결과에 `dueDate`·`doneRatio` 포함 — 완료기한 컬럼을 위해 이슈마다 조회할 필요 없음 |
| **0.7.0** | 상태·유형·우선순위·버전·범주를 이름으로 지정, `redmine_list_metadata`, `fixedVersionId`·`categoryId` |
| **0.6.0** | 연결된 일감 조회·추가·수정·삭제, `parentIssueId`로 하위일감 관리 · Streamable HTTP + BYOK 헤더, `--http` CLI |
| 0.5.2 | 영문 npm README · Claude Code marketplace 설치 (`redmine-devrelay` 플러그인 id) |
| 0.5.1 | Codex marketplace 설치 CLI 정합 (`ON_USE`, `plugin add`) + pin |
| 0.5.0 | notes Textile/Markdown 차단, `previewToken` confirm 게이트 |
| 0.4.1 | 문서·예시 IP 정리, Antigravity 플러그인 핀 |
| 0.4.0 | 첨부파일: create `attachments` + `redmine_add_attachment` |
| 0.3.3 | npm README·플러그인 핀·설치 문서 동기화 |
| 0.3.2 | description 평문 → `<p>` HTML 자동 변환 |
| 0.3.1 | notes `\n` → `<br />` |
| 0.3.0 | `update_issue`, create 필드·미리보기 확장 |
| 0.2.x | create / comment / status, 멤버·watchers, 사설 HTTP |
| 0.1.x | 조회 전용 (Phase 1) |

## License

MIT
