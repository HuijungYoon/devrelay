import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedmineClient } from "../src/client.js";
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
