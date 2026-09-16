import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedmineError } from "redmine-devrelay-client";
import {
  handleBulkUpdateIssue,
  handleBulkUpdateStatus,
} from "../src/tools/writes.js";
import { clearPreviewStore } from "../src/tools/previewStore.js";
import {
  safeParseBulkUpdateIssue,
  safeParseBulkUpdateStatus,
} from "../src/tools/schemas.js";

const STATUSES = [
  { id: 2, name: "진행중", isClosed: false },
  { id: 5, name: "완료", isClosed: true },
];

function bulkClient(extra: Record<string, unknown> = {}) {
  return {
    listIssueStatuses: vi.fn().mockResolvedValue(STATUSES),
    getIssue: vi.fn(async (id: number) => {
      if (id === 404) {
        throw new RedmineError({
          code: "REDMINE_ISSUE_NOT_FOUND",
          message: "Redmine resource not found",
          httpStatus: 404,
        });
      }
      return {
        id,
        subject: `Issue ${id}`,
        status: id === 3 ? { id: 5, name: "완료" } : { id: 2, name: "진행중" },
      };
    }),
    updateIssueStatus: vi.fn(async (id: number) => {
      if (id === 2) throw new Error("workflow forbids this transition");
      return { issueId: id, status: { id: 5, name: "완료" } };
    }),
    ...extra,
  };
}

describe("redmine_bulk_update_status", () => {
  beforeEach(() => clearPreviewStore());

  it("dry-run builds a per-issue before→after table without writing", async () => {
    const client = bulkClient();
    const result = await handleBulkUpdateStatus(client as never, {
      issueIds: [1, 2, 3, 404],
      statusId: "완료",
      notes: "일괄 완료 처리",
    });
    expect(client.updateIssueStatus).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      dryRun: true,
      statusId: 5,
      statusLabel: "완료",
      notes: "일괄 완료 처리",
      summary: { total: 4, willChange: 2, unchanged: 1, unreadable: 1 },
    });
    expect(result.rows).toEqual([
      { issueId: 1, subject: "Issue 1", from: { id: 2, name: "진행중" }, to: { id: 5, name: "완료" } },
      { issueId: 2, subject: "Issue 2", from: { id: 2, name: "진행중" }, to: { id: 5, name: "완료" } },
      { issueId: 3, subject: "Issue 3", from: { id: 5, name: "완료" }, to: { id: 5, name: "완료" }, unchanged: true },
      expect.objectContaining({ issueId: 404, subject: null, error: expect.stringContaining("not found") }),
    ]);
    expect(result.previewToken).toBeTruthy();
  });

  it("confirm applies issue by issue, keeps going after a failure, and skips unchanged ones", async () => {
    const client = bulkClient();
    const args = { issueIds: [1, 2, 3, 404], statusId: "완료", notes: "일괄 완료 처리" };
    const dry = await handleBulkUpdateStatus(client as never, { ...args });
    const done = await handleBulkUpdateStatus(client as never, {
      ...args,
      confirm: true,
      previewToken: dry.previewToken,
    });
    expect(client.updateIssueStatus).toHaveBeenCalledTimes(2);
    expect(client.updateIssueStatus).toHaveBeenCalledWith(1, 5, "일괄 완료 처리");
    expect(client.updateIssueStatus).toHaveBeenCalledWith(2, 5, "일괄 완료 처리");
    expect(done).toMatchObject({
      dryRun: false,
      statusId: 5,
      updated: [{ issueId: 1, status: { id: 5, name: "완료" } }],
      skipped: [3],
    });
    expect(done.failed).toEqual([
      { issueId: 2, error: "workflow forbids this transition" },
      expect.objectContaining({ issueId: 404 }),
    ]);
  });

  it("confirm reports the status name even when Redmine's PUT returns no body", async () => {
    const client = bulkClient({
      updateIssueStatus: vi.fn(async (id: number) => ({
        issueId: id,
        status: { id: 5 },
      })),
    });
    const args = { issueIds: [1], statusId: "완료" };
    const dry = await handleBulkUpdateStatus(client as never, { ...args });
    const done = await handleBulkUpdateStatus(client as never, {
      ...args,
      confirm: true,
      previewToken: dry.previewToken,
    });
    expect(done.updated).toEqual([{ issueId: 1, status: { id: 5, name: "완료" } }]);
  });

  it("confirm without a matching token is rejected before any write", async () => {
    const client = bulkClient();
    await expect(
      handleBulkUpdateStatus(client as never, {
        issueIds: [1],
        statusId: 5,
        confirm: true,
        previewToken: "nope",
      })
    ).rejects.toMatchObject({ code: "REDMINE_VALIDATION_ERROR" });
    expect(client.updateIssueStatus).not.toHaveBeenCalled();
  });

  it("blocks markup in notes like the other write tools", async () => {
    const client = bulkClient();
    const result = await handleBulkUpdateStatus(client as never, {
      issueIds: [1],
      statusId: 5,
      notes: "h3. 완료",
    });
    expect(result).toMatchObject({ dryRun: true, blocked: true });
    expect(client.getIssue).not.toHaveBeenCalled();
  });

  it("schema caps the batch at 50 and refuses repeats", () => {
    expect(safeParseBulkUpdateStatus({ issueIds: [], statusId: 5 }).success).toBe(false);
    expect(safeParseBulkUpdateStatus({ issueIds: [1, 1], statusId: 5 }).success).toBe(false);
    expect(
      safeParseBulkUpdateStatus({
        issueIds: Array.from({ length: 51 }, (_, i) => i + 1),
        statusId: 5,
      }).success
    ).toBe(false);
    expect(safeParseBulkUpdateStatus({ issueIds: [1, 2], statusId: "완료" }).success).toBe(true);
    expect(
      safeParseBulkUpdateStatus({ issueIds: [1], statusId: 5, confirm: true }).success
    ).toBe(false);
  });
});


describe("redmine_bulk_update_issue", () => {
  beforeEach(() => clearPreviewStore());

  function issueClient(extra: Record<string, unknown> = {}) {
    return {
      listIssueStatuses: vi.fn().mockResolvedValue(STATUSES),
      getIssue: vi.fn(async (id: number) => {
        if (id === 404) {
          throw new RedmineError({
            code: "REDMINE_ISSUE_NOT_FOUND",
            message: "Redmine resource not found",
            httpStatus: 404,
          });
        }
        return {
          id,
          subject: `Issue ${id}`,
          description: "",
          project: { id: 1, name: "P" },
          tracker: { id: 1, name: "Feature" },
          status: { id: 2, name: "진행중" },
          priority: { id: 2, name: "Normal" },
          assignedTo: { id: 1, name: "Me" },
          doneRatio: id === 3 ? 30 : 0,
          startDate: null,
          dueDate: null,
          estimatedHours: null,
        };
      }),
      updateIssue: vi.fn(async (input: { issueId: number }) => {
        if (input.issueId === 2) throw new Error("workflow forbids this");
        return { issueId: input.issueId, status: null };
      }),
      listProjectPeople: vi.fn(),
      searchUsers: vi.fn(),
      getCurrentUser: vi.fn(),
      ...extra,
    };
  }

  it("dry-run merges common into every row and lets a row win, without writing", async () => {
    const client = issueClient();
    const result = await handleBulkUpdateIssue(client as never, {
      issues: [
        { issueId: 1, notes: "첫 번째 진행" },
        { issueId: 3, doneRatio: 30, notes: "두 번째 진행" },
      ],
      common: { doneRatio: 10 },
    });
    expect(client.updateIssue).not.toHaveBeenCalled();
    expect(result.summary).toEqual({
      total: 2,
      willChange: 2,
      unchanged: 0,
      unreadable: 0,
    });
    // common의 10%가 1번에 적용되고
    expect(result.rows[0]).toMatchObject({ issueId: 1, subject: "Issue 1" });
    expect(result.rows[0].changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "doneRatio", from: 0, to: 10 }),
        expect.objectContaining({ field: "notes" }),
      ])
    );
    // 3번은 자기 값(30)이 common을 이겨서 진척도는 그대로, 댓글만 남는다
    expect(result.rows[1].changes).toEqual([
      expect.objectContaining({ field: "notes" }),
    ]);
    expect(result.previewToken).toBeTruthy();
  });

  it("confirm writes each issue with its own note and keeps going after a failure", async () => {
    const client = issueClient();
    const args = {
      issues: [
        { issueId: 1, notes: "하나" },
        { issueId: 2, notes: "둘" },
      ],
      common: { statusId: "완료" },
    };
    const dry = await handleBulkUpdateIssue(client as never, { ...args });
    const done = await handleBulkUpdateIssue(client as never, {
      ...args,
      confirm: true,
      previewToken: dry.previewToken,
    });
    expect(client.updateIssue).toHaveBeenCalledTimes(2);
    expect(client.updateIssue).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: 1, statusId: 5, notes: "하나" })
    );
    expect(client.updateIssue).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: 2, statusId: 5, notes: "둘" })
    );
    expect(done.updated).toEqual([
      expect.objectContaining({ issueId: 1 }),
    ]);
    expect(done.failed).toEqual([
      { issueId: 2, error: "workflow forbids this" },
    ]);
  });

  it("flags an unreadable issue in the preview and never writes it", async () => {
    const client = issueClient();
    const args = { issues: [{ issueId: 1 }, { issueId: 404 }], common: { doneRatio: 50 } };
    const dry = await handleBulkUpdateIssue(client as never, { ...args });
    expect(dry.summary).toMatchObject({ total: 2, willChange: 1, unreadable: 1 });
    const done = await handleBulkUpdateIssue(client as never, {
      ...args,
      confirm: true,
      previewToken: dry.previewToken,
    });
    expect(client.updateIssue).toHaveBeenCalledTimes(1);
    expect(client.updateIssue).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: 1 })
    );
    expect(done.failed).toEqual([
      expect.objectContaining({ issueId: 404 }),
    ]);
  });

  it("confirm without a matching token is rejected before any write", async () => {
    const client = issueClient();
    await expect(
      handleBulkUpdateIssue(client as never, {
        issues: [{ issueId: 1, doneRatio: 10 }],
        confirm: true,
        previewToken: "nope",
      })
    ).rejects.toMatchObject({ code: "REDMINE_VALIDATION_ERROR" });
    expect(client.updateIssue).not.toHaveBeenCalled();
  });

  it("blocks markup in a per-issue note", async () => {
    const client = issueClient();
    const result = await handleBulkUpdateIssue(client as never, {
      issues: [{ issueId: 1, notes: "h3. 진행" }],
    });
    expect(result).toMatchObject({ dryRun: true, blocked: true });
    expect(client.getIssue).not.toHaveBeenCalled();
  });

  it("schema rejects repeats, oversized batches, and rows with nothing to change", () => {
    expect(
      safeParseBulkUpdateIssue({
        issues: [{ issueId: 1, doneRatio: 10 }, { issueId: 1, doneRatio: 20 }],
      }).success
    ).toBe(false);
    expect(
      safeParseBulkUpdateIssue({
        issues: Array.from({ length: 51 }, (_, i) => ({ issueId: i + 1, doneRatio: 10 })),
      }).success
    ).toBe(false);
    // 행에도 common에도 바꿀 필드가 없으면 거부
    expect(safeParseBulkUpdateIssue({ issues: [{ issueId: 1 }] }).success).toBe(false);
    // common에만 있어도 통과
    expect(
      safeParseBulkUpdateIssue({ issues: [{ issueId: 1 }], common: { doneRatio: 10 } }).success
    ).toBe(true);
  });
});
