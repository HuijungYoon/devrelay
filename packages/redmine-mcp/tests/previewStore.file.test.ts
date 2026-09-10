import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  clearPreviewStore,
  configurePreviewStore,
  consumePreviewToken,
  issuePreviewToken,
} from "../src/tools/previewStore.js";

describe("file-backed preview store", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rd-preview-"));
    configurePreviewStore({ dir });
  });
  afterEach(() => {
    configurePreviewStore();
    clearPreviewStore();
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes one file per token and removes it on consume", () => {
    const input = { issueId: 1, notes: "hello" };
    const token = issuePreviewToken("redmine_add_comment", input);
    expect(readdirSync(dir)).toEqual([`${token}.json`]);
    consumePreviewToken("redmine_add_comment", token, {
      ...input,
      confirm: true,
      previewToken: token,
    });
    expect(readdirSync(dir)).toEqual([]);
    expect(() =>
      consumePreviewToken("redmine_add_comment", token, {
        ...input,
        confirm: true,
        previewToken: token,
      })
    ).toThrow(/unknown or already used/);
  });

  it("lets a second process (fresh store on the same dir) consume a token", () => {
    const input = { issueId: 2, notes: "x" };
    const token = issuePreviewToken("redmine_add_comment", input);
    // simulate another server process pointing at the same directory
    configurePreviewStore({ dir });
    expect(() =>
      consumePreviewToken("redmine_add_comment", token, {
        ...input,
        confirm: true,
        previewToken: token,
      })
    ).not.toThrow();
  });

  it("still checks tool and payload before deleting the file", () => {
    const input = { issueId: 3, notes: "x" };
    const token = issuePreviewToken("redmine_add_comment", input);
    expect(() =>
      consumePreviewToken("redmine_update_status", token, {
        ...input,
        confirm: true,
        previewToken: token,
      })
    ).toThrow(/tool mismatch/);
    expect(() =>
      consumePreviewToken("redmine_add_comment", token, {
        issueId: 3,
        notes: "changed",
        confirm: true,
        previewToken: token,
      })
    ).toThrow(/does not match/);
    expect(readdirSync(dir)).toEqual([`${token}.json`]);
  });

  it("sweeps expired files and ignores tokens that are not uuids", () => {
    writeFileSync(
      join(dir, "11111111-1111-1111-1111-111111111111.json"),
      JSON.stringify({
        tool: "redmine_add_comment",
        payloadHash: "x",
        expiresAt: Date.now() - 1000,
      })
    );
    issuePreviewToken("redmine_add_comment", { issueId: 4 });
    expect(readdirSync(dir)).toHaveLength(1);
    expect(readdirSync(dir)[0]).not.toBe("11111111-1111-1111-1111-111111111111.json");
    expect(() =>
      consumePreviewToken("redmine_add_comment", "../../etc/passwd", {
        issueId: 4,
        confirm: true,
        previewToken: "../../etc/passwd",
      })
    ).toThrow(/unknown or already used/);
  });
});
