import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedmineClient } from "../src/client.js";
import { RedmineError } from "../src/errors.js";
import { matchNamedByName } from "../src/metadata.js";
import type { RedmineHttp } from "../src/http.js";
import type { RedmineConfig } from "../src/config.js";

const config: RedmineConfig = {
  baseUrl: "https://redmine.example.com",
  apiKey: "k",
  connectTimeoutMs: 5000,
  requestTimeoutMs: 15000,
  maxResultCount: 100,
  logLevel: "info",
  userAgent: "redmine-mcp/0.6.0",
};

function clientWith(getJson: ReturnType<typeof vi.fn>): RedmineClient {
  return new RedmineClient({ getJson } as unknown as RedmineHttp, config);
}

describe("metadata lookups (이름 → id)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("listTrackers normalizes id and name", async () => {
    const getJson = vi.fn().mockResolvedValue({
      trackers: [
        { id: 1, name: "버그", default_status: { id: 1, name: "신규" } },
        { id: 2, name: "기능추가" },
      ],
    });
    const trackers = await clientWith(getJson).listTrackers();
    expect(getJson).toHaveBeenCalledWith("/trackers.json");
    expect(trackers).toEqual([
      { id: 1, name: "버그" },
      { id: 2, name: "기능추가" },
    ]);
  });

  it("listIssueStatuses keeps the closed flag", async () => {
    const getJson = vi.fn().mockResolvedValue({
      issue_statuses: [
        { id: 1, name: "신규" },
        { id: 5, name: "완료", is_closed: true },
      ],
    });
    const statuses = await clientWith(getJson).listIssueStatuses();
    expect(getJson).toHaveBeenCalledWith("/issue_statuses.json");
    expect(statuses).toEqual([
      { id: 1, name: "신규", isClosed: false },
      { id: 5, name: "완료", isClosed: true },
    ]);
  });

  it("listIssuePriorities keeps the default flag", async () => {
    const getJson = vi.fn().mockResolvedValue({
      issue_priorities: [
        { id: 3, name: "보통", is_default: true },
        { id: 4, name: "높음" },
      ],
    });
    const priorities = await clientWith(getJson).listIssuePriorities();
    expect(getJson).toHaveBeenCalledWith(
      "/enumerations/issue_priorities.json"
    );
    expect(priorities[0]).toEqual({ id: 3, name: "보통", isDefault: true });
    expect(priorities[1].isDefault).toBe(false);
  });

  it("listProjectVersions is per project and keeps status/dueDate", async () => {
    const getJson = vi.fn().mockResolvedValue({
      versions: [
        { id: 7, name: "2026-Q3", status: "open", due_date: "2026-09-30" },
        { id: 8, name: "2026-Q2", status: "closed" },
      ],
    });
    const versions = await clientWith(getJson).listProjectVersions(11);
    expect(getJson).toHaveBeenCalledWith("/projects/11/versions.json");
    expect(versions[0]).toEqual({
      id: 7,
      name: "2026-Q3",
      status: "open",
      dueDate: "2026-09-30",
    });
    expect(versions[1].dueDate).toBeNull();
  });

  it("listIssueCategories is per project", async () => {
    const getJson = vi.fn().mockResolvedValue({
      issue_categories: [
        { id: 2, name: "프론트엔드", assigned_to: { id: 9, name: "윤 희정" } },
        { id: 3, name: "백엔드" },
      ],
    });
    const categories = await clientWith(getJson).listIssueCategories(11);
    expect(getJson).toHaveBeenCalledWith("/projects/11/issue_categories.json");
    expect(categories[0].assignedTo).toEqual({ id: 9, name: "윤 희정" });
    expect(categories[1].assignedTo).toBeNull();
  });

  it("listProjectIssueCustomFields reads the project include (Redmine 4.2+)", async () => {
    const getJson = vi.fn().mockResolvedValue({
      project: {
        id: 11,
        name: "P",
        issue_custom_fields: [
          { id: 3, name: "고객사" },
          { id: 7, name: "플랫폼" },
        ],
      },
    });
    const result = await clientWith(getJson).listProjectIssueCustomFields(11);
    expect(getJson).toHaveBeenCalledTimes(1);
    expect(getJson).toHaveBeenCalledWith("/projects/11.json", {
      include: "issue_custom_fields",
    });
    expect(result).toEqual({
      fields: [
        { id: 3, name: "고객사" },
        { id: 7, name: "플랫폼" },
      ],
      source: "project",
    });
  });

  it("listProjectIssueCustomFields trusts an empty project list without falling back", async () => {
    const getJson = vi
      .fn()
      .mockResolvedValue({ project: { id: 11, issue_custom_fields: [] } });
    const result = await clientWith(getJson).listProjectIssueCustomFields(11);
    expect(result).toEqual({ fields: [], source: "project" });
    expect(getJson).toHaveBeenCalledTimes(1);
  });

  it("listProjectIssueCustomFields falls back to /custom_fields.json on older Redmine", async () => {
    const getJson = vi.fn(async (path: string) => {
      if (path === "/projects/11.json") return { project: { id: 11 } };
      if (path === "/custom_fields.json") {
        return {
          custom_fields: [
            { id: 3, name: "고객사", customized_type: "issue", is_for_all: true },
            {
              id: 4,
              name: "다른 프로젝트 전용",
              customized_type: "issue",
              is_for_all: false,
              projects: [{ id: 99, name: "X" }],
            },
            {
              id: 5,
              name: "이 프로젝트",
              customized_type: "issue",
              is_for_all: false,
              projects: [{ id: 11, name: "P" }],
            },
            { id: 6, name: "사용자 필드", customized_type: "user" },
          ],
        };
      }
      throw new Error("unexpected " + path);
    });
    const result = await clientWith(getJson).listProjectIssueCustomFields(11);
    expect(result).toEqual({
      fields: [
        { id: 3, name: "고객사" },
        { id: 5, name: "이 프로젝트" },
      ],
      source: "custom_fields",
    });
  });

  it("listProjectIssueCustomFields samples recent issues when the admin API is refused", async () => {
    const getJson = vi.fn(async (path: string, query?: Record<string, unknown>) => {
      if (path === "/projects/11.json") return { project: { id: 11 } };
      if (path === "/custom_fields.json") {
        throw new RedmineError({
          code: "REDMINE_AUTHENTICATION_ERROR",
          message: "401",
          httpStatus: 401,
        });
      }
      if (path === "/issues.json") {
        expect(query).toMatchObject({ project_id: 11, status_id: "*" });
        return {
          issues: [
            {
              id: 1,
              custom_fields: [
                { id: 3, name: "고객사", value: "A사" },
                { id: 7, name: "플랫폼", value: [] },
              ],
            },
            { id: 2, custom_fields: [{ id: 3, name: "고객사", value: "" }] },
            { id: 3 },
          ],
        };
      }
      throw new Error("unexpected " + path);
    });
    const result = await clientWith(getJson).listProjectIssueCustomFields(11);
    expect(result).toEqual({
      fields: [
        { id: 3, name: "고객사" },
        { id: 7, name: "플랫폼" },
      ],
      source: "issues",
    });
  });

  it("listProjectIssueCustomFields does not swallow a network error on the admin API", async () => {
    const getJson = vi.fn(async (path: string) => {
      if (path === "/projects/11.json") return { project: { id: 11 } };
      throw new RedmineError({
        code: "REDMINE_NETWORK_ERROR",
        message: "boom",
      });
    });
    await expect(
      clientWith(getJson).listProjectIssueCustomFields(11)
    ).rejects.toMatchObject({ code: "REDMINE_NETWORK_ERROR" });
  });

  it("tolerates an empty body", async () => {
    const getJson = vi.fn().mockResolvedValue({});
    expect(await clientWith(getJson).listTrackers()).toEqual([]);
  });

  it("matchNamedByName prefers exact, ignoring case and spaces", () => {
    const items = [
      { id: 1, name: "진행중" },
      { id: 2, name: "진행중 (검토)" },
      { id: 3, name: "In Progress" },
    ];
    expect(matchNamedByName(items, "진행중")).toEqual([
      { id: 1, name: "진행중" },
    ]);
    expect(matchNamedByName(items, "in progress")).toEqual([
      { id: 3, name: "In Progress" },
    ]);
    expect(matchNamedByName(items, "진행").map((i) => i.id)).toEqual([1, 2]);
    expect(matchNamedByName(items, "없는상태")).toEqual([]);
  });
});
