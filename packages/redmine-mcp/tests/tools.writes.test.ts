import { describe, it, expect, vi } from "vitest";
import {
  handleAddComment,
  handleCreateIssue,
  handleUpdateStatus,
  resolveAssignedTo,
} from "../src/tools/writes.js";

describe("write handlers confirm gate", () => {
  it("createIssue dry-run does not call client.createIssue", async () => {
    const createIssue = vi.fn();
    const result = await handleCreateIssue(
      { createIssue, searchUsers: vi.fn() } as never,
      { projectId: 1, subject: "S", confirm: false }
    );
    expect(createIssue).not.toHaveBeenCalled();
    expect(result).toEqual({
      dryRun: true,
      wouldApply: {
        projectId: 1,
        subject: "S",
      },
    });
  });

  it("createIssue resolves assignee name then confirms", async () => {
    const searchUsers = vi.fn().mockResolvedValue({
      users: [{ id: 99, login: "ysk", name: "윤 석준" }],
      totalCount: 1,
      returnedCount: 1,
    });
    const createIssue = vi.fn().mockResolvedValue({ id: 5, subject: "S" });
    const dry = await handleCreateIssue(
      { createIssue, searchUsers } as never,
      { projectId: 1, subject: "S", assignedTo: "윤석준", confirm: false }
    );
    expect(createIssue).not.toHaveBeenCalled();
    expect(dry.wouldApply).toMatchObject({
      assignedTo: 99,
      assignedToLabel: "윤 석준 (ysk)",
    });

    const applied = await handleCreateIssue(
      { createIssue, searchUsers } as never,
      { projectId: 1, subject: "S", assignedTo: "윤석준", confirm: true }
    );
    expect(createIssue).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 1, subject: "S", assignedTo: 99 })
    );
    expect(applied.dryRun).toBe(false);
  });

  it("createIssue confirm calls client", async () => {
    const createIssue = vi.fn().mockResolvedValue({ id: 5, subject: "S" });
    const result = await handleCreateIssue(
      { createIssue, searchUsers: vi.fn() } as never,
      { projectId: 1, subject: "S", confirm: true }
    );
    expect(createIssue).toHaveBeenCalled();
    expect(result.dryRun).toBe(false);
    expect(result.result).toEqual({ id: 5, subject: "S" });
  });

  it("addComment dry-run skips client", async () => {
    const addComment = vi.fn();
    await handleAddComment(
      { addComment } as never,
      { issueId: 1, notes: "n" }
    );
    expect(addComment).not.toHaveBeenCalled();
  });

  it("updateStatus confirm calls client", async () => {
    const updateIssueStatus = vi
      .fn()
      .mockResolvedValue({ issueId: 1, status: { id: 4, name: "T" } });
    const result = await handleUpdateStatus(
      { updateIssueStatus } as never,
      { issueId: 1, statusId: 4, confirm: true }
    );
    expect(updateIssueStatus).toHaveBeenCalledWith(1, 4, undefined);
    expect(result.dryRun).toBe(false);
  });
});

describe("resolveAssignedTo", () => {
  it("passes through me and numeric id", async () => {
    expect(await resolveAssignedTo({} as never, "me")).toEqual({
      assignedTo: "me",
      label: "me",
    });
    expect(await resolveAssignedTo({} as never, 12)).toEqual({
      assignedTo: 12,
      label: "12",
    });
  });
});
