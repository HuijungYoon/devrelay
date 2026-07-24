import { randomUUID } from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  RedmineClient,
  configFromCredentials,
} from "redmine-devrelay-client";
import { createRedmineMcpServer } from "../createServer.js";
import { logInfo } from "../logging.js";
import { parseByokHeaders } from "./byok.js";
import { SessionStore } from "./sessions.js";

export type CreateHttpAppOptions = {
  allowEnvFallback: boolean;
};

function resolveByok(
  headers: Request["headers"],
  allowEnvFallback: boolean
): { baseUrl: string; apiKey: string } | null {
  try {
    return parseByokHeaders(headers);
  } catch {
    // headers missing — try env fallback when allowed
  }

  if (!allowEnvFallback) return null;

  const baseUrl = process.env.REDMINE_URL?.trim();
  const apiKey = process.env.REDMINE_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

function sendByokRequired(res: Response): void {
  res.status(401).json({
    error: "BYOK required",
    message: "Set X-Redmine-Url and X-Redmine-Api-Key headers",
  });
}

export function createHttpApp(opts: CreateHttpAppOptions): Express {
  const app = express();
  app.use(express.json({ limit: "4mb" }));
  const sessions = new SessionStore();

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get("/.well-known/openai-apps-challenge", (_req, res) => {
    const token = process.env.OPENAI_APPS_CHALLENGE_TOKEN?.trim();
    if (!token) {
      res.status(404).type("text/plain").send("not configured");
      return;
    }
    res.status(200).type("text/plain").send(token);
  });

  app.post("/mcp", async (req, res) => {
    try {
      const sessionIdHeader = req.headers["mcp-session-id"];
      const sessionId =
        typeof sessionIdHeader === "string" ? sessionIdHeader : undefined;

      if (sessionId) {
        const existing = sessions.get(sessionId);
        if (!existing) {
          res.status(404).json({
            jsonrpc: "2.0",
            error: { code: -32001, message: "Session not found" },
            id: null,
          });
          return;
        }
        await existing.transport.handleRequest(req, res, req.body);
        return;
      }

      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
        return;
      }

      const credentials = resolveByok(req.headers, opts.allowEnvFallback);
      if (!credentials) {
        sendByokRequired(res);
        return;
      }

      const client = RedmineClient.fromConfig(
        configFromCredentials(credentials)
      );
      const server = createRedmineMcpServer(client);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, { transport, server, client });
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
        }
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logInfo("mcp request failed", {
        message: err instanceof Error ? err.message : "unknown error",
      });
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionIdHeader = req.headers["mcp-session-id"];
    const sessionId =
      typeof sessionIdHeader === "string" ? sessionIdHeader : undefined;
    if (!sessionId || !sessions.get(sessionId)) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    const entry = sessions.get(sessionId)!;
    await entry.transport.handleRequest(req, res);
  };

  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);

  return app;
}
