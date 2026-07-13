import { describe, it, expect, vi } from "vitest";
import {
  handleAddComment,
  handleCreateIssue,
  handleUpdateStatus,
} from "../src/tools/writes.js";

describe("write handlers confirm gate", () => {
  it("createIssue dry-run does not call client", async () => {
    const createIssue = vi.fn();
    const result = await handleCreateIssue(
      { createIssue } as never,
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

  it("createIssue confirm calls client", async () => {
    const createIssue = vi.fn().mockResolvedValue({ id: 5, subject: "S" });
    const result = await handleCreateIssue(
      { createIssue } as never,
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
