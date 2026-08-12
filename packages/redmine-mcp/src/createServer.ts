import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { RedmineClient, RedmineError } from "redmine-devrelay-client";
import { toMcpError } from "./errors.js";
import { logAudit } from "./logging.js";
import { handleTestConnection } from "./tools/connection.js";
import { handleGetIssue, handleSearchIssues } from "./tools/issues.js";
import { handleListMetadata } from "./tools/metadata.js";
import { handleListProjects } from "./tools/projects.js";
import {
  handleAddAttachment,
  handleAddComment,
  handleCreateIssue,
  handleUpdateIssue,
  handleUpdateStatus,
} from "./tools/writes.js";
import {
  handleAddIssueRelation,
  handleListIssueRelations,
  handleRemoveIssueRelation,
  handleUpdateIssueRelation,
} from "./tools/relations.js";
import { handleSearchUsers } from "./tools/users.js";
import { handleListProjectMembers } from "./tools/members.js";
import {
  safeParseAddAttachment,
  safeParseAddComment,
  safeParseAddIssueRelation,
  safeParseConnection,
  safeParseCreateIssue,
  safeParseGetIssue,
  safeParseListIssueRelations,
  safeParseListMetadata,
  safeParseListProjectMembers,
  safeParseListProjects,
  safeParseRemoveIssueRelation,
  safeParseSearch,
  safeParseSearchUsers,
  safeParseUpdateIssue,
  safeParseUpdateIssueRelation,
  safeParseUpdateStatus,
} from "./tools/schemas.js";
import { INSTRUCTIONS, listToolsPayload } from "./toolDefs.js";

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

export function createRedmineMcpServer(client: RedmineClient): Server {
  const server = new Server(
    { name: "redmine", version: "0.6.0" },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () =>
    listToolsPayload()
  );

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
        case "redmine_list_metadata": {
          const parsed = safeParseListMetadata(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleListMetadata(client, parsed.data);
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
        case "redmine_list_issue_relations": {
          const parsed = safeParseListIssueRelations(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleListIssueRelations(client, parsed.data);
          break;
        }
        case "redmine_add_issue_relation": {
          const parsed = safeParseAddIssueRelation(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleAddIssueRelation(client, parsed.data);
          break;
        }
        case "redmine_update_issue_relation": {
          const parsed = safeParseUpdateIssueRelation(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleUpdateIssueRelation(client, parsed.data);
          break;
        }
        case "redmine_remove_issue_relation": {
          const parsed = safeParseRemoveIssueRelation(req.params.arguments);
          if (!parsed.success) throw validationError(parsed.error.message);
          result = await handleRemoveIssueRelation(client, parsed.data);
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

  return server;
}
