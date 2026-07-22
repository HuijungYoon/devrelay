#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { RedmineClient, RedmineError } from "redmine-devrelay-client";
import { toMcpError } from "./errors.js";
import { logAudit, logInfo } from "./logging.js";
import { handleTestConnection } from "./tools/connection.js";
import { handleGetIssue, handleSearchIssues } from "./tools/issues.js";
import { handleListProjects } from "./tools/projects.js";
import {
  handleAddAttachment,
  handleAddComment,
  handleCreateIssue,
  handleUpdateIssue,
  handleUpdateStatus,
} from "./tools/writes.js";
import { handleSearchUsers } from "./tools/users.js";
import { handleListProjectMembers } from "./tools/members.js";
import {
  safeParseAddAttachment,
  safeParseAddComment,
  safeParseConnection,
  safeParseCreateIssue,
  safeParseGetIssue,
  safeParseListProjectMembers,
  safeParseListProjects,
  safeParseSearch,
  safeParseSearchUsers,
  safeParseUpdateIssue,
  safeParseUpdateStatus,
  toolJsonSchemas,
} from "./tools/schemas.js";

const INSTRUCTIONS = `Redmine read tools may be used without write confirmation.
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

const TOOLS = [
  {
    name: "redmine_test_connection",
    description: "Verify Redmine URL and API key by fetching the current user.",
    inputSchema: toolJsonSchemas.redmine_test_connection,
  },
  {
    name: "redmine_list_projects",
    description: "List Redmine projects visible to the current user.",
    inputSchema: toolJsonSchemas.redmine_list_projects,
  },
  {
    name: "redmine_list_project_members",
    description:
      "List project members (for 담당자 / 일감관리자 picker). Prefer this over redmine_search_users.",
    inputSchema: toolJsonSchemas.redmine_list_project_members,
  },
  {
    name: "redmine_search_users",
    description:
      "Search all Redmine users (may require admin). Prefer redmine_list_project_members.",
    inputSchema: toolJsonSchemas.redmine_search_users,
  },
  {
    name: "redmine_search_issues",
    description:
      "Search Redmine issues. Defaults to open issues. Supports assignedTo=me.",
    inputSchema: toolJsonSchemas.redmine_search_issues,
  },
  {
    name: "redmine_get_issue",
    description:
      "Get a Redmine issue by id, optionally including journals and related data.",
    inputSchema: toolJsonSchemas.redmine_get_issue,
  },
  {
    name: "redmine_create_issue",
    description:
      'Create issue. projectId+subject required. Optional: tracker/status/priority/startDate/doneRatio, assignedTo(담당자), watchers(일감관리자), attachments[{path}]. Dry-run returns previewToken; confirm=true requires that token.',
    inputSchema: toolJsonSchemas.redmine_create_issue,
  },
  {
    name: "redmine_update_issue",
    description:
      "Update issue fields (tracker/status/priority/dates/doneRatio/assignee/watchers/subject...). Dry-run returns before→after + previewToken; confirm=true requires matching previewToken. notes: plain text only (Textile/Markdown blocked).",
    inputSchema: toolJsonSchemas.redmine_update_issue,
  },
  {
    name: "redmine_add_comment",
    description:
      "Add a comment (notes). Plain text only. Dry-run returns previewToken; confirm=true requires it. Never confirm on first call.",
    inputSchema: toolJsonSchemas.redmine_add_comment,
  },
  {
    name: "redmine_add_attachment",
    description:
      "Attach local files. attachments: [{path, filename?, description?}]. Dry-run returns previewToken; confirm=true requires it.",
    inputSchema: toolJsonSchemas.redmine_add_attachment,
  },
  {
    name: "redmine_update_status",
    description:
      "Update issue status by statusId. Optional notes: plain text only. Dry-run returns previewToken; confirm=true requires it.",
    inputSchema: toolJsonSchemas.redmine_update_status,
  },
] as const;

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function validationError(message: string): RedmineError {
  return new RedmineError({
    code: "REDMINE_VALIDATION_ERROR",
    message,
    check: ["Fix the tool arguments and retry"],
  });
}

function dryRunFromResult(result: unknown): boolean | undefined {
  if (
    result &&
    typeof result === "object" &&
    "dryRun" in result &&
    typeof (result as { dryRun: unknown }).dryRun === "boolean"
  ) {
    return (result as { dryRun: boolean }).dryRun;
  }
  return undefined;
}

export async function startServer(
  client: RedmineClient = RedmineClient.fromEnv()
): Promise<Server> {
  const server = new Server(
    { name: "redmine", version: "0.2.0" },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const toolName = req.params.name;
    const started = Date.now();
    const host = hostFromUrl(client.config.baseUrl);

    try {
      let result: unknown;
      switch (toolName) {
        case "redmine_test_connection": {
          const parsed = safeParseConnection(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleTestConnection(client);
          break;
        }
        case "redmine_list_projects": {
          const parsed = safeParseListProjects(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleListProjects(client, parsed.data);
          break;
        }
        case "redmine_search_issues": {
          const parsed = safeParseSearch(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleSearchIssues(client, parsed.data);
          break;
        }
        case "redmine_get_issue": {
          const parsed = safeParseGetIssue(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleGetIssue(client, parsed.data);
          break;
        }
        case "redmine_create_issue": {
          const parsed = safeParseCreateIssue(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleCreateIssue(client, parsed.data);
          break;
        }
        case "redmine_update_issue": {
          const parsed = safeParseUpdateIssue(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleUpdateIssue(client, parsed.data);
          break;
        }
        case "redmine_search_users": {
          const parsed = safeParseSearchUsers(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleSearchUsers(client, parsed.data);
          break;
        }
        case "redmine_list_project_members": {
          const parsed = safeParseListProjectMembers(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleListProjectMembers(client, parsed.data);
          break;
        }
        case "redmine_add_comment": {
          const parsed = safeParseAddComment(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleAddComment(client, parsed.data);
          break;
        }
        case "redmine_add_attachment": {
          const parsed = safeParseAddAttachment(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleAddAttachment(client, parsed.data);
          break;
        }
        case "redmine_update_status": {
          const parsed = safeParseUpdateStatus(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleUpdateStatus(client, parsed.data);
          break;
        }
        default:
          throw validationError(`Unknown tool: ${toolName}`);
      }

      logAudit({
        tool: toolName,
        host,
        ok: true,
        durationMs: Date.now() - started,
        dryRun: dryRunFromResult(result),
      });

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    } catch (err) {
      const payload = toMcpError(err);
      logAudit({
        tool: toolName,
        host,
        ok: false,
        durationMs: Date.now() - started,
        errorCode: payload.code,
        httpStatus: payload.httpStatus,
      });
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logInfo("redmine-mcp started", { host: hostFromUrl(client.config.baseUrl) });

  const shutdown = () => {
    logInfo("redmine-mcp shutting down");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return server;
}
