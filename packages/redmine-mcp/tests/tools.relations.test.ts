import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleAddIssueRelation,
  handleListIssueRelations,
  handleRemoveIssueRelation,
  handleUpdateIssueRelation,
} from "../src/tools/relations.js";
import { clearPreviewStore } from "../src/tools/previewStore.js";

const relation = {
  id: 7,
  issueId: 100,
  issueToId: 200,
  relationType: "relates",
  delay: null,
};

describe("relation handlers confirm gate", () => {
  beforeEach(() => {
    clearPreviewStore();
  });

  it("listIssueRelations passes through without a confirm gate", async () => {
    const listIssueRelations = vi
      .fn()
      .mockResolvedValue({ issueId: 100, relations: [relation], totalCount: 1 });
    const result = await handleListIssueRelations(
      { listIssueRelations } as never,
      { issueId: 100 }
    );
    expect(listIssueRelations).toHaveBeenCalledWith(100);
    expect(result.relations).toHaveLength(1);
  });

  it("addIssueRelation dry-run does not write and returns a token", async () => {
    const addIssueRelation = vi.fn();
    const result = await handleAddIssueRelation(
      { addIssueRelation } as never,
      {
        issueId: 100,
        issueToId: 200,
        relationType: "relates",
        confirm: false,
      }
    );
    expect(addIssueRelation).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      dryRun: true,
      wouldApply: { issueId: 100, issueToId: 200, relationType: "relates" },
    });
    expect(result.previewToken).toBeTruthy();
  });

  it("addIssueRelation applies with the dry-run token", async () => {
    const addIssueRelation = vi.fn().mockResolvedValue(relation);
    const client = { addIssueRelation } as never;
    const args = {
      issueId: 100,
      issueToId: 200,
      relationType: "relates" as const,
    };
    const dry = await handleAddIssueRelation(client, { ...args });
    const applied = await handleAddIssueRelation(client, {
      ...args,
      confirm: true,
      previewToken: dry.previewToken,
    });
    expect(addIssueRelation).toHaveBeenCalledWith({
      issueId: 100,
      issueToId: 200,
      relationType: "relates",
    });
    expect(applied).toMatchObject({ dryRun: false, result: { relation } });
  });

  it("addIssueRelation rejects confirm without a token", async () => {
    const addIssueRelation = vi.fn();
    await expect(
      handleAddIssueRelation({ addIssueRelation } as never, {
        issueId: 100,
        issueToId: 200,
        relationType: "relates",
        confirm: true,
      })
    ).rejects.toThrow(/previewToken/);
    expect(addIssueRelation).not.toHaveBeenCalled();
  });

  it("updateIssueRelation dry-run shows before→after", async () => {
    const getIssueRelation = vi.fn().mockResolvedValue(relation);
    const replaceIssueRelation = vi.fn();
    const result = await handleUpdateIssueRelation(
      { getIssueRelation, replaceIssueRelation } as never,
      { relationId: 7, relationType: "blocks" }
    );
    expect(replaceIssueRelation).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      dryRun: true,
      relationId: 7,
      issueId: 100,
      changes: [{ field: "relationType", from: "relates", to: "blocks" }],
    });
  });

  it("updateIssueRelation applies via replace after confirm", async () => {
    const getIssueRelation = vi.fn().mockResolvedValue(relation);
    const replaceIssueRelation = vi.fn().mockResolvedValue({
      removedRelationId: 7,
      relation: { ...relation, id: 9, relationType: "blocks" },
    });
    const client = { getIssueRelation, replaceIssueRelation } as never;
    const args = { relationId: 7, relationType: "blocks" as const };
    const dry = await handleUpdateIssueRelation(client, { ...args });
    const applied = await handleUpdateIssueRelation(client, {
      ...args,
      confirm: true,
      previewToken: dry.previewToken,
    });
    expect(replaceIssueRelation).toHaveBeenCalledWith({
      relationId: 7,
      relationType: "blocks",
    });
    expect(applied).toMatchObject({ dryRun: false });
  });

  it("removeIssueRelation dry-run shows what would be unlinked", async () => {
    const getIssueRelation = vi.fn().mockResolvedValue(relation);
    const removeIssueRelation = vi.fn();
    const result = await handleRemoveIssueRelation(
      { getIssueRelation, removeIssueRelation } as never,
      { relationId: 7 }
    );
    expect(removeIssueRelation).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      dryRun: true,
      wouldRemove: {
        relationId: 7,
        issueId: 100,
        issueToId: 200,
        relationType: "relates",
      },
    });
  });

  it("removeIssueRelation deletes only after confirm with token", async () => {
    const getIssueRelation = vi.fn().mockResolvedValue(relation);
    const removeIssueRelation = vi
      .fn()
      .mockResolvedValue({ relationId: 7, removed: true });
    const client = { getIssueRelation, removeIssueRelation } as never;
    const dry = await handleRemoveIssueRelation(client, { relationId: 7 });
    const applied = await handleRemoveIssueRelation(client, {
      relationId: 7,
      confirm: true,
      previewToken: dry.previewToken,
    });
    expect(removeIssueRelation).toHaveBeenCalledWith(7);
    expect(applied).toMatchObject({
      dryRun: false,
      result: { relationId: 7, removed: true, issueToId: 200 },
    });
  });

  it("a token from one relation tool is rejected by another", async () => {
    const getIssueRelation = vi.fn().mockResolvedValue(relation);
    const removeIssueRelation = vi.fn();
    const dry = await handleAddIssueRelation({ addIssueRelation: vi.fn() } as never, {
      issueId: 100,
      issueToId: 200,
      relationType: "relates",
    });
    await expect(
      handleRemoveIssueRelation(
        { getIssueRelation, removeIssueRelation } as never,
        { relationId: 7, confirm: true, previewToken: dry.previewToken }
      )
    ).rejects.toThrow(/tool mismatch|does not match/);
    expect(removeIssueRelation).not.toHaveBeenCalled();
  });
});
