import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedmineError } from "redmine-devrelay-client";
import { handleBulkUpdateStatus } from "../src/tools/writes.js";
import { clearPreviewStore } from "../src/tools/previewStore.js";
import { safeParseBulkUpdateStatus } from "../src/tools/schemas.js";

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
