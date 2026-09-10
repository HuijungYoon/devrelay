import { describe, it, expect, vi } from "vitest";
import { RedmineClient } from "../src/client.js";
import { buildIssueQuery, dateRangeFilter } from "../src/issues.js";
import { buildSearchTextQuery } from "../src/search.js";
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
  userAgent: "redmine-mcp/0.8.0",
};

describe("issue search filters", () => {
  it("dateRangeFilter picks the Redmine operator", () => {
    expect(dateRangeFilter("2026-09-01", "2026-09-30")).toBe("><2026-09-01|2026-09-30");
    expect(dateRangeFilter("2026-09-01", undefined)).toBe(">=2026-09-01");
    expect(dateRangeFilter(undefined, "2026-09-30")).toBe("<=2026-09-30");
    expect(dateRangeFilter(undefined, undefined)).toBeUndefined();
  });

  it("maps due date, author, watcher, version and category", () => {
    expect(
      buildIssueQuery({
        projectId: 301,
        dueAfter: "2026-09-08",
        dueBefore: "2026-09-12",
        authorId: "me",
        watcherId: 16,
        fixedVersionId: 7,
        categoryId: 2,
        createdBefore: "2026-01-01",
        updatedAfter: "2026-08-01",
        updatedBefore: "2026-08-31",
      })
    ).toEqual({
      project_id: 301,
      status_id: "open",
      due_date: "><2026-09-08|2026-09-12",
      author_id: "me",
      watcher_id: "16",
      fixed_version_id: 7,
      category_id: 2,
      created_on: "<=2026-01-01",
      updated_on: "><2026-08-01|2026-08-31",
    });
  });

  it("keeps the old single-bound createdAfter/updatedAfter shape", () => {
    expect(
      buildIssueQuery({ createdAfter: "2026-07-01", updatedAfter: "2026-08-01" })
    ).toMatchObject({ created_on: ">=2026-07-01", updated_on: ">=2026-08-01" });
  });
});

describe("full-text search", () => {
  it("buildSearchTextQuery defaults to issues with all_words", () => {
    expect(buildSearchTextQuery({ query: " 라이선스 " })).toEqual({
      q: "라이선스",
      issues: 1,
      all_words: 1,
    });
    expect(
      buildSearchTextQuery({
        query: "x",
        types: ["wiki_pages", "news"],
        titlesOnly: true,
        openIssuesOnly: true,
        allWords: false,
      })
    ).toEqual({ q: "x", wiki_pages: 1, news: 1, titles_only: 1, open_issues: 1 });
  });

  it("searchText normalizes rows and scopes to a project path", async () => {
    const getJson = vi.fn().mockResolvedValue({
      results: [
        {
          id: 24110,
          title: "기능추가 #24110 (신규): [License] 라이선스 대시보드 구성",
          type: "issue",
          url: "http://redmine/issues/24110",
          description: "대시보드 …",
          datetime: "2026-09-09T03:13:41Z",
        },
      ],
      total_count: 1,
      offset: 0,
      limit: 25,
    });
    const client = new RedmineClient({ getJson } as unknown as RedmineHttp, config);
    const result = await client.searchText({ query: "라이선스", projectId: 301 });
    expect(getJson).toHaveBeenCalledWith("/projects/301/search.json", {
      q: "라이선스",
      issues: 1,
      all_words: 1,
      limit: 25,
      offset: 0,
    });
    expect(result).toEqual({
      query: "라이선스",
      results: [
        {
          id: 24110,
          title: "기능추가 #24110 (신규): [License] 라이선스 대시보드 구성",
          type: "issue",
          url: "http://redmine/issues/24110",
          description: "대시보드 …",
          datetime: "2026-09-09T03:13:41Z",
        },
      ],
      totalCount: 1,
      returnedCount: 1,
      hasMore: false,
    });
  });

  it("explains a missing search API instead of blaming the key", async () => {
    const getJson = vi.fn().mockRejectedValue(
      new RedmineError({
        code: "REDMINE_AUTHENTICATION_ERROR",
        message: "auth",
        httpStatus: 401,
      })
    );
    const client = new RedmineClient({ getJson } as unknown as RedmineHttp, config);
    await expect(client.searchText({ query: "x" })).rejects.toMatchObject({
      code: "REDMINE_UNKNOWN_ERROR",
      message: expect.stringContaining("3.3+"),
      check: expect.arrayContaining([expect.stringContaining("subjectContains")]),
    });
  });

  it("rejects an empty query without calling Redmine", async () => {
    const getJson = vi.fn();
    const client = new RedmineClient({ getJson } as unknown as RedmineHttp, config);
    await expect(client.searchText({ query: "   " })).rejects.toMatchObject({
      code: "REDMINE_VALIDATION_ERROR",
    });
    expect(getJson).not.toHaveBeenCalled();
  });
});
