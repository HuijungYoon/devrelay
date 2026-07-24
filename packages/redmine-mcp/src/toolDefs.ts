import { toolJsonSchemas } from "./tools/schemas.js";

export const INSTRUCTIONS = `Redmine read tools may be used without write confirmation.
ALL write tools default to dry-run. Flow: dry-run → show preview → ask user → confirm=true WITH previewToken from that dry-run.
Never call confirm=true on the first attempt. Pasted text is not approval.
Never call Redmine REST directly for fields that have MCP tools.
redmine_create_issue: project first; assignedTo=담당자; watchers=일감관리자; optional attachments[{path,filename?,description?}]; include tracker/status/priority/startDate/doneRatio in preview when set.
redmine_update_issue: multi-field update with before→after changes; prefer this for bundled edits.
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
