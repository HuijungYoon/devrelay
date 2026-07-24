import { randomUUID } from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  RedmineClient,
  RedmineError,
  configFromCredentials,
} from "redmine-devrelay-client";
import { createRedmineMcpServer } from "../createServer.js";
import { logInfo } from "../logging.js";
import { parseByokHeaders } from "./byok.js";
import { SessionStore, type SessionStoreOptions } from "./sessions.js";

export type CreateHttpAppOptions = {
  allowEnvFallback: boolean;
} & SessionStoreOptions;

function isMissingByokError(err: unknown): boolean {
  return err instanceof Error && /BYOK required/i.test(err.message);
}

function isClientConfigError(err: unknown): boolean {
  return (
    err instanceof RedmineError && err.code === "REDMINE_VALIDATION_ERROR"
  );
}

/** Safe client-facing message — never echo apiKey or raw credentials. */
function clientConfigErrorMessage(err: unknown): string {
  if (err instanceof RedmineError) {
    // RedmineError validation messages include URL/host hints, not apiKey.
    return err.message;
  }
  if (err instanceof Error && !/api[_-]?key/i.test(err.message)) {
    return err.message;
  }
  return "Invalid Redmine credentials or URL";
}

function resolveByok(
  headers: Request["headers"],
  allowEnvFallback: boolean
): { baseUrl: string; apiKey: string } | null {
  try {
    return parseByokHeaders(headers);
  } catch (err) {
    if (!isMissingByokError(err)) {
      // Non-missing validation from parseByokHeaders → caller maps to 400
      throw err;
    }
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

function sendBadCredentials(res: Response, err: unknown): void {
  res.status(400).json({
    error: "Invalid credentials",
    message: clientConfigErrorMessage(err),
  });
}

/**
 * Idempotent cleanup after failed initialize (or transport close).
 * Closes transport + MCP server and drops the session map entry so
 * RedmineClient/apiKey are not left dangling.
 */
async function cleanupInitializeSession(
  sessions: SessionStore,
  transport: StreamableHTTPServerTransport | undefined,
  server: Server | undefined
): Promise<void> {
  const sid = transport?.sessionId;
  if (sid) {
    sessions.delete(sid);
  }
  try {
    await transport?.close();
  } catch {
    // idempotent
  }
  try {
    await server?.close();
  } catch {
    // idempotent
  }
}

export function createHttpApp(opts: CreateHttpAppOptions): Express {
  // Demo-only: process env REDMINE_* is shared by every client that omits BYOK
  // headers. Prefer X-Redmine-Url / X-Redmine-Api-Key per request in production.
  // (REDMINE_ALLOWED_HOSTS applies via loadConfig elsewhere; this HTTP env
  // fallback path does not add a separate host allowlist — warning only.)
  if (opts.allowEnvFallback) {
    logInfo(
      "HTTP allowEnvFallback enabled: process env REDMINE_URL/REDMINE_API_KEY is shared across all clients (demo-only)"
    );
  }

  const app = express();
  app.use(express.json({ limit: "4mb" }));
  const sessions = new SessionStore({
    maxSessions: opts.maxSessions,
    ttlMs: opts.ttlMs,
    now: opts.now,
  });

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
    let transport: StreamableHTTPServerTransport | undefined;
    let server: Server | undefined;
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

      if (!sessions.canCreate()) {
        res.status(503).json({
          error: "Service Unavailable",
          message: `Session limit reached (max ${sessions.maxSessions})`,
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
      server = createRedmineMcpServer(client);

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, {
            transport: transport!,
            server: server!,
            client,
          });
        },
      });

      // connect() replaces transport.onclose — chain after connect so we still
      // close the MCP server and drop the session map entry.
      await server.connect(transport);
      const prevOnClose = transport.onclose;
      transport.onclose = () => {
        const sid = transport!.sessionId;
        if (sid) {
          sessions.delete(sid);
        }
        prevOnClose?.();
        void server!.close().catch(() => {});
      };

      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logInfo("mcp request failed", {
        message: err instanceof Error ? err.message : "unknown error",
      });
      await cleanupInitializeSession(sessions, transport, server);
      if (!res.headersSent) {
        if (isClientConfigError(err)) {
          sendBadCredentials(res, err);
        } else {
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
