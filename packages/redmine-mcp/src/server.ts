#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RedmineClient } from "redmine-devrelay-client";
import { createRedmineMcpServer } from "./createServer.js";
import { logInfo } from "./logging.js";

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

export async function startServer(
  client: RedmineClient = RedmineClient.fromEnv()
): Promise<Server> {
  const server = createRedmineMcpServer(client);
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
