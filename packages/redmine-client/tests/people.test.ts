import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedmineClient } from "../src/client.js";
import { RedmineError } from "../src/errors.js";
import type { RedmineHttp } from "../src/http.js";
import type { RedmineConfig } from "../src/config.js";

const config: RedmineConfig = {
  baseUrl: "https://redmine.example.com",
  apiKey: "k",
  connectTimeoutMs: 5000,
  requestTimeoutMs: 15000,
  maxResultCount: 100,
  logLevel: "info",
  userAgent: "redmine-mcp/0.7.1",
};

const denied = () =>
  new RedmineError({
    code: "REDMINE_PERMISSION_DENIED",
    message: "Redmine permission denied",
    httpStatus: 403,
  });

function clientWith(getJson: ReturnType<typeof vi.fn>): RedmineClient {
  return new RedmineClient({ getJson } as unknown as RedmineHttp, config);
}

describe("listProjectPeople (담당자·일감관리자 후보)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("uses the memberships API when it is allowed", async () => {
    const getJson = vi.fn().mockResolvedValue({
      memberships: [
        { id: 1, user: { id: 164, name: "윤 희중" } },
        { id: 2, user: { id: 141, name: "박 병주" } },
      ],
      total_count: 2,
    });
    const result = await clientWith(getJson).listProjectPeople({
      projectId: 301,
    });
    expect(getJson.mock.calls[0][0]).toBe("/projects/301/memberships.json");
    expect(result.source).toBe("memberships");
    expect(result.members.map((u) => u.id)).toEqual([164, 141]);
  });

  it("harvests recent assignees when memberships is forbidden", async () => {
    const getJson = vi
      .fn()
      .mockRejectedValueOnce(denied())
      .mockResolvedValueOnce({
        issues: [
          { id: 1, subject: "a", assigned_to: { id: 164, name: "윤 희중" } },
          { id: 2, subject: "b", assigned_to: { id: 226, name: "조 민석" } },
          { id: 3, subject: "c", assigned_to: { id: 164, name: "윤 희중" } },
          { id: 4, subject: "d" },
        ],
        total_count: 4,
        offset: 0,
        limit: 100,
      });

    const result = await clientWith(getJson).listProjectPeople({
      projectId: 301,
    });
    expect(getJson.mock.calls[1][0]).toBe("/issues.json");
    expect(result.source).toBe("issues");
    expect(result.members).toEqual([
      { id: 164, login: "164", name: "윤 희중" },
      { id: 226, login: "226", name: "조 민석" },
    ]);
    expect(result.totalCount).toBe(2);
  });

  it("filters the harvested people by query", async () => {
    const getJson = vi
      .fn()
      .mockRejectedValueOnce(denied())
      .mockResolvedValueOnce({
        issues: [
          { id: 1, subject: "a", assigned_to: { id: 164, name: "윤 희중" } },
          { id: 2, subject: "b", assigned_to: { id: 226, name: "조 민석" } },
        ],
        total_count: 2,
        offset: 0,
        limit: 100,
      });
    const result = await clientWith(getJson).listProjectPeople({
      projectId: 301,
      query: "조민석",
    });
    expect(result.members).toEqual([
      { id: 226, login: "226", name: "조 민석" },
    ]);
  });

  it("does not swallow a non-permission error", async () => {
    const getJson = vi.fn().mockRejectedValue(
      new RedmineError({
        code: "REDMINE_AUTHENTICATION_ERROR",
        message: "bad key",
        httpStatus: 401,
      })
    );
    await expect(
      clientWith(getJson).listProjectPeople({ projectId: 301 })
    ).rejects.toMatchObject({ code: "REDMINE_AUTHENTICATION_ERROR" });
    expect(getJson).toHaveBeenCalledTimes(1);
  });
});
