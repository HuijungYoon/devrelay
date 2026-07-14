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

  it("postJson sends JSON body with Content-Type and does not retry 503", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const http = new RedmineHttp(baseConfig, { retryBackoffMs: 1 });
    await expect(
      http.postJson("/issues.json", { issue: { subject: "x", project_id: 1 } })
    ).rejects.toMatchObject({ code: "REDMINE_UNKNOWN_ERROR", httpStatus: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      issue: { subject: "x", project_id: 1 },
    });
  });

  it("putJson uses PUT and returns JSON on 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ issue: { id: 9 } }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const http = new RedmineHttp(baseConfig);
    const data = await http.putJson<{ issue: { id: number } }>(
      "/issues/9.json",
      { issue: { notes: "hi" } }
    );
    expect(data.issue.id).toBe(9);
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
  });

  it("putJson returns undefined on empty 200 body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 200 }))
    );
    const http = new RedmineHttp(baseConfig);
    await expect(
      http.putJson("/issues/1.json", { issue: {} })
    ).resolves.toBeUndefined();
  });

  it("postBinary sends binary body with custom Content-Type and parses JSON response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ upload: { token: "abc123" } }), {
        status: 201,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const http = new RedmineHttp(baseConfig);
    const body = Buffer.from("file bytes");
    const data = await http.postBinary<{ upload: { token: string } }>(
      "/uploads.json",
      body,
      { "Content-Type": "application/octet-stream" },
      { filename: "doc.pdf" }
    );
    expect(data.upload.token).toBe("abc123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://redmine.example.com/uploads.json?filename=doc.pdf"
    );
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/octet-stream");
    expect(init.headers["Content-Type"]).not.toBe("application/json");
    expect(init.body).toBe(body);
  });

  it("preserves baseUrl path prefix such as /redmine", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const http = new RedmineHttp({
      ...baseConfig,
      baseUrl: "http://192.168.1.20/redmine",
    });
    await http.getJson("/users/current.json");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://192.168.1.20/redmine/users/current.json"
    );
  });
});
