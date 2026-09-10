import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedmineClient } from "../src/client.js";
import { buildTimeEntryQuery } from "../src/timeEntries.js";
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

function clientWith(http: Partial<RedmineHttp>): RedmineClient {
  return new RedmineClient(http as unknown as RedmineHttp, config);
}

const RAW_ENTRY = {
  id: 928,
  project: { id: 109, name: "WEB-HMI" },
  issue: { id: 22374 },
  user: { id: 164, name: "윤 희중" },
  activity: { id: 9, name: "개발" },
  hours: 1.5,
  comments: "다국어 설정",
  spent_on: "2026-09-10",
  created_on: "2026-09-10T05:26:13Z",
  updated_on: "2026-09-10T05:26:13Z",
};

describe("time entry query", () => {
  it("uses the Redmine range syntax when both dates are given", () => {
    expect(
      buildTimeEntryQuery({ spentFrom: "2026-09-01", spentTo: "2026-09-10" })
    ).toMatchObject({ spent_on: "><2026-09-01|2026-09-10" });
  });

  it("uses >= / <= for a single bound", () => {
    expect(buildTimeEntryQuery({ spentFrom: "2026-09-01" })).toMatchObject({
      spent_on: ">=2026-09-01",
    });
    expect(buildTimeEntryQuery({ spentTo: "2026-09-10" })).toMatchObject({
      spent_on: "<=2026-09-10",
    });
  });

  it("maps issue, project, user and activity filters", () => {
    expect(
      buildTimeEntryQuery({
        issueId: 5,
        projectId: 11,
        userId: "me",
        activityId: 9,
      })
    ).toEqual({
      issue_id: 5,
      project_id: 11,
      user_id: "me",
      activity_id: 9,
      sort: "spent_on:desc",
    });
  });
});

describe("time entries", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("listTimeEntries normalizes rows and sums hours", async () => {
    const getJson = vi.fn().mockResolvedValue({
      time_entries: [RAW_ENTRY, { ...RAW_ENTRY, id: 929, hours: "0.25" }],
      total_count: 2,
    });
    const result = await clientWith({ getJson }).listTimeEntries({
      userId: "me",
      limit: 10,
    });
    expect(getJson).toHaveBeenCalledWith("/time_entries.json", {
      user_id: "me",
      sort: "spent_on:desc",
      limit: 10,
      offset: 0,
    });
    expect(result.entries[0]).toEqual({
      id: 928,
      project: { id: 109, name: "WEB-HMI" },
      issue: { id: 22374 },
      user: { id: 164, name: "윤 희중" },
      activity: { id: 9, name: "개발" },
      hours: 1.5,
      comments: "다국어 설정",
      spentOn: "2026-09-10",
      createdOn: "2026-09-10T05:26:13Z",
      updatedOn: "2026-09-10T05:26:13Z",
    });
    expect(result.totalHours).toBe(1.75);
    expect(result.hasMore).toBe(false);
  });

  it("listTimeEntries follows pages up to the limit", async () => {
    const getJson = vi
      .fn()
      .mockResolvedValueOnce({
        time_entries: Array.from({ length: 100 }, (_, i) => ({
          ...RAW_ENTRY,
          id: i,
          hours: 1,
        })),
        total_count: 150,
      })
      .mockResolvedValueOnce({
        time_entries: Array.from({ length: 20 }, (_, i) => ({
          ...RAW_ENTRY,
          id: 100 + i,
          hours: 1,
        })),
        total_count: 150,
      });
    const c = new RedmineClient(
      { getJson } as unknown as RedmineHttp,
      { ...config, maxResultCount: 500 }
    );
    const result = await c.listTimeEntries({ projectId: 11, limit: 120 });
    expect(getJson).toHaveBeenCalledTimes(2);
    expect(getJson.mock.calls[1][1]).toMatchObject({ limit: 20, offset: 100 });
    expect(result.returnedCount).toBe(120);
    expect(result.totalHours).toBe(120);
    expect(result.hasMore).toBe(true);
  });

  it("createTimeEntry POSTs the time_entry payload for an issue", async () => {
    const postJson = vi.fn().mockResolvedValue({ time_entry: RAW_ENTRY });
    const result = await clientWith({ postJson }).createTimeEntry({
      issueId: 22374,
      hours: 1.5,
      spentOn: "2026-09-10",
      activityId: 9,
      comments: "다국어 설정",
    });
    expect(postJson).toHaveBeenCalledWith("/time_entries.json", {
      time_entry: {
        hours: 1.5,
        issue_id: 22374,
        spent_on: "2026-09-10",
        activity_id: 9,
        comments: "다국어 설정",
      },
    });
    expect(result).toEqual({
      id: 928,
      hours: 1.5,
      spentOn: "2026-09-10",
      issueId: 22374,
      projectId: 109,
      activity: { id: 9, name: "개발" },
      comments: "다국어 설정",
    });
  });

  it("createTimeEntry uses project_id when there is no issue", async () => {
    const postJson = vi
      .fn()
      .mockResolvedValue({ time_entry: { ...RAW_ENTRY, issue: null } });
    await clientWith({ postJson }).createTimeEntry({
      projectId: 109,
      hours: 2,
    });
    expect(postJson).toHaveBeenCalledWith("/time_entries.json", {
      time_entry: { hours: 2, project_id: 109 },
    });
  });

  it("createTimeEntry rejects missing target and non-positive hours before calling Redmine", async () => {
    const postJson = vi.fn();
    const client = clientWith({ postJson });
    await expect(client.createTimeEntry({ hours: 1 })).rejects.toMatchObject({
      code: "REDMINE_VALIDATION_ERROR",
    });
    await expect(
      client.createTimeEntry({ issueId: 1, hours: 0 })
    ).rejects.toMatchObject({ code: "REDMINE_VALIDATION_ERROR" });
    expect(postJson).not.toHaveBeenCalled();
  });

  it("listTimeEntryActivities keeps the default flag", async () => {
    const getJson = vi.fn().mockResolvedValue({
      time_entry_activities: [
        { id: 8, name: "설계" },
        { id: 9, name: "개발", is_default: true },
      ],
    });
    const activities = await clientWith({ getJson }).listTimeEntryActivities();
    expect(getJson).toHaveBeenCalledWith(
      "/enumerations/time_entry_activities.json"
    );
    expect(activities).toEqual([
      { id: 8, name: "설계", isDefault: false },
      { id: 9, name: "개발", isDefault: true },
    ]);
  });
});
