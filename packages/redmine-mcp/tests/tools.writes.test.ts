import { describe, it, expect, vi } from "vitest";
import {
  handleAddAttachment,
  handleAddComment,
  handleCreateIssue,
  handleUpdateIssue,
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

  it("createIssue wouldApply includes status startDate doneRatio", async () => {
    const createIssue = vi.fn();
    const result = await handleCreateIssue(
      {
        createIssue,
        listProjectMembers: vi.fn(),
        searchUsers: vi.fn(),
        getCurrentUser: vi.fn(),
      } as never,
      {
        projectId: 1,
        subject: "S",
        statusId: 1,
        startDate: "2026-07-13",
        doneRatio: 10,
        trackerId: 2,
        priorityId: 4,
        confirm: false,
      }
    );
    expect(result.wouldApply).toMatchObject({
      statusId: 1,
      startDate: "2026-07-13",
      doneRatio: 10,
      trackerId: 2,
      priorityId: 4,
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
  });

  it("updateIssue dry-run returns before→after and does not PUT", async () => {
    const getIssue = vi.fn().mockResolvedValue({
      id: 7,
      subject: "Old",
      description: "",
      project: { id: 1, name: "P" },
      tracker: { id: 1, name: "Feature" },
      status: { id: 1, name: "New" },
      priority: { id: 2, name: "Normal" },
      assignedTo: { id: 1, name: "Me" },
      doneRatio: 0,
      startDate: "2026-07-01",
      dueDate: null,
      estimatedHours: null,
    });
    const updateIssue = vi.fn();
    const result = await handleUpdateIssue(
      {
        getIssue,
        updateIssue,
        listProjectMembers: vi.fn(),
        getCurrentUser: vi.fn(),
        searchUsers: vi.fn(),
      } as never,
      { issueId: 7, doneRatio: 20, trackerId: 2, confirm: false }
    );
    expect(updateIssue).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "doneRatio", from: 0, to: 20 }),
        expect.objectContaining({ field: "trackerId", from: 1, to: 2 }),
      ])
    );
  });

  it("updateIssue confirm calls client.updateIssue", async () => {
    const getIssue = vi.fn().mockResolvedValue({
      id: 7,
      subject: "Old",
      description: "",
      project: { id: 1, name: "P" },
      tracker: { id: 1, name: "Feature" },
      status: { id: 1, name: "New" },
      priority: { id: 2, name: "Normal" },
      assignedTo: null,
      doneRatio: 0,
      startDate: null,
      dueDate: null,
      estimatedHours: null,
    });
    const updateIssue = vi.fn().mockResolvedValue({
      issueId: 7,
      status: { id: 1, name: "New" },
    });
    const result = await handleUpdateIssue(
      {
        getIssue,
        updateIssue,
        listProjectMembers: vi.fn(),
        getCurrentUser: vi.fn(),
        searchUsers: vi.fn(),
      } as never,
      { issueId: 7, doneRatio: 20, confirm: true }
    );
    expect(updateIssue).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: 7, doneRatio: 20 })
    );
    expect(result.dryRun).toBe(false);
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

  it("createIssue dry-run includes attachment sizes and does not upload", async () => {
    const inspectAttachments = vi.fn().mockReturnValue([
      {
        path: "C:/tmp/a.png",
        filename: "a.png",
        sizeBytes: 12,
      },
    ]);
    const uploadAttachments = vi.fn();
    const createIssue = vi.fn();
    const result = await handleCreateIssue(
      {
        createIssue,
        inspectAttachments,
        uploadAttachments,
        listProjectMembers: vi.fn(),
        searchUsers: vi.fn(),
        getCurrentUser: vi.fn(),
      } as never,
      {
        projectId: 1,
        subject: "S",
        attachments: [{ path: "C:/tmp/a.png" }],
        confirm: false,
      }
    );
    expect(uploadAttachments).not.toHaveBeenCalled();
    expect(createIssue).not.toHaveBeenCalled();
    expect(result.wouldApply).toMatchObject({
      attachments: [{ filename: "a.png", sizeBytes: 12 }],
    });
  });

  it("addAttachment confirm uploads then addIssueAttachments", async () => {
    const inspectAttachments = vi.fn().mockReturnValue([
      { path: "./a.txt", filename: "a.txt", sizeBytes: 3 },
    ]);
    const uploadAttachments = vi.fn().mockResolvedValue([
      { token: "tok", filename: "a.txt", sizeBytes: 3 },
    ]);
    const addIssueAttachments = vi.fn().mockResolvedValue({
      issueId: 7,
      uploadedCount: 1,
    });
    const result = await handleAddAttachment(
      {
        inspectAttachments,
        uploadAttachments,
        addIssueAttachments,
      } as never,
      {
        issueId: 7,
        attachments: [{ path: "./a.txt" }],
        confirm: true,
      }
    );
    expect(uploadAttachments).toHaveBeenCalled();
    expect(addIssueAttachments).toHaveBeenCalledWith({
      issueId: 7,
      uploads: [{ token: "tok", filename: "a.txt" }],
    });
    expect(result.dryRun).toBe(false);
  });
});
