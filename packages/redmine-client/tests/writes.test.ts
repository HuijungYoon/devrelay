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

  it("addComment PUTs notes", async () => {
    const putJson = vi.fn().mockResolvedValue({});
    const http = { postJson: vi.fn(), putJson } as unknown as RedmineHttp;
    const client = new RedmineClient(http, config);
    await client.addComment(7, "hello");
    expect(putJson).toHaveBeenCalledWith("/issues/7.json", {
      issue: { notes: "hello" },
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
      issue: { status_id: 4, notes: "done" },
    });
    expect(result.status?.id).toBe(4);
  });
});
