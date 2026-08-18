import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedmineError } from "redmine-devrelay-client";
import {
  handleListMetadata,
  resolveIssueMetadata,
  resolveNamedRef,
} from "../src/tools/metadata.js";
import {
  handleCreateIssue,
  handleUpdateIssue,
  handleUpdateStatus,
} from "../src/tools/writes.js";
import { clearPreviewStore } from "../src/tools/previewStore.js";

const TRACKERS = [
  { id: 1, name: "버그" },
  { id: 2, name: "기능추가" },
];
const STATUSES = [
  { id: 1, name: "신규", isClosed: false },
  { id: 2, name: "진행중", isClosed: false },
  { id: 5, name: "완료", isClosed: true },
];
const PRIORITIES = [
  { id: 3, name: "보통", isDefault: true },
  { id: 4, name: "높음", isDefault: false },
];
const VERSIONS = [
  { id: 7, name: "2026-Q3", status: "open", dueDate: null },
  { id: 8, name: "2026-Q4", status: "open", dueDate: null },
];
const CATEGORIES = [{ id: 2, name: "프론트엔드", assignedTo: null }];

function metaClient(extra: Record<string, unknown> = {}) {
  return {
    listTrackers: vi.fn().mockResolvedValue(TRACKERS),
    listIssueStatuses: vi.fn().mockResolvedValue(STATUSES),
    listIssuePriorities: vi.fn().mockResolvedValue(PRIORITIES),
    listProjectVersions: vi.fn().mockResolvedValue(VERSIONS),
    listIssueCategories: vi.fn().mockResolvedValue(CATEGORIES),
    listProjectPeople: vi.fn(),
    searchUsers: vi.fn(),
    getCurrentUser: vi.fn(),
    ...extra,
  };
}

describe("redmine_list_metadata", () => {
  it("returns the three global kinds without projectId", async () => {
    const client = metaClient();
    const result = await handleListMetadata(client as never, {});
    expect(Object.keys(result)).toEqual([
      "trackers",
      "statuses",
      "priorities",
    ]);
    expect(client.listProjectVersions).not.toHaveBeenCalled();
  });

  it("adds versions and categories when projectId is given", async () => {
    const client = metaClient();
    const result = await handleListMetadata(client as never, { projectId: 11 });
    expect(Object.keys(result)).toEqual([
      "projectId",
      "trackers",
      "statuses",
      "priorities",
      "versions",
      "categories",
    ]);
    expect(client.listProjectVersions).toHaveBeenCalledWith(11);
    expect(client.listIssueCategories).toHaveBeenCalledWith(11);
  });

  it("honours the kinds filter", async () => {
    const client = metaClient();
    const result = await handleListMetadata(client as never, {
      kinds: ["statuses"],
    });
    expect(Object.keys(result)).toEqual(["statuses"]);
    expect(client.listTrackers).not.toHaveBeenCalled();
  });

  it("rejects versions without projectId", async () => {
    await expect(
      handleListMetadata(metaClient() as never, { kinds: ["versions"] })
    ).rejects.toThrow(/requires projectId/);
  });

  it("keeps the other kinds when one is forbidden", async () => {
    const client = metaClient({
      listIssueCategories: vi.fn().mockRejectedValue(
        new RedmineError({
          code: "REDMINE_PERMISSION_DENIED",
          message: "denied",
          httpStatus: 403,
        })
      ),
    });
    const result = await handleListMetadata(client as never, { projectId: 11 });
    expect(result.statuses).toHaveLength(3);
    expect(result.categories).toBeUndefined();
    expect(result.unavailable).toEqual([
      { kind: "categories", reason: "REDMINE_PERMISSION_DENIED" },
    ]);
  });

  it("does not swallow an auth failure", async () => {
    const client = metaClient({
      listTrackers: vi.fn().mockRejectedValue(
        new RedmineError({
          code: "REDMINE_AUTHENTICATION_ERROR",
          message: "bad key",
          httpStatus: 401,
        })
      ),
    });
    await expect(
      handleListMetadata(client as never, {})
    ).rejects.toMatchObject({ code: "REDMINE_AUTHENTICATION_ERROR" });
  });
});

describe("resolveNamedRef", () => {
  it("passes numbers through without a lookup", async () => {
    const client = metaClient();
    const r = await resolveNamedRef(client as never, "statuses", 2, "statusId");
    expect(r).toEqual({ id: 2 });
    expect(client.listIssueStatuses).not.toHaveBeenCalled();
  });

  it("treats a digit-only string as an id", async () => {
    const client = metaClient();
    const r = await resolveNamedRef(
      client as never,
      "statuses",
      "2",
      "statusId"
    );
    expect(r).toEqual({ id: 2 });
    expect(client.listIssueStatuses).not.toHaveBeenCalled();
  });

  it("resolves a name to id and label", async () => {
    const r = await resolveNamedRef(
      metaClient() as never,
      "statuses",
      "진행중",
      "statusId"
    );
    expect(r).toEqual({ id: 2, label: "진행중" });
  });

  it("lists candidates when nothing matches", async () => {
    await expect(
      resolveNamedRef(metaClient() as never, "statuses", "없는상태", "statusId")
    ).rejects.toMatchObject({
      code: "REDMINE_VALIDATION_ERROR",
      check: expect.arrayContaining([expect.stringContaining("2:진행중")]),
    });
  });

  it("refuses an ambiguous name", async () => {
    const client = metaClient({
      listIssueStatuses: vi.fn().mockResolvedValue([
        { id: 2, name: "진행중 검토", isClosed: false },
        { id: 3, name: "진행중 개발", isClosed: false },
      ]),
    });
    await expect(
      resolveNamedRef(client as never, "statuses", "진행중", "statusId")
    ).rejects.toThrow(/Ambiguous/);
  });

  it("matches when the user glued a suffix onto the name (진행중 → 진행)", async () => {
    const client = metaClient({
      listIssueStatuses: vi.fn().mockResolvedValue([
        { id: 1, name: "신규", isClosed: false },
        { id: 2, name: "진행", isClosed: false },
        { id: 5, name: "완료", isClosed: true },
      ]),
    });
    const r = await resolveNamedRef(
      client as never,
      "statuses",
      "진행중",
      "statusId"
    );
    expect(r).toEqual({ id: 2, label: "진행" });
  });

  it("stays ambiguous when the query contains two names", async () => {
    const client = metaClient({
      listIssueStatuses: vi.fn().mockResolvedValue([
        { id: 4, name: "테스트", isClosed: false },
        { id: 5, name: "완료", isClosed: true },
      ]),
    });
    await expect(
      resolveNamedRef(client as never, "statuses", "테스트 완료", "statusId")
    ).rejects.toThrow(/Ambiguous/);
  });

  it("explains how to proceed when the list is forbidden", async () => {
    const client = metaClient({
      listIssueCategories: vi.fn().mockRejectedValue(
        new RedmineError({
          code: "REDMINE_PERMISSION_DENIED",
          message: "denied",
          httpStatus: 403,
        })
      ),
    });
    await expect(
      resolveNamedRef(client as never, "categories", "프론트", "categoryId", 11)
    ).rejects.toMatchObject({
      code: "REDMINE_PERMISSION_DENIED",
      check: expect.arrayContaining([
        expect.stringContaining("numeric id for categoryId"),
      ]),
    });
  });

  it("requires projectId for versions", async () => {
    await expect(
      resolveNamedRef(
        metaClient() as never,
        "versions",
        "2026-Q3",
        "fixedVersionId"
      )
    ).rejects.toThrow(/requires projectId/);
  });

  it("resolveIssueMetadata resolves every field at once", async () => {
    const meta = await resolveIssueMetadata(metaClient() as never, 11, {
      trackerId: "기능추가",
      statusId: "진행중",
      priorityId: "높음",
      fixedVersionId: "2026-Q3",
      categoryId: "프론트엔드",
    });
    expect(meta).toEqual({
      trackerId: 2,
      trackerLabel: "기능추가",
      statusId: 2,
      statusLabel: "진행중",
      priorityId: 4,
      priorityLabel: "높음",
      fixedVersionId: 7,
      fixedVersionLabel: "2026-Q3",
      categoryId: 2,
      categoryLabel: "프론트엔드",
    });
  });

  it("resolveIssueMetadata passes null through as a clear", async () => {
    const client = metaClient();
    const meta = await resolveIssueMetadata(client as never, 11, {
      fixedVersionId: null,
      categoryId: null,
    });
    expect(meta).toEqual({ fixedVersionId: null, categoryId: null });
    expect(client.listProjectVersions).not.toHaveBeenCalled();
  });
});

describe("write handlers accept names", () => {
  beforeEach(() => {
    clearPreviewStore();
  });

  it("createIssue dry-run shows resolved ids with labels", async () => {
    const client = metaClient({ createIssue: vi.fn() });
    const result = await handleCreateIssue(client as never, {
      projectId: 11,
      subject: "S",
      statusId: "진행중",
      trackerId: "기능추가",
      fixedVersionId: "2026-Q3",
    });
    expect(result.wouldApply).toMatchObject({
      statusId: 2,
      statusLabel: "진행중",
      trackerId: 2,
      trackerLabel: "기능추가",
      fixedVersionId: 7,
      fixedVersionLabel: "2026-Q3",
    });
  });

  it("createIssue confirm sends numeric ids to the client", async () => {
    const createIssue = vi.fn().mockResolvedValue({ id: 1 });
    const client = metaClient({ createIssue });
    const args = { projectId: 11, subject: "S", statusId: "진행중" };
    const dry = await handleCreateIssue(client as never, { ...args });
    await handleCreateIssue(client as never, {
      ...args,
      confirm: true,
      previewToken: dry.previewToken,
    });
    expect(createIssue).toHaveBeenCalledWith(
      expect.objectContaining({ statusId: 2 })
    );
    const sent = createIssue.mock.calls[0][0];
    expect(sent).not.toHaveProperty("statusLabel");
  });

  it("updateStatus resolves a status name", async () => {
    const updateIssueStatus = vi.fn().mockResolvedValue({ issueId: 5 });
    const client = metaClient({ updateIssueStatus });
    const dry = await handleUpdateStatus(client as never, {
      issueId: 5,
      statusId: "완료",
    });
    expect(dry.wouldApply).toMatchObject({ statusId: 5, statusLabel: "완료" });
    await handleUpdateStatus(client as never, {
      issueId: 5,
      statusId: "완료",
      confirm: true,
      previewToken: dry.previewToken,
    });
    expect(updateIssueStatus).toHaveBeenCalledWith(5, 5, undefined);
  });

  it("updateIssue diffs against the resolved id and labels the change", async () => {
    const client = metaClient({
      getIssue: vi.fn().mockResolvedValue({
        subject: "old",
        project: { id: 11, name: "P" },
        status: { id: 1, name: "신규" },
        tracker: { id: 1, name: "버그" },
        priority: { id: 3, name: "보통" },
        fixedVersion: null,
        category: null,
        parent: null,
        description: "",
      }),
      updateIssue: vi.fn(),
    });
    const result = await handleUpdateIssue(client as never, {
      issueId: 5,
      statusId: "진행중",
      fixedVersionId: "2026-Q4",
    });
    expect(result.changes).toEqual([
      { field: "statusId", from: 1, to: 2 },
      { field: "fixedVersionId", from: null, to: 8 },
    ]);
    expect(result).toMatchObject({
      statusLabel: "진행중",
      fixedVersionLabel: "2026-Q4",
    });
  });

  it("updateIssue can clear 대상 버전 with null", async () => {
    const updateIssue = vi.fn().mockResolvedValue({ issueId: 5 });
    const client = metaClient({
      getIssue: vi.fn().mockResolvedValue({
        project: { id: 11, name: "P" },
        fixedVersion: { id: 8, name: "2026-Q4" },
        category: null,
        parent: null,
        description: "",
      }),
      updateIssue,
    });
    const args = { issueId: 5, fixedVersionId: null };
    const dry = await handleUpdateIssue(client as never, { ...args });
    expect(dry.changes).toEqual([
      { field: "fixedVersionId", from: 8, to: null },
    ]);
    await handleUpdateIssue(client as never, {
      ...args,
      confirm: true,
      previewToken: dry.previewToken,
    });
    expect(updateIssue).toHaveBeenCalledWith(
      expect.objectContaining({ fixedVersionId: null })
    );
  });
});
