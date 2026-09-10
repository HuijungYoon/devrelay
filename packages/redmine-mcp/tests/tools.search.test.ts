import { describe, it, expect, vi } from "vitest";
import { RedmineError } from "redmine-devrelay-client";
import { handleSearchIssues, resolveUserFilter } from "../src/tools/issues.js";
import { handleSearchText } from "../src/tools/search.js";
import { safeParseSearch, safeParseSearchText } from "../src/tools/schemas.js";

const EMPTY = { issues: [], totalCount: 0, returnedCount: 0, hasMore: false };

function searchClient(extra: Record<string, unknown> = {}) {
  return {
    searchIssues: vi.fn().mockResolvedValue(EMPTY),
    listTrackers: vi.fn().mockResolvedValue([{ id: 1, name: "버그" }, { id: 2, name: "기능추가" }]),
    listIssueStatuses: vi.fn().mockResolvedValue([
      { id: 1, name: "신규", isClosed: false },
      { id: 2, name: "진행중", isClosed: false },
    ]),
    listIssuePriorities: vi.fn().mockResolvedValue([{ id: 4, name: "높음", isDefault: false }]),
    listProjectVersions: vi.fn().mockResolvedValue([{ id: 7, name: "2026-Q3", status: "open", dueDate: null }]),
    listIssueCategories: vi.fn().mockResolvedValue([{ id: 2, name: "프론트엔드", assignedTo: null }]),
    listProjectPeople: vi.fn().mockResolvedValue({
      members: [
        { id: 16, login: "sjyoon", name: "윤 석준" },
        { id: 164, login: "hjyoon", name: "윤 희중" },
      ],
    }),
    searchUsers: vi.fn().mockResolvedValue({ users: [] }),
    ...extra,
  };
}

describe("redmine_search_issues name resolution", () => {
  it("passes plain filters through unchanged and adds no resolved block", async () => {
    const client = searchClient();
    const result = await handleSearchIssues(client as never, {
      assignedTo: "me",
      status: "open",
      dueAfter: "2026-09-08",
      dueBefore: "2026-09-12",
      limit: 20,
    });
    expect(client.searchIssues).toHaveBeenCalledWith({
      assignedTo: "me",
      status: "open",
      dueAfter: "2026-09-08",
      dueBefore: "2026-09-12",
      limit: 20,
    });
    expect((result as Record<string, unknown>).resolved).toBeUndefined();
  });

  it("resolves tracker, priority, status, version, category and people names", async () => {
    const client = searchClient();
    const result = await handleSearchIssues(client as never, {
      projectId: 301,
      trackerId: "버그",
      priorityId: "높음",
      status: "진행중",
      fixedVersionId: "2026-Q3",
      categoryId: "프론트엔드",
      authorId: "윤 석준",
      watcherId: "희중",
    });
    expect(client.searchIssues).toHaveBeenCalledWith({
      projectId: 301,
      trackerId: 1,
      priorityId: 4,
      status: 2,
      fixedVersionId: 7,
      categoryId: 2,
      authorId: 16,
      watcherId: 164,
    });
    expect((result as Record<string, unknown>).resolved).toEqual({
      tracker: "버그",
      priority: "높음",
      status: "진행중",
      fixedVersion: "2026-Q3",
      category: "프론트엔드",
      authorId: "윤 석준",
      watcherId: "윤 희중",
    });
  });

  it("needs projectId to resolve a version or category name", async () => {
    const client = searchClient();
    await expect(
      handleSearchIssues(client as never, { fixedVersionId: "2026-Q3" })
    ).rejects.toMatchObject({
      code: "REDMINE_VALIDATION_ERROR",
      message: expect.stringContaining("projectId"),
    });
    expect(client.searchIssues).not.toHaveBeenCalled();
  });

  it("resolveUserFilter falls back to the users API and refuses ambiguity", async () => {
    const client = searchClient({
      searchUsers: vi.fn().mockResolvedValue({
        users: [{ id: 5, login: "kim", name: "김 철수" }],
      }),
    });
    expect(await resolveUserFilter(client as never, undefined, "김 철수", "authorId")).toEqual({
      id: 5,
      label: "김 철수",
    });
    expect(await resolveUserFilter(client as never, undefined, "42", "authorId")).toEqual({ id: 42 });
    await expect(
      resolveUserFilter(client as never, 301, "윤", "watcherId")
    ).rejects.toMatchObject({ message: expect.stringContaining("Ambiguous") });
  });

  it("gives a projectId hint when a name cannot be matched without a project", async () => {
    const client = searchClient({
      searchUsers: vi.fn().mockRejectedValue(
        new RedmineError({ code: "REDMINE_PERMISSION_DENIED", message: "403", httpStatus: 403 })
      ),
    });
    await expect(
      handleSearchIssues(client as never, { assignedTo: "김 철수" })
    ).rejects.toMatchObject({
      check: expect.arrayContaining([expect.stringContaining("projectId")]),
    });
  });
});

describe("search schemas", () => {
  it("accepts names and date ranges, rejects reversed ranges", () => {
    expect(
      safeParseSearch({ trackerId: "버그", status: "진행중", authorId: "윤 석준" }).success
    ).toBe(true);
    expect(safeParseSearch({ dueAfter: "2026-09-01", dueBefore: "2026-09-30" }).success).toBe(true);
    expect(safeParseSearch({ dueAfter: "2026-09-30", dueBefore: "2026-09-01" }).success).toBe(false);
    expect(safeParseSearch({ dueBefore: "next week" }).success).toBe(false);
  });

  it("search_text requires a query and known types", () => {
    expect(safeParseSearchText({}).success).toBe(false);
    expect(safeParseSearchText({ query: "x" }).success).toBe(true);
    expect(safeParseSearchText({ query: "x", types: ["wiki_pages"] }).success).toBe(true);
    expect(safeParseSearchText({ query: "x", types: ["nope"] }).success).toBe(false);
    expect(safeParseSearchText({ query: "x", limit: 101 }).success).toBe(false);
  });
});

describe("redmine_search_text", () => {
  it("delegates to client.searchText with only the given options", async () => {
    const searchText = vi.fn().mockResolvedValue({
      query: "x",
      results: [],
      totalCount: 0,
      returnedCount: 0,
      hasMore: false,
    });
    await handleSearchText({ searchText } as never, {
      query: "x",
      projectId: 301,
      openIssuesOnly: true,
    });
    expect(searchText).toHaveBeenCalledWith({
      query: "x",
      projectId: 301,
      openIssuesOnly: true,
    });
  });
});
