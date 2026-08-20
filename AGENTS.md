# AGENTS.md — DevRelay

코딩 에이전트(Codex · Cursor · Claude Code · Antigravity)가 이 레포에서 작업할 때 **먼저 읽는 문서**입니다.
Claude Code는 [CLAUDE.md](CLAUDE.md)가 이 파일을 import 하고, Cursor는 [.cursor/rules/devrelay.mdc](.cursor/rules/devrelay.mdc)가 이 파일을 가리킵니다. 규칙을 고칠 때는 **이 파일만** 고치면 됩니다.

---

## 1. 이 레포는 무엇인가

Redmine을 MCP로 노출하는 서버 + 4개 에이전트용 플러그인. 에이전트는 Redmine REST를 직접 부르지 않고 MCP 도구를 통합니다.

```
Codex / Cursor / Claude Code / Antigravity   (plugins/* : 설정 + 스킬)
        │ MCP STDIO (또는 Streamable HTTP)
        ▼
redmine-devrelay            packages/redmine-mcp     도구 스키마·zod 검증·dry-run 게이트
        │
        ▼
redmine-devrelay-client     packages/redmine-client  REST·인증·HTML 변환·마스킹
        │ HTTPS 또는 사설 IP HTTP
        ▼
Redmine REST API
```

- npm 배포 버전: **0.7.2** (두 패키지 동일 버전으로 맞춤). 플러그인 pin은 publish 후에 올립니다 (§8)
- pnpm workspace (`pnpm-workspace.yaml`), TypeScript ESM, vitest
- 언어: 스킬 문서와 사용자 대화는 한국어, 코드·커밋은 영어

---

## 2. 경로 지도

### 루트

| 경로 | 역할 |
| --- | --- |
| `AGENTS.md` | 이 파일. 에이전트 공통 규칙 |
| `CLAUDE.md` | Claude Code 진입점 (이 파일을 import) |
| `.cursor/rules/devrelay.mdc` | Cursor 규칙 (이 파일을 가리킴) |
| `README.md` / `README.ko.md` | 사용자용 소개·설치·도구 표 (둘 다 같이 고칠 것) |
| `.claude-plugin/marketplace.json` | Claude Code 마켓 카탈로그 |
| `.cursor-plugin/marketplace.json` | Cursor 마켓 카탈로그 |
| `.agents/plugins/marketplace.json` | Codex 마켓 카탈로그 (`plugins/codex`를 가리킴) |
| `.env` / `.env.example` | `REDMINE_URL`, `REDMINE_API_KEY` 등. `.env`는 **커밋 금지** |
| `package.json` | 루트 스크립트 (`build` / `test` / `lint` = `pnpm -r`) |
| `deploy/redmine-demo/fly.toml` | Fly 데모 Redmine 배포 설정 |
| `dist-portal/` | OpenAI Apps 포털 빌드 산출물 — **gitignore 대상**, 커밋하지 말 것 |
| `scripts/redmine-call.mjs` | MCP 서버가 세션에 없을 때 쓰는 게이트 있는 단일 호출 헬퍼 (§4-1) |
| `skills/shared/` | 플러그인이 아니라 개발용 공용 스킬 (`git-commit-command`, `pr-description-writer`, `changesets`, `writing-guidelines`, `license-auth-project`) |

### packages/redmine-client — REST 클라이언트 (`redmine-devrelay-client`)

| 파일 | 역할 |
| --- | --- |
| `packages/redmine-client/src/client.ts` | `RedmineClient` 파사드. 새 기능은 여기에 메서드 추가 |
| `packages/redmine-client/src/http.ts` | `RedmineHttp` — `getJson` / `postJson` / `putJson` / `deleteJson` / `postBinary`, 재시도, 상태코드→`RedmineError` 매핑 |
| `packages/redmine-client/src/config.ts` | `loadConfig`(env) / `configFromCredentials`(BYOK), 호스트 allowlist, 사설 IP 허용 |
| `packages/redmine-client/src/errors.ts` | `RedmineError` (code · httpStatus · check[] · retrySafe) |
| `packages/redmine-client/src/mask.ts` | `maskSecret` — 에러·로그에서 API key 제거 |
| `packages/redmine-client/src/issues.ts` | 이슈 검색·상세, 쿼리 빌더, 정규화 |
| `packages/redmine-client/src/writes.ts` | 이슈 생성·수정·댓글·상태·첨부 payload 조립 (`parent_issue_id` 포함) |
| `packages/redmine-client/src/relations.ts` | 연결된 일감 목록·조회·추가·삭제·교체(삭제+재생성) |
| `packages/redmine-client/src/memberships.ts` | 프로젝트 멤버 (담당자·일감관리자 후보), 이름 매칭 |
| `packages/redmine-client/src/metadata.ts` | 유형·상태·우선순위·대상 버전·범주 목록 + `matchNamedByName` (이름 → id) |
| `packages/redmine-client/src/users.ts` | 전체 사용자 검색 (권한 필요할 수 있음) |
| `packages/redmine-client/src/attachments.ts` | 파일 검사·업로드 토큰 (최대 5개, 10MiB/파일) |
| `packages/redmine-client/src/textile.ts` | `formatDescriptionForRedmine`(→`<p>`), `formatNotesForRedmine`(→`<br />`), `detectNotesMarkup` |
| `packages/redmine-client/src/types.ts` | 모든 입출력 타입 + `ISSUE_RELATION_TYPES` 등 상수 |
| `packages/redmine-client/src/index.ts` | 공개 export. 새 함수·타입은 여기도 추가 |
| `packages/redmine-client/tests/*.test.ts` | 단위 테스트 (`http`를 `vi.fn()`으로 모킹) |
| `packages/redmine-client/tests/integration/` | 실제 Redmine 필요. `REDMINE_INTEGRATION=1` 없으면 skip |

### packages/redmine-mcp — MCP 서버 (`redmine-devrelay`)

| 파일 | 역할 |
| --- | --- |
| `packages/redmine-mcp/src/index.ts` | 엔트리. `--http`면 HTTP, 아니면 STDIO |
| `packages/redmine-mcp/src/cli.ts` | 인자 파싱 |
| `packages/redmine-mcp/src/server.ts` | STDIO 트랜스포트 |
| `packages/redmine-mcp/src/httpServer.ts`, `packages/redmine-mcp/src/http/app.ts`, `packages/redmine-mcp/src/http/byok.ts`, `packages/redmine-mcp/src/http/sessions.ts` | Streamable HTTP + BYOK 헤더 + 세션 |
| `packages/redmine-mcp/src/createServer.ts` | **도구 디스패치 switch**. 새 도구는 여기에 case 추가 |
| `packages/redmine-mcp/src/toolDefs.ts` | `TOOL_DEFS`(이름·설명·annotations) + `INSTRUCTIONS`(모델에게 주는 사용 규칙) |
| `packages/redmine-mcp/src/tools/schemas.ts` | zod 입력 스키마 + `safeParse*` + `toolJsonSchemas`(ListTools용 JSON Schema). **둘 다** 갱신해야 함 |
| `packages/redmine-mcp/src/tools/previewStore.ts` | previewToken 발급·소비, `asPayload` / `withIssuedToken` / `consumeIfConfirm` 공용 헬퍼 |
| `packages/redmine-mcp/src/tools/writes.ts` | 생성·수정·댓글·첨부·상태 핸들러 (담당자·일감관리자 해석 포함) |
| `packages/redmine-mcp/src/tools/relations.ts` | 연결된 일감 핸들러 |
| `packages/redmine-mcp/src/tools/metadata.ts` | `redmine_list_metadata` 핸들러 + `resolveNamedRef`/`resolveIssueMetadata` (쓰기 도구가 이름을 id로 해석할 때 쓰는 공용 함수) |
| `packages/redmine-mcp/src/tools/` 의 `issues.ts` · `projects.ts` · `members.ts` · `users.ts` · `connection.ts` | 읽기 핸들러 |
| `packages/redmine-mcp/src/errors.ts`, `packages/redmine-mcp/src/logging.ts` | MCP 에러 payload, 감사 로그(`logAudit`) |
| `packages/redmine-mcp/static/privacy.html`, `packages/redmine-mcp/static/terms.html` | HTTP 모드에서 서빙하는 정책 페이지 |
| `packages/redmine-mcp/tests/*.test.ts` | 핸들러·스키마·annotations·HTTP 테스트 |

### plugins/ — 4개 클라이언트 (설정 파일 이름이 서로 다름)

| 플러그인 | 설정 | 슬래시 접두 | 비고 |
| --- | --- | --- | --- |
| `plugins/claude-code` | `plugins/claude-code/.claude-plugin/plugin.json` + `plugins/claude-code/.mcp.json` | `/redmine-devrelay:` | 기준 사본 |
| `plugins/codex` | `plugins/codex/.codex-plugin/plugin.json` + `plugins/codex/.mcp.json` | 없음(스킬 이름 호출) | |
| `plugins/cursor` | `plugins/cursor/.cursor-plugin/plugin.json` + `plugins/cursor/mcp.json` | `/` | `commands/*.md`가 스킬을 호출 |
| `plugins/antigravity` | `plugins/antigravity/plugin.json` + `plugins/antigravity/mcp_config.json` | `/redmine:` | 스킬 frontmatter `name:`도 `redmine:` 접두 |

스킬 12개 — 4개 플러그인 모두 `plugins/<client>/skills/<name>/SKILL.md`:
`help` · `test-connection` · `list-projects` · `my-issues` · `issue` · `create-issue` · `update-issue` · `add-comment` · `add-attachment` · `update-status` · `relate-issue` · `subtask`

플러그인 스킬을 고치는 절차는 §7에 있습니다.

### docs/

| 문서 | 내용 |
| --- | --- |
| `docs/installation.md` | 설치·환경변수·클라이언트별 등록 |
| `docs/development.md` | 빌드·테스트·Inspector·publish dry-run |
| `docs/security.md` | API key·호스트 allowlist·감사 |
| `docs/troubleshooting.md` | 연결·인증·TLS |
| `docs/claude-code-marketplace-submit.md`, `docs/official-directory/` | 마켓 제출 체크리스트 |
| `docs/superpowers/specs/`, `docs/superpowers/plans/` | Phase별 설계·계획 (히스토리) |
| `docker/redmine/` | 통합 테스트용 Redmine (compose + seed) |

---

## 3. 명령어

```bash
pnpm install
pnpm -r run build     # client → mcp 순서로 빌드
pnpm -r run test      # vitest (client 79 + mcp 96)
pnpm -r run lint      # tsc --noEmit
```

**빌드 순서가 중요합니다.** `redmine-mcp`는 `redmine-devrelay-client`의 **빌드된 `dist`** 타입을 봅니다. client를 고치고 빌드하지 않으면 mcp 타입체크가 엉뚱한 zod 에러를 뱉습니다. 타입 에러가 이상하면 먼저 `pnpm -r run build`.

개별 실행:

```bash
pnpm --filter redmine-devrelay-client test relations   # 파일명 필터
pnpm --filter redmine-devrelay test
```

MCP Inspector / 통합 테스트는 [docs/development.md](docs/development.md) 참고.

---

## 4. 이 환경(Windows)의 함정

- **`node`가 PATH에서 v14입니다.** 최신 문법(`??=`)이 깨집니다. `pnpm`을 통해 실행하거나 `"C:/Program Files/nodejs/node.exe"`(v22)를 직접 쓰세요. `npx`도 같은 이유로 실패합니다.
- **`python`은 Python 2**입니다. 임시 스크립트는 PowerShell을 쓰는 편이 안전합니다.
- **Git Bash가 `rev:path` 인자를 망깁니다** (`origin/main:file` → `origin\main;file`). `git cat-file`/`git show`에 `rev:path`를 넘길 때는 PowerShell을 쓰거나 `MSYS_NO_PATHCONV=1`.
- **Bash 도구에서 PowerShell here-string(`@'…'@`)을 쓰지 마세요.** 커밋 메시지는 heredoc(`git commit -F -`)으로.
- **Bash heredoc 안에서 역슬래시 2개(`\\n`, `\\/`)가 1개로 줄어듭니다.** 정규식·`\n` 문자열을 그렇게 넣으면 코드가 조용히 깨집니다.
  Node 스크립트로 파일을 고칠 때는 `const BS = String.fromCharCode(92)`로 조립하거나 Write/Edit 도구를 쓰세요.
- 파일은 **UTF-8(BOM 없음)**, 줄바꿈은 CRLF가 기본. **CP949로 저장하지 마세요** (과거에 스킬 3개가 깨졌던 원인).
- 이 레포에는 **worktree가 여러 개** 있습니다 (`git worktree list`). 브랜치 체크아웃이 거부되면 다른 worktree가 물고 있는 것이니 그쪽에서 작업하세요.

---

## 4-1. MCP 서버가 안 붙어 있을 때 (중요)

플러그인을 업데이트한 뒤 재시작 전이거나 `npx`가 실패하면 `redmine_*` 도구가 세션에 없습니다.
이때 **쓰기는 하지 마세요.** 조회만 하고, 쓰기가 필요하면 아래 게이트 있는 경로를 쓰거나 사용자에게
재시작을 안내하고 멈춥니다.

**규칙 (§5.1의 연장)**

- **Redmine REST를 손으로 호출하지 않습니다.** 실제로 그렇게 일감을 만들었다가 본문이 한 덩어리로
  붙어서 다시 고친 적이 있습니다 (이 Redmine은 본문을 HTML로 저장합니다).
- **빌드된 클라이언트로 직접 쓰지도 않습니다.** 변환·이스케이프는 되지만 **dry-run 게이트가 없습니다.**
  `createIssue` / `updateIssue` / `addComment` / `addIssueRelation` 등은 이 경로에서 호출 금지.
- **조회는 자유롭게** 하세요. 아래 스니펫으로 읽고 사용자에게 보여 주면 됩니다.

```js
// "C:/Program Files/nodejs/node.exe" script.mjs  (PATH의 node는 v14라 안 됩니다)
// import 경로는 스크립트 위치 기준으로 풀립니다. 스크래치 폴더에 두면 상대경로가
// 깨지므로 절대 file:// URL을 쓰세요.
import { RedmineClient } from "file:///C:/Users/User/Desktop/M2I/DevRelay/packages/redmine-client/dist/index.js";
const client = RedmineClient.fromEnv();          // .env의 REDMINE_URL / REDMINE_API_KEY
const issues = await client.searchIssues({ assignedTo: "me", status: "open" });
```

**꼭 써야 한다면: 배포된 MCP 서버를 직접 구동**해서 게이트를 그대로 통과시키세요. 도구를 거치므로
dry-run → previewToken → confirm이 살아 있습니다.

```bash
# 조회
node scripts/redmine-call.mjs redmine_search_issues '{"assignedTo":"me","status":"open"}'
# 쓰기: 먼저 dry-run 결과를 사용자에게 보여 주고, 승인을 받은 다음에만 confirm
node scripts/redmine-call.mjs redmine_add_comment '{"issueId":24038,"notes":"확인했습니다"}'
node scripts/redmine-call.mjs redmine_add_comment '{"issueId":24038,"notes":"확인했습니다","confirm":true,"previewToken":"<위에서 받은 토큰>"}'
```

- 본문 규칙은 클라이언트가 처리합니다 — `description`은 줄마다 `<p>`, `notes`는 줄 끝에 `<br />`,
  `<` `>` `&` `"`는 이스케이프. 직접 문자열을 만들지 말고 평문을 넘기세요.
- 사람 이름 → id는 `listProjectPeople()`을 쓰세요. 멤버 목록 API가 403이면 최근 이슈의 담당자에서
  후보를 추립니다 (`source: "issues"`).

이 인스턴스에서 확인된 권한 제약 (읽기 전용 계정 기준):

| 엔드포인트 | 결과 | 대안 |
| --- | --- | --- |
| `/projects/:id/memberships.json` | 403 | `listProjectPeople` (최근 이슈 담당자) |
| `/users.json` (전체 검색) | 403 | `/users/:id.json`은 개별 조회 가능 |
| `/projects/:id/issue_categories.json` | 403 | `categoryId`에 숫자 id 사용 |
| `/issues/:id/relations.json` | 일부 프로젝트 403 | 이슈의 `include=relations`로 자동 폴백 |

---

## 5. 절대 지켜야 하는 규칙

1. **모든 쓰기 도구는 dry-run → previewToken → confirm 게이트를 탑니다.**
   첫 호출에 `confirm=true` 금지. `confirm=true`에는 같은 payload로 받은 `previewToken` 필수(TTL 10분·1회용). 새 쓰기 도구를 만들면 `previewStore`의 `withIssuedToken` / `consumeIfConfirm`을 그대로 쓰세요.
2. **Redmine REST를 직접 호출하지 마세요.** 도구가 있는 필드는 도구로. 클라이언트 계층 밖에서 `fetch`를 부르지 않습니다.
3. **API key를 출력·로그·에러에 남기지 마세요.** 에러 메시지는 `maskSecret`을 통과합니다.
4. **notes(댓글)는 평문만.** Textile/Markdown은 dry-run에서 `blocked`로 막고 confirm에서 throw합니다.
5. **스킬은 4벌 동기화.** `create-issue` 같은 스킬 본문은 4개 플러그인에서 동일해야 하고, 다른 것은 frontmatter `name:`(antigravity는 `redmine:` 접두)뿐입니다. 상호참조는 접두사에 묶이지 않게 `` `subtask` 스킬 `` 형태로 씁니다.
6. **일감을 삭제하는 도구는 만들지 않습니다.** Redmine의 이슈 삭제는 되돌릴 수 없고 하위 트리까지 지웁니다. "하위일감 삭제"는 `parentIssueId: null`(부모 연결 해제)입니다.
7. **일감 생성 시 담당자(작업자)는 기본 `"me"`, 일감관리자(`watchers`)는 dry-run 전에 반드시 한 번 묻습니다.** (`create-issue` 스킬)
8. `README.md`를 고치면 `README.ko.md`도 같이. 도구 표는 루트 README 2개 + `packages/redmine-mcp/README.md` 2개에 있습니다.

---

## 6. 새 MCP 도구를 추가하는 순서

1. `packages/redmine-client/src/types.ts` — 입출력 타입(+ 필요하면 상수)
2. `packages/redmine-client/src/<기능>.ts` — REST 호출 + 정규화 + 검증(`RedmineError`)
3. `packages/redmine-client/src/client.ts` — `RedmineClient` 메서드
4. `packages/redmine-client/src/index.ts` — export
5. `packages/redmine-mcp/src/tools/schemas.ts` — zod 스키마 + `safeParse*` + `toolJsonSchemas` 항목
6. `packages/redmine-mcp/src/tools/<기능>.ts` — 핸들러. 쓰기면 dry-run/confirm 게이트
   쓰기 도구면 `previewStore.ts`의 `PreviewTool` union에 도구 이름 추가
7. `packages/redmine-mcp/src/toolDefs.ts` — `TOOL_DEFS` 항목(annotations: 읽기 `readOnlyAnnotations`, 쓰기 `writeAnnotations`) + 필요하면 `INSTRUCTIONS` 한 줄
8. `packages/redmine-mcp/src/createServer.ts` — `case "redmine_..."` 추가
9. 테스트: client(모킹된 http로 payload 검증) + mcp(dry-run이 쓰지 않는지, confirm이 토큰을 요구하는지)
10. 문서: 4개 플러그인 스킬 + help 표 + README 도구 표

`pnpm -r run build && pnpm -r run test`로 마무리. 테스트는 `tsconfig`의 `include`에 없어서 타입체크되지 않습니다(런타임만 검증).

---

## 7. 스킬을 추가·수정하는 순서

1. `plugins/claude-code/skills/<name>/SKILL.md`를 기준으로 작성
2. 나머지 3개 플러그인에 같은 본문 복사 — `name:`만 각 규칙에 맞게 (antigravity `redmine:<name>`)
3. `plugins/cursor/commands/<name>.md`도 추가 (커서는 command → skill 구조)
4. 4개 플러그인의 `plugins/<client>/skills/help/SKILL.md` 표에 행 추가 (각자 슬래시 접두 사용)
5. 각 `plugins/*/README.md` 명령 표에도 추가

---

## 8. 릴리즈 순서 (순서를 지켜야 합니다)

플러그인은 MCP 서버를 `npx -y redmine-devrelay@<버전>`으로 해결합니다. 그래서 **publish 전에 버전 pin을 push하면 신규 설치가 깨집니다.**

1. 두 패키지 `package.json` 버전을 올린다 (항상 동일 버전)
2. `pnpm -r run build && pnpm -r run test`
3. `pnpm --filter redmine-devrelay-client publish --access public`
4. `pnpm --filter redmine-devrelay publish --access public`
5. pin을 올린 릴리즈 커밋을 push — 4개 플러그인 설정 + 3개 marketplace 카탈로그 + README 4개 + `docs/installation.md`
6. 버전 이력 표에는 **새 행을 추가**합니다. 과거 행(`| **0.5.2** | …`)의 숫자는 바꾸지 않습니다

`npm publish`는 되돌릴 수 없습니다. 사용자 승인 없이 실행하지 마세요.

---

## 9. 커밋 · PR

- Conventional Commits: `feat(mcp):` `fix(client):` `docs(plugin):` `chore(plugins):`
- 성격이 다른 변경은 커밋을 분리합니다 (client / mcp / docs·plugins / release)
- 커밋 메시지 본문은 "무엇을 왜"까지. 끝에:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- 이 레포는 `main`에 직접 커밋하는 관행입니다. 사용자가 PR을 요청하면 브랜치를 만드세요.
- **커밋·push·publish는 사용자가 요청할 때만** 합니다.

---

## 10. 작업 전 확인

```bash
git status --short          # 다른 작업물이 섞여 있는지
git worktree list           # 브랜치가 다른 worktree에 잡혀 있는지
pnpm -r run build           # dist 최신화 (타입 에러 오진 방지)
```

Redmine에 실제로 붙어 확인해야 하면 **읽기 전용 호출**만 하세요. 쓰기(이슈 생성·수정·관계 변경)는 사용자의 실제 Redmine 데이터를 바꾸므로 승인 없이 실행하지 않습니다.
