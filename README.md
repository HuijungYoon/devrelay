# DevRelay / redmine-agent-integration

Codex·Claude Code에서 **자연어와 슬래시 명령**으로 Redmine 이슈를 조회할 수 있게 해주는 로컬 MCP 연동 프로젝트입니다.

에이전트가 Redmine REST API를 직접 만지지 않고, 공통 MCP 서버(`redmine-mcp`)를 통해 안전하게 읽기 전용으로 접근합니다. **Phase 1은 조회만** 지원하며, 이슈 생성·수정·댓글 등록 같은 쓰기는 포함하지 않습니다.

## 무엇을 할 수 있나요?

에이전트에게 예를 들어 이렇게 말할 수 있습니다.

- “Cloud HMI에서 내게 할당된 열린 이슈 보여줘”
- “#1523 이슈 상세랑 최근 댓글 보여줘”
- “Redmine 연결 확인해줘”

또는 슬래시 명령:

| 명령 | 동작 |
| --- | --- |
| `/redmine:my-issues` | 내게 할당된 **열린** 이슈 목록 |
| `/redmine:issue 1523` | 이슈 상세 + 최근 journals(댓글/이력) |

## 구성

```
Claude Code / Codex  (얇은 플러그인 + 스킬)
        │ MCP STDIO
        ▼
   redmine-mcp       (도구 스키마, STDIO 서버)
        │
        ▼
   redmine-client    (REST, 인증, 페이지네이션, 오류 표준화)
        │ HTTPS
        ▼
   Redmine REST API
```

| 경로 | 역할 |
| --- | --- |
| `packages/redmine-client` | Redmine HTTP 클라이언트 |
| `packages/redmine-mcp` | MCP 서버 (조회 도구 4개) |
| `plugins/claude-code` | Claude Code 플러그인 + 스킬 |
| `plugins/codex` | Codex 플러그인 + 스킬 |

### MCP 도구 (Phase 1)

| 도구 | 설명 |
| --- | --- |
| `redmine_test_connection` | URL·API Key로 현재 사용자 확인 |
| `redmine_list_projects` | 접근 가능한 프로젝트 목록 |
| `redmine_search_issues` | 이슈 검색 (`assignedTo: "me"`, 기본 열린 이슈) |
| `redmine_get_issue` | 이슈 상세 (`journals` 등 include) |

## 사전 준비

1. **Node.js 20+** (권장 22 LTS), **pnpm**
2. Redmine에서 **REST API 활성화**  
   Administration → Settings → API → REST web service
3. 본인 계정의 **API Key**  
   My account → API access key
4. PC에서 Redmine URL 접근 가능 (사내망이면 VPN)

## 빠른 시작

### 1. 의존성 설치·빌드

```bash
pnpm install
pnpm --filter redmine-client build
pnpm --filter redmine-mcp build
```

### 2. 환경변수

`.env.example`을 참고해 셸에 설정합니다. (키는 git에 넣지 마세요.)

```bash
# Windows PowerShell 예시
$env:REDMINE_URL = "https://redmine.example.com"
$env:REDMINE_API_KEY = "your-api-key"
$env:REDMINE_ALLOWED_HOSTS = "redmine.example.com"
```

```bash
# Bash 예시
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=your-api-key
export REDMINE_ALLOWED_HOSTS=redmine.example.com
```

사설 CA를 쓰는 경우:

```bash
export REDMINE_CA_CERT_PATH=/path/to/company-ca.pem
```

로컬 Docker Redmine 테스트 시에는 `http://localhost:3000`과 `REDMINE_ALLOWED_HOSTS=localhost`를 사용할 수 있습니다. (`docker/redmine/README.md` 참고)

### 3. Claude Code에서 쓰기

npm에 `redmine-mcp@0.1.0`이 아직 없으면, 로컬 빌드 결과를 쓰도록 `plugins/claude-code/.mcp.json`을 잠시 이렇게 바꿉니다.

```json
{
  "mcpServers": {
    "redmine": {
      "command": "node",
      "args": ["../../packages/redmine-mcp/dist/index.js"],
      "env": {
        "REDMINE_URL": "${REDMINE_URL}",
        "REDMINE_API_KEY": "${REDMINE_API_KEY}"
      }
    }
  }
}
```

플러그인 로드:

```bash
claude --plugin-dir ./plugins/claude-code
```

그다음:

- `/mcp` 로 Redmine 서버 연결 확인
- `/redmine:my-issues` 또는 자연어로 이슈 조회

### 4. Codex에서 쓰기

`plugins/codex`를 Codex 플러그인으로 로드합니다. (로컬 경로 또는 marketplace — `plugins/codex/README.md` 참고)

조회 도구는 승인 정책을 `approve`로 두는 것을 권장합니다. 쓰기 도구는 Phase 1에 없습니다.

### 5. MCP Inspector로 도구만 확인

```bash
npx @modelcontextprotocol/inspector node packages/redmine-mcp/dist/index.js
```

환경변수가 설정된 터미널에서 실행해야 연결 테스트가 됩니다.

## 사용 팁

- **조회만** 됩니다. “이슈 만들어줘 / 상태 바꿔줘”는 Phase 1에서 지원하지 않습니다.
- API Key는 환경변수로만 넘깁니다. 플러그인 manifest·채팅·로그에 넣지 마세요.
- `REDMINE_ALLOWED_HOSTS`로 허용 호스트를 제한하는 것을 권장합니다.
- 일반 검색·프로젝트 목록은 슬래시 없이도 자연어 + MCP 도구로 가능합니다. 슬래시는 자주 쓰는 두 가지 진입점만 제공합니다.

## 저장소 구조 (요약)

```
packages/redmine-client/   # REST 클라이언트
packages/redmine-mcp/      # MCP STDIO 서버
plugins/claude-code/       # Claude 플러그인 + skills/
plugins/codex/             # Codex 플러그인 + skills/
docker/redmine/            # 통합 테스트용 Redmine
docs/                      # 설치·보안·개발 가이드
```

## 문서

| 문서 | 내용 |
| --- | --- |
| [docs/installation.md](docs/installation.md) | 설치·환경변수·플러그인 |
| [docs/security.md](docs/security.md) | API Key·호스트 제한·감사 로그 |
| [docs/troubleshooting.md](docs/troubleshooting.md) | 연결/인증/TLS 문제 |
| [docs/development.md](docs/development.md) | 빌드·테스트·Inspector |
| [docs/superpowers/specs/2026-07-10-redmine-mcp-phase1-design.md](docs/superpowers/specs/2026-07-10-redmine-mcp-phase1-design.md) | Phase 1 설계 스펙 |

## 라이선스 / 배포

패키지명: `redmine-client@0.1.0`, `redmine-mcp@0.1.0` (unscoped).  
사내 npm 레지스트리 배포는 운영 정책에 따릅니다.
