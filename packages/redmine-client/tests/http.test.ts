import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedmineHttp } from "../src/http.js";
import type { RedmineConfig } from "../src/config.js";

const baseConfig: RedmineConfig = {
  baseUrl: "https://redmine.example.com",
  apiKey: "secret-key",
  connectTimeoutMs: 5000,
  requestTimeoutMs: 15000,
  maxResultCount: 100,
  logLevel: "info",
  userAgent: "redmine-mcp/0.1.0",
};

describe("RedmineHttp", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("sends X-Redmine-API-Key and Accept headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const http = new RedmineHttp(baseConfig);
    await http.getJson("/users/current.json");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-Redmine-API-Key"]).toBe("secret-key");
    expect(init.headers["Accept"]).toBe("application/json");
  });

  it("maps 401 to AUTHENTICATION_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }))
    );
    const http = new RedmineHttp(baseConfig);
    await expect(http.getJson("/users/current.json")).rejects.toMatchObject({
      code: "REDMINE_AUTHENTICATION_ERROR",
    });
  });

  it("retries GET on 503 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { id: 1 } }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const http = new RedmineHttp(baseConfig, { retryBackoffMs: 1 });
    const data = await http.getJson<{ user: { id: number } }>(
      "/users/current.json"
    );
    expect(data.user.id).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
