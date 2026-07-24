import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { RedmineClient } from "redmine-devrelay-client";

export type SessionEntry = {
  transport: StreamableHTTPServerTransport;
  server: Server;
  client: RedmineClient;
};

export class SessionStore {
  private readonly sessions = new Map<string, SessionEntry>();

  get(sessionId: string): SessionEntry | undefined {
    return this.sessions.get(sessionId);
  }

  set(sessionId: string, entry: SessionEntry): void {
    this.sessions.set(sessionId, entry);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
