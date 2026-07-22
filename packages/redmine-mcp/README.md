# redmine-devrelay

Cursor · Claude Code · Codex용 **Redmine MCP 서버**입니다.

- **버전:** `0.5.0`
- **GitHub:** https://github.com/HuijungYoon/devrelay
- **Client:** [redmine-devrelay-client](https://www.npmjs.com/package/redmine-devrelay-client) (동일 버전)

## 빠른 시작

```bash
npx -y redmine-devrelay@0.5.0
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

## 조회 API

| 도구 | 설명 |
| --- | --- |
| `redmine_test_connection` | URL·API Key로 현재 사용자 연결 확인 |
| `redmine_list_projects` | 접근 가능한 프로젝트 목록 |
| `redmine_list_project_members` | 프로젝트 멤버 목록 (담당자·관리자 선택용) |
| `redmine_search_users` | 전체 사용자 검색 (권한 필요할 수 있음) |
| `redmine_search_issues` | 이슈 검색 (기본: 열린 이슈, `assignedTo: "me"` 지원) |
| `redmine_get_issue` | 이슈 상세 조회 (journals 등 include) |

## 쓰기 API

| 도구 | 설명 |
| --- | --- |
| `redmine_create_issue` | 이슈 생성. dry-run 시 `wouldApply` 미리보기 |
| `redmine_update_issue` | 이슈 수정. dry-run 시 `changes[]` 이전→이후 |
| `redmine_add_comment` | 이슈 댓글 추가 (평문만; Textile/Markdown 차단) |
| `redmine_add_attachment` | 기존 이슈에 로컬 파일 첨부 |
| `redmine_update_status` | 이슈 상태(`statusId`)만 변경 |

### create / update 선택 필드

| 필드 | 의미 |
| --- | --- |
| `trackerId` | 유형 |
| `statusId` | 상태 |
| `priorityId` | 우선순위 |
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
| **0.5.0** | notes Textile/Markdown 차단, `previewToken` confirm 게이트 |
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
