import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleAddAttachment,
  handleAddComment,
  handleCreateIssue,
  handleUpdateIssue,
  handleUpdateStatus,
} from "../src/tools/writes.js";
import { clearPreviewStore } from "../src/tools/previewStore.js";

describe("write handlers confirm gate", () => {
  beforeEach(() => {
    clearPreviewStore();
  });

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
    expect(result).toMatchObject({
      dryRun: true,
      wouldApply: {
        projectId: 1,
        subject: "S",
      },
    });
    expect(result.previewToken).toBeTruthy();
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
    expect(result.previewToken).toBeTruthy();
    expect(result.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "doneRatio", from: 0, to: 20 }),
        expect.objectContaining({ field: "trackerId", from: 1, to: 2 }),
      ])
    );
  });

  it("updateIssue confirm calls client.updateIssue after dry-run token", async () => {
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
    const client = {
      getIssue,
      updateIssue,
      listProjectMembers: vi.fn(),
      getCurrentUser: vi.fn(),
      searchUsers: vi.fn(),
    } as never;
    const base = { issueId: 7, doneRatio: 20 };
    const dry = await handleUpdateIssue(client, { ...base, confirm: false });
    const result = await handleUpdateIssue(client, {
      ...base,
      confirm: true,
      previewToken: dry.previewToken,
    });
    expect(updateIssue).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: 7, doneRatio: 20 })
    );
    expect(result.dryRun).toBe(false);
  });

  it("addComment dry-run skips client and returns previewToken", async () => {
    const addComment = vi.fn();
    const dry = await handleAddComment(
      { addComment } as never,
      { issueId: 1, notes: "n" }
    );
    expect(addComment).not.toHaveBeenCalled();
    expect(dry.previewToken).toBeTruthy();
  });

  it("addComment confirm without previewToken is rejected", async () => {
    const addComment = vi.fn();
    await expect(
      handleAddComment(
        { addComment } as never,
        { issueId: 1, notes: "n", confirm: true }
      )
    ).rejects.toMatchObject({ code: "REDMINE_VALIDATION_ERROR" });
    expect(addComment).not.toHaveBeenCalled();
  });

  it("addComment dry-run blocks textile markup without writing or token", async () => {
    const addComment = vi.fn();
    const result = await handleAddComment(
      { addComment } as never,
      {
        issueId: 1,
        notes: "h3. 로그인\n* 게스트 라우트",
        confirm: false,
      }
    );
    expect(addComment).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      dryRun: true,
      blocked: true,
      reason: "notes must be plain text (no Textile/Markdown)",
    });
    expect(result.matches).toEqual(expect.arrayContaining(["h3.", "* "]));
    expect(result).not.toHaveProperty("previewToken");
  });

  it("addComment confirm throws when notes have markup", async () => {
    const addComment = vi.fn();
    await expect(
      handleAddComment(
        { addComment } as never,
        {
          issueId: 1,
          notes: "h3. section",
          confirm: true,
        }
      )
    ).rejects.toMatchObject({
      code: "REDMINE_VALIDATION_ERROR",
    });
    expect(addComment).not.toHaveBeenCalled();
  });

  it("updateIssue dry-run blocks notes markup", async () => {
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
    const updateIssue = vi.fn();
    const result = await handleUpdateIssue(
      {
        getIssue,
        updateIssue,
        listProjectMembers: vi.fn(),
        getCurrentUser: vi.fn(),
        searchUsers: vi.fn(),
      } as never,
      {
        issueId: 7,
        doneRatio: 75,
        notes: "h3. progress\n* done",
        confirm: false,
      }
    );
    expect(updateIssue).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      dryRun: true,
      blocked: true,
    });
  });

  it("updateStatus dry-run blocks notes markup", async () => {
    const updateIssueStatus = vi.fn();
    const result = await handleUpdateStatus(
      { updateIssueStatus } as never,
      {
        issueId: 1,
        statusId: 4,
        notes: "# Title",
        confirm: false,
      }
    );
    expect(updateIssueStatus).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      dryRun: true,
      blocked: true,
    });
  });

  it("updateStatus confirm calls client after dry-run token", async () => {
    const updateIssueStatus = vi
      .fn()
      .mockResolvedValue({ issueId: 1, status: { id: 4, name: "T" } });
    const client = { updateIssueStatus } as never;
    const base = { issueId: 1, statusId: 4 };
    const dry = await handleUpdateStatus(client, { ...base, confirm: false });
    const result = await handleUpdateStatus(client, {
      ...base,
      confirm: true,
      previewToken: dry.previewToken,
    });
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

  it("addAttachment confirm uploads then addIssueAttachments after dry-run", async () => {
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
    const client = {
      inspectAttachments,
      uploadAttachments,
      addIssueAttachments,
    } as never;
    const base = {
      issueId: 7,
      attachments: [{ path: "./a.txt" }],
    };
    const dry = await handleAddAttachment(client, { ...base, confirm: false });
    const result = await handleAddAttachment(client, {
      ...base,
      confirm: true,
      previewToken: dry.previewToken,
    });
    expect(uploadAttachments).toHaveBeenCalled();
    expect(addIssueAttachments).toHaveBeenCalledWith({
      issueId: 7,
      uploads: [{ token: "tok", filename: "a.txt" }],
    });
    expect(result.dryRun).toBe(false);
  });
});
