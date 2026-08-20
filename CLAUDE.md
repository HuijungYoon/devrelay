# CLAUDE.md

@AGENTS.md

위 파일이 이 레포의 공통 규칙·경로 지도·릴리즈 순서를 모두 담고 있습니다. 규칙을 고칠 때는 `AGENTS.md`를 고치세요 (이 파일에 중복해 적지 않습니다).

## Claude Code에서만 해당되는 것

### 이 레포가 만드는 플러그인을 이 세션에서 쓰고 있다면

`plugins/claude-code`가 곧 사용자가 설치한 `redmine-devrelay` 플러그인입니다. 설치본은 레포를 직접 읽지 않고 **캐시 사본**을 씁니다:

```
~/.claude/plugins/cache/devrelay/redmine-devrelay/<version>/
```

- MCP 서버는 `npx -y redmine-devrelay@<version>`으로 받은 **npm 배포판**입니다. 레포에서 `packages/redmine-mcp`를 고쳐도 **이 세션의 `redmine_*` 도구는 바뀌지 않습니다.** 배포 후 플러그인을 업데이트해야 반영됩니다.
- 스킬(SKILL.md)만 고친 경우도 캐시 사본이 갱신되어야 적용됩니다.
- `/plugin` 같은 대화형 패널은 앱 세션에서 열 수 없습니다. 대화형 `claude` 터미널이나 `claude plugin update <plugin>@<marketplace>`로 업데이트하도록 안내하세요.
- **`redmine_*` 도구가 세션에 없으면 쓰기를 하지 마세요.** 조회는 `AGENTS.md` §4-1의 스니펫으로, 꼭 써야 하면 `node scripts/redmine-call.mjs`로 실제 MCP 서버를 거쳐 dry-run 게이트를 통과시키세요. 예전에 REST를 직접 불러 본문이 한 덩어리로 저장된 적이 있습니다.

### 스킬을 고칠 때

`plugins/claude-code/skills/*/SKILL.md`가 기준 사본입니다. 고쳤으면 codex · cursor · antigravity 3개에도 같은 본문을 복사하세요 (`AGENTS.md` §7).

### 로컬에서 플러그인만 빠르게 확인

```bash
claude --plugin-dir ./plugins/claude-code
```

### Redmine 도구를 쓸 때

- 쓰기 도구는 dry-run 결과를 사용자에게 보여 주고 승인받은 뒤에만 `confirm: true` + `previewToken`.
- 일감 생성: 담당자는 묻지 않고 `"me"`, **일감관리자는 반드시 한 번 묻습니다.**
- 사용자가 "하위일감 삭제"라고 하면 부모 연결 해제(`parentIssueId: null`)인지 확인합니다. 일감 자체를 지우는 도구는 없습니다.

### 도구 사용 메모

- 셸은 PowerShell이 기본이고 Bash 도구도 있습니다. **한 호출 안에서 두 문법을 섞지 마세요** (PowerShell here-string을 Bash에 넣으면 커밋 메시지가 깨집니다).
- `node` / `npx`는 PATH에서 v14입니다. `pnpm`을 쓰거나 `"C:/Program Files/nodejs/node.exe"`를 직접 쓰세요.
