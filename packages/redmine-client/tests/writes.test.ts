import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedmineClient } from "../src/client.js";
import { RedmineHttp } from "../src/http.js";
import type { RedmineConfig } from "../src/config.js";

const config: RedmineConfig = {
  baseUrl: "https://redmine.example.com",
  apiKey: "k",
  connectTimeoutMs: 5000,
  requestTimeoutMs: 15000,
  maxResultCount: 100,
  logLevel: "info",
  userAgent: "redmine-mcp/0.2.0",
};

describe("write methods", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("createIssue POSTs issue payload", async () => {
    const postJson = vi.fn().mockResolvedValue({
      issue: {
        id: 42,
        subject: "Bug",
        project: { id: 1, name: "P" },
        status: { id: 1, name: "New" },
      },
    });
    const http = { postJson, putJson: vi.fn() } as unknown as RedmineHttp;
    const client = new RedmineClient(http, config);
    const result = await client.createIssue({
      projectId: 1,
      subject: "Bug",
      description: "d",
      assignedTo: "me",
    });
    expect(postJson).toHaveBeenCalledWith("/issues.json", {
      issue: {
        project_id: 1,
        subject: "Bug",
        description: "d",
        assigned_to_id: "me",
      },
    });
    expect(result.id).toBe(42);
  });

  it("createIssue sends watcher_user_ids", async () => {
    const postJson = vi.fn().mockResolvedValue({
      issue: {
        id: 43,
        subject: "Bug",
        project: { id: 1, name: "P" },
        status: { id: 1, name: "New" },
      },
    });
    const http = { postJson, putJson: vi.fn() } as unknown as RedmineHttp;
    const client = new RedmineClient(http, config);
    await client.createIssue({
      projectId: 1,
      subject: "Bug",
      assignedTo: "me",
      watcherUserIds: [99, 12],
    });
    expect(postJson).toHaveBeenCalledWith("/issues.json", {
      issue: {
        project_id: 1,
        subject: "Bug",
        assigned_to_id: "me",
        watcher_user_ids: [99, 12],
      },
    });
  });

  it("createIssue sends status_id start_date done_ratio", async () => {
    const postJson = vi.fn().mockResolvedValue({
      issue: { id: 44, subject: "Bug", project: null, status: { id: 1, name: "New" } },
    });
    const http = { postJson, putJson: vi.fn() } as unknown as RedmineHttp;
    const client = new RedmineClient(http, config);
    await client.createIssue({
      projectId: 1,
      subject: "Bug",
      trackerId: 2,
      statusId: 1,
      priorityId: 4,
      startDate: "2026-07-13",
      doneRatio: 10,
    });
    expect(postJson).toHaveBeenCalledWith("/issues.json", {
      issue: {
        project_id: 1,
        subject: "Bug",
        tracker_id: 2,
        status_id: 1,
        priority_id: 4,
        start_date: "2026-07-13",
        done_ratio: 10,
      },
    });
  });

  it("updateIssue PUTs only provided fields and watcher_user_ids", async () => {
    const putJson = vi.fn().mockResolvedValue({
      issue: { id: 7, subject: "X", status: { id: 2, name: "WIP" } },
    });
    const http = { postJson: vi.fn(), putJson } as unknown as RedmineHttp;
    const client = new RedmineClient(http, config);
    await client.updateIssue({
      issueId: 7,
      doneRatio: 20,
      assignedTo: "me",
      watcherUserIds: [99],
      notes: "progress",
    });
    expect(putJson).toHaveBeenCalledWith("/issues/7.json", {
      issue: {
        done_ratio: 20,
        assigned_to_id: "me",
        watcher_user_ids: [99],
        notes: "progress<br />",
      },
    });
  });

  it("addComment PUTs notes", async () => {
    const putJson = vi.fn().mockResolvedValue({});
    const http = { postJson: vi.fn(), putJson } as unknown as RedmineHttp;
    const client = new RedmineClient(http, config);
    await client.addComment(7, "hello\nworld");
    expect(putJson).toHaveBeenCalledWith("/issues/7.json", {
      issue: { notes: "hello<br />\nworld<br />" },
    });
  });

  it("updateIssueStatus PUTs status_id and optional notes", async () => {
    const putJson = vi.fn().mockResolvedValue({
      issue: { id: 7, status: { id: 4, name: "Test" } },
    });
    const http = { postJson: vi.fn(), putJson } as unknown as RedmineHttp;
    const client = new RedmineClient(http, config);
    const result = await client.updateIssueStatus(7, 4, "done");
    expect(putJson).toHaveBeenCalledWith("/issues/7.json", {
      issue: { status_id: 4, notes: "done<br />" },
    });
    expect(result.status?.id).toBe(4);
  });
});
