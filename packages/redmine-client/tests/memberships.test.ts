import { describe, it, expect, vi, beforeEach } from "vitest";
import { listProjectMembers, matchMemberByName } from "../src/memberships.js";
import type { RedmineHttp } from "../src/http.js";
import type { RedmineConfig } from "../src/config.js";

const config: RedmineConfig = {
  baseUrl: "https://redmine.example.com",
  apiKey: "k",
  connectTimeoutMs: 5000,
  requestTimeoutMs: 15000,
  maxResultCount: 100,
  logLevel: "info",
  userAgent: "redmine-mcp/0.2.6",
};

describe("listProjectMembers", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("collects users from memberships and filters by query", async () => {
    const getJson = vi.fn().mockResolvedValue({
      memberships: [
        { id: 1, user: { id: 10, name: "윤 석준" } },
        { id: 2, user: { id: 11, name: "윤 희중" } },
        { id: 3, group: { id: 1, name: "Devs" } },
      ],
      total_count: 3,
    });
    const http = { getJson } as unknown as RedmineHttp;
    const result = await listProjectMembers(http, config, {
      projectId: 5,
      query: "석준",
    });
    expect(getJson).toHaveBeenCalledWith(
      "/projects/5/memberships.json",
      expect.objectContaining({ limit: expect.any(Number), offset: 0 })
    );
    expect(result.members).toEqual([{ id: 10, login: "10", name: "윤 석준" }]);
  });
});

describe("matchMemberByName", () => {
  it("matches compact Korean names", () => {
    const members = [
      { id: 1, login: "1", name: "윤 석준" },
      { id: 2, login: "2", name: "김 용호" },
    ];
    expect(matchMemberByName(members, "윤석준")).toHaveLength(1);
    expect(matchMemberByName(members, "윤석준")[0].id).toBe(1);
  });
});
