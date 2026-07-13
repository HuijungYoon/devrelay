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
  handleAddComment,
  handleCreateIssue,
  handleUpdateStatus,
} from "./tools/writes.js";
import { handleSearchUsers } from "./tools/users.js";
import {
  safeParseAddComment,
  safeParseConnection,
  safeParseCreateIssue,
  safeParseGetIssue,
  safeParseListProjects,
  safeParseSearch,
  safeParseSearchUsers,
  safeParseUpdateStatus,
  toolJsonSchemas,
} from "./tools/schemas.js";

const INSTRUCTIONS = `Redmine read tools may be used without write confirmation.
Write tools (redmine_create_issue, redmine_add_comment, redmine_update_status) default to dry-run.
Only pass confirm=true after the user explicitly approves the dry-run preview.
For create-issue: require projectId first; set assignedTo to "me", user id, or name (e.g. 윤석준). Use redmine_search_users when unsure.
Do not print API keys or credentials.
Do not invent write operations beyond the three write tools.
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
    name: "redmine_search_users",
    description:
      "Search Redmine users by name/login to resolve assignee ids for create-issue.",
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
      'Create a Redmine issue. Requires projectId + subject. Optional assignedTo: "me", user id, or name/login (일감 담당자). Defaults to dry-run; set confirm=true to apply.',
    inputSchema: toolJsonSchemas.redmine_create_issue,
  },
  {
    name: "redmine_add_comment",
    description:
      "Add a comment (notes) to an issue. Defaults to dry-run; set confirm=true to apply.",
    inputSchema: toolJsonSchemas.redmine_add_comment,
  },
  {
    name: "redmine_update_status",
    description:
      "Update issue status by statusId. Defaults to dry-run; set confirm=true to apply.",
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
        case "redmine_search_users": {
          const parsed = safeParseSearchUsers(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleSearchUsers(client, parsed.data);
          break;
        }
        case "redmine_add_comment": {
          const parsed = safeParseAddComment(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleAddComment(client, parsed.data);
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
