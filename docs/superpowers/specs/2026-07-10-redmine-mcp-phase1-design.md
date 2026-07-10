# Redmine MCP Phase 1 Design — Read-Only MVP

**Date:** 2026-07-10  
**Status:** Approved for implementation planning (amended: Phase 1 slash skills)  
**Source requirements:** `Redmine MCP 및 Codex·Claude Code 로컬 플러그인 요구사항.pdf`  
**Scope:** Phase 1 (조회 전용 MVP) only

## 1. Goal

Enable developers to query Redmine from Codex and Claude Code via natural language **and slash-command skills**, using a shared STDIO MCP server. Phase 1 must not mutate Redmine data.

Success looks like:

- “Cloud HMI에서 내게 할당된 열린 이슈를 보여줘”
- “#1523 이슈의 상세 내용과 최근 댓글을 보여줘”
- `/redmine:my-issues` lists open issues assigned to me
- `/redmine:issue` (with an issue id) shows detail and recent journals
- Connection/auth failures are clear and do not crash the MCP process
- API keys never appear in logs, errors, manifests, or tool output

## 2. Scope Decisions

| Decision | Choice |
| --- | --- |
| Phase | Phase 1 read-only MVP |
| Plugins | Thin wrappers + **2 read-only slash skills** (`my-issues`, `issue`) |
| Repo layout | PDF-recommended monorepo with `redmine-client` + `redmine-mcp` |
| Integration tests | Docker local Redmine |
| Package publish | Internal npm `redmine-client@0.1.0` and `redmine-mcp@0.1.0` |
| Approach | Layer split (client vs MCP) + schema-first tool contracts |

### In scope

- `redmine-client` HTTP client
- `redmine-mcp` STDIO MCP server
- Four read tools (see §5)
- Thin Claude Code and Codex plugins (manifest + `.mcp.json`)
- Two read-only skills exposed as slash commands (see §6.5)
- Docker Redmine for integration tests
- Internal npm publish of `0.1.0`
- Install/security/troubleshooting docs sufficient for local use

### Out of scope (explicit non-goals)

- Write tools and `confirm` preview/approval flow
- `redmine_get_project_context`
- Extra slash skills (`search`, `projects`, `test-connection`, create/update/work-summary)
- PDF Phase-3 skills (`redmine-issue-create/update/work-summary`) and broad `redmine-issue-search` skill (natural language + MCP covers general search)
- Formal marketplace rollout (beyond what is needed to load plugins locally)
- Remote HTTP MCP, OAuth
- Issue delete, attachments upload, time entries, webhooks
- MCP TypeScript SDK v2 (stay on verified `1.x`)
- `REDMINE_DISABLE_SSL_VERIFY` / `REDMINE_ALLOW_ANY_HOST`

## 3. Architecture

```
Claude Code / Codex
  (thin plugin + slash skills)
        │ skill guides tool use
        │ MCP STDIO
        ▼
  redmine-mcp
  (tool schemas, instructions, STDIO I/O)
        │
        ▼
  redmine-client
  (REST, auth, pagination, error mapping)
        │ HTTPS
        ▼
     Redmine REST API
```

Design principles carried from the requirements doc:

- All Redmine business logic lives in packages, not in plugins
- Plugins stay thin: register MCP + env wiring + minimal skill prompts
- Skills only orchestrate MCP tools and format output; they never call Redmine HTTP directly
- Read vs write remains clearly separated (Phase 1 = read only)
- Respect existing Redmine user permissions; no server-side Ruby plugin
- Never store API keys in code, repo, or logs

## 4. Repository Structure

```
redmine-agent-integration/
├── packages/
│   ├── redmine-client/
│   │   ├── src/
│   │   ├── tests/
│   │   └── package.json
│   └── redmine-mcp/
│       ├── src/
│       │   ├── server.ts
│       │   ├── config.ts
│       │   ├── errors.ts
│       │   ├── logging.ts
│       │   └── tools/
│       │       ├── connection.ts
│       │       ├── projects.ts
│       │       └── issues.ts
│       ├── tests/
│       └── package.json
├── plugins/
│   ├── claude-code/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── .mcp.json
│   │   ├── skills/
│   │   │   ├── my-issues/SKILL.md
│   │   │   └── issue/SKILL.md
│   │   └── README.md
│   └── codex/
│       ├── .codex-plugin/plugin.json
│       ├── .mcp.json
│       ├── skills/
│       │   ├── my-issues/SKILL.md
│       │   └── issue/SKILL.md
│       └── README.md
├── docker/
│   └── redmine/          # compose + seed notes for integration tests
├── docs/
│   ├── installation.md
│   ├── security.md
│   ├── troubleshooting.md
│   └── development.md
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

Workspace tooling: pnpm, TypeScript, eslint + formatter, Node.js 20+ (recommend 22 LTS).

Package names:

- `redmine-client@0.1.0`
- `redmine-mcp@0.1.0`

Publish target: internal GitLab Package Registry or Nexus. Pin exact versions (no `latest`, no unbounded `^` in plugin launch args).

## 5. MCP Tools (Phase 1)

Tool naming: lowercase `snake_case`, prefixed with `redmine_`.

### 5.1 `redmine_test_connection`

- Calls `GET /users/current.json`
- Returns `{ connected, redmineUrl, user: { id, login, name } }`
- Never returns the API key
- Distinguishes connection failure vs auth failure vs permission issues

### 5.2 `redmine_list_projects`

- Lists projects visible to the current user
- Inputs: optional `search`, `limit`
- Supports name/identifier search and pagination
- Output includes id, identifier, name, description, public flag, parent, status

### 5.3 `redmine_search_issues`

- Filters: project, issue id, assignee (`me` supported), status, tracker, priority, subject, created/updated dates, parent, custom fields, open/closed/all
- Default status scope: open issues
- Cap results via `REDMINE_MAX_RESULT_COUNT`; paginate internally when Redmine page size (max 100) is exceeded
- Response includes total count, returned count, and whether another page exists

### 5.4 `redmine_get_issue`

- Input: `issueId`, optional `include` (`journals`, `attachments`, `relations`, `children`, `allowed_statuses`)
- Returns normalized issue detail suitable for agent display
- Does not upload/download attachment binaries; metadata only

### Schema policy

- Validate all tool inputs with JSON Schema
- Reject unexpected properties by default
- Fix schemas before implementing handlers (schema-first)

### Server instructions (initialize)

State clearly, early in the instructions text:

- Read tools may be used without write confirmation
- Do not print API keys or credentials
- Phase 1 has no write tools; do not invent write operations

## 6. Components and Data Flow

### 6.1 `redmine-client`

Responsibilities:

- Parse and validate environment config
- Perform HTTPS requests with required headers
- Map Redmine/HTTP failures to `REDMINE_*` errors
- Paginate list endpoints
- Normalize response DTOs for MCP tools
- Mask secrets in any logged or thrown messages

Required request headers:

- `Accept: application/json`
- `Content-Type: application/json` only when the request has a JSON body (Phase 1 reads typically omit it)
- `User-Agent: redmine-mcp/<version>`
- `X-Redmine-API-Key: <secret>`

Timeouts (env-overridable):

- Connect: 5s
- Total request: 15s

Retry policy (GET only):

- Retry network blips and HTTP 429/502/503/504
- Max 2 retries with exponential backoff
- No automatic retry for POST/PUT (relevant from Phase 2)

### 6.2 `redmine-mcp`

Responsibilities:

- STDIO transport only
- Register the four tools
- Schema validation at the tool boundary
- Delegate to `redmine-client`
- Write protocol messages to stdout only; logs to stderr
- Convert domain errors to MCP errors without crashing

### 6.3 Plugins

Claude Code plugin:

- `.claude-plugin/plugin.json` with name `redmine` (or company-approved equivalent), semver `0.1.0`
- `.mcp.json` launching `npx -y redmine-mcp@0.1.0`
- Env passthrough: `REDMINE_URL`, `REDMINE_API_KEY` (and optionally `REDMINE_CA_CERT_PATH`)
- `skills/my-issues` and `skills/issue` (see §6.5); slash form `/redmine:my-issues`, `/redmine:issue`

Codex plugin:

- `.codex-plugin/plugin.json` + `.mcp.json` (direct server map preferred)
- Same package pin and env var names
- Same two skills under `skills/`
- Document recommended approval mode: read tools `approve` (auto-allow after policy), writes deferred to Phase 2

### 6.4 Example read flow

1. User asks for open issues assigned to them in a project **or** runs `/redmine:my-issues`
2. Agent (guided by skill or natural language) calls `redmine_search_issues` with `assignedTo: "me"`, `status: "open"`, optional project filter
3. MCP validates input → client builds query → `GET /issues.json`
4. Client paginates if needed → returns normalized list
5. If detail needed (or `/redmine:issue 1523`), agent calls `redmine_get_issue` with `include: ["journals"]`

### 6.5 Read-only slash skills

Skills are thin prompt wrappers. They must not embed Redmine URLs, API keys, or duplicate REST logic.

| Skill folder | Claude slash command | Behavior | MCP tools |
| --- | --- | --- | --- |
| `my-issues` | `/redmine:my-issues` | Default: open issues assigned to current user. If user names a project, resolve via `redmine_list_projects` / search filters first. Present a compact table: id, subject, status, priority, updated_on. | `redmine_search_issues` (`assignedTo: "me"`, `status: "open"`); optionally `redmine_list_projects` |
| `issue` | `/redmine:issue` | Extract issue id from args or conversation (`1523`, `#1523`). If missing, ask once. Show core fields + recent journals summary. | `redmine_get_issue` with `include: ["journals"]` |

SKILL.md requirements (both plugins, keep content aligned):

- State which MCP tools to call and with which default arguments
- Define output formatting (table vs sections)
- Forbid inventing write operations or calling non-existent tools
- On MCP/auth errors, surface the standardized error message; do not retry with alternate credentials

Intentionally **not** shipped in Phase 1 as slash commands: `search`, `projects`, `test-connection` (available via natural language + MCP tools only).

## 7. Configuration

### Required

- `REDMINE_URL=https://redmine.example.com`
- `REDMINE_API_KEY=...`

### Optional

- `REDMINE_DEFAULT_PROJECT_ID`
- `REDMINE_REQUEST_TIMEOUT_MS` (default 15000)
- `REDMINE_CONNECT_TIMEOUT_MS` (default 5000)
- `REDMINE_MAX_RESULT_COUNT` (default 100)
- `REDMINE_LOG_LEVEL` (default `info`)
- `REDMINE_CA_CERT_PATH`
- `REDMINE_ALLOWED_HOSTS` (comma-separated host allowlist)

### Forbidden in production config surface

- `REDMINE_DISABLE_SSL_VERIFY`
- `REDMINE_ALLOW_ANY_HOST`

Private CA issues are solved only via `REDMINE_CA_CERT_PATH`.

URL validation rules:

- Production/default: `https:` only
- Local integration exception: `http:` allowed solely for loopback/Docker hostnames used in tests (e.g. `localhost`, `127.0.0.1`, `redmine`) when explicitly present in `REDMINE_ALLOWED_HOSTS`
- Reject `file://`, `ftp://`, link-local/metadata IPs (e.g. `169.254.169.254`), and hosts outside the allowlist
- When `REDMINE_ALLOWED_HOSTS` is set, only listed hosts are accepted; when unset in local dev, still reject metadata/link-local targets

## 8. Error Handling

Phase 1 standard codes:

| Situation | Code |
| --- | --- |
| Cannot reach Redmine | `REDMINE_CONNECTION_ERROR` |
| Bad/missing API key | `REDMINE_AUTHENTICATION_ERROR` |
| Insufficient permission | `REDMINE_PERMISSION_DENIED` |
| Issue missing | `REDMINE_ISSUE_NOT_FOUND` |
| Project missing | `REDMINE_PROJECT_NOT_FOUND` |
| Invalid tool input | `REDMINE_VALIDATION_ERROR` |
| Request timed out | `REDMINE_TIMEOUT` |
| TLS/certificate failure | `REDMINE_TLS_ERROR` |
| Unexpected failure | `REDMINE_UNKNOWN_ERROR` |

Error messages must tell the user:

1. What failed
2. Whether any Redmine data changed (always no for Phase 1 reads)
3. What to check next
4. Whether retry is safe (GET retries are generally safe)

Process stability:

- Connection failures must not exit the MCP process
- One tool failure must not poison subsequent calls
- Handle SIGINT/SIGTERM for clean shutdown
- Uncaught exceptions map to standard MCP errors

## 9. Security

- Per-user API keys only; no shared admin key
- Keys via environment variables only — never CLI args, manifests, or committed `.env`
- Secret masking in logs and error serialization
- Host allowlisting to reduce SSRF risk
- No impersonation features
- Input limits: positive integer issue IDs, capped `limit`, schema allowlist only
- Audit log fields for reads: timestamp, tool name, Redmine hostname, user id (when known), success/failure, HTTP status, duration, error type
- Audit log must not record: API key, Authorization headers, full descriptions/comments, sensitive custom fields, raw env dumps

## 10. Non-Functional Requirements

- MCP server start: under 2 seconds on a typical developer machine
- Typical issue read: under 3 seconds excluding slow Redmine backends
- Do not N+1 detail-fetch when listing up to 100 issues
- Optional short-TTL in-memory cache for project list metadata is allowed; issue search results are not required to be cached in Phase 1
- Support Windows PowerShell, WSL2, macOS, Ubuntu; Codex CLI + IDE extension; Claude Code CLI
- Maintainability: client vs tool layer split, typed DTOs, eslint/formatter, ≥80% coverage on core client/tool logic

## 11. Testing Strategy

### Unit

- Env parsing and defaults
- URL / allowlist validation
- API key masking
- Input schema accept/reject
- Error mapping
- Pagination assembly
- Date filter conversion
- Response normalization

### Integration (Docker Redmine)

- Valid auth
- Invalid API key
- Inaccessible project
- Issue list + search filters including `assignedTo=me`
- Pagination beyond 100
- Issue detail with journals
- Timeout behavior
- Custom CA path behavior where applicable

### MCP compatibility

- MCP Inspector: tool list, schemas, invalid input rejection
- Confirm stdout contains only protocol traffic

### Plugin smoke

- Claude: `claude --plugin-dir ./plugins/claude-code` — plugin visible, MCP starts, missing-env error is clear
- Codex: local plugin load — `.mcp.json` loads, `/mcp` shows connected, read tools available
- Slash/skills: `/redmine:my-issues` and `/redmine:issue` are listed/invokable; `issue` without an id asks for the number once
- Skills do not register write workflows

## 12. Implementation Order

1. Monorepo scaffold (pnpm workspace, TS, lint/format)
2. Freeze JSON Schemas + error types for the four tools
3. Implement `redmine-client` read APIs
4. Implement `redmine-mcp` STDIO server
5. Docker Redmine + unit/integration tests
6. Thin Claude and Codex plugins pinned to `redmine-mcp@0.1.0`
7. Add `my-issues` and `issue` SKILL.md to both plugins (keep prompts in sync)
8. Inspector + CLI smoke tests including slash skill invocation
9. Publish `0.1.0` to internal npm and document install (include slash command examples)

## 13. Phase 1 Acceptance Checklist

### redmine-mcp

- [ ] Connection check works
- [ ] Accessible projects list works
- [ ] Issue search works (including `me` + open default)
- [ ] Issue detail + journals works
- [ ] API key never appears in logs/output
- [ ] Runs on Windows, macOS, Linux
- [ ] MCP Inspector checks pass

### Plugins

- [ ] Claude `--plugin-dir` loads plugin and starts MCP
- [ ] Codex local plugin loads and starts MCP
- [ ] `/redmine:my-issues` and `/redmine:issue` work (or equivalent skill invoke on Codex)
- [ ] Read vs write separation preserved (no write tools or write skills)
- [ ] Env-based credentials only

### Release

- [ ] `redmine-client@0.1.0` published internally
- [ ] `redmine-mcp@0.1.0` published internally
- [ ] Install docs cover Redmine REST enablement, API key, env vars, CA cert, slash commands, troubleshooting

## 14. Follow-on Phases (reference only)

Not part of this design’s delivery, but boundaries for later work:

- **Phase 2:** create/comment/status with `confirm=false|true`, audit log for writes; optional write slash skills later
- **Phase 3:** Git-diff issue drafts, work summary skills; broader search skill if still needed
- **Phase 4:** formal marketplaces, security review, version policy

## 15. Open Dependencies

- Internal npm registry endpoint and publish permissions for unscoped `redmine-client` / `redmine-mcp` must exist before publish step
- Docker image/tag for Redmine used in CI/dev should be pinned in `docker/` when implementation starts
- Exact verified `@modelcontextprotocol/sdk` 1.x version is chosen at implementation time and locked in lockfile
