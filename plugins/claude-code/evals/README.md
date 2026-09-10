# Skill evals (`claude plugin eval`)

스킬 회귀를 잡는 평가 케이스입니다. 각 케이스는 **모의 MCP 서버**(`mocks/redmine/*.md`)로 돌아가므로 실제 Redmine이 필요 없고, Redmine에 아무것도 쓰지 않습니다.

```
evals/
  mocks/_tools.json          # tools/list 스냅샷 (dist/toolDefs.js의 listToolsPayload()에서 생성)
  <case>/
    prompt.md                # 사용자 요청 + frontmatter (plugins, runs, allowed_tools)
    graders/<name>.md        # tool_used / regex / llm 판정
    mocks/redmine/<tool>.md  # 그 케이스에서 MCP 도구가 돌려줄 응답
```

## 케이스

| 케이스 | 지키는 규칙 |
| --- | --- |
| `comment-dry-run-first` | 댓글 요청은 dry-run만 부르고, 같은 턴에 `confirm: true`를 부르지 않으며, 미리보기를 보여 주고 승인을 묻는다 |
| `my-issues-read-only` | 조회 요청에는 쓰기 도구를 하나도 부르지 않는다 |
| `create-asks-watchers` | 일감 생성은 담당자를 묻지 않고(`me`) 일감관리자는 dry-run 전에 한 번 묻는다. confirm 금지 |
| `search-passes-names` | 상태·유형을 id로 추측하지 않고 이름 그대로 넘긴다 |
| `bulk-not-loop` | 여러 일감 상태 변경은 `redmine_bulk_update_status` 한 번, `redmine_update_status` 반복 금지 |

## 실행

```bash
cd plugins/claude-code
claude plugin eval . --threshold 0.8 --max-cost-usd 1
claude plugin eval . --case comment-dry-run-first --verbose
claude plugin eval . --json results.json --report report.html   # CI
```

- `claude plugin eval`은 **early access**입니다. 이 머신(2026-09-10)에서는 게이트가 닫혀 있어 실행하지 못했고, 케이스는 문서 스펙대로 작성했습니다. 게이트가 열리면 먼저 `--case my-issues-read-only`로 grader의 도구 이름(`tool:` 값)이 실제 트레이스와 맞는지 확인하세요 — MCP 도구 이름의 접두(`mcp__redmine__…`)는 서버 키에서 옵니다
- 도구 스키마를 바꿨으면 `_tools.json`을 다시 생성합니다:

```bash
node -e 'import("./packages/redmine-mcp/dist/toolDefs.js").then(m=>require("fs").writeFileSync("plugins/claude-code/evals/mocks/_tools.json", JSON.stringify(m.listToolsPayload(),null,2)+"\n"))'
```

- 새 케이스를 추가하면 이 표에도 한 줄 넣습니다. mock 응답은 실제 도구 결과 모양(`dryRun`, `previewToken`, `issues[]` …)을 따릅니다.
