import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { RedmineClient } from "redmine-devrelay-client";

export type SessionEntry = {
  transport: StreamableHTTPServerTransport;
  server: Server;
  client: RedmineClient;
};

type StoredSession = SessionEntry & { lastAccessAt: number };

export type SessionStoreOptions = {
  /** Max concurrent sessions; default env MCP_MAX_SESSIONS or 100 */
  maxSessions?: number;
  /** Idle TTL in ms; default env MCP_SESSION_TTL_MS or 30 minutes */
  ttlMs?: number;
  /** Clock for tests */
  now?: () => number;
};

const DEFAULT_MAX_SESSIONS = 100;
const DEFAULT_TTL_MS = 30 * 60 * 1000;

function envPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export class SessionStore {
  private readonly sessions = new Map<string, StoredSession>();
  readonly maxSessions: number;
  readonly ttlMs: number;
  private readonly now: () => number;

  constructor(opts?: SessionStoreOptions) {
    this.maxSessions =
      opts?.maxSessions ??
      envPositiveInt("MCP_MAX_SESSIONS", DEFAULT_MAX_SESSIONS);
    this.ttlMs =
      opts?.ttlMs ?? envPositiveInt("MCP_SESSION_TTL_MS", DEFAULT_TTL_MS);
    this.now = opts?.now ?? Date.now;
  }

  get size(): number {
    return this.sessions.size;
  }

  /** Prune idle sessions, then report whether a new session may be created. */
  canCreate(): boolean {
    this.pruneExpired();
    return this.sessions.size < this.maxSessions;
  }

  get(sessionId: string): SessionEntry | undefined {
    this.pruneExpired();
    const entry = this.sessions.get(sessionId);
    if (!entry) return undefined;
    entry.lastAccessAt = this.now();
    return entry;
  }

  set(sessionId: string, entry: SessionEntry): void {
    this.pruneExpired();
    this.sessions.set(sessionId, {
      ...entry,
      lastAccessAt: this.now(),
    });
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private pruneExpired(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [id, entry] of this.sessions) {
      if (entry.lastAccessAt < cutoff) {
        this.sessions.delete(id);
        void entry.transport.close().catch(() => {});
        void entry.server.close().catch(() => {});
      }
    }
  }
}
