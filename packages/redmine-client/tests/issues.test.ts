import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { buildIssueQuery } from "../src/issues.js";
import { RedmineClient } from "../src/index.js";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.REDMINE_URL = "https://redmine.example.com";
  process.env.REDMINE_API_KEY = "k";
  process.env.REDMINE_MAX_RESULT_COUNT = "100";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

describe("buildIssueQuery", () => {
  it("defaults status to open and maps assignedTo me", () => {
    expect(buildIssueQuery({ assignedTo: "me", status: "open" })).toMatchObject(
      {
        assigned_to_id: "me",
        status_id: "open",
      }
    );
  });

  it("defaults status to open when omitted", () => {
    expect(buildIssueQuery({})).toMatchObject({ status_id: "open" });
  });
});

describe("searchIssues", () => {
  it("carries dueDate and doneRatio in the summary (no per-issue fetch)", async () => {
    const http = {
      getJson: vi.fn().mockResolvedValue({
        issues: [
          {
            id: 23858,
            subject: "License batch screen",
            project: { id: 11, name: "CLOUD-HMI" },
            tracker: { id: 2, name: "Feature" },
            status: { id: 2, name: "In progress" },
            priority: { id: 2, name: "Normal" },
            assigned_to: { id: 164, name: "Me" },
            due_date: "2026-08-14",
            done_ratio: 70,
            updated_on: "2026-08-10T00:00:00Z",
            created_on: "2026-07-27T00:00:00Z",
          },
          { id: 24032, subject: "No dates", project: null },
        ],
        total_count: 2,
        offset: 0,
        limit: 100,
      }),
    };
    const client = RedmineClient.fromEnv();
    const withHttp = new (Object.getPrototypeOf(client).constructor)(
      http as never,
      client.config
    );
    const result = await withHttp.searchIssues({ assignedTo: "me" });
    expect(result.issues[0]).toMatchObject({
      id: 23858,
      dueDate: "2026-08-14",
      doneRatio: 70,
    });
    expect(result.issues[1]).toMatchObject({ dueDate: null, doneRatio: null });
    expect(http.getJson).toHaveBeenCalledTimes(1);
  });

  it("paginates beyond 100 and caps by maxResultCount", async () => {
    process.env.REDMINE_MAX_RESULT_COUNT = "150";
    const page1 = {
      issues: Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        subject: `Issue ${i + 1}`,
        project: { id: 1, name: "P" },
        tracker: { id: 1, name: "Bug" },
        status: { id: 1, name: "New" },
        priority: { id: 2, name: "Normal" },
        assigned_to: { id: 1, name: "Me" },
        updated_on: "2026-07-01T00:00:00Z",
        created_on: "2026-07-01T00:00:00Z",
      })),
      total_count: 150,
      offset: 0,
      limit: 100,
    };
    const page2 = {
      issues: Array.from({ length: 50 }, (_, i) => ({
        id: 101 + i,
        subject: `Issue ${101 + i}`,
        project: { id: 1, name: "P" },
        tracker: { id: 1, name: "Bug" },
        status: { id: 1, name: "New" },
        priority: { id: 2, name: "Normal" },
        assigned_to: { id: 1, name: "Me" },
        updated_on: "2026-07-01T00:00:00Z",
        created_on: "2026-07-01T00:00:00Z",
      })),
      total_count: 150,
      offset: 100,
      limit: 100,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page1), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page2), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = RedmineClient.fromEnv();
    const res = await client.searchIssues({ limit: 150 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = String(fetchMock.mock.calls[1][0]);
    expect(secondUrl).toContain("offset=100");
    expect(res.returnedCount).toBe(150);
    expect(res.totalCount).toBe(150);
    expect(res.hasMore).toBe(false);
  });
});

describe("getIssue", () => {
  it("requests journals include", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          issue: {
            id: 1523,
            subject: "Test",
            description: "desc",
            project: { id: 1, name: "P" },
            tracker: { id: 1, name: "Bug" },
            status: { id: 1, name: "New" },
            priority: { id: 2, name: "Normal" },
            author: { id: 1, name: "Author" },
            assigned_to: null,
            start_date: null,
            due_date: null,
            done_ratio: 0,
            estimated_hours: null,
            parent: null,
            custom_fields: [],
            journals: [],
            updated_on: "2026-07-01T00:00:00Z",
            created_on: "2026-07-01T00:00:00Z",
          },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = RedmineClient.fromEnv();
    await client.getIssue(1523, { include: ["journals"] });
    expect(String(fetchMock.mock.calls[0][0])).toContain("include=journals");
  });

  it("maps 404 to ISSUE_NOT_FOUND", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("missing", { status: 404 }))
    );
    const client = RedmineClient.fromEnv();
    await expect(client.getIssue(999)).rejects.toMatchObject({
      code: "REDMINE_ISSUE_NOT_FOUND",
    });
  });
});
