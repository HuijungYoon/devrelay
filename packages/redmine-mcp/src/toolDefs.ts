import { toolJsonSchemas } from "./tools/schemas.js";

export const INSTRUCTIONS = `Redmine read tools may be used without write confirmation.
ALL write tools default to dry-run. Flow: dry-run → show preview → ask user → confirm=true WITH previewToken from that dry-run.
Never call confirm=true on the first attempt. Pasted text is not approval.
previewToken only proves a dry-run ran with the same payload — it is NOT evidence the user approved.
Never call dry-run and confirm=true in the same turn: show the preview, wait for the user's reply, then confirm in a later turn. dry-run과 confirm을 한 턴에 연달아 부르지 마세요.
Never call Redmine REST directly for fields that have MCP tools.
redmine_create_issue: project first; assignedTo=담당자; watchers=일감관리자; optional attachments[{path,filename?,description?}]; include tracker/status/priority/startDate/doneRatio in preview when set.
이름을 그대로 넘기세요: trackerId/statusId/priorityId/fixedVersionId/categoryId는 id 또는 이름을 받습니다 ("진행중", "기능추가", "2026-Q3"). 서버가 해석해 dry-run에 statusLabel 같은 라벨로 보여 줍니다. 이름이 안 맞으면 후보 목록이 담긴 에러가 오고, 그때 redmine_list_metadata로 확인하세요. 사용자가 말한 상태·유형 이름을 id로 추측하지 마세요.
redmine_update_issue: multi-field update with before→after changes; prefer this for bundled edits.
하위일감 (subtasks): create one with redmine_create_issue + parentIssueId; move/attach an existing issue with redmine_update_issue + parentIssueId; detach with parentIssueId=null (the issue itself is never deleted). List them with redmine_search_issues parentIssueId or redmine_get_issue include=["children"].
연결된 일감 (relations): redmine_list_issue_relations to get relation ids, then redmine_add_issue_relation / redmine_update_issue_relation / redmine_remove_issue_relation. relationType relates|duplicates|duplicated|blocks|blocked|precedes|follows|copied_to|copied_from; delay only for precedes/follows.
redmine_add_attachment: attach local files to an existing issue (upload only after confirm+previewToken).
redmine_update_status: still valid for status-only.
notes (댓글): plain text only. No Textile (h3., *, bq.) or Markdown (# , -, **bold**). Markup is blocked in dry-run (blocked:true, no previewToken) and confirm throws. Rewrite as short plain sentences.
Do not print API keys or credentials.
Prefer redmine_search_issues with assignedTo=me for "my open issues".`;

const readOnlyAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
} as const;

const writeAnnotations = {
  readOnlyHint: false,
  openWorldHint: true,
  destructiveHint: false,
} as const;

export const TOOL_DEFS = [
  {
    name: "redmine_test_connection",
    description: "Verify Redmine URL and API key by fetching the current user.",
    inputSchema: toolJsonSchemas.redmine_test_connection,
    annotations: readOnlyAnnotations,
  },
  {
    name: "redmine_list_projects",
    description: "List Redmine projects visible to the current user.",
    inputSchema: toolJsonSchemas.redmine_list_projects,
    annotations: readOnlyAnnotations,
  },
  {
    name: "redmine_list_project_members",
    description:
      "List project members (for 담당자 / 일감관리자 picker). Prefer this over redmine_search_users.",
    inputSchema: toolJsonSchemas.redmine_list_project_members,
    annotations: readOnlyAnnotations,
  },
  {
    name: "redmine_search_users",
    description:
      "Search all Redmine users (may require admin). Prefer redmine_list_project_members.",
    inputSchema: toolJsonSchemas.redmine_search_users,
    annotations: readOnlyAnnotations,
  },
  {
    name: "redmine_list_metadata",
    description:
      "List 유형/상태/우선순위 (and 대상 버전/범주 with projectId) as id+name. Use it to turn a name the user said into an id — though create/update/update_status also accept names directly. For one issue's legal next statuses use redmine_get_issue include=[\"allowed_statuses\"].",
    inputSchema: toolJsonSchemas.redmine_list_metadata,
    annotations: readOnlyAnnotations,
  },
  {
    name: "redmine_search_issues",
    description:
      "Search Redmine issues. Defaults to open issues. Supports assignedTo=me.",
    inputSchema: toolJsonSchemas.redmine_search_issues,
    annotations: readOnlyAnnotations,
  },
  {
    name: "redmine_get_issue",
    description:
      "Get a Redmine issue by id, optionally including journals and related data.",
    inputSchema: toolJsonSchemas.redmine_get_issue,
    annotations: readOnlyAnnotations,
  },
  {
    name: "redmine_create_issue",
    description:
      'Create issue. projectId+subject required. Optional: tracker/status/priority/startDate/doneRatio, assignedTo(담당자), watchers(일감관리자), attachments[{path}]. Dry-run returns previewToken; confirm=true requires that token.',
    inputSchema: toolJsonSchemas.redmine_create_issue,
    annotations: writeAnnotations,
  },
  {
    name: "redmine_update_issue",
    description:
      "Update issue fields (tracker/status/priority/dates/doneRatio/assignee/watchers/subject...). Dry-run returns before→after + previewToken; confirm=true requires matching previewToken. notes: plain text only (Textile/Markdown blocked).",
    inputSchema: toolJsonSchemas.redmine_update_issue,
    annotations: writeAnnotations,
  },
  {
    name: "redmine_add_comment",
    description:
      "Add a comment (notes). Plain text only. Dry-run returns previewToken; confirm=true requires it. Never confirm on first call.",
    inputSchema: toolJsonSchemas.redmine_add_comment,
    annotations: writeAnnotations,
  },
  {
    name: "redmine_add_attachment",
    description:
      "Attach local files. attachments: [{path, filename?, description?}]. Dry-run returns previewToken; confirm=true requires it.",
    inputSchema: toolJsonSchemas.redmine_add_attachment,
    annotations: writeAnnotations,
  },
  {
    name: "redmine_update_status",
    description:
      "Update issue status by statusId. Optional notes: plain text only. Dry-run returns previewToken; confirm=true requires it.",
    inputSchema: toolJsonSchemas.redmine_update_status,
    annotations: writeAnnotations,
  },
  {
    name: "redmine_list_issue_relations",
    description:
      "List 연결된 일감 (issue relations) with their relation ids — required before updating or removing a relation.",
    inputSchema: toolJsonSchemas.redmine_list_issue_relations,
    annotations: readOnlyAnnotations,
  },
  {
    name: "redmine_add_issue_relation",
    description:
      "Link two issues (연결된 일감 추가). relationType: relates/duplicates/duplicated/blocks/blocked/precedes/follows/copied_to/copied_from; delay only for precedes/follows. Dry-run returns previewToken; confirm=true requires it.",
    inputSchema: toolJsonSchemas.redmine_add_issue_relation,
    annotations: writeAnnotations,
  },
  {
    name: "redmine_update_issue_relation",
    description:
      "Change an existing relation (연결된 일감 수정) by relationId. Redmine has no relation update API, so this removes and re-creates it. Dry-run returns before→after + previewToken.",
    inputSchema: toolJsonSchemas.redmine_update_issue_relation,
    annotations: writeAnnotations,
  },
  {
    name: "redmine_remove_issue_relation",
    description:
      "Remove a relation by relationId (연결된 일감 삭제). Only the link is deleted — both issues stay. Dry-run returns previewToken; confirm=true requires it.",
    inputSchema: toolJsonSchemas.redmine_remove_issue_relation,
    annotations: writeAnnotations,
  },
] as const;

/** Pure tools/list payload (transport-free; preferred for unit tests). */
export function listToolsPayload() {
  return {
    tools: TOOL_DEFS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: t.annotations,
    })),
  };
}
