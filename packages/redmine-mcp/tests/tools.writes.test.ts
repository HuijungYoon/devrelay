import { describe, it, expect, vi } from "vitest";
import {
  handleAddComment,
  handleCreateIssue,
  handleUpdateStatus,
} from "../src/tools/writes.js";

describe("write handlers confirm gate", () => {
  it("createIssue dry-run does not call client.createIssue", async () => {
    const createIssue = vi.fn();
    const result = await handleCreateIssue(
      {
        createIssue,
        listProjectMembers: vi.fn(),
        searchUsers: vi.fn(),
        getCurrentUser: vi.fn(),
      } as never,
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

  it("createIssue resolves watchers from project members", async () => {
    const listProjectMembers = vi.fn().mockResolvedValue({
      members: [
        { id: 99, login: "99", name: "윤 석준" },
        { id: 1, login: "1", name: "윤 희중" },
      ],
      totalCount: 2,
      returnedCount: 2,
      projectId: 1,
    });
    const createIssue = vi.fn().mockResolvedValue({ id: 5, subject: "S" });
    const dry = await handleCreateIssue(
      {
        createIssue,
        listProjectMembers,
        searchUsers: vi.fn(),
        getCurrentUser: vi.fn(),
      } as never,
      {
        projectId: 1,
        subject: "S",
        assignedTo: "me",
        watchers: ["윤석준"],
        confirm: false,
      }
    );
    expect(createIssue).not.toHaveBeenCalled();
    expect(dry.wouldApply).toMatchObject({
      assignedTo: "me",
      watcherUserIds: [99],
      watcherLabels: ["윤 석준"],
    });

    await handleCreateIssue(
      {
        createIssue,
        listProjectMembers,
        searchUsers: vi.fn(),
        getCurrentUser: vi.fn(),
      } as never,
      {
        projectId: 1,
        subject: "S",
        assignedTo: "me",
        watchers: ["윤석준"],
        confirm: true,
      }
    );
    expect(createIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedTo: "me",
        watcherUserIds: [99],
      })
    );
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
