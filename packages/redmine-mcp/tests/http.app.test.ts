import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { createHttpApp } from "../src/http/app.js";

const INIT_BODY = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "0" },
  },
};

const BYOK_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  "x-redmine-url": "https://redmine.example.com",
  "x-redmine-api-key": "test-key",
};

async function byokInitialize(
  base: string,
  headers: Record<string, string> = BYOK_HEADERS
): Promise<{
  res: Response;
  sessionId: string | null;
  body: string;
}> {
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(INIT_BODY),
  });
  // Drain SSE/JSON body so the connection can close cleanly.
  const body = await res.text();
  return { res, sessionId: res.headers.get("mcp-session-id"), body };
}

describe("http app", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    process.env.OPENAI_APPS_CHALLENGE_TOKEN = "challenge-token-test";
    const app = createHttpApp({ allowEnvFallback: false });
    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  it("serves challenge token as plain text", async () => {
    const res = await fetch(`${base}/.well-known/openai-apps-challenge`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/plain/);
    expect(await res.text()).toBe("challenge-token-test");
  });

  it("healthz ok", async () => {
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
  });

  it("serves privacy and terms html", async () => {
    const privacy = await fetch(`${base}/privacy`);
    expect(privacy.status).toBe(200);
    expect(privacy.headers.get("content-type")).toMatch(/html/);
    expect(await privacy.text()).toMatch(/Privacy Policy/i);

    const terms = await fetch(`${base}/terms`);
    expect(terms.status).toBe(200);
    expect(terms.headers.get("content-type")).toMatch(/html/);
    expect(await terms.text()).toMatch(/Terms of Use/i);
  });

  it("rejects /mcp without BYOK", async () => {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(INIT_BODY),
    });
    expect(res.status).toBe(401);
  });

  it("invalid BYOK URL returns 400 not 500 and omits apiKey", async () => {
    const apiKey = "secret-key-must-not-leak";
    const { res, body } = await byokInitialize(base, {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "x-redmine-url": "not-a-valid-url",
      "x-redmine-api-key": apiKey,
    });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
    expect(body).not.toContain(apiKey);
    const json = JSON.parse(body) as { error?: string; message?: string };
    expect(json.error).toBe("Invalid credentials");
    expect(json.message).toBeTruthy();
  });

  it("successful BYOK initialize returns session id header", async () => {
    const { res, sessionId } = await byokInitialize(base);
    expect(res.status).toBe(200);
    expect(sessionId).toBeTruthy();
    expect(sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("follow-up request with mcp-session-id is accepted as known session", async () => {
    const { sessionId } = await byokInitialize(base);
    expect(sessionId).toBeTruthy();

    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });
    await res.text();
    // Known session: not 401 (BYOK) and not 404 (unknown session).
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(404);
    expect([200, 202]).toContain(res.status);
  });

  it("DELETE session then subsequent request fails appropriately", async () => {
    const { sessionId } = await byokInitialize(base);
    expect(sessionId).toBeTruthy();

    const del = await fetch(`${base}/mcp`, {
      method: "DELETE",
      headers: { "mcp-session-id": sessionId! },
    });
    await del.text();
    expect(del.status).toBe(200);

    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });
    await res.text();
    expect(res.status).toBe(404);
  });
});

describe("http app session limits", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = createHttpApp({
      allowEnvFallback: false,
      maxSessions: 1,
      ttlMs: 30 * 60 * 1000,
    });
    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  it("rejects new initialize with 503 when at maxSessions", async () => {
    const first = await byokInitialize(base);
    expect(first.res.status).toBe(200);
    expect(first.sessionId).toBeTruthy();

    const second = await byokInitialize(base);
    expect(second.res.status).toBe(503);
    expect(second.body).toMatch(/Session limit/i);
    expect(second.body).not.toContain("test-key");
  });
});
