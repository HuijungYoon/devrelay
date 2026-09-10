import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleListTimeEntries,
  handleLogTime,
  todayYmd,
} from "../src/tools/timeEntries.js";
import { handleListMetadata } from "../src/tools/metadata.js";
import { clearPreviewStore } from "../src/tools/previewStore.js";
import {
  safeParseListTimeEntries,
  safeParseLogTime,
} from "../src/tools/schemas.js";

const ACTIVITIES = [
  { id: 8, name: "설계", isDefault: false },
  { id: 9, name: "개발", isDefault: true },
];

function timeClient(extra: Record<string, unknown> = {}) {
  return {
    listTimeEntryActivities: vi.fn().mockResolvedValue(ACTIVITIES),
    getIssue: vi.fn().mockResolvedValue({
      id: 24067,
      subject: "라이선스 대시보드",
      project: { id: 301, name: "CLOUD-HMI" },
    }),
    createTimeEntry: vi.fn().mockResolvedValue({
      id: 1000,
      hours: 2,
      spentOn: "2026-09-10",
      issueId: 24067,
      projectId: 301,
      activity: { id: 9, name: "개발" },
      comments: "",
    }),
    listTimeEntries: vi.fn().mockResolvedValue({
      entries: [],
      totalCount: 0,
      returnedCount: 0,
      hasMore: false,
      totalHours: 0,
    }),
    ...extra,
  };
}

describe("redmine_log_time", () => {
  beforeEach(() => clearPreviewStore());

  it("dry-run reads the issue for its subject, resolves the activity name and does not write", async () => {
    const client = timeClient();
    const result = await handleLogTime(client as never, {
      issueId: 24067,
      hours: 2,
      spentOn: "2026-09-10",
      activityId: "개발",
      comments: "대시보드 차트",
    });
    expect(client.createTimeEntry).not.toHaveBeenCalled();
    expect(client.getIssue).toHaveBeenCalledWith(24067);
    expect(result).toMatchObject({
      dryRun: true,
      wouldApply: {
        issueId: 24067,
        issueSubject: "라이선스 대시보드",
        projectId: 301,
        hours: 2,
        spentOn: "2026-09-10",
        activityId: 9,
        activityLabel: "개발",
        comments: "대시보드 차트",
        user: "me",
      },
    });
    expect(result.previewToken).toBeTruthy();
  });

  it("dry-run fills in today when spentOn is omitted", async () => {
    const result = await handleLogTime(timeClient() as never, {
      issueId: 24067,
      hours: 1,
    });
    expect(result.wouldApply.spentOn).toBe(todayYmd());
  });

  it("confirm needs the dry-run token and then records the entry with the resolved activity id", async () => {
    const client = timeClient();
    const args = { issueId: 24067, hours: 2, activityId: "개발" };
    await expect(
      handleLogTime(client as never, {
        ...args,
        confirm: true,
        previewToken: "bogus",
      })
    ).rejects.toMatchObject({ code: "REDMINE_VALIDATION_ERROR" });
    expect(client.createTimeEntry).not.toHaveBeenCalled();

    const dry = await handleLogTime(client as never, { ...args });
    const done = await handleLogTime(client as never, {
      ...args,
      confirm: true,
      previewToken: dry.previewToken,
    });
    expect(client.createTimeEntry).toHaveBeenCalledWith({
      issueId: 24067,
      hours: 2,
      spentOn: todayYmd(),
      activityId: 9,
    });
    expect(done.dryRun).toBe(false);
  });

  it("rejects an unknown activity name with the candidates", async () => {
    await expect(
      handleLogTime(timeClient() as never, {
        issueId: 24067,
        hours: 1,
        activityId: "없는활동",
      })
    ).rejects.toMatchObject({
      code: "REDMINE_VALIDATION_ERROR",
      check: expect.arrayContaining([expect.stringContaining("9:개발")]),
    });
  });

  it("logs against a project when there is no issue", async () => {
    const client = timeClient();
    const dry = await handleLogTime(client as never, {
      projectId: 301,
      hours: 0.5,
      spentOn: "2026-09-09",
    });
    expect(client.getIssue).not.toHaveBeenCalled();
    expect(dry.wouldApply).toMatchObject({ projectId: 301, hours: 0.5 });
    await handleLogTime(client as never, {
      projectId: 301,
      hours: 0.5,
      spentOn: "2026-09-09",
      confirm: true,
      previewToken: dry.previewToken,
    });
    expect(client.createTimeEntry).toHaveBeenCalledWith({
      projectId: 301,
      hours: 0.5,
      spentOn: "2026-09-09",
    });
  });
});

describe("redmine_list_time_entries", () => {
  it("defaults to the current user when no issue or project is given", async () => {
    const client = timeClient();
    const result = await handleListTimeEntries(client as never, {
      spentFrom: "2026-09-08",
      spentTo: "2026-09-12",
    });
    expect(client.listTimeEntries).toHaveBeenCalledWith({
      userId: "me",
      spentFrom: "2026-09-08",
      spentTo: "2026-09-12",
    });
    expect(result.userId).toBe("me");
  });

  it("does not add a user filter when an issue is given", async () => {
    const client = timeClient();
    await handleListTimeEntries(client as never, { issueId: 24067 });
    expect(client.listTimeEntries).toHaveBeenCalledWith({ issueId: 24067 });
  });

  it("resolves the activity name and echoes the label", async () => {
    const client = timeClient();
    const result = await handleListTimeEntries(client as never, {
      projectId: 301,
      activityId: "설계",
    });
    expect(client.listTimeEntries).toHaveBeenCalledWith({
      projectId: 301,
      activityId: 8,
    });
    expect(result.activityLabel).toBe("설계");
  });
});

describe("activities metadata kind", () => {
  it("lists time entry activities without a projectId", async () => {
    const client = timeClient();
    const result = await handleListMetadata(client as never, {
      kinds: ["activities"],
    });
    expect(result).toEqual({ activities: ACTIVITIES });
  });
});

describe("time entry schemas", () => {
  it("log_time needs hours and an issue or project", () => {
    expect(safeParseLogTime({ hours: 1 }).success).toBe(false);
    expect(safeParseLogTime({ issueId: 1 }).success).toBe(false);
    expect(safeParseLogTime({ issueId: 1, hours: 0 }).success).toBe(false);
    expect(safeParseLogTime({ issueId: 1, hours: 25 }).success).toBe(false);
    expect(safeParseLogTime({ issueId: 1, hours: 1.5 }).success).toBe(true);
    expect(
      safeParseLogTime({ projectId: 1, hours: 1, activityId: "개발" }).success
    ).toBe(true);
    expect(
      safeParseLogTime({ issueId: 1, hours: 1, confirm: true }).success
    ).toBe(false);
  });

  it("list_time_entries rejects a reversed range and unknown keys", () => {
    expect(
      safeParseListTimeEntries({ spentFrom: "2026-09-10", spentTo: "2026-09-01" })
        .success
    ).toBe(false);
    expect(
      safeParseListTimeEntries({ spentFrom: "2026-09-01", spentTo: "2026-09-10" })
        .success
    ).toBe(true);
    expect(safeParseListTimeEntries({ hack: 1 }).success).toBe(false);
    expect(safeParseListTimeEntries({ userId: "me" }).success).toBe(true);
  });
});
