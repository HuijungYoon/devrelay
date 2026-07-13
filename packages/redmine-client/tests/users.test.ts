import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchUsers } from "../src/users.js";
import type { RedmineHttp } from "../src/http.js";
import type { RedmineConfig } from "../src/config.js";

const config: RedmineConfig = {
  baseUrl: "https://redmine.example.com",
  apiKey: "k",
  connectTimeoutMs: 5000,
  requestTimeoutMs: 15000,
  maxResultCount: 100,
  logLevel: "info",
  userAgent: "redmine-mcp/0.2.5",
};

describe("searchUsers", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("queries /users.json and filters by compact name", async () => {
    const getJson = vi.fn().mockResolvedValue({
      users: [
        { id: 1, login: "a", firstname: "석준", lastname: "윤" },
        { id: 2, login: "b", firstname: "희중", lastname: "윤" },
      ],
      total_count: 2,
    });
    const http = { getJson } as unknown as RedmineHttp;
    const result = await searchUsers(http, config, { query: "윤석준" });
    expect(getJson).toHaveBeenCalledWith(
      "/users.json",
      expect.objectContaining({ name: "윤석준", status: 1 })
    );
    expect(result.users).toHaveLength(1);
    expect(result.users[0]).toMatchObject({ id: 1, name: "윤 석준" });
  });
});
