# redmine-devrelay

Cursor · Claude Code · Codex용 **Redmine MCP 서버**입니다.

- **GitHub:** https://github.com/HuijungYoon/devrelay
- **Client:** [redmine-devrelay-client](https://www.npmjs.com/package/redmine-devrelay-client)

## 빠른 시작

```bash
npx -y redmine-devrelay@0.3.1
```

| 환경변수          | 설명               |
| ----------------- | ------------------ |
| `REDMINE_URL`     | Redmine 베이스 URL |
| `REDMINE_API_KEY` | REST API Key       |

## 쓰기 규칙

**미리보기 → 확인 → `confirm=true`.** 쓰기 도구는 dry-run이 기본입니다.  
코멘트/`notes`는 Textile 줄바꿈을 위해 `\n` → `<br />` 로 자동 변환합니다.

## 조회 API

| 도구                           | 설명                                                 |
| ------------------------------ | ---------------------------------------------------- |
| `redmine_test_connection`      | URL·API Key로 현재 사용자 연결 확인                  |
| `redmine_list_projects`        | 접근 가능한 프로젝트 목록                            |
| `redmine_list_project_members` | 프로젝트 멤버 목록 (담당자·관리자 선택용)            |
| `redmine_search_users`         | 전체 사용자 검색 (권한 필요할 수 있음)               |
| `redmine_search_issues`        | 이슈 검색 (기본: 열린 이슈, `assignedTo: "me"` 지원) |
| `redmine_get_issue`            | 이슈 상세 조회 (journals 등 include)                 |

## 쓰기 API

| 도구                    | 설명                                        |
| ----------------------- | ------------------------------------------- |
| `redmine_create_issue`  | 이슈 생성. dry-run 시 `wouldApply` 미리보기 |
| `redmine_update_issue`  | 이슈 수정. dry-run 시 `changes[]` 이전→이후 |
| `redmine_add_comment`   | 이슈 댓글 추가 (`\n` → `<br />` 자동)       |
| `redmine_update_status` | 이슈 상태(`statusId`)만 변경                |

### create / update 선택 필드

| 필드                    | 의미                                       |
| ----------------------- | ------------------------------------------ |
| `trackerId`             | 유형                                       |
| `statusId`              | 상태                                       |
| `priorityId`            | 우선순위                                   |
| `startDate` / `dueDate` | 시작일 / 완료기한 (`YYYY-MM-DD`)           |
| `doneRatio`             | 진척도 (0–100)                             |
| `assignedTo`            | 담당자 (`"me"` / id / 이름)                |
| `watchers`              | 관리자 (id·이름 배열, update 시 전체 교체) |
| `confirm`               | `false`(기본)=미리보기, `true`=적용        |

## License

MIT
