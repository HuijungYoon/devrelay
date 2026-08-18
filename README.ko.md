# DevRelay / redmine-devrelay

[![English](https://img.shields.io/badge/lang-English-blue)](README.md)

Codex · Claude Code · Cursor · Antigravity에서 **자연어와 슬래시 명령**으로 Redmine 이슈를 조회·생성·수정할 수 있게 해주는 MCP 연동 프로젝트입니다.

에이전트는 Redmine REST를 직접 호출하지 않고, 공통 MCP 서버 [`redmine-devrelay`](https://www.npmjs.com/package/redmine-devrelay)를 통합니다. 쓰기 API는 **dry-run → 확인 → `confirm=true` + `previewToken`** 게이트를 강제합니다.

**현재 배포 버전: `0.7.2`** (`redmine-devrelay` / `redmine-devrelay-client`)

## 현재까지 (Phase 1–7)

| Phase | 내용 | 버전 |
| --- | --- | --- |
| 1 | 연결·프로젝트·이슈 조회 | 0.1.x |
| 2 | 이슈 생성 / 댓글 / 상태 변경 (+ 담당자·관리자) | 0.2.x |
| 3 | `update_issue`, 생성 필드 확장, HTML 본문 줄바꿈 | 0.3.x |
| 4 | 이슈 **첨부파일** (create + `add_attachment`) | 0.4.x |
| 5 | notes 평문 강제, **`previewToken` confirm 게이트** | 0.5.x |
| 6 | 연결된 일감·하위일감, Streamable HTTP + BYOK | 0.6.x |
| 7 | **id 대신 이름** (상태·유형·우선순위), 대상 버전·범주 | **0.7.x** |

### 0.7.x 하이라이트

- `statusId`·`trackerId`·`priorityId`·`fixedVersionId`·`categoryId`가 **이름**을 받습니다 — "진행으로 바꿔줘"가 id 없이 동작
- 이름이 안 맞으면 실제 후보(`2:진행, 4:테스트 …`)를 돌려줍니다. 추측하지 않고, 애매하면 거절
- `redmine_list_metadata`로 유형·상태·우선순위(+프로젝트별 대상 버전·범주) 목록. 권한이 막힌 종류는 호출 전체를 실패시키지 않고 `unavailable`로 표시
- `fixedVersionId`(대상 버전)·`categoryId`(범주) 필드 추가, `null`이면 비움

### 0.6.x 하이라이트

- `redmine_list_issue_relations` / `add` / `update` / `remove` — 연결된 일감도 같은 dry-run 게이트
- 하위일감은 `parentIssueId`로: id를 넣으면 생성·편입, `null`이면 연결 해제 (일감 자체는 삭제되지 않음)
- Redmine에 관계 수정 API가 없어 "수정"은 삭제 후 재생성
- 프로젝트가 관계 목록 조회를 막아 두면 이슈의 `include=relations`로 자동 폴백

### 0.5.x 하이라이트

- `notes` Textile/Markdown dry-run 차단 (`blocked` + matches)
- 쓰기 적용 시 dry-run에서 받은 `previewToken` 필수 (TTL 10분, 1회용)
- 첫 호출 `confirm=true` 불가

### 0.4.x 하이라이트

- `attachments: [{ path, filename?, description? }]` on create
- `redmine_add_attachment` — 기존 이슈에 로컬 파일 첨부
- dry-run은 경로·파일명·크기만; `confirm=true`에서만 업로드

### 0.3.x 하이라이트

- `redmine_update_issue` — 이전→이후 `changes[]` dry-run 후 적용
- create/update: 유형·상태·우선순위·날짜·진척도·담당자(`assignedTo`)·관리자(`watchers`)
- `redmine_list_project_members` / `redmine_search_users`
- 사설망 HTTP(`http://192.168.x.x/...`) 허용, `/redmine` base path 유지
- **HTML 본문 자동 변환** (이 Redmine은 Textile이 아님)
  - description: 평문 줄 → `<p>…</p>`
  - notes/댓글: `\n` → `<br />` (평문만; Textile/Markdown은 dry-run에서 차단)

아직 없는 것: 커스텀 필드 쓰기, 시간 기록, 일괄 수정.

## 무엇을 할 수 있나요?

- “Cloud HMI에서 내게 할당된 열린 이슈 보여줘”
- “#1523 상세랑 최근 댓글 보여줘”
- “이슈 만들어줘” → 프로젝트·제목·담당자·관리자 확인 → dry-run → 적용
- “#23870 설명/진척도 바꿔줘” → before/after 미리보기 → 확인 후 적용
- “댓글 달아줘” → 미리보기 → 확인

슬래시 예시 (Cursor):

| 명령 | 동작 |
| --- | --- |
| `/help` | 명령 목록 |
| `/test-connection` | 연결·현재 사용자 |
| `/list-projects` | 프로젝트 목록 |
| `/my-issues` | 내 열린 이슈 |
| `/issue 1523` | 이슈 상세 + journals |
| `/create-issue` | 이슈 생성 (dry-run → 확인) |
| `/update-issue` | 이슈 수정 (dry-run → 확인) |
| `/add-comment` | 댓글 (dry-run → 확인) |
| `/add-attachment` | 파일 첨부 (dry-run → 확인) |
| `/update-status` | 상태만 변경 (dry-run → 확인) |

## 구성

```
Claude Code / Codex / Cursor / Antigravity  (플러그인 + 스킬)
        │ MCP STDIO
        ▼
   redmine-devrelay@0.7.2   (도구 스키마, STDIO, npm)
        │
        ▼
   redmine-devrelay-client@0.7.2  (REST, 인증, HTML 포맷, 쓰기)
        │ HTTPS 또는 사설 IP HTTP
        ▼
   Redmine REST API
```

| 경로 | 역할 |
| --- | --- |
| `packages/redmine-client` | npm: `redmine-devrelay-client@0.7.2` |
| `packages/redmine-mcp` | npm: `redmine-devrelay@0.7.2` |
| `plugins/cursor` | Cursor 플러그인 |
| `plugins/claude-code` | Claude Code 플러그인 + 스킬 |
| `plugins/codex` | Codex 플러그인 + 스킬 |
| `plugins/antigravity` | Antigravity IDE/CLI 플러그인 |

### MCP 도구

**조회**

| 도구 | 설명 |
| --- | --- |
| `redmine_test_connection` | URL·API Key로 현재 사용자 확인 |
| `redmine_list_projects` | 접근 가능한 프로젝트 목록 |
| `redmine_list_project_members` | 프로젝트 멤버 (담당자·관리자 선택) |
| `redmine_search_users` | 전체 사용자 검색 (권한 필요할 수 있음) |
| `redmine_search_issues` | 이슈 검색 (`assignedTo: "me"`, 기본 열린 이슈; 각 행에 `dueDate`·`doneRatio`) |
| `redmine_get_issue` | 이슈 상세 (`journals`·`children` 등 include) |
| `redmine_list_issue_relations` | 연결된 일감 목록 (+ `relationId`) |
| `redmine_list_metadata` | 유형·상태·우선순위·대상 버전·범주 (id + 이름) |

**쓰기** (`confirm` 기본 `false` = 미리보기)

| 도구 | 설명 |
| --- | --- |
| `redmine_create_issue` | 생성 · `wouldApply` 미리보기 (상태·유형·버전 **이름으로 지정 가능**, `attachments`, `parentIssueId`로 하위일감 생성) |
| `redmine_update_issue` | 수정 · `changes[]` 이전→이후 (`parentIssueId: null`이면 하위 연결 해제) |
| `redmine_add_comment` | 댓글 (`\n` → `<br />`) |
| `redmine_add_attachment` | 기존 이슈에 로컬 파일 첨부 |
| `redmine_update_status` | `statusId`만 변경 |
| `redmine_add_issue_relation` | 연결된 일감 추가 (`relates`·`blocks`·`precedes` 등) |
| `redmine_update_issue_relation` | 연결된 일감 수정 (삭제 후 재생성) |
| `redmine_remove_issue_relation` | 연결된 일감 삭제 — 링크만 끊고 일감은 유지 |

자세한 필드·HTML 규칙은 [`packages/redmine-mcp/README.md`](packages/redmine-mcp/README.md) 참고.

## 사전 준비

1. **Node.js 20+** (권장 22 LTS), **pnpm**
2. Redmine REST API 활성화  
   Administration → Settings → API → REST web service
3. 본인 계정 **API Key** (My account → API access key)
4. PC에서 Redmine URL 접근 가능 (사내망이면 VPN)

## 빠른 시작

### 1. npm으로 실행 (권장)

```bash
npx -y redmine-devrelay@0.7.2
```

로컬 빌드:

```bash
pnpm install
pnpm --filter redmine-devrelay-client build
pnpm --filter redmine-devrelay build
```

### 2. 환경변수

`.env.example`을 참고하세요. 키는 git에 넣지 마세요.

```bash
# Windows PowerShell
$env:REDMINE_URL = "https://redmine.example.com"
$env:REDMINE_API_KEY = "your-api-key"
```

```bash
# Bash
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=your-api-key
```

선택:

| 변수 | 설명 |
| --- | --- |
| `REDMINE_ALLOWED_HOSTS` | 호스트 allowlist (비어 있으면 생략 가능). 사설 IPv4는 별도 허용 |
| `REDMINE_CA_CERT_PATH` | 사설 CA PEM |

사설망 예: `REDMINE_URL=http://192.168.10.50/redmine`  
로컬 Docker: `http://localhost:3000` + `REDMINE_ALLOWED_HOSTS=localhost` (`docker/redmine/README.md`)

### 3. Cursor

```text
/add-plugin redmine-devrelay
```

또는 `plugins/cursor/mcp.json` / MCP 설정에서 `npx -y redmine-devrelay@0.7.2` 연결 후 `REDMINE_URL` / `REDMINE_API_KEY` 설정.

### 4. Claude Code

```text
/plugin marketplace add HuijungYoon/devrelay
/plugin install redmine-devrelay@devrelay
/reload-plugins
```

로컬 폴백: `claude --plugin-dir ./plugins/claude-code`

- `/mcp`로 연결 확인
- 슬래시 네임스페이스는 `/redmine-devrelay:…` (예: `/redmine-devrelay:create-issue`) 또는 자연어
- 자세한 내용: `plugins/claude-code/README.md`

### 5. Codex

`codex plugin marketplace` / `codex plugin add` 지원 CLI 필요 (없으면 업그레이드, 예: 0.107.0).

```bash
codex plugin marketplace add HuijungYoon/devrelay
codex plugin add redmine-devrelay@devrelay
```

로컬 개발: 레포 루트에서 `codex plugin marketplace add .` 후 동일 install.  
환경변수 `REDMINE_URL` / `REDMINE_API_KEY`. 조회는 approve, 쓰기는 prompt 권장.  
자세한 내용: `plugins/codex/README.md`.

### 6. Antigravity

```bash
agy plugin install ./plugins/antigravity
```

GitHub: clone repo then `agy plugin install ./devrelay/plugins/antigravity`.  
Slash: `/redmine:help`, `/redmine:my-issues`, … — see `plugins/antigravity/README.md`.

### 7. MCP Inspector

```bash
npx @modelcontextprotocol/inspector node packages/redmine-mcp/dist/index.js
```

## 사용 팁

- 쓰기는 항상 **dry-run → 확인 → `confirm=true` + `previewToken`**. 원시 REST 우회 금지.
- description/댓글은 **평문 줄바꿈**으로 넣으면 됩니다. HTML은 클라이언트가 변환합니다.
- API Key는 환경변수로만. 채팅·로그에 출력하지 마세요.
- `assignedTo` = 담당자, `watchers` = 관리자(일감관리자). update 시 `watchers`는 **전체 교체**.

## 저장소 구조

```
packages/redmine-client/   # npm: redmine-devrelay-client@0.7.2
packages/redmine-mcp/      # npm: redmine-devrelay@0.7.2
plugins/cursor|claude-code|codex|antigravity/
docker/redmine/            # 통합 테스트용 Redmine
docs/superpowers/          # Phase 설계·구현 계획
```

## 문서

| 문서 | 내용 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | **에이전트로 이 레포 작업하기** — 경로 지도·명령어·불변 규칙·릴리즈 순서 (Claude Code는 [CLAUDE.md](CLAUDE.md), Cursor는 `.cursor/rules/`를 통해 읽음) |
| [packages/redmine-mcp/README.md](packages/redmine-mcp/README.md) | MCP 도구·쓰기·HTML 규칙 |
| [docs/installation.md](docs/installation.md) | 설치·환경변수·플러그인 |
| [docs/security.md](docs/security.md) | API Key·호스트·감사 |
| [docs/troubleshooting.md](docs/troubleshooting.md) | 연결/인증/TLS |
| [docs/development.md](docs/development.md) | 빌드·테스트·Inspector |
| [docs/superpowers/specs/2026-07-10-redmine-mcp-phase1-design.md](docs/superpowers/specs/2026-07-10-redmine-mcp-phase1-design.md) | Phase 1 |
| [docs/superpowers/specs/2026-07-13-redmine-mcp-phase2-write-design.md](docs/superpowers/specs/2026-07-13-redmine-mcp-phase2-write-design.md) | Phase 2 |
| [docs/superpowers/specs/2026-07-13-redmine-mcp-phase3-update-issue-design.md](docs/superpowers/specs/2026-07-13-redmine-mcp-phase3-update-issue-design.md) | Phase 3 |

## 라이선스 / 배포

MIT · npm: [`redmine-devrelay@0.7.2`](https://www.npmjs.com/package/redmine-devrelay), [`redmine-devrelay-client@0.7.2`](https://www.npmjs.com/package/redmine-devrelay-client)
