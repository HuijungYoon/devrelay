import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedmineClient } from "../src/client.js";
import { RedmineError } from "../src/errors.js";
import type { RedmineHttp } from "../src/http.js";
import type { RedmineConfig } from "../src/config.js";

const config: RedmineConfig = {
  baseUrl: "https://redmine.example.com",
  apiKey: "k",
  connectTimeoutMs: 5000,
  requestTimeoutMs: 15000,
  maxResultCount: 100,
  logLevel: "info",
  userAgent: "redmine-mcp/0.6.0",
};

function clientWith(http: Partial<RedmineHttp>): RedmineClient {
  return new RedmineClient(http as RedmineHttp, config);
}

const rawRelation = {
  id: 7,
  issue_id: 100,
  issue_to_id: 200,
  relation_type: "relates",
  delay: null,
};

describe("issue relations (연결된 일감)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("listIssueRelations normalizes and counts", async () => {
    const getJson = vi.fn().mockResolvedValue({
      relations: [rawRelation, { ...rawRelation, id: 8, issue_to_id: 300 }],
    });
    const result = await clientWith({ getJson }).listIssueRelations(100);
    expect(getJson).toHaveBeenCalledWith("/issues/100/relations.json");
    expect(result).toEqual({
      issueId: 100,
      totalCount: 2,
      via: "relations",
      relations: [
        {
          id: 7,
          issueId: 100,
          issueToId: 200,
          relationType: "relates",
          delay: null,
        },
        {
          id: 8,
          issueId: 100,
          issueToId: 300,
          relationType: "relates",
          delay: null,
        },
      ],
    });
  });

  it("listIssueRelations tolerates an empty body", async () => {
    const getJson = vi.fn().mockResolvedValue({});
    const result = await clientWith({ getJson }).listIssueRelations(100);
    expect(result).toEqual({
      issueId: 100,
      relations: [],
      totalCount: 0,
      via: "relations",
    });
  });

  it("listIssueRelations falls back to the issue when the index is denied", async () => {
    const denied = new RedmineError({
      code: "REDMINE_PERMISSION_DENIED",
      message: "Redmine permission denied",
      httpStatus: 403,
    });
    const getJson = vi
      .fn()
      .mockRejectedValueOnce(denied)
      .mockResolvedValueOnce({ issue: { relations: [rawRelation] } });

    const result = await clientWith({ getJson }).listIssueRelations(100);
    expect(getJson).toHaveBeenNthCalledWith(2, "/issues/100.json", {
      include: "relations",
    });
    expect(result).toMatchObject({ via: "issue-include", totalCount: 1 });
    expect(result.relations[0].id).toBe(7);
  });

  it("listIssueRelations does not swallow other errors", async () => {
    const getJson = vi.fn().mockRejectedValue(
      new RedmineError({
        code: "REDMINE_ISSUE_NOT_FOUND",
        message: "nope",
        httpStatus: 404,
      })
    );
    await expect(
      clientWith({ getJson }).listIssueRelations(100)
    ).rejects.toMatchObject({ code: "REDMINE_ISSUE_NOT_FOUND" });
    expect(getJson).toHaveBeenCalledTimes(1);
  });

  it("addIssueRelation POSTs relation payload", async () => {
    const postJson = vi.fn().mockResolvedValue({ relation: rawRelation });
    const relation = await clientWith({ postJson }).addIssueRelation({
      issueId: 100,
      issueToId: 200,
      relationType: "relates",
    });
    expect(postJson).toHaveBeenCalledWith("/issues/100/relations.json", {
      relation: { issue_to_id: 200, relation_type: "relates" },
    });
    expect(relation.id).toBe(7);
  });

  it("addIssueRelation sends delay for precedes", async () => {
    const postJson = vi.fn().mockResolvedValue({
      relation: { ...rawRelation, relation_type: "precedes", delay: 2 },
    });
    await clientWith({ postJson }).addIssueRelation({
      issueId: 100,
      issueToId: 200,
      relationType: "precedes",
      delay: 2,
    });
    expect(postJson).toHaveBeenCalledWith("/issues/100/relations.json", {
      relation: { issue_to_id: 200, relation_type: "precedes", delay: 2 },
    });
  });

  it("addIssueRelation rejects delay on a non-precedes relation", async () => {
    const postJson = vi.fn();
    await expect(
      clientWith({ postJson }).addIssueRelation({
        issueId: 100,
        issueToId: 200,
        relationType: "relates",
        delay: 3,
      })
    ).rejects.toThrow(RedmineError);
    expect(postJson).not.toHaveBeenCalled();
  });

  it("addIssueRelation rejects self-relation", async () => {
    const postJson = vi.fn();
    await expect(
      clientWith({ postJson }).addIssueRelation({
        issueId: 100,
        issueToId: 100,
        relationType: "relates",
      })
    ).rejects.toThrow(/itself/);
    expect(postJson).not.toHaveBeenCalled();
  });

  it("removeIssueRelation DELETEs the relation only", async () => {
    const deleteJson = vi.fn().mockResolvedValue(undefined);
    const result = await clientWith({ deleteJson }).removeIssueRelation(7);
    expect(deleteJson).toHaveBeenCalledWith("/relations/7.json");
    expect(result).toEqual({ relationId: 7, removed: true });
  });

  it("replaceIssueRelation deletes then re-creates with carried-over fields", async () => {
    const getJson = vi.fn().mockResolvedValue({ relation: rawRelation });
    const deleteJson = vi.fn().mockResolvedValue(undefined);
    const postJson = vi.fn().mockResolvedValue({
      relation: { ...rawRelation, id: 9, relation_type: "blocks" },
    });

    const result = await clientWith({
      getJson,
      deleteJson,
      postJson,
    }).replaceIssueRelation({ relationId: 7, relationType: "blocks" });

    expect(getJson).toHaveBeenCalledWith("/relations/7.json");
    expect(deleteJson).toHaveBeenCalledWith("/relations/7.json");
    expect(postJson).toHaveBeenCalledWith("/issues/100/relations.json", {
      relation: { issue_to_id: 200, relation_type: "blocks" },
    });
    expect(result).toEqual({
      removedRelationId: 7,
      relation: {
        id: 9,
        issueId: 100,
        issueToId: 200,
        relationType: "blocks",
        delay: null,
      },
    });
  });

  it("replaceIssueRelation reports how to restore when re-create fails", async () => {
    const getJson = vi.fn().mockResolvedValue({ relation: rawRelation });
    const deleteJson = vi.fn().mockResolvedValue(undefined);
    const postJson = vi.fn().mockRejectedValue(new Error("boom"));

    const promise = clientWith({
      getJson,
      deleteJson,
      postJson,
    }).replaceIssueRelation({ relationId: 7, issueToId: 300 });

    await expect(promise).rejects.toMatchObject({
      code: "REDMINE_UNKNOWN_ERROR",
      message: expect.stringContaining("was removed but the replacement failed"),
    });
  });

  it("getIssueRelation raises not-found on an empty body", async () => {
    const getJson = vi.fn().mockResolvedValue({});
    await expect(clientWith({ getJson }).getIssueRelation(7)).rejects.toMatchObject(
      { code: "REDMINE_ISSUE_NOT_FOUND" }
    );
  });
});
