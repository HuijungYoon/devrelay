import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { RedmineClient, RedmineError } from "@m2i/redmine-client";
import { toMcpError } from "./errors.js";
import { logAudit, logInfo } from "./logging.js";
import { handleTestConnection } from "./tools/connection.js";
import { handleGetIssue, handleSearchIssues } from "./tools/issues.js";
import { handleListProjects } from "./tools/projects.js";
import {
  safeParseConnection,
  safeParseGetIssue,
  safeParseListProjects,
  safeParseSearch,
  toolJsonSchemas,
} from "./tools/schemas.js";

const INSTRUCTIONS = `Redmine read tools may be used without write confirmation.
Do not print API keys or credentials.
Phase 1 has no write tools; do not invent write operations.
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

export async function startServer(
  client: RedmineClient = RedmineClient.fromEnv()
): Promise<Server> {
  const server = new Server(
    { name: "redmine", version: "0.1.0" },
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
        default:
          throw validationError(`Unknown tool: ${toolName}`);
      }

      logAudit({
        tool: toolName,
        host,
        ok: true,
        durationMs: Date.now() - started,
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
