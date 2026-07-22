import { describe, it, expect, beforeEach } from "vitest";
import { RedmineError } from "redmine-devrelay-client";
import {
  clearPreviewStore,
  consumePreviewToken,
  issuePreviewToken,
} from "../src/tools/previewStore.js";

describe("previewStore", () => {
  beforeEach(() => {
    clearPreviewStore();
  });

  it("issues token and consumes matching confirm payload", () => {
    const input = { issueId: 1, notes: "hello" };
    const token = issuePreviewToken("redmine_add_comment", input);
    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(() =>
      consumePreviewToken("redmine_add_comment", token, {
        ...input,
        confirm: true,
        previewToken: token,
      })
    ).not.toThrow();
  });

  it("rejects confirm without token", () => {
    expect(() =>
      consumePreviewToken("redmine_add_comment", undefined, {
        issueId: 1,
        notes: "x",
        confirm: true,
      })
    ).toThrow(RedmineError);
  });

  it("rejects payload change after dry-run", () => {
    const token = issuePreviewToken("redmine_add_comment", {
      issueId: 1,
      notes: "a",
    });
    expect(() =>
      consumePreviewToken("redmine_add_comment", token, {
        issueId: 1,
        notes: "b",
        confirm: true,
        previewToken: token,
      })
    ).toThrow(/payload/i);
  });

  it("rejects reuse of consumed token", () => {
    const input = { issueId: 1, notes: "once" };
    const token = issuePreviewToken("redmine_add_comment", input);
    consumePreviewToken("redmine_add_comment", token, {
      ...input,
      confirm: true,
      previewToken: token,
    });
    expect(() =>
      consumePreviewToken("redmine_add_comment", token, {
        ...input,
        confirm: true,
        previewToken: token,
      })
    ).toThrow(RedmineError);
  });

  it("rejects wrong tool name", () => {
    const input = { issueId: 1, notes: "n" };
    const token = issuePreviewToken("redmine_add_comment", input);
    expect(() =>
      consumePreviewToken("redmine_update_status", token, {
        ...input,
        confirm: true,
        previewToken: token,
      })
    ).toThrow(/tool/i);
  });
});
