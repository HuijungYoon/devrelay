# redmine-devrelay

Cursor · Claude Code · Codex용 **Redmine MCP 서버**입니다.

- **GitHub:** https://github.com/HuijungYoon/devrelay

## 빠른 시작

```bash
npx -y redmine-devrelay@0.3.0
```

환경변수: `REDMINE_URL`, `REDMINE_API_KEY`

## 쓰기 규칙

**미리보기 → 확인 → `confirm=true`.** dry-run 기본. 원시 REST 우회 금지.

## 주요 도구

| 도구 | 설명 |
| --- | --- |
| `redmine_create_issue` | 생성. `wouldApply`에 유형·상태·우선순위·시작일·진척도·담당자·일감관리자 |
| `redmine_update_issue` | 수정. `changes[]` 이전→이후 |
| `redmine_update_status` | 상태만 |
| `redmine_add_comment` | 댓글 |
| `redmine_list_project_members` | 담당자/일감관리자 후보 |

### create / update 공통 필드 (선택)

`trackerId`, `statusId`, `priorityId`, `startDate`, `dueDate`, `doneRatio`, `assignedTo`, `watchers`

## License

MIT
