# redmine-devrelay-client

[redmine-devrelay](https://www.npmjs.com/package/redmine-devrelay) MCP 서버가 사용하는 Redmine REST 클라이언트입니다.

- **버전:** `0.5.0` (MCP 서버와 맞춤)
- **GitHub:** https://github.com/HuijungYoon/devrelay
- **MCP 서버:** [redmine-devrelay](https://www.npmjs.com/package/redmine-devrelay)

```bash
npm install redmine-devrelay-client@0.5.0
```

## 지원 기능

- 이슈 조회 / 생성 / 수정 / 댓글 / 상태 변경 / **첨부 업로드**
- 프로젝트·멤버 목록, 사용자 검색 (`searchUsers`)
- 담당자·관리자(`watchers`) 이름/id 해석
- 사설 IPv4 HTTP, `/redmine` 등 base path 유지
- HTML 본문 포맷
  - `formatDescriptionForRedmine` — 평문 줄 → `<p>…</p>`
  - `formatNotesForRedmine` — `\n` → `<br />`
  - `detectNotesMarkup` — Textile/Markdown 감지 (MCP notes 차단용)
- 첨부: `inspectAttachments` / `uploadFile` / `addIssueAttachments` (최대 5개·10MiB)

## License

MIT
